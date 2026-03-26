from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select

from app.core.security import decode_access_token
from app.db.base import AsyncSessionLocal
from app.models.project import Project
from app.models.project_collaborator import CollaboratorRole
from app.models.user import User
from app.services.hash_lookup import get_project_by_ref
from app.services.permissions import get_user_project_role


class WebSocketAuthError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class WebSocketProjectContext:
    user_id: int
    project_id: int
    project_ref: str
    role: CollaboratorRole


def _is_role_at_least(role: CollaboratorRole, minimum: CollaboratorRole) -> bool:
    order = {
        CollaboratorRole.READER: 1,
        CollaboratorRole.COMMENTOR: 2,
        CollaboratorRole.WRITER: 3,
        CollaboratorRole.ADMIN: 4,
        CollaboratorRole.OWNER: 5,
    }
    return order.get(role, 0) >= order.get(minimum, 0)


async def _get_user_from_token(db, token: Optional[str]) -> User:
    if not token:
        raise WebSocketAuthError("missing_token")

    payload = decode_access_token(token)
    if not payload:
        raise WebSocketAuthError("invalid_token")

    user_id = payload.get("sub")
    if user_id is None:
        raise WebSocketAuthError("invalid_token")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise WebSocketAuthError("invalid_token")

    return user


async def _resolve_effective_role(
    db,
    *,
    project: Project,
    user: User,
) -> Optional[CollaboratorRole]:
    if project.owner_id == user.id:
        return CollaboratorRole.OWNER
    return await get_user_project_role(db, project, user)


async def authenticate_websocket_project(
    *,
    token: Optional[str],
    project_ref: str,
    minimum_role: CollaboratorRole = CollaboratorRole.READER,
) -> WebSocketProjectContext:
    async with AsyncSessionLocal() as db:
        user = await _get_user_from_token(db, token)
        project = await get_project_by_ref(db, project_ref)
        role = await _resolve_effective_role(db, project=project, user=user)

        if role is None or not _is_role_at_least(role, minimum_role):
            raise WebSocketAuthError("forbidden")

        return WebSocketProjectContext(
            user_id=user.id,
            project_id=project.id,
            project_ref=project_ref,
            role=role,
        )


async def get_current_project_role(
    *,
    project_id: int,
    user_id: int,
) -> Optional[CollaboratorRole]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if not project:
            return None

        user = await db.get(User, user_id)
        if not user:
            return None
        return await _resolve_effective_role(db, project=project, user=user)
