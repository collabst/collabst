from datetime import datetime
from pydantic import BaseModel
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.collaborator import Collaborator


class ProjectBase(BaseModel):
    name: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class Project(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    collaborators: List["Collaborator"] = []

    model_config = {"from_attributes": True}
