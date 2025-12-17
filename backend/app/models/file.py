from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import AsyncSession
import enum
from app.db.base import Base


class FileType(str, enum.Enum):
    TYPST = "typst"
    TEXT = "text"
    YAML = "yaml"
    JSON = "json"
    OTHER = "other"


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    type = Column(SQLEnum(FileType), nullable=False, default=FileType.TYPST)
    content = Column(Text, nullable=False, default="")
    parent_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=True, index=True)
    is_folder = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="files")
    parent = relationship("File", remote_side=[id], backref="children", foreign_keys=[parent_id])

    # Table constraints
    __table_args__ = (
        UniqueConstraint("project_id", "parent_id", "name", name="unique_name_in_directory"),
        CheckConstraint("is_folder = false OR content = ''", name="folders_no_content"),
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
