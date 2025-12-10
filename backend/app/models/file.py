from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="files")
