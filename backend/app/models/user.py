from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    email = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=False)
    profile_picture_path = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    collaborations = relationship("ProjectCollaborator", back_populates="user", cascade="all, delete-orphan")
    comment_threads = relationship("CommentThread", back_populates="author", foreign_keys="CommentThread.author_id", cascade="all, delete-orphan")
    comment_replies = relationship("CommentReply", back_populates="author", cascade="all, delete-orphan")

