from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.collaborator import Collaborator
from app.schemas.invitation import Invitation


ShareLinkPermission = Literal["read", "comment", "edit"]


class ShareLink(BaseModel):
    link_type: ShareLinkPermission
    hash: str
    url: str
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ShareLinksSummary(BaseModel):
    read: ShareLink | None = None
    comment: ShareLink | None = None
    edit: ShareLink | None = None


class SharingOverview(BaseModel):
    public_links: ShareLinksSummary
    collaborators: list[Collaborator]
    invitations: list[Invitation]


class ShareLinkAccess(BaseModel):
    project_id: str
    permission: ShareLinkPermission
    project_added_to_workspace: bool
