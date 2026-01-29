"""Analysis and POI models."""

from datetime import datetime
from typing import Optional, List, Any, Dict
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship

from app.services.database import Base


class POICategory(str, Enum):
    """Categories of Points of Interest."""
    FINANCIAL_METRICS = "financial_metrics"
    SEGMENT_ANALYSIS = "segment_analysis"
    CASH_FLOW = "cash_flow"
    EARNINGS_QUALITY = "earnings_quality"
    MANAGEMENT_COMMENTARY = "management_commentary"


class POIOutputType(str, Enum):
    """Output types for POIs."""
    VALUE = "value"
    MULTI_VALUE = "multi_value"
    VALUE_DELTA = "value_delta"
    COMMENTARY = "commentary"
    ARRAY = "array"


# SQLAlchemy Models

class Analysis(Base):
    """Analysis session for a document."""
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    status = Column(String(20), default="pending")
    summary = Column(Text, nullable=True)
    
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="analyses")
    pois = relationship("PointOfInterest", back_populates="analysis", cascade="all, delete-orphan")


class PointOfInterest(Base):
    """Extracted Point of Interest."""
    __tablename__ = "points_of_interest"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    
    category = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    output_type = Column(String(50), default=POIOutputType.VALUE.value)
    value = Column(JSON, nullable=True)  # Flexible JSON for different output types
    
    citations = Column(JSON, nullable=True)  # List of page numbers and quotes
    confidence = Column(Float, nullable=True)  # 0-1 confidence score
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    analysis = relationship("Analysis", back_populates="pois")


# Pydantic Schemas

class Citation(BaseModel):
    """Citation reference to source document."""
    page_number: int
    text: Optional[str] = None
    section: Optional[str] = None


class POIValue(BaseModel):
    """Flexible POI value container."""
    current: Optional[Any] = None
    prior: Optional[Any] = None
    change: Optional[Any] = None
    change_percent: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None


class POIResponse(BaseModel):
    """Schema for POI response."""
    id: int
    category: str
    name: str
    description: Optional[str]
    output_type: str
    value: Any
    citations: Optional[List[Citation]]
    confidence: Optional[float]

    class Config:
        from_attributes = True


class AnalysisResponse(BaseModel):
    """Schema for analysis response."""
    id: int
    document_id: int
    status: str
    summary: Optional[str]
    model_used: Optional[str]
    processing_time_seconds: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]
    pois: List[POIResponse] = []

    class Config:
        from_attributes = True


class AnalysisSummary(BaseModel):
    """Summary view of analysis."""
    id: int
    document_id: int
    status: str
    poi_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class POIsByCategory(BaseModel):
    """POIs grouped by category."""
    category: str
    category_display: str
    pois: List[POIResponse]
