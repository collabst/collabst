from datetime import datetime
from pydantic import BaseModel
from app.models.file import FileType


class FileBase(BaseModel):
    name: str
    path: str
    type: FileType
    content: str = ""


class FileCreate(FileBase):
    project_id: int


class FileUpdate(BaseModel):
    name: str | None = None
    path: str | None = None
    content: str | None = None


class File(FileBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
