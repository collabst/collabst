from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.db.base import Base


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_email = Column(String, nullable=False, index=True)
    invitee_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Set when they register/accept
    role = Column(String, nullable=False, default="editor")
    status = Column(SQLEnum(InvitationStatus), nullable=False, default=InvitationStatus.PENDING)
    token = Column(String, unique=True, nullable=False, index=True)  # For email link
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])
