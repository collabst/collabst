from datetime import datetime
from pydantic import BaseModel
from enum import Enum


class CollaboratorRole(str, Enum):
    READER = "reader"
    COMMENTOR = "commentor"
    EDITOR = "editor"
    ADMIN = "admin"


class CollaboratorBase(BaseModel):
    role: CollaboratorRole


class CollaboratorAdd(CollaboratorBase):
    user_id: int


class CollaboratorUpdate(BaseModel):
    role: CollaboratorRole


class CollaboratorUser(BaseModel):
    id: int
    email: str
    username: str

    model_config = {"from_attributes": True}


class Collaborator(CollaboratorBase):
    id: int
    project_id: int
    user_id: int
    user: CollaboratorUser
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

