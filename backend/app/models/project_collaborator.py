from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
import enum

from app.db.base import Base
from app.core.hash_ids import generate_hash_id


class CollaboratorRole(str, enum.Enum):
    OWNER = "owner"
    READER = "reader"
    COMMENTOR = "commentor"
    WRITER = "writer"
    ADMIN = "admin"


class ProjectCollaborator(Base):
    __tablename__ = "project_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(
        Enum(
            CollaboratorRole,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            name="collaboratorrole",
        ),
        nullable=False,
        default=CollaboratorRole.READER,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="collaborators")
    user = relationship("AuthUser", back_populates="collaborations")

    # Ensure one user can only have one role per project
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="unique_project_user"),
    )

