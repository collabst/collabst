from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class CommentThreadStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    DELETED = "deleted"


class CommentThread(Base):
    __tablename__ = "comment_threads"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    content = Column(Text, nullable=False)
    status = Column(
        SQLEnum(
            CommentThreadStatus,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="commentthreadstatus",
        ),
        nullable=False,
        default=CommentThreadStatus.OPEN,
        index=True,
    )

    anchor_rel_json = Column(Text, nullable=True)
    head_rel_json = Column(Text, nullable=True)

    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="comment_threads")
    file = relationship("File", back_populates="comment_threads")
    author = relationship("User", foreign_keys=[author_id], back_populates="comment_threads")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    replies = relationship("CommentReply", back_populates="thread", cascade="all, delete-orphan")
