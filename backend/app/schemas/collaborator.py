from datetime import datetime
from pydantic import BaseModel
from enum import Enum


class CollaboratorRole(str, Enum):
    OWNER = "owner"
    READER = "reader"
    COMMENTOR = "commentor"
    WRITER = "writer"
    ADMIN = "admin"


class CollaboratorBase(BaseModel):
    role: CollaboratorRole


class CollaboratorAdd(CollaboratorBase):
    user_id: str


class CollaboratorUpdate(BaseModel):
    role: CollaboratorRole


class CollaboratorUser(BaseModel):
    id: str
    email: str
    display_name: str

    model_config = {"from_attributes": True}


class Collaborator(CollaboratorBase):
    id: str
    project_id: str
    user_id: str
    user: CollaboratorUser
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

