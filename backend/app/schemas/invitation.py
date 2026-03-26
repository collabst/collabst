from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr
from app.models.invitation import InvitationStatus


class InvitationCreate(BaseModel):
    invitee_email: EmailStr
    role: Literal["reader", "commentor", "writer", "admin"] = "writer"


class InvitationResponse(BaseModel):
    action: str  # "accept" or "decline"


class Invitation(BaseModel):
    id: str
    project_id: str
    inviter_id: str
    invitee_email: str
    invitee_id: str | None
    role: Literal["reader", "commentor", "writer", "admin"]
    status: InvitationStatus
    token: str
    expires_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvitationWithDetails(Invitation):
    project_name: str
    inviter_display_name: str

    model_config = {"from_attributes": True}
