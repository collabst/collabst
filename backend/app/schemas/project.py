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
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OwnerInfo(BaseModel):
    """Basic owner information."""
    id: str
    display_name: str
    email: str

    model_config = {"from_attributes": True}


class ProjectWithRole(Project):
    """Project with the current user's role and owner information."""
    current_user_role: Literal['owner', 'admin', 'writer', 'commentor', 'reader']
    owner: Optional[OwnerInfo] = None
    collaborators_count: int = 0
