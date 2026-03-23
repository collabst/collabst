from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.file import FileType


class FileBase(BaseModel):
    name: str
    path: str
    type: FileType
    content: str = ""
    parent_id: str | None = None
    is_folder: bool = False


class FileCreate(FileBase):
    project_id: str | None = None

    @field_validator('content')
    @classmethod
    def validate_folder_content(cls, v: str, info) -> str:
        # Check if is_folder field is True
        if info.data.get('is_folder') and v:
            raise ValueError('Folders cannot have content')
        return v


class FileUpdate(BaseModel):
    name: str | None = None
    path: str | None = None
    content: str | None = None
    parent_id: str | None = None
    # Note: is_folder is NOT in FileUpdate (immutable after creation)


class File(FileBase):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
