from pathlib import Path
from uuid import uuid4
from typing import Annotated
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.security import get_password_hash, verify_password
from app.db.base import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChange,
    User as UserSchema,
    UserPublicProfile,
    UserSettingsUpdate,
)
from app.services.storage import storage_service
from app.services.user_profile import serialize_user


router = APIRouter()

MAX_PROFILE_PICTURE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def _build_public_profile(user: User, is_self: bool) -> UserPublicProfile:
    return UserPublicProfile(
        id=user.hash_id,
        display_name=user.display_name,
        created_at=user.created_at,
        updated_at=user.updated_at,
        is_self=is_self,
        email=user.email if is_self else None,
        is_active=user.is_active if is_self else None,
        is_superuser=user.is_superuser if is_self else None,
    )


@router.get("/me", response_model=UserSchema)
async def get_me(current_user: CurrentUser):
    return serialize_user(current_user)


@router.get("/{user_id}", response_model=UserPublicProfile)
async def get_user_profile(
    user_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.hash_id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _build_public_profile(user, is_self=user.id == current_user.id)


@router.patch("/me", response_model=UserSchema)
async def update_me(
    user_in: UserSettingsUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_in.display_name is not None:
        trimmed_display_name = user_in.display_name.strip()
        if not trimmed_display_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Display name cannot be empty",
            )
        current_user.display_name = trimmed_display_name

    await db.commit()
    await db.refresh(current_user)
    return serialize_user(current_user)


@router.patch("/me/password")
async def change_password(
    password_in: PasswordChange,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not verify_password(password_in.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if password_in.current_password == password_in.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = get_password_hash(password_in.new_password)
    await db.commit()

    return {"message": "Password updated successfully"}


@router.post("/me/profile-picture", response_model=UserSchema)
async def upload_profile_picture(
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Allowed: PNG, JPEG, WEBP, GIF",
        )

    file_content = await file.read()
    file_size = len(file_content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if file_size > MAX_PROFILE_PICTURE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile picture must be smaller than 5MB",
        )

    extension = Path(file.filename or "avatar").suffix or ".png"
    object_name = f"users/{current_user.id}/profile/{uuid4().hex}{extension}"

    storage_service.upload_file(
        object_name,
        file_data=io.BytesIO(file_content),
        length=file_size,
        content_type=file.content_type,
    )

    old_path = current_user.profile_picture_path
    current_user.profile_picture_path = object_name
    await db.commit()
    await db.refresh(current_user)

    if old_path and old_path != object_name:
        try:
            storage_service.delete_file(old_path)
        except Exception:
            pass

    return serialize_user(current_user)


@router.delete("/me/profile-picture", response_model=UserSchema)
async def delete_profile_picture(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    old_path = current_user.profile_picture_path
    current_user.profile_picture_path = None
    await db.commit()
    await db.refresh(current_user)

    if old_path:
        try:
            storage_service.delete_file(old_path)
        except Exception:
            pass

    return serialize_user(current_user)
