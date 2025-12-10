from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project
from app.models.project_collaborator import ProjectCollaborator, CollaboratorRole
from app.models.user import User


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
    db: AsyncSession, project_id: int, user_id: int, required_role: Optional[CollaboratorRole] = None
) -> Project:
    """
    Check if user has access to a project and optionally if they have a specific role.
    Returns the project if access is granted.
    Raises HTTPException if access is denied.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Owner has all permissions
    if project.owner_id == user_id:
        return project

    # Check if user is a collaborator
    user_role = await get_user_project_role(db, project_id, user_id)

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # Check specific role requirements
    if required_role:
        role_hierarchy = {
            CollaboratorRole.READER: 1,
            CollaboratorRole.COMMENTOR: 2,
            CollaboratorRole.EDITOR: 3,
            CollaboratorRole.ADMIN: 4,
        }

        if role_hierarchy.get(user_role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You need {required_role.value} role or higher to perform this action",
            )

    return project


async def check_is_admin_or_owner(
    db: AsyncSession, project_id: int, user_id: int
) -> Project:
    """Check if user is owner or admin of the project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Owner has all permissions
    if project.owner_id == user_id:
        return project

    # Check if user is admin
    user_role = await get_user_project_role(db, project_id, user_id)

    if user_role != CollaboratorRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need to be an admin or owner to perform this action",
        )

    return project

