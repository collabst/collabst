"""
YJS Document State Model

Stores the binary YJS document state for each project.
This is the source of truth - Redis is just a cache for active projects.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, LargeBinary
from sqlalchemy.orm import relationship
from app.db.base import Base


class YjsDocumentState(Base):
    __tablename__ = "yjs_document_states"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True, index=True)
    
    # Binary YJS state (encoded Y.Doc)
    state = Column(LargeBinary, nullable=False, default=b"")
    
    # Timestamps for tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
