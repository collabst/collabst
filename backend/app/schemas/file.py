from datetime import datetime
from pydantic import BaseModel, field_validator


class FileCreate(BaseModel):
    name: str
    content: str = ""
    parent_id: str | None = None
    is_folder: bool = False

    @field_validator('content')
    @classmethod
    def validate_folder_content(cls, v: str, info) -> str:
        if info.data.get('is_folder') and v:
            raise ValueError('Folders cannot have content')
        return v


class FileUpdate(BaseModel):
    name: str | None = None
    parent_id: str | None = None


class File(BaseModel):
    id: str
    project_id: str
    name: str
    path: str
    parent_id: str | None = None
    is_folder: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
