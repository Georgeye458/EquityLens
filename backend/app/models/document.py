"""Document models for database and API."""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.services.database import Base


class DocumentType(str, Enum):
    """Types of earnings documents."""
    ANNUAL_REPORT = "annual_report"
    HALF_YEAR = "half_year"
    QUARTERLY = "quarterly"
    ASX_ANNOUNCEMENT = "asx_announcement"
    INVESTOR_PRESENTATION = "investor_presentation"
    OTHER = "other"


class ProcessingStatus(str, Enum):
    """Document processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# SQLAlchemy Models

class Document(Base):
    """Document database model."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, nullable=True, index=True)  # Unique identifier for distributed systems
    filename = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    company_ticker = Column(String(20), nullable=True)
    document_type = Column(String(50), default=DocumentType.OTHER.value)
    reporting_period = Column(String(50), nullable=True)
    
    file_path = Column(String(500), nullable=True)  # Local path (fallback)
    s3_key = Column(String(500), nullable=True)  # S3 storage key
    content_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for deduplication
    file_size_bytes = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    
    status = Column(String(20), default=ProcessingStatus.PENDING.value)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="document", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Document chunk for vector storage."""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=False)
    
    # Store embedding as JSON array (or use pgvector extension)
    embedding = Column(JSON, nullable=True)
    
    chunk_metadata = Column(JSON, nullable=True)  # Additional chunk metadata
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")


# Pydantic Schemas

class DocumentCreate(BaseModel):
    """Schema for document creation."""
    company_name: str = Field(..., min_length=1, max_length=255)
    company_ticker: Optional[str] = Field(None, max_length=20)
    document_type: DocumentType = DocumentType.OTHER
    reporting_period: Optional[str] = Field(None, max_length=50)


class DocumentResponse(BaseModel):
    """Schema for document response."""
    id: int
    uuid: Optional[str] = None
    filename: str
    company_name: str
    company_ticker: Optional[str]
    document_type: str
    reporting_period: Optional[str]
    page_count: Optional[int]
    status: str
    error_message: Optional[str]
    has_s3_storage: bool = False  # Indicates if PDF is persisted in S3
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True
    
    @classmethod
    def from_document(cls, doc: "Document") -> "DocumentResponse":
        """Create response from Document model with computed fields."""
        return cls(
            id=doc.id,
            uuid=doc.uuid,
            filename=doc.filename,
            company_name=doc.company_name,
            company_ticker=doc.company_ticker,
            document_type=doc.document_type,
            reporting_period=doc.reporting_period,
            page_count=doc.page_count,
            status=doc.status,
            error_message=doc.error_message,
            has_s3_storage=bool(doc.s3_key),
            created_at=doc.created_at,
            processed_at=doc.processed_at,
        )


class DocumentListResponse(BaseModel):
    """Schema for document list response."""
    documents: List[DocumentResponse]
    total: int


class DocumentChunkResponse(BaseModel):
    """Schema for document chunk response."""
    id: int
    content: str
    page_number: Optional[int]
    chunk_index: int

    class Config:
        from_attributes = True
