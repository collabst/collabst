from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    files = relationship("File", back_populates="project", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="project", cascade="all, delete-orphan")
    collaborators = relationship("ProjectCollaborator", back_populates="project", cascade="all, delete-orphan")
    yjs_document_state = relationship("YjsDocumentState", uselist=False, cascade="all, delete-orphan")
    share_links = relationship("ProjectShareLink", back_populates="project", cascade="all, delete-orphan")
    comment_threads = relationship("CommentThread", back_populates="project", cascade="all, delete-orphan")
