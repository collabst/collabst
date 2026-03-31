from datetime import datetime
from typing import Annotated, List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.core.hash_ids import generate_hash_id
from app.db.base import get_db
from app.models.invitation import Invitation, InvitationStatus
from app.models.project import Project
from app.models.project_collaborator import CollaboratorRole, ProjectCollaborator
from app.models.project_share_link import ProjectShareLink, ShareLinkType
from app.models.guest_share import GuestShare
from app.models.user import AuthUser, GuestUser, User
from app.schemas.collaborator import Collaborator, CollaboratorAdd, CollaboratorUpdate
from app.schemas.invitation import Invitation as InvitationSchema
from app.schemas.project import Project as ProjectSchema
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectWithRole
from app.schemas.sharing import ShareLink, ShareLinkAccess, ShareLinksSummary, SharingOverview
from app.services.hash_lookup import get_project_by_ref, get_user_by_hash
from app.services.permissions import (
    ROLE_HIERARCHY,
    check_can_manage_sharing,
    check_project_access,
    get_user_project_role,
)
from app.websocket.project_ws import project_manager
from app.websocket.notifications_ws import notifications_manager

router = APIRouter()


def _serialize_collaborator(collaborator: ProjectCollaborator) -> Collaborator:
    return Collaborator(
        id=collaborator.hash_id,
        project_id=collaborator.project.hash_id,
        user_id=collaborator.user.hash_id,
        role=collaborator.role,
        created_at=collaborator.created_at,
        updated_at=collaborator.updated_at,
        user={
            "id": collaborator.user.hash_id,
            "email": collaborator.user.email,
            "display_name": collaborator.user.display_name,
        },
    )


def _serialize_project(project: Project, current_user_role: str, owner: AuthUser, collaborators_count: int) -> ProjectWithRole:
    return ProjectWithRole(
        id=project.hash_id,
        name=project.name,
        description=project.description,
        owner_id=owner.hash_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        current_user_role=current_user_role,
        owner={
            "id": owner.hash_id,
            "display_name": owner.display_name,
            "email": owner.email,
        },
        collaborators_count=collaborators_count,
    )


def _serialize_invitation(invitation: Invitation, project_hash_id: str) -> InvitationSchema:
    return InvitationSchema(
        id=invitation.hash_id,
        project_id=project_hash_id,
        inviter_id=invitation.inviter.hash_id if invitation.inviter else "",
        invitee_email=invitation.invitee_email,
        invitee_id=invitation.invitee.hash_id if invitation.invitee else None,
        role=invitation.role,
        status=invitation.status,
        token=invitation.token,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
    )


def _serialize_share_link(project_hash_id: str, link: ProjectShareLink) -> ShareLink:
    return ShareLink(
        link_type=link.link_type.value,
        hash=link.hash,
        url=f"/share/{link.hash}",
        revoked_at=link.revoked_at,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


def _effective_role_value(project: Project, current_user: User, user_role: CollaboratorRole | None) -> str:
    if project.owner_id == current_user.id:
        return "owner"
    return user_role.value if user_role else "reader"


def _filter_links_for_role(links_summary: ShareLinksSummary, role: str) -> ShareLinksSummary:
    if role in {"owner", "admin", "writer"}:
        return links_summary
    if role == "commentor":
        return ShareLinksSummary(read=links_summary.read, comment=links_summary.comment, edit=None)
    return ShareLinksSummary(read=links_summary.read, comment=None, edit=None)


def _serialize_owner_as_collaborator(project: Project, owner: AuthUser) -> Collaborator:
    now = project.updated_at
    return Collaborator(
        id=f"owner-{owner.hash_id}",
        project_id=project.hash_id,
        user_id=owner.hash_id,
        role=CollaboratorRole.OWNER,
        created_at=project.created_at,
        updated_at=now,
        user={
            "id": owner.hash_id,
            "email": owner.email,
            "display_name": owner.display_name,
        },
    )


@router.post("", response_model=ProjectSchema)
async def create_project(
    project_in: ProjectCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not isinstance(current_user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest users cannot create projects",
        )

    existing_project = await db.execute(
        select(Project).where(Project.owner_id == current_user.id, Project.name == project_in.name)
    )
    if existing_project.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a project named '{project_in.name}'",
        )

    project = Project(**project_in.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ProjectSchema(
        id=project.hash_id,
        name=project.name,
        description=project.description,
        owner_id=current_user.hash_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=List[ProjectWithRole])
async def list_projects(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
):
    if not isinstance(current_user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest users cannot access projects dashboard",
        )

    result = await db.execute(
        select(Project)
        .outerjoin(ProjectCollaborator)
        .where(or_(Project.owner_id == current_user.id, ProjectCollaborator.user_id == current_user.id))
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    projects = result.scalars().all()

    projects_with_role: list[ProjectWithRole] = []
    for project in projects:
        if project.owner_id == current_user.id:
            role = "owner"
        else:
            user_role = await get_user_project_role(db, project, current_user)
            role = user_role.value if user_role else "reader"

        owner_result = await db.execute(select(AuthUser).where(AuthUser.id == project.owner_id))
        owner = owner_result.scalar_one_or_none()
        if not owner:
            continue

        collab_result = await db.execute(select(ProjectCollaborator).where(ProjectCollaborator.project_id == project.id))
        collaborators_count = len(collab_result.scalars().all())

        projects_with_role.append(_serialize_project(project, role, owner, collaborators_count))

    return projects_with_role


@router.get("/share/{share_hash}", response_model=ShareLinkAccess)
async def access_project_via_share_link(
    share_hash: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ProjectShareLink)
        .options(selectinload(ProjectShareLink.project))
        .where(ProjectShareLink.hash == share_hash, ProjectShareLink.revoked_at.is_(None))
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

    project_added_to_workspace = False
    if isinstance(current_user, AuthUser) and link.project.owner_id != current_user.id:
        collab_result = await db.execute(
            select(ProjectCollaborator).where(
                ProjectCollaborator.project_id == link.project_id,
                ProjectCollaborator.user_id == current_user.id,
            )
        )
        collaborator = collab_result.scalar_one_or_none()
        role_from_link = (
            CollaboratorRole.WRITER
            if link.link_type == ShareLinkType.EDIT
            else CollaboratorRole.COMMENTOR if link.link_type == ShareLinkType.COMMENT else CollaboratorRole.READER
        )

        if collaborator is None:
            db.add(
                ProjectCollaborator(
                    project_id=link.project_id,
                    user_id=current_user.id,
                    role=role_from_link,
                )
            )
            await db.commit()
            project_added_to_workspace = True
        elif ROLE_HIERARCHY.get(role_from_link, 0) > ROLE_HIERARCHY.get(collaborator.role, 0):
            collaborator.role = role_from_link
            await db.commit()
    elif isinstance(current_user, GuestUser):
        guest_share_result = await db.execute(
            select(GuestShare).where(
                GuestShare.guest_user_id == current_user.id,
                GuestShare.project_share_link_id == link.id,
            )
        )
        guest_share = guest_share_result.scalar_one_or_none()
        if guest_share is None:
            db.add(
                GuestShare(
                    guest_user_id=current_user.id,
                    project_share_link_id=link.id,
                )
            )
            await db.commit()
            project_added_to_workspace = True

    return ShareLinkAccess(
        project_id=link.project.hash_id,
        permission=link.link_type.value,
        project_added_to_workspace=project_added_to_workspace,
    )


@router.get("/{project_ref}", response_model=ProjectWithRole)
async def get_project(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    if project.owner_id == current_user.id:
        role = "owner"
    else:
        user_role = await get_user_project_role(db, project, current_user)
        role = user_role.value if user_role else "reader"

    owner_result = await db.execute(select(AuthUser).where(AuthUser.id == project.owner_id))
    owner = owner_result.scalar_one_or_none()
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project owner not found")

    collab_result = await db.execute(select(ProjectCollaborator).where(ProjectCollaborator.project_id == project.id))
    collaborators_count = len(collab_result.scalars().all())

    return _serialize_project(project, role, owner, collaborators_count)


@router.put("/{project_ref}", response_model=ProjectSchema)
async def update_project(
    project_ref: str,
    project_in: ProjectUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)

    if project_in.name and project_in.name != project.name:
        existing_project = await db.execute(
            select(Project).where(
                Project.owner_id == project.owner_id,
                Project.name == project_in.name,
                Project.id != project.id,
            )
        )
        if existing_project.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a project named '{project_in.name}'",
            )

    for field, value in project_in.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    owner = await db.get(AuthUser, project.owner_id)

    await project_manager.broadcast_to_project(
        project.hash_id,
        {
            "type": "project_updated",
            "project": {
                "id": project.hash_id,
                "name": project.name,
                "description": project.description,
                "owner_id": owner.hash_id if owner else "",
                "created_at": project.created_at.isoformat(),
                "updated_at": project.updated_at.isoformat(),
            },
        },
    )

    return ProjectSchema(
        id=project.hash_id,
        name=project.name,
        description=project.description,
        owner_id=(await db.get(AuthUser, project.owner_id)).hash_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_ref}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete the project",
        )

    from app.models.asset import Asset
    from app.services.storage import storage_service

    assets_result = await db.execute(select(Asset).where(Asset.project_id == project.id))
    assets = assets_result.scalars().all()

    for asset in assets:
        try:
            storage_service.delete_file(asset.storage_path)
        except Exception:
            pass

    await db.delete(project)
    await db.commit()


@router.get("/{project_ref}/collaborators", response_model=List[Collaborator])
async def list_collaborators(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user), selectinload(ProjectCollaborator.project))
        .where(ProjectCollaborator.project_id == project.id)
    )
    collaborators = result.scalars().all()

    owner = await db.get(AuthUser, project.owner_id)
    serialized = [_serialize_collaborator(collaborator) for collaborator in collaborators]
    if owner is not None:
        serialized.insert(0, _serialize_owner_as_collaborator(project, owner))
    return serialized


@router.post("/{project_ref}/collaborators", response_model=Collaborator, status_code=status.HTTP_201_CREATED)
async def add_collaborator(
    project_ref: str,
    collaborator_in: CollaboratorAdd,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)
    user = await get_user_by_hash(db, collaborator_in.user_id)

    if not isinstance(user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only authenticated users can be collaborators",
        )

    if collaborator_in.role == CollaboratorRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner role cannot be assigned",
        )

    if project.owner_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add the project owner as a collaborator",
        )

    result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user), selectinload(ProjectCollaborator.project))
        .where(ProjectCollaborator.project_id == project.id, ProjectCollaborator.user_id == user.id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a collaborator")

    collaborator = ProjectCollaborator(
        project_id=project.id,
        user_id=user.id,
        role=collaborator_in.role,
        user=user,
        project=project,
    )
    db.add(collaborator)
    await db.commit()
    await db.refresh(collaborator)
    await db.refresh(collaborator, attribute_names=["user", "project"])
    return _serialize_collaborator(collaborator)


@router.put("/{project_ref}/collaborators/{user_hash_id}", response_model=Collaborator)
async def update_collaborator_role(
    project_ref: str,
    user_hash_id: str,
    collaborator_in: CollaboratorUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)
    user = await get_user_by_hash(db, user_hash_id)

    if not isinstance(user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only authenticated users can be collaborators",
        )

    if collaborator_in.role == CollaboratorRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner role cannot be assigned",
        )

    result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user), selectinload(ProjectCollaborator.project))
        .where(ProjectCollaborator.project_id == project.id, ProjectCollaborator.user_id == user.id)
    )
    collaborator = result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")

    collaborator.role = collaborator_in.role
    await db.commit()

    await notifications_manager.send_event_to_user(
        project_id=project.hash_id,
        user_id=user.id,
        message={
            "type": "permission_changed",
            "action": "role_updated",
            "new_role": collaborator_in.role.value,
            "reason": "Your project permissions have been updated",
            "changed_at": datetime.utcnow().isoformat(),
        },
    )

    await db.refresh(collaborator)
    await db.refresh(collaborator, attribute_names=["user", "project"])
    return _serialize_collaborator(collaborator)


@router.delete("/{project_ref}/collaborators/{user_hash_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collaborator(
    project_ref: str,
    user_hash_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)
    user = await get_user_by_hash(db, user_hash_id)

    if not isinstance(user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only authenticated users can be collaborators",
        )

    is_leaving_self = user.id == current_user.id
    if not is_leaving_self:
        await check_can_manage_sharing(db, project, current_user)

    if project.owner_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the project owner")

    result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project.id,
            ProjectCollaborator.user_id == user.id,
        )
    )
    collaborator = result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")

    await db.delete(collaborator)
    await db.commit()

    await notifications_manager.send_event_to_user(
        project_id=project.hash_id,
        user_id=user.id,
        message={
            "type": "permission_changed",
            "action": "removed_from_project",
            "reason": "Your access to this project has been revoked",
            "changed_at": datetime.utcnow().isoformat(),
        },
    )

    return


@router.get("/{project_ref}/share-links", response_model=ShareLinksSummary)
async def list_share_links(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)

    result = await db.execute(
        select(ProjectShareLink).where(
            ProjectShareLink.project_id == project.id,
            ProjectShareLink.revoked_at.is_(None),
        )
    )
    links = result.scalars().all()

    summary = ShareLinksSummary()
    for link in links:
        serialized = _serialize_share_link(project.hash_id, link)
        if link.link_type == ShareLinkType.READ:
            summary.read = serialized
        elif link.link_type == ShareLinkType.COMMENT:
            summary.comment = serialized
        else:
            summary.edit = serialized

    return summary


@router.post("/{project_ref}/share-links/{link_type}", response_model=ShareLink)
async def create_or_rotate_share_link(
    project_ref: str,
    link_type: Literal["read", "comment", "edit"],
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)

    share_link_type = ShareLinkType(link_type)
    result = await db.execute(
        select(ProjectShareLink).where(
            ProjectShareLink.project_id == project.id,
            ProjectShareLink.link_type == share_link_type,
            ProjectShareLink.revoked_at.is_(None),
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{link_type.capitalize()} share link already exists. Please revoke it before creating a new one.",
        )

    link = ProjectShareLink(project_id=project.id, link_type=share_link_type)
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _serialize_share_link(project.hash_id, link)


@router.delete("/{project_ref}/share-links/{link_type}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    project_ref: str,
    link_type: Literal["read", "comment", "edit"],
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, current_user)
    share_link_type = ShareLinkType(link_type)

    result = await db.execute(
        select(ProjectShareLink).where(
            ProjectShareLink.project_id == project.id,
            ProjectShareLink.link_type == share_link_type,
            ProjectShareLink.revoked_at.is_(None),
        )
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

    link.revoked_at = datetime.utcnow()
    await db.commit()


@router.get("/{project_ref}/sharing", response_model=SharingOverview)
async def get_sharing_overview(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = await get_project_by_ref(db, project_ref)
    project = await check_project_access(db, project, current_user)

    user_role = await get_user_project_role(db, project, current_user)
    role_value = _effective_role_value(project, current_user, user_role)

    collaborators_result = await db.execute(
        select(ProjectCollaborator)
        .options(selectinload(ProjectCollaborator.user), selectinload(ProjectCollaborator.project))
        .where(ProjectCollaborator.project_id == project.id)
    )
    collaborators = collaborators_result.scalars().all()

    owner = await db.get(AuthUser, project.owner_id)

    invitations_result = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.inviter), selectinload(Invitation.invitee))
        .where(
            Invitation.project_id == project.id,
            Invitation.status == InvitationStatus.PENDING,
        )
        .order_by(Invitation.created_at.desc())
    )
    invitations = invitations_result.scalars().all()

    links_result = await db.execute(
        select(ProjectShareLink).where(
            ProjectShareLink.project_id == project.id,
            ProjectShareLink.revoked_at.is_(None),
        )
    )
    links = links_result.scalars().all()

    links_summary = ShareLinksSummary()
    for link in links:
        serialized = _serialize_share_link(project.hash_id, link)
        if link.link_type == ShareLinkType.READ:
            links_summary.read = serialized
        elif link.link_type == ShareLinkType.COMMENT:
            links_summary.comment = serialized
        else:
            links_summary.edit = serialized

    visible_links = _filter_links_for_role(links_summary, role_value)

    serialized_collaborators = [_serialize_collaborator(c) for c in collaborators]
    if owner is not None:
        serialized_collaborators.insert(0, _serialize_owner_as_collaborator(project, owner))

    return SharingOverview(
        public_links=visible_links,
        collaborators=serialized_collaborators,
        invitations=[_serialize_invitation(inv, project.hash_id) for inv in invitations],
    )
