from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel


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

    model_config = {"from_attributes": True}


class ProjectWithRole(Project):
    """Project with the current user's role."""
    current_user_role: Literal['owner', 'admin', 'editor', 'reader']
