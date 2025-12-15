from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
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


@router.post("/{project_id}/files", response_model=FileSchema)
async def create_file(
    project_id: int,
    file_in: FileCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    file = File(**file_in.model_dump())
    db.add(file)
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

    # If renaming, check for duplicate names and update path
    if file_in.name and file_in.name != file.name:
        # Check if another file with this name exists in the project
        duplicate_check = await db.execute(
            select(File).where(
                File.project_id == project_id,
                File.name == file_in.name,
                File.id != file_id
            )
        )
        if duplicate_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A file named '{file_in.name}' already exists in this project"
            )
        
        # Update path to match new name
        file_in.path = f"/{file_in.name}"

    for field, value in file_in.model_dump(exclude_unset=True).items():
        setattr(file, field, value)

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
                "created_at": file.created_at.isoformat(),
                "updated_at": file.updated_at.isoformat(),
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
    """Delete a file"""
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

    # Delete from database
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

    return {"message": "File deleted successfully"}


@router.post("/{project_id}/assets/upload", response_model=AssetSchema)
async def upload_asset(
    project_id: int,
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user has access (owner or collaborator)
    await check_project_access(db, project_id, current_user.id)

    file_content = await file.read()
    file_size = len(file_content)

    storage_path = f"projects/{project_id}/assets/{file.filename}"

    storage_service.upload_file(
        storage_path,
        io.BytesIO(file_content),
        file_size,
        file.content_type or "application/octet-stream",
    )

    asset = Asset(
        project_id=project_id,
        filename=file.filename,
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size=file_size,
    )
    db.add(asset)
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
                "storage_path": asset.storage_path,
                "mime_type": asset.mime_type,
                "size": asset.size,
                "created_at": asset.created_at.isoformat(),
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
    """Update an asset (e.g., rename)"""
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

    # If renaming, check for duplicate filenames
    if asset_in.filename and asset_in.filename != asset.filename:
        duplicate_check = await db.execute(
            select(Asset).where(
                Asset.project_id == project_id,
                Asset.filename == asset_in.filename,
                Asset.id != asset_id
            )
        )
        if duplicate_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An asset named '{asset_in.filename}' already exists in this project"
            )

    for field, value in asset_in.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

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
                "storage_path": asset.storage_path,
                "mime_type": asset.mime_type,
                "size": asset.size,
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
