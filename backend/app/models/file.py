from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True)
    is_folder = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="files")
    parent = relationship("File", remote_side=[id], backref="children", foreign_keys=[parent_id])
    comment_threads = relationship("CommentThread", back_populates="file", cascade="all, delete-orphan")

    # Table constraints
    __table_args__ = (
        UniqueConstraint("project_id", "parent_id", "name", name="unique_name_in_directory"),
    )

    async def compute_path(self, db: AsyncSession) -> str:
        """Recursively compute full path from parent hierarchy"""
        if not self.parent_id:
            return f"/{self.name}"

        # Build path iteratively to avoid deep recursion
        path_parts = [self.name]
        current_id = self.parent_id

        while current_id:
            parent = await db.get(File, current_id)
            if parent:
                path_parts.insert(0, parent.name)
                current_id = parent.parent_id
            else:
                break

        return "/" + "/".join(path_parts)
