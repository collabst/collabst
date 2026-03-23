from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.file import File
from app.models.invitation import Invitation
from app.models.project import Project
from app.models.user import User


async def get_project_by_ref(db: AsyncSession, project_ref: str) -> Project:
    result = await db.execute(select(Project).where(Project.hash_id == project_ref))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def get_user_by_hash(db: AsyncSession, user_hash_id: str) -> User:
    result = await db.execute(select(User).where(User.hash_id == user_hash_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def get_invitation_by_ref(db: AsyncSession, invitation_ref: str) -> Invitation:
    result = await db.execute(select(Invitation).where(Invitation.hash_id == invitation_ref))
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    return invitation


async def get_file_by_ref(db: AsyncSession, file_ref: str) -> File:
    result = await db.execute(select(File).where(File.hash_id == file_ref))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file


async def get_asset_by_ref(db: AsyncSession, asset_ref: str) -> Asset:
    result = await db.execute(select(Asset).where(Asset.hash_id == asset_ref))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset
