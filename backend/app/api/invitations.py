from datetime import datetime, timedelta
from typing import Annotated, List
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.invitation import Invitation, InvitationStatus
from app.models.project_collaborator import ProjectCollaborator
from app.models.user import AuthUser
from app.schemas.invitation import Invitation as InvitationSchema
from app.schemas.invitation import InvitationCreate
from app.services.hash_lookup import get_invitation_by_ref, get_project_by_ref
from app.services.permissions import check_can_manage_sharing

router = APIRouter()


def _require_auth_user(current_user: CurrentUser) -> AuthUser:
    if not isinstance(current_user, AuthUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authenticated users can manage invitations",
        )
    return current_user


def _serialize_invitation(invitation: Invitation) -> InvitationSchema:
    return InvitationSchema(
        id=invitation.hash_id,
        project_id=invitation.project.hash_id,
        inviter_id=invitation.inviter.hash_id,
        invitee_email=invitation.invitee_email,
        invitee_id=invitation.invitee.hash_id if invitation.invitee else None,
        role=invitation.role,
        status=invitation.status,
        token=invitation.token,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
    )


@router.post("/{project_ref}/invitations", response_model=InvitationSchema, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    project_ref: str,
    invitation_in: InvitationCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, auth_user)

    result = await db.execute(select(AuthUser).where(AuthUser.email == invitation_in.invitee_email))
    invitee = result.scalar_one_or_none()

    if invitee:
        result = await db.execute(
            select(ProjectCollaborator).where(
                ProjectCollaborator.project_id == project.id,
                ProjectCollaborator.user_id == invitee.id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a collaborator")

    result = await db.execute(
        select(Invitation).where(
            Invitation.project_id == project.id,
            Invitation.invitee_email == invitation_in.invitee_email,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a pending invitation for this email",
        )

    invitation = Invitation(
        project_id=project.id,
        inviter_id=auth_user.id,
        invitee_email=invitation_in.invitee_email,
        invitee_id=invitee.id if invitee else None,
        role=invitation_in.role,
        status=InvitationStatus.PENDING,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + timedelta(days=7),
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    await db.refresh(invitation, attribute_names=["project", "inviter", "invitee"])

    return _serialize_invitation(invitation)


@router.get("/invitations/pending", response_model=List[InvitationSchema])
async def list_pending_invitations(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)

    result = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.project), selectinload(Invitation.inviter), selectinload(Invitation.invitee))
        .where(
            or_(Invitation.invitee_email == auth_user.email, Invitation.invitee_id == auth_user.id),
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > datetime.utcnow(),
        )
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return [_serialize_invitation(i) for i in invitations]


@router.get("/{project_ref}/invitations", response_model=List[InvitationSchema])
async def list_project_invitations(
    project_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, auth_user)

    result = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.project), selectinload(Invitation.inviter), selectinload(Invitation.invitee))
        .where(Invitation.project_id == project.id)
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return [_serialize_invitation(i) for i in invitations]


@router.post("/invitations/{invitation_ref}/accept", status_code=status.HTTP_200_OK)
async def accept_invitation(
    invitation_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)
    invitation = await get_invitation_by_ref(db, invitation_ref)

    if invitation.invitee_email != auth_user.email and invitation.invitee_id != auth_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation is not for you")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invitation is {invitation.status}")

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has expired")

    result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == invitation.project_id,
            ProjectCollaborator.user_id == auth_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a collaborator on this project",
        )

    db.add(
        ProjectCollaborator(
            project_id=invitation.project_id,
            user_id=auth_user.id,
            role=invitation.role,
        )
    )

    invitation.status = InvitationStatus.ACCEPTED
    invitation.invitee_id = auth_user.id
    await db.commit()

    return {"message": "Invitation accepted successfully"}


@router.post("/invitations/{invitation_ref}/decline", status_code=status.HTTP_200_OK)
async def decline_invitation(
    invitation_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)
    invitation = await get_invitation_by_ref(db, invitation_ref)

    if invitation.invitee_email != auth_user.email and invitation.invitee_id != auth_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation is not for you")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is already {invitation.status}",
        )

    invitation.status = InvitationStatus.DECLINED
    await db.commit()

    return {"message": "Invitation declined"}


@router.delete("/{project_ref}/invitations/{invitation_ref}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    project_ref: str,
    invitation_ref: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    auth_user = _require_auth_user(current_user)
    project = await get_project_by_ref(db, project_ref)
    project = await check_can_manage_sharing(db, project, auth_user)
    invitation = await get_invitation_by_ref(db, invitation_ref)

    if invitation.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invitation.status = InvitationStatus.CANCELLED
    await db.commit()
    return
