"""Chat session and message models."""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.services.database import Base


class MessageRole(str, Enum):
    """Chat message roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# SQLAlchemy Models

class ChatSession(Base):
    """Chat session for document analysis."""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Individual chat message."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    
    # Store citations and retrieved chunks for traceability
    citations = Column(JSON, nullable=True)
    retrieved_chunks = Column(JSON, nullable=True)
    
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


# Pydantic Schemas

class ChatMessageCreate(BaseModel):
    """Schema for creating a chat message."""
    content: str = Field(..., min_length=1, max_length=10000)


class CitationDetail(BaseModel):
    """Detailed citation in chat response."""
    page_number: int
    text: str
    relevance_score: Optional[float] = None


class ChatMessageResponse(BaseModel):
    """Schema for chat message response."""
    id: int
    role: str
    content: str
    citations: Optional[List[CitationDetail]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    """Schema for chat session response."""
    id: int
    document_id: int
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    """Schema for creating a chat session."""
    document_id: int
    title: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    message: ChatMessageResponse
    session_id: int
