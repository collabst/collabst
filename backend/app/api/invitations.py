from typing import Annotated, List
from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.invitation import Invitation, InvitationStatus
from app.models.project import Project
from app.models.user import User
from app.models.project_collaborator import ProjectCollaborator
from app.schemas.invitation import (
    InvitationCreate,
    InvitationResponse,
    Invitation as InvitationSchema,
)
from app.services.permissions import check_is_admin_or_owner

router = APIRouter()


@router.post("/{project_id}/invitations", response_model=InvitationSchema, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    project_id: int,
    invitation_in: InvitationCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send an invitation to collaborate on a project."""
    # Check if user has permission (owner or admin)
    await check_is_admin_or_owner(db, project_id, current_user.id)

    # Check if user exists
    result = await db.execute(select(User).where(User.email == invitation_in.invitee_email))
    invitee = result.scalar_one_or_none()

    # Check if user is already a collaborator
    if invitee:
        result = await db.execute(
            select(ProjectCollaborator).where(
                ProjectCollaborator.project_id == project_id,
                ProjectCollaborator.user_id == invitee.id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a collaborator"
            )

    # Check if there's already a pending invitation
    result = await db.execute(
        select(Invitation).where(
            Invitation.project_id == project_id,
            Invitation.invitee_email == invitation_in.invitee_email,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a pending invitation for this email"
        )

    # Create invitation
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        project_id=project_id,
        inviter_id=current_user.id,
        invitee_email=invitation_in.invitee_email,
        invitee_id=invitee.id if invitee else None,
        role=invitation_in.role,
        status=InvitationStatus.PENDING,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7),  # 7 days to accept
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # TODO: Send email notification here
    # send_invitation_email(invitation_in.invitee_email, token, project.name)

    return invitation


@router.get("/invitations/pending", response_model=List[InvitationSchema])
async def list_pending_invitations(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all pending invitations for the current user."""
    result = await db.execute(
        select(Invitation)
        .where(
            or_(
                Invitation.invitee_email == current_user.email,
                Invitation.invitee_id == current_user.id,
            ),
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > datetime.utcnow(),
        )
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return invitations


@router.get("/{project_id}/invitations", response_model=List[InvitationSchema])
async def list_project_invitations(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all invitations for a project."""
    # Check if user has access to the project
    await check_is_admin_or_owner(db, project_id, current_user.id)

    result = await db.execute(
        select(Invitation)
        .where(Invitation.project_id == project_id)
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return invitations


@router.post("/invitations/{invitation_id}/accept", status_code=status.HTTP_200_OK)
async def accept_invitation(
    invitation_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept an invitation to collaborate on a project."""
    # Get invitation
    result = await db.execute(select(Invitation).where(Invitation.id == invitation_id))
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Check if invitation is for current user
    if invitation.invitee_email != current_user.email and invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for you"
        )

    # Check if invitation is still valid
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is {invitation.status}"
        )

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )

    # Check if user is already a collaborator
    result = await db.execute(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == invitation.project_id,
            ProjectCollaborator.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a collaborator on this project"
        )

    # Add user as collaborator
    collaborator = ProjectCollaborator(
        project_id=invitation.project_id,
        user_id=current_user.id,
        role=invitation.role,
    )
    db.add(collaborator)

    # Update invitation status
    invitation.status = InvitationStatus.ACCEPTED
    invitation.invitee_id = current_user.id

    await db.commit()

    return {"message": "Invitation accepted successfully"}


@router.post("/invitations/{invitation_id}/decline", status_code=status.HTTP_200_OK)
async def decline_invitation(
    invitation_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Decline an invitation to collaborate on a project."""
    # Get invitation
    result = await db.execute(select(Invitation).where(Invitation.id == invitation_id))
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Check if invitation is for current user
    if invitation.invitee_email != current_user.email and invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for you"
        )

    # Check if invitation is still valid
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is already {invitation.status}"
        )

    # Update invitation status
    invitation.status = InvitationStatus.DECLINED

    await db.commit()

    return {"message": "Invitation declined"}


@router.delete("/{project_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    project_id: int,
    invitation_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cancel a pending invitation (owner/admin only)."""
    # Check if user has permission
    await check_is_admin_or_owner(db, project_id, current_user.id)

    # Get invitation
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.project_id == project_id,
        )
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Update status or delete
    invitation.status = InvitationStatus.CANCELLED
    await db.commit()
