from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.project import Project
from app.models.project_collaborator import ProjectCollaborator, CollaboratorRole
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, Project as ProjectSchema, ProjectWithRole
from app.schemas.collaborator import (
    Collaborator,
    CollaboratorAdd,
    CollaboratorUpdate,
)
from app.services.permissions import (
    check_project_access,
    check_is_admin_or_owner,
    get_user_project_role,
)
from app.websocket.project_ws import project_manager

router = APIRouter()


def _serialize_collaborator(collaborator: ProjectCollaborator) -> Collaborator:
    return Collaborator(
        id=collaborator.id,
        project_id=collaborator.project_id,
        user_id=collaborator.user_id,
        role=collaborator.role,
        created_at=collaborator.created_at,
        updated_at=collaborator.updated_at,
        user={
            "id": collaborator.user.id,
            "email": collaborator.user.email,
            "username": collaborator.user.username,
        },
    )


@router.post("", response_model=ProjectSchema)
async def create_project(
    project_in: ProjectCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check if user already has a project with this name
    existing_project = await db.execute(
        select(Project).where(
            Project.owner_id == current_user.id,
            Project.name == project_in.name
        )
    )
    if existing_project.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a project named '{project_in.name}'"
        )
    
    project = Project(**project_in.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=List[ProjectWithRole])
async def list_projects(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
):
    """List all projects where user is owner or collaborator with role and owner info."""
    # Get projects where user is owner or collaborator
    result = await db.execute(
        select(Project)
        .outerjoin(ProjectCollaborator)
        .where(
            or_(
                Project.owner_id == current_user.id,
                ProjectCollaborator.user_id == current_user.id,
            )
        )
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    projects = result.scalars().all()

    # Build response with role and owner info
    projects_with_role = []
    for project in projects:
        # Determine user's role
        if project.owner_id == current_user.id:
            role = 'owner'
        else:
            user_role = await get_user_project_role(db, project.id, current_user.id)
            role = user_role.value if user_role else 'reader'

        # Get owner info
        owner_result = await db.execute(select(User).where(User.id == project.owner_id))
        owner = owner_result.scalar_one_or_none()

        # Count collaborators
        collab_result = await db.execute(
            select(ProjectCollaborator).where(ProjectCollaborator.project_id == project.id)
        )
        collaborators_count = len(collab_result.scalars().all())

        projects_with_role.append(
            ProjectWithRole(
                id=project.id,
                name=project.name,
                description=project.description,
                owner_id=project.owner_id,
                created_at=project.created_at,
                updated_at=project.updated_at,
                current_user_role=role,
                owner={
                    'id': owner.id,
                    'username': owner.username,
                    'email': owner.email,
                } if owner else None,
                collaborators_count=collaborators_count,
            )
        )

    return projects_with_role


@router.get("/{project_id}", response_model=ProjectWithRole)
async def get_project(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a project by ID. User must be owner or collaborator."""
    project = await check_project_access(db, project_id, current_user.id)

    # Determine user's role
    if project.owner_id == current_user.id:
        role = 'owner'
    else:
        user_role = await get_user_project_role(db, project_id, current_user.id)
        role = user_role.value if user_role else 'reader'

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == project.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Count collaborators
    collab_result = await db.execute(
        select(ProjectCollaborator).where(ProjectCollaborator.project_id == project.id)
    )
    collaborators_count = len(collab_result.scalars().all())

    # Return project with role and owner info
    return ProjectWithRole(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        current_user_role=role,
        owner={
            'id': owner.id,
            'username': owner.username,
            'email': owner.email,
        } if owner else None,
        collaborators_count=collaborators_count,
    )


@router.put("/{project_id}", response_model=ProjectSchema)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a project. User must be owner or admin."""
    project = await check_is_admin_or_owner(db, project_id, current_user.id)

    # If renaming, check if user already has another project with this name
    if project_in.name and project_in.name != project.name:
        existing_project = await db.execute(
            select(Project).where(
                Project.owner_id == project.owner_id,
                Project.name == project_in.name,
                Project.id != project_id
            )
        )
        if existing_project.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a project named '{project_in.name}'"
            )

    for field, value in project_in.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    
    # Broadcast project update to all users in the project
    await project_manager.broadcast_to_project(
        project_id,
        {
            "type": "project_updated",
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "owner_id": project.owner_id,
                "created_at": project.created_at.isoformat(),
                "updated_at": project.updated_at.isoformat(),
            }
        }
    )
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a project. Only the owner can delete a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete the project"
        )

    # Clean up storage files before deleting database records
    from app.models.asset import Asset
    from app.services.storage import storage_service
    
    # Get all assets that will be deleted
    assets_result = await db.execute(
        select(Asset).where(Asset.project_id == project_id)
    )
    assets = assets_result.scalars().all()
    
    # Delete files from storage
    for asset in assets:
        try:
            storage_service.delete_file(asset.storage_path)
        except Exception as e:
            # Log the error but continue with deletion
            print(f"Warning: Failed to delete storage file {asset.storage_path}: {e}")

    await db.delete(project)
    await db.commit()


# Collaborator Management Endpoints

@router.get("/{project_id}/collaborators", response_model=List[Collaborator])
async def list_collaborators(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all collaborators of a project. User must have access to the project."""
    await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user))
        .where(ProjectCollaborator.project_id == project_id)
    )
    collaborators = result.scalars().all()
    return [_serialize_collaborator(collaborator) for collaborator in collaborators]


@router.post("/{project_id}/collaborators", response_model=Collaborator, status_code=status.HTTP_201_CREATED)
async def add_collaborator(
    project_id: int,
    collaborator_in: CollaboratorAdd,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a collaborator to a project. User must be owner or admin."""
    await check_is_admin_or_owner(db, project_id, current_user.id)

    # Check if user exists
    result = await db.execute(select(User).where(User.id == collaborator_in.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if user is the owner
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project.owner_id == collaborator_in.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add the project owner as a collaborator"
        )

    # Check if already a collaborator
    result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == collaborator_in.user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator"
        )

    # Add collaborator
    collaborator = ProjectCollaborator(
        project_id=project_id,
        user_id=collaborator_in.user_id,
        role=collaborator_in.role,
        user=user,
    )
    db.add(collaborator)
    await db.commit()
    await db.refresh(collaborator)
    return _serialize_collaborator(collaborator)


@router.put("/{project_id}/collaborators/{user_id}", response_model=Collaborator)
async def update_collaborator_role(
    project_id: int,
    user_id: int,
    collaborator_in: CollaboratorUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a collaborator's role. User must be owner or admin."""
    await check_is_admin_or_owner(db, project_id, current_user.id)

    # Get collaborator
    result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user))
        .where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == user_id,
        )
    )
    collaborator = result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )

    # Update role
    collaborator.role = collaborator_in.role
    await db.commit()
    await db.refresh(collaborator)
    await db.refresh(collaborator, attribute_names=["user"])
    return _serialize_collaborator(collaborator)


@router.delete("/{project_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collaborator(
    project_id: int,
    user_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Remove a collaborator from a project.
    - Owner or admin can remove any collaborator.
    - Any collaborator can remove themselves (leave the project).
    """
    project = await check_project_access(db, project_id, current_user.id)

    # Check if user is trying to leave the project themselves
    is_leaving_self = user_id == current_user.id

    # If not leaving themselves, must be owner or admin
    if not is_leaving_self:
        await check_is_admin_or_owner(db, project_id, current_user.id)

    # Cannot remove the owner
    if project.owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the project owner"
        )

    # Get collaborator
    result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == user_id,
        )
    )
    collaborator = result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )

    # Remove collaborator
    await db.delete(collaborator)
    await db.commit()

