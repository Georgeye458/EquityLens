"""Full Analysis Report models."""

from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship

from app.services.database import Base


class ReportStatus(str, Enum):
    """Report generation status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# SQLAlchemy Model

class Report(Base):
    """Full analysis report for a document."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Report metadata
    company_name = Column(String(255), nullable=True)
    reporting_period = Column(String(100), nullable=True)
    
    # Status tracking
    status = Column(String(20), default=ReportStatus.PENDING.value)
    error_message = Column(Text, nullable=True)
    
    # Report content (full markdown)
    content = Column(Text, nullable=True)
    
    # Processing metadata
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="reports")


# Pydantic Schemas

class ReportResponse(BaseModel):
    """Full report response schema."""
    id: int
    document_id: int
    company_name: Optional[str]
    reporting_period: Optional[str]
    status: str
    error_message: Optional[str]
    content: Optional[str]
    model_used: Optional[str]
    tokens_used: Optional[int]
    processing_time_seconds: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReportSummary(BaseModel):
    """Summary view of a report."""
    id: int
    document_id: int
    company_name: Optional[str]
    reporting_period: Optional[str]
    status: str
    model_used: Optional[str]
    processing_time_seconds: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReportGenerateRequest(BaseModel):
    """Request schema for generating a report."""
    model: Optional[str] = "llama-4"


class ReportStatusResponse(BaseModel):
    """Status response for report generation."""
    id: int
    status: str
    processing_time_seconds: Optional[float]
    error_message: Optional[str]
