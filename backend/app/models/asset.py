from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    path = Column(String, nullable=False, index=True)
    storage_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size = Column(BigInteger, nullable=False)
    parent_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="assets")
    parent_folder = relationship("File", foreign_keys=[parent_id])

    async def compute_path(self, db: AsyncSession) -> str:
        """Recursively compute full path from parent hierarchy"""
        # Import here to avoid circular dependency
        from app.models.file import File

        if not self.parent_id:
            return f"/{self.filename}"

        # Build path by traversing parent folders
        path_parts = [self.filename]
        current_id = self.parent_id

        while current_id:
            parent = await db.get(File, current_id)
            if parent:
                path_parts.insert(0, parent.name)
                current_id = parent.parent_id
            else:
                break

        return "/" + "/".join(path_parts)
