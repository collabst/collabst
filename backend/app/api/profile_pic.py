from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.user import AuthUser
from app.services.storage import storage_service


router = APIRouter()


@router.get("/profile-pic/{user_ref}")
async def get_profile_picture(
    user_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    filters = [AuthUser.hash_id == user_ref]
    if user_ref.isdigit():
        filters.append(AuthUser.id == int(user_ref))

    result = await db.execute(select(AuthUser).where(or_(*filters)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.profile_picture_path:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    try:
        url = storage_service.get_presigned_url(user.profile_picture_path, expires=3600)
    except Exception:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return RedirectResponse(url=url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
