from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.guest_share import GuestShare
from app.models.project import Project
from app.models.user import User, AuthUser, GuestUser
from app.models.project_collaborator import ProjectCollaborator, CollaboratorRole
from app.models.project_share_link import ProjectShareLink, ShareLinkType


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


async def get_auth_user_project_role(
    db: AsyncSession, project: Project, user: AuthUser,
) -> Optional[CollaboratorRole]:
    """Resolve project role for authenticated users via project collaborators."""
    result = await db.execute(
        select(ProjectCollaborator.role)
        .where(
            ProjectCollaborator.project_id == project.id,
            ProjectCollaborator.user_id == user.id,
        )
    )
    role = result.scalar_one_or_none()
    return role


async def get_guest_user_project_role(
    db: AsyncSession, project: Project, guest_user: GuestUser,
) -> Optional[CollaboratorRole]:
    """Resolve project role for guests via active guest-share link associations."""
    result = await db.execute(
        select(ProjectShareLink.link_type)
        .join(GuestShare, GuestShare.project_share_link_id == ProjectShareLink.id)
        .where(
            ProjectShareLink.revoked_at.is_(None),
            ProjectShareLink.project_id == project.id,
            GuestShare.guest_user_id == guest_user.id,
        )
    )
    link_types = result.scalars().all()
    if not link_types:
        return None

    roles = [_role_from_share_type(link_type) for link_type in link_types]
    return max(roles, key=lambda role: ROLE_HIERARCHY.get(role, 0))


async def get_user_project_role(
    db: AsyncSession, project: Project, user: User,
) -> Optional[CollaboratorRole]:
    """Dispatch role resolution based on concrete user subtype."""
    if isinstance(user, AuthUser):
        return await get_auth_user_project_role(db, project, user)
    if isinstance(user, GuestUser):
        return await get_guest_user_project_role(db, project, user)
    return None


async def check_project_access(
    db: AsyncSession,
    project: Project,
    user: User,
    required_role: Optional[CollaboratorRole] = None,
) -> Project:
    """
    Check if user has access to a project and optionally if they have a specific role.
    Returns the project if access is granted.
    Raises HTTPException if access is denied.
    """
    # Owner has all permissions
    if project.owner_id == user.id:
        return project

    # Check if user is a collaborator
    user_role = await get_user_project_role(db, project, user)

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
    db: AsyncSession, project: Project, user: User
) -> Project:
    """Check if user is owner or admin for sharing management.

    Sharing management is AuthUser-only. Guests can access shared content
    but cannot administer collaborators, invitations, or share links.
    """
    # Owner has all permissions
    if project.owner_id == user.id:
        return project

    user_role = await get_user_project_role(db, project, user)

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
