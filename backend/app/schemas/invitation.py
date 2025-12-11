from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.invitation import InvitationStatus


class InvitationCreate(BaseModel):
    invitee_email: EmailStr
    role: str = "editor"


class InvitationResponse(BaseModel):
    action: str  # "accept" or "decline"


class Invitation(BaseModel):
    id: int
    project_id: int
    inviter_id: int
    invitee_email: str
    invitee_id: int | None
    role: str
    status: InvitationStatus
    token: str
    expires_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvitationWithDetails(Invitation):
    project_name: str
    inviter_username: str

    model_config = {"from_attributes": True}
