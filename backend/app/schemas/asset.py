from datetime import datetime
from pydantic import BaseModel


class AssetBase(BaseModel):
    filename: str
    path: str
    mime_type: str
    parent_id: str | None = None


class AssetUpdate(BaseModel):
    filename: str | None = None
    parent_id: str | None = None


class Asset(AssetBase):
    id: str
    project_id: str
    path: str
    storage_path: str
    size: int
    parent_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
