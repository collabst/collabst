from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class InvitationRole(str, enum.Enum):
    READER = "reader"
    COMMENTOR = "commentor"
    WRITER = "writer"
    ADMIN = "admin"


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_email = Column(String, nullable=False, index=True)
    invitee_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Set when they register/accept
    role = Column(
        SQLEnum(
            InvitationRole,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="invitationrole",
        ),
        nullable=False,
        default=InvitationRole.WRITER,
    )
    status = Column(
        SQLEnum(
            InvitationStatus,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="invitationstatus",
        ),
        nullable=False,
        default=InvitationStatus.PENDING,
    )
    token = Column(String, unique=True, nullable=False, index=True)  # For email link
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project")
    inviter = relationship("AuthUser", foreign_keys=[inviter_id])
    invitee = relationship("AuthUser", foreign_keys=[invitee_id])
