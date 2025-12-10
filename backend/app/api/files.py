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
from app.schemas.asset import Asset as AssetSchema
from app.services.storage import storage_service

router = APIRouter()


@router.post("/{project_id}/files", response_model=FileSchema)
async def create_file(
    project_id: int,
    file_in: FileCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    file = File(**file_in.model_dump())
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return file


@router.get("/{project_id}/files", response_model=List[FileSchema])
async def list_files(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

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
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    result = await db.execute(
        select(File).where(File.id == file_id, File.project_id == project_id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    for field, value in file_in.model_dump(exclude_unset=True).items():
        setattr(file, field, value)

    await db.commit()
    await db.refresh(file)
    return file


@router.post("/{project_id}/assets/upload", response_model=AssetSchema)
async def upload_asset(
    project_id: int,
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

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
    return asset


@router.get("/{project_id}/assets", response_model=List[AssetSchema])
async def list_assets(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    result = await db.execute(select(Asset).where(Asset.project_id == project_id))
    assets = result.scalars().all()
    return assets
