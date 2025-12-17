from datetime import datetime
from pydantic import BaseModel


class AssetBase(BaseModel):
    filename: str
    path: str
    mime_type: str
    parent_id: int | None = None


class AssetCreate(AssetBase):
    project_id: int
    storage_path: str
    size: int


class AssetUpdate(BaseModel):
    filename: str | None = None
    parent_id: int | None = None


class Asset(AssetBase):
    id: int
    project_id: int
    path: str
    storage_path: str
    size: int
    parent_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
