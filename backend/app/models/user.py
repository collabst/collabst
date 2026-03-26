from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class UserType(str, enum.Enum):
    AUTH = "auth"
    GUEST = "guest"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    display_name = Column(String, nullable=False)
    user_type = Column(
        Enum(
            UserType,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="usertype",
        ),
        nullable=False,
        default=UserType.AUTH,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __mapper_args__ = {
        "polymorphic_on": user_type,
        "with_polymorphic": "*",
    }

    # Relationships
    comment_threads = relationship("CommentThread", back_populates="author",
                                   foreign_keys="CommentThread.author_id", cascade="all, delete-orphan")
    comment_replies = relationship("CommentReply", back_populates="author", cascade="all, delete-orphan")


class AuthUser(User):
    email = Column(String, unique=True, index=True, nullable=True)
    profile_picture_path = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    __mapper_args__ = {
        "polymorphic_identity": "auth",
    }

    collaborations = relationship("ProjectCollaborator", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class GuestUser(User):
    __mapper_args__ = {
        "polymorphic_identity": "guest",
    }

    guest_shares = relationship("GuestShare", back_populates="guest_user", cascade="all, delete-orphan")
