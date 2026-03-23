from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project
from app.models.project_collaborator import ProjectCollaborator, CollaboratorRole
from app.models.project_share_link import ProjectShareLink, ShareLinkType
from app.services.hash_lookup import get_project_by_ref


ROLE_HIERARCHY = {
    CollaboratorRole.READER: 1,
    CollaboratorRole.COMMENTOR: 2,
    CollaboratorRole.WRITER: 3,
    CollaboratorRole.ADMIN: 4,
    CollaboratorRole.OWNER: 5,
}


def _role_from_share_type(link_type: ShareLinkType) -> CollaboratorRole:
    if link_type == ShareLinkType.EDIT:
        return CollaboratorRole.WRITER
    if link_type == ShareLinkType.COMMENT:
        return CollaboratorRole.COMMENTOR
    return CollaboratorRole.READER


def _has_required_role(
    role: Optional[CollaboratorRole],
    required_role: Optional[CollaboratorRole],
) -> bool:
    if role is None:
        return False
    if required_role is None:
        return True
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY.get(required_role, 0)


async def get_user_project_role(
    db: AsyncSession, project_id: int, user_id: int
) -> Optional[CollaboratorRole]:
    """Get the user's role in a project. Returns None if user is not a collaborator."""
    result = await db.execute(
        select(ProjectCollaborator.role)
        .where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == user_id,
        )
    )
    role = result.scalar_one_or_none()
    return role


async def check_project_access(
    db: AsyncSession,
    project_ref: str,
    user_id: int,
    required_role: Optional[CollaboratorRole] = None,
) -> Project:
    """
    Check if user has access to a project and optionally if they have a specific role.
    Returns the project if access is granted.
    Raises HTTPException if access is denied.
    """
    project = await get_project_by_ref(db, project_ref)

    # Owner has all permissions
    if project.owner_id == user_id:
        return project

    # Check if user is a collaborator
    user_role = await get_user_project_role(db, project.id, user_id)

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check specific role requirements
    if required_role:
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(required_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You need {required_role.value} role or higher to perform this action",
            )

    return project


async def check_can_manage_sharing(
    db: AsyncSession, project_ref: str, user_id: int
) -> Project:
    """Check if user is owner or admin for sharing management."""
    project = await get_project_by_ref(db, project_ref)

    # Owner has all permissions
    if project.owner_id == user_id:
        return project

    user_role = await get_user_project_role(db, project.id, user_id)

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if user_role != CollaboratorRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need to be an admin or owner to perform this action",
        )

    return project
