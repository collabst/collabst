from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.hash_ids import generate_hash_id
from app.db.base import Base


class GuestShare(Base):
    __tablename__ = "guest_shares"

    id = Column(Integer, primary_key=True, index=True)
    hash_id = Column(String(20), unique=True, index=True, nullable=False, default=generate_hash_id)
    guest_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_share_link_id = Column(Integer, ForeignKey("project_share_links.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    guest_user = relationship("GuestUser", back_populates="guest_shares")
    project_share_link = relationship("ProjectShareLink", back_populates="guest_shares")

    __table_args__ = (
        UniqueConstraint("guest_user_id", "project_share_link_id", name="uq_guest_share_user_link"),
    )
