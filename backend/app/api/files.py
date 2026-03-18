from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.project import Project
from app.models.file import File
from app.models.asset import Asset
from app.schemas.file import FileCreate, FileUpdate, File as FileSchema
from app.schemas.asset import Asset as AssetSchema, AssetUpdate
from app.services.storage import storage_service
from app.services.permissions import check_project_access
from app.websocket.project_ws import project_manager

router = APIRouter()


# Helper functions for folder support
async def validate_parent_folder(db: AsyncSession, parent_id: int, project_id: int) -> File:
    """Ensure parent exists, is a folder, and in same project"""
    result = await db.execute(select(File).where(File.id == parent_id))
    parent = result.scalar_one_or_none()

    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent folder not found"
        )

    if not parent.is_folder:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent must be a folder"
        )

    if parent.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent must be in same project"
        )

    return parent


async def check_duplicate_name(
    db: AsyncSession,
    project_id: int,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None
) -> None:
    """Check for duplicate name in same directory"""
    query = select(File).where(
        File.project_id == project_id,
        File.parent_id == parent_id,
        File.name == name
    )

    if exclude_id is not None:
        query = query.where(File.id != exclude_id)

    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A file or folder named '{name}' already exists in this location"
        )


async def check_duplicate_asset(
    db: AsyncSession,
    project_id: int,
    parent_id: int | None,
    filename: str,
    exclude_id: int | None = None
) -> None:
    """Check for duplicate asset filename in same directory"""
    query = select(Asset).where(
        Asset.project_id == project_id,
        Asset.parent_id == parent_id,
        Asset.filename == filename
    )

    if exclude_id is not None:
        query = query.where(Asset.id != exclude_id)

    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An asset named '{filename}' already exists in this location"
        )


async def check_circular_reference(db: AsyncSession, folder_id: int, new_parent_id: int) -> None:
    """Prevent moving folder into itself or descendant"""
    current_id = new_parent_id
    visited = set()

    while current_id:
        if current_id in visited:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular reference detected"
            )

        if current_id == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move folder into itself or its descendants"
            )

        visited.add(current_id)
        result = await db.execute(select(File).where(File.id == current_id))
        file = result.scalar_one_or_none()
        current_id = file.parent_id if file else None


async def get_all_descendants(db: AsyncSession, folder_id: int) -> List[File]:
    """Recursively get all files/folders under a folder"""
    descendants = []
    to_process = [folder_id]

    while to_process:
        current_id = to_process.pop(0)
        result = await db.execute(
            select(File).where(File.parent_id == current_id)
        )
        children = result.scalars().all()

        for child in children:
            descendants.append(child)
            if child.is_folder:
                to_process.append(child.id)

    return descendants


async def update_descendant_paths(db: AsyncSession, folder: File) -> List[File]:
    """Recursively update paths for all descendants and return updated files"""
    descendants = await get_all_descendants(db, folder.id)
    updated_files = []

    for descendant in descendants:
        new_path = await descendant.compute_path(db)
        descendant.path = new_path
        updated_files.append(descendant)

    return updated_files


@router.post("/{project_id}/files", response_model=FileSchema)
async def create_file(
    project_id: int,
    file_in: FileCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    # Validate parent folder if provided
    if file_in.parent_id:
        await validate_parent_folder(db, file_in.parent_id, project_id)

    # Check for duplicate name in same directory
    await check_duplicate_name(db, project_id, file_in.parent_id, file_in.name)

    # Create file with initial path
    file = File(**file_in.model_dump())

    # Compute correct path from parent hierarchy
    db.add(file)
    await db.flush()  # Flush to get the ID before computing path

    file.path = await file.compute_path(db)

    await db.commit()
    await db.refresh(file)

    # Broadcast file creation to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "file_created",
            "file": {
                "id": file.id,
                "project_id": file.project_id,
                "name": file.name,
                "path": file.path,
                "type": file.type,
                "content": file.content,
                "parent_id": file.parent_id,
                "is_folder": file.is_folder,
                "created_at": file.created_at.isoformat(),
                "updated_at": file.updated_at.isoformat(),
            }
        }
    )

    return file


@router.get("/{project_id}/files", response_model=List[FileSchema])
async def list_files(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(select(File).where(File.project_id == project_id))
    files = result.scalars().all()
    return files


@router.put("/{project_id}/files/{file_id}", response_model=FileSchema)
async def update_file(
    project_id: int,
    file_id: int,
    file_in: FileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(File).where(File.id == file_id, File.project_id == project_id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    updated_files = []  # Track all files that need broadcast updates
    parent_changed = False
    name_changed = False

    # Check if moving file (parent_id changed) - check if parent_id was provided in the update
    update_dict = file_in.model_dump(exclude_unset=True)
    if 'parent_id' in update_dict and file_in.parent_id != file.parent_id:
        # Validate new parent (if not moving to root)
        if file_in.parent_id is not None:
            await validate_parent_folder(db, file_in.parent_id, project_id)

        # Check for circular reference if moving a folder
        if file.is_folder and file_in.parent_id is not None:
            await check_circular_reference(db, file_id, file_in.parent_id)

        parent_changed = True

    # Determine the new name and parent for duplicate checking
    new_name = file_in.name if file_in.name is not None else file.name
    new_parent_id = file_in.parent_id if parent_changed else file.parent_id

    # If renaming or moving, check for duplicate in target directory
    if file_in.name and file_in.name != file.name:
        name_changed = True

    if parent_changed or name_changed:
        await check_duplicate_name(db, project_id, new_parent_id, new_name, exclude_id=file_id)

    # Update file fields (except path, which we'll recompute)
    update_data = file_in.model_dump(exclude_unset=True, exclude={'path'})
    for field, value in update_data.items():
        setattr(file, field, value)

    # Recompute path if name or parent changed
    if parent_changed or name_changed:
        file.path = await file.compute_path(db)
        updated_files.append(file)

        # If this is a folder, update all descendant paths
        if file.is_folder:
            descendants = await update_descendant_paths(db, file)
            updated_files.extend(descendants)

    await db.commit()
    await db.refresh(file)

    # Broadcast file update to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "file_updated",
            "file": {
                "id": file.id,
                "project_id": file.project_id,
                "name": file.name,
                "path": file.path,
                "type": file.type,
                "content": file.content,
                "parent_id": file.parent_id,
                "is_folder": file.is_folder,
                "created_at": file.created_at.isoformat(),
                "updated_at": file.updated_at.isoformat(),
            }
        }
    )

    # Broadcast updates for all descendants if any
    for updated in updated_files[1:]:  # Skip the first one (main file) as it's already broadcast
        await project_manager.broadcast_to_project(
            project_id,
            {
                "type": "file_updated",
                "file": {
                    "id": updated.id,
                    "project_id": updated.project_id,
                    "name": updated.name,
                    "path": updated.path,
                    "type": updated.type,
                    "content": updated.content,
                    "parent_id": updated.parent_id,
                    "is_folder": updated.is_folder,
                    "created_at": updated.created_at.isoformat(),
                    "updated_at": updated.updated_at.isoformat(),
                }
            }
        )

    return file


@router.delete("/{project_id}/files/{file_id}")
async def delete_file(
    project_id: int,
    file_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a file or folder (cascade deletes all contents)"""
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(File).where(File.id == file_id, File.project_id == project_id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    # Get all descendants if this is a folder (for broadcasting)
    descendants_to_delete = []
    if file.is_folder:
        descendants_to_delete = await get_all_descendants(db, file_id)

    # Delete from database (CASCADE will handle descendants automatically)
    await db.delete(file)
    await db.commit()

    # Broadcast file deletion to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "file_deleted",
            "file_id": file_id,
        }
    )

    # Broadcast deletion for all descendants
    for descendant in descendants_to_delete:
        await project_manager.broadcast_to_project(
            project_id,
            {
                "type": "file_deleted",
                "file_id": descendant.id,
            }
        )

    return {"message": "File deleted successfully"}


@router.post("/{project_id}/assets/upload", response_model=AssetSchema)
async def upload_asset(
    project_id: int,
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent_id: int | None = Form(None),
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    # Validate parent folder if provided
    if parent_id is not None:
        await validate_parent_folder(db, parent_id, project_id)

    # Check for duplicate filename in same directory
    await check_duplicate_asset(db, project_id, parent_id, file.filename)

    file_content = await file.read()
    file_size = len(file_content)

    storage_path = f"projects/{project_id}/assets/{file.filename}"

    storage_service.upload_file(
        storage_path,
        io.BytesIO(file_content),
        file_size,
        file.content_type or "application/octet-stream",
    )

    # Create asset with temporary path
    asset = Asset(
        project_id=project_id,
        filename=file.filename,
        path="/",  # Will be computed below
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size=file_size,
        parent_id=parent_id,
    )
    db.add(asset)
    await db.flush()  # Flush to get the ID before computing path

    # Compute and set the path based on parent hierarchy
    asset.path = await asset.compute_path(db)

    await db.commit()
    await db.refresh(asset)

    # Broadcast asset creation to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "asset_created",
            "asset": {
                "id": asset.id,
                "project_id": asset.project_id,
                "filename": asset.filename,
                "path": asset.path,
                "storage_path": asset.storage_path,
                "mime_type": asset.mime_type,
                "size": asset.size,
                "parent_id": asset.parent_id,
                "created_at": asset.created_at.isoformat(),
                "updated_at": asset.updated_at.isoformat(),
            }
        }
    )

    return asset


@router.get("/{project_id}/assets", response_model=List[AssetSchema])
async def list_assets(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(select(Asset).where(Asset.project_id == project_id))
    assets = result.scalars().all()
    return assets


@router.get("/{project_id}/assets/{asset_id}/url")
async def get_asset_url(
    project_id: int,
    asset_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a presigned URL for accessing an asset from MinIO"""
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.project_id == project_id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    # Generate presigned URL (valid for 1 hour)
    url = storage_service.get_presigned_url(asset.storage_path, expires=3600)

    return {
        "url": url,
        "filename": asset.filename,
        "mime_type": asset.mime_type,
    }


@router.put("/{project_id}/assets/{asset_id}", response_model=AssetSchema)
async def update_asset(
    project_id: int,
    asset_id: int,
    asset_in: AssetUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an asset (e.g., rename or move to a folder)"""
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.project_id == project_id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    # Check if parent or filename changed (need to recompute path)
    update_dict = asset_in.model_dump(exclude_unset=True)
    parent_changed = False
    filename_changed = False

    # Validate parent folder if being moved - check if parent_id was provided in the update
    if 'parent_id' in update_dict and asset_in.parent_id != asset.parent_id:
        # Validate new parent (if not moving to root)
        if asset_in.parent_id is not None:
            await validate_parent_folder(db, asset_in.parent_id, project_id)
        parent_changed = True

    # If renaming, check for duplicate filenames
    if asset_in.filename and asset_in.filename != asset.filename:
        filename_changed = True

    # Determine the new filename and parent for duplicate checking
    new_filename = asset_in.filename if asset_in.filename is not None else asset.filename
    new_parent_id = asset_in.parent_id if parent_changed else asset.parent_id

    # If renaming or moving, check for duplicate in target directory
    if parent_changed or filename_changed:
        await check_duplicate_asset(db, project_id, new_parent_id, new_filename, exclude_id=asset_id)

    # Update asset fields
    for field, value in asset_in.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

    # Recompute path if parent or filename changed
    if parent_changed or filename_changed:
        asset.path = await asset.compute_path(db)

    await db.commit()
    await db.refresh(asset)

    # Broadcast asset update to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "asset_updated",
            "asset": {
                "id": asset.id,
                "project_id": asset.project_id,
                "filename": asset.filename,
                "path": asset.path,
                "storage_path": asset.storage_path,
                "mime_type": asset.mime_type,
                "size": asset.size,
                "parent_id": asset.parent_id,
                "created_at": asset.created_at.isoformat(),
                "updated_at": asset.updated_at.isoformat(),
            }
        }
    )

    return asset


@router.delete("/{project_id}/assets/{asset_id}")
async def delete_asset(
    project_id: int,
    asset_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete an asset"""
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.project_id == project_id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    # Delete from storage
    storage_service.delete_file(asset.storage_path)

    # Delete from database
    await db.delete(asset)
    await db.commit()

    # Broadcast asset deletion to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "asset_deleted",
            "asset_id": asset_id,
        }
    )

    return {"message": "Asset deleted successfully"}
