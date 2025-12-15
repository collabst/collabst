from datetime import datetime
from pydantic import BaseModel


class AssetBase(BaseModel):
    filename: str
    mime_type: str


class AssetCreate(AssetBase):
    project_id: int
    storage_path: str
    size: int


class AssetUpdate(BaseModel):
    filename: str | None = None


class Asset(AssetBase):
    id: int
    project_id: int
    storage_path: str
    size: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
