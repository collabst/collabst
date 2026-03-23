from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class CommentReplyStatus(str, enum.Enum):
    ACTIVE = "active"
    DELETED = "deleted"


class CommentReply(Base):
    __tablename__ = "comment_replies"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)

    thread_id = Column(Integer, ForeignKey("comment_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    content = Column(Text, nullable=False)
    status = Column(
        SQLEnum(
            CommentReplyStatus,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="commentreplystatus",
        ),
        nullable=False,
        default=CommentReplyStatus.ACTIVE,
        index=True,
    )

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    thread = relationship("CommentThread", back_populates="replies")
    author = relationship("User", back_populates="comment_replies")
