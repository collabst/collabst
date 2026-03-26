from typing import Annotated, List
import io

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.file import File
from app.models.asset import Asset
from app.models.project_collaborator import CollaboratorRole
from app.schemas.file import FileCreate, FileUpdate, File as FileSchema
from app.schemas.asset import Asset as AssetSchema, AssetUpdate
from app.services.storage import storage_service
from app.services.hash_lookup import get_project_by_ref
from app.services.permissions import check_project_access
from app.websocket.project_ws import project_manager

router = APIRouter()


def _serialize_file(file: File, project_hash_id: str, file_id_to_hash: dict[int, str]) -> FileSchema:
    return FileSchema(
        id=file.hash_id,
        project_id=project_hash_id,
        name=file.name,
        path=file.path,
        content=file.content,
        parent_id=file_id_to_hash.get(file.parent_id) if file.parent_id else None,
        is_folder=file.is_folder,
        created_at=file.created_at,
        updated_at=file.updated_at,
    )


def _serialize_asset(asset: Asset, project_hash_id: str, file_id_to_hash: dict[int, str]) -> AssetSchema:
    return AssetSchema(
        id=asset.hash_id,
        project_id=project_hash_id,
        filename=asset.filename,
        path=asset.path,
        storage_path=asset.storage_path,
        mime_type=asset.mime_type,
        size=asset.size,
        parent_id=file_id_to_hash.get(asset.parent_id) if asset.parent_id else None,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


async def _get_project_file_hash_map(db: AsyncSession, project_id: int) -> dict[int, str]:
    result = await db.execute(select(File.id, File.hash_id).where(File.project_id == project_id))
    return {row[0]: row[1] for row in result.all()}


# Helper functions for folder support
async def validate_parent_folder(db: AsyncSession, parent_ref: str, project_id: int) -> File:
    """Ensure parent exists, is a folder, and in same project"""
    result = await db.execute(select(File).where(File.hash_id == parent_ref))
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


def _name_with_suffix(name: str, suffix_number: int) -> str:
    """Insert _N before extension, preserving original extension if present."""
    base, dot, ext = name.rpartition(".")
    if dot and base:
        return f"{base}_{suffix_number}.{ext}"
    return f"{name}_{suffix_number}"


async def _get_taken_names(
    db: AsyncSession,
    project_id: int,
    parent_id: int | None,
    exclude_file_id: int | None = None,
    exclude_asset_id: int | None = None,
) -> set[str]:
    file_query = select(File.name).where(
        File.project_id == project_id,
        File.parent_id == parent_id,
    )
    if exclude_file_id is not None:
        file_query = file_query.where(File.id != exclude_file_id)

    asset_query = select(Asset.filename).where(
        Asset.project_id == project_id,
        Asset.parent_id == parent_id,
    )
    if exclude_asset_id is not None:
        asset_query = asset_query.where(Asset.id != exclude_asset_id)

    file_result = await db.execute(file_query)
    asset_result = await db.execute(asset_query)
    return set(file_result.scalars().all()) | set(asset_result.scalars().all())


async def resolve_available_name(
    db: AsyncSession,
    project_id: int,
    parent_id: int | None,
    proposed_name: str,
    exclude_file_id: int | None = None,
    exclude_asset_id: int | None = None,
) -> str:
    taken_names = await _get_taken_names(
        db,
        project_id,
        parent_id,
        exclude_file_id=exclude_file_id,
        exclude_asset_id=exclude_asset_id,
    )

    if proposed_name not in taken_names:
        return proposed_name

    suffix = 1
    while True:
        candidate = _name_with_suffix(proposed_name, suffix)
        if candidate not in taken_names:
            return candidate
        suffix += 1


async def ensure_name_available_or_raise(
    db: AsyncSession,
    project_id: int,
    parent_id: int | None,
    name: str,
    exclude_file_id: int | None = None,
    exclude_asset_id: int | None = None,
) -> None:
    resolved_name = await resolve_available_name(
        db,
        project_id,
        parent_id,
        name,
        exclude_file_id=exclude_file_id,
        exclude_asset_id=exclude_asset_id,
    )
    if resolved_name != name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An item named '{name}' already exists in this location",
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


@router.post("/{project_ref}/files", response_model=FileSchema)
async def create_file(
    project_ref: str,
    file_in: FileCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    parent: File | None = None
    if file_in.parent_id:
        parent = await validate_parent_folder(db, file_in.parent_id, project.id)

    resolved_name = await resolve_available_name(
        db,
        project.id,
        parent.id if parent else None,
        file_in.name,
    )

    file = File(
        project_id=project.id,
        name=resolved_name,
        path="/",
        content=file_in.content,
        parent_id=parent.id if parent else None,
        is_folder=file_in.is_folder,
    )

    db.add(file)
    await db.flush()

    file.path = await file.compute_path(db)

    await db.commit()
    await db.refresh(file)

    id_to_hash = await _get_project_file_hash_map(db, project.id)
    serialized_file = _serialize_file(file, project.hash_id, id_to_hash)

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "file_created",
            "file": serialized_file.model_dump(mode="json"),
        }
    )

    return serialized_file


@router.get("/{project_ref}/files", response_model=List[FileSchema])
async def list_files(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    result = await db.execute(select(File).where(File.project_id == project.id))
    files = result.scalars().all()
    id_to_hash = {file.id: file.hash_id for file in files}
    return [_serialize_file(file, project.hash_id, id_to_hash) for file in files]


@router.put("/{project_ref}/files/{file_ref}", response_model=FileSchema)
async def update_file(
    project_ref: str,
    file_ref: str,
    file_in: FileUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    result = await db.execute(
        select(File).where(File.hash_id == file_ref, File.project_id == project.id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    updated_files = []
    parent_changed = False
    name_changed = False

    update_dict = file_in.model_dump(exclude_unset=True)
    new_parent_id = file.parent_id

    if "parent_id" in update_dict:
        if file_in.parent_id is not None:
            new_parent = await validate_parent_folder(db, file_in.parent_id, project.id)
            new_parent_id = new_parent.id
        else:
            new_parent_id = None

        if new_parent_id != file.parent_id:
            if file.is_folder and new_parent_id is not None:
                await check_circular_reference(db, file.id, new_parent_id)
            parent_changed = True

    new_name = file_in.name if file_in.name is not None else file.name

    if file_in.name and file_in.name != file.name:
        name_changed = True

    if parent_changed or name_changed:
        await ensure_name_available_or_raise(
            db,
            project.id,
            new_parent_id,
            new_name,
            exclude_file_id=file.id,
        )

    update_data = file_in.model_dump(exclude_unset=True, exclude={"parent_id"})
    for field, value in update_data.items():
        setattr(file, field, value)

    if "parent_id" in update_dict:
        file.parent_id = new_parent_id

    if parent_changed or name_changed:
        file.path = await file.compute_path(db)
        updated_files.append(file)

        if file.is_folder:
            descendants = await update_descendant_paths(db, file)
            updated_files.extend(descendants)

    await db.commit()
    await db.refresh(file)

    id_to_hash = await _get_project_file_hash_map(db, project.id)
    serialized_file = _serialize_file(file, project.hash_id, id_to_hash)

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "file_updated",
            "file": serialized_file.model_dump(mode="json"),
        }
    )

    for updated in updated_files[1:]:
        await project_manager.broadcast_to_project(
            project_ref,
            {
                "type": "file_updated",
                "file": _serialize_file(updated, project.hash_id, id_to_hash).model_dump(mode="json"),
            }
        )

    return serialized_file


@router.delete("/{project_ref}/files/{file_ref}")
async def delete_file(
    project_ref: str,
    file_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a file or folder (cascade deletes all contents)"""
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    result = await db.execute(
        select(File).where(File.hash_id == file_ref, File.project_id == project.id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    descendants_to_delete = []
    if file.is_folder:
        descendants_to_delete = await get_all_descendants(db, file.id)

    file_hash_id = file.hash_id
    descendant_hash_ids = [desc.hash_id for desc in descendants_to_delete]

    await db.delete(file)
    await db.commit()

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "file_deleted",
            "file_id": file_hash_id,
        }
    )

    for descendant_hash_id in descendant_hash_ids:
        await project_manager.broadcast_to_project(
            project_ref,
            {
                "type": "file_deleted",
                "file_id": descendant_hash_id,
            }
        )

    return {"message": "File deleted successfully"}


@router.post("/{project_ref}/assets/upload", response_model=FileSchema | AssetSchema)
async def upload_asset(
    project_ref: str,
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent_id: str | None = Form(None),
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    parent: File | None = None
    if parent_id is not None:
        parent = await validate_parent_folder(db, parent_id, project.id)

    original_name = file.filename or "uploaded_file"
    resolved_name = await resolve_available_name(
        db,
        project.id,
        parent.id if parent else None,
        original_name,
    )

    file_content = await file.read()
    file_size = len(file_content)

    try:
        decoded_content = file_content.decode("utf-8")
    except UnicodeDecodeError:
        decoded_content = None

    if decoded_content is not None:
        created_file = File(
            project_id=project.id,
            name=resolved_name,
            path="/",
            content=decoded_content,
            parent_id=parent.id if parent else None,
            is_folder=False,
        )
        db.add(created_file)
        await db.flush()

        created_file.path = await created_file.compute_path(db)

        await db.commit()
        await db.refresh(created_file)

        id_to_hash = await _get_project_file_hash_map(db, project.id)
        serialized_file = _serialize_file(created_file, project.hash_id, id_to_hash)

        await project_manager.broadcast_to_project(
            project_ref,
            {
                "type": "file_created",
                "file": serialized_file.model_dump(mode="json"),
            }
        )

        return serialized_file

    storage_path = f"projects/{project.hash_id}/assets/{resolved_name}"

    storage_service.upload_file(
        storage_path,
        io.BytesIO(file_content),
        file_size,
        file.content_type or "application/octet-stream",
    )

    asset = Asset(
        project_id=project.id,
        filename=resolved_name,
        path="/",
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size=file_size,
        parent_id=parent.id if parent else None,
    )
    db.add(asset)
    await db.flush()

    asset.path = await asset.compute_path(db)

    await db.commit()
    await db.refresh(asset)

    id_to_hash = await _get_project_file_hash_map(db, project.id)
    serialized_asset = _serialize_asset(asset, project.hash_id, id_to_hash)

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "asset_created",
            "asset": serialized_asset.model_dump(mode="json"),
        }
    )

    return serialized_asset


@router.get("/{project_ref}/assets", response_model=List[AssetSchema])
async def list_assets(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    result = await db.execute(select(Asset).where(Asset.project_id == project.id))
    assets = result.scalars().all()
    id_to_hash = await _get_project_file_hash_map(db, project.id)
    return [_serialize_asset(asset, project.hash_id, id_to_hash) for asset in assets]


@router.get("/{project_ref}/assets/{asset_ref}/url")
async def get_asset_url(
    project_ref: str,
    asset_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a presigned URL for accessing an asset from MinIO"""
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    result = await db.execute(
        select(Asset).where(Asset.hash_id == asset_ref, Asset.project_id == project.id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    url = storage_service.get_presigned_url(asset.storage_path, expires=3600)

    return {
        "url": url,
        "filename": asset.filename,
        "mime_type": asset.mime_type,
    }


@router.put("/{project_ref}/assets/{asset_ref}", response_model=AssetSchema)
async def update_asset(
    project_ref: str,
    asset_ref: str,
    asset_in: AssetUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an asset (e.g., rename or move to a folder)"""
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    result = await db.execute(
        select(Asset).where(Asset.hash_id == asset_ref, Asset.project_id == project.id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    update_dict = asset_in.model_dump(exclude_unset=True)
    parent_changed = False
    filename_changed = False
    new_parent_id = asset.parent_id

    if "parent_id" in update_dict:
        if asset_in.parent_id is not None:
            new_parent = await validate_parent_folder(db, asset_in.parent_id, project.id)
            new_parent_id = new_parent.id
        else:
            new_parent_id = None

        if new_parent_id != asset.parent_id:
            parent_changed = True

    if asset_in.filename and asset_in.filename != asset.filename:
        filename_changed = True

    new_filename = asset_in.filename if asset_in.filename is not None else asset.filename

    if parent_changed or filename_changed:
        await ensure_name_available_or_raise(
            db,
            project.id,
            new_parent_id,
            new_filename,
            exclude_asset_id=asset.id,
        )

    update_data = asset_in.model_dump(exclude_unset=True, exclude={"parent_id"})
    for field, value in update_data.items():
        setattr(asset, field, value)

    if "parent_id" in update_dict:
        asset.parent_id = new_parent_id

    if parent_changed or filename_changed:
        asset.path = await asset.compute_path(db)

    await db.commit()
    await db.refresh(asset)

    id_to_hash = await _get_project_file_hash_map(db, project.id)
    serialized_asset = _serialize_asset(asset, project.hash_id, id_to_hash)

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "asset_updated",
            "asset": serialized_asset.model_dump(mode="json"),
        }
    )

    return serialized_asset


@router.delete("/{project_ref}/assets/{asset_ref}")
async def delete_asset(
    project_ref: str,
    asset_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete an asset"""
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user, CollaboratorRole.WRITER)

    result = await db.execute(
        select(Asset).where(Asset.hash_id == asset_ref, Asset.project_id == project.id)
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    storage_service.delete_file(asset.storage_path)

    asset_hash_id = asset.hash_id
    await db.delete(asset)
    await db.commit()

    await project_manager.broadcast_to_project(
        project_ref,
        {
            "type": "asset_deleted",
            "asset_id": asset_hash_id,
        }
    )

    return {"message": "Asset deleted successfully"}
