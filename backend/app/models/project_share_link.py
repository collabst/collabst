from datetime import datetime
import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.core.hash_ids import generate_hash_id
from app.db.base import Base


class ShareLinkType(str, enum.Enum):
    READ = "read"
    COMMENT = "comment"
    EDIT = "edit"


class ProjectShareLink(Base):
    __tablename__ = "project_share_links"

    id = Column(Integer, primary_key=True, index=True)
    hash = Column(String(48), unique=True, index=True, nullable=False, default=lambda: generate_hash_id(32))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(Enum(ShareLinkType), nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="share_links")
    guest_shares = relationship("GuestShare", back_populates="project_share_link", cascade="all, delete-orphan")

    __table_args__ = (
        Index(
            "uq_project_share_link_active_type",
            "project_id",
            "link_type",
            unique=True,
            postgresql_where=revoked_at.is_(None),
            sqlite_where=revoked_at.is_(None),
        ),
    )
