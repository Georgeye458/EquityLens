"""Chat API routes for document Q&A."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.chat_service import chat_service
from app.models.document import Document, ProcessingStatus
from app.models.chat import (
    ChatSession,
    ChatMessage,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatResponse,
)

router = APIRouter()


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_data: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat session for a document."""
    # Verify document exists and is processed
    result = await db.execute(
        select(Document).where(Document.id == session_data.document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.status != ProcessingStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail="Document must be processed before starting a chat",
        )

    session = await chat_service.create_session(
        db=db,
        document_id=session_data.document_id,
        title=session_data.title,
    )

    return ChatSessionResponse(
        id=session.id,
        document_id=session.document_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[],
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a chat session with all messages."""
    session = await chat_service.get_session(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = await chat_service.get_session_messages(db, session_id)

    return ChatSessionResponse(
        id=session.id,
        document_id=session.document_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
    )


@router.get("/documents/{document_id}/sessions", response_model=List[ChatSessionResponse])
async def get_document_sessions(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all chat sessions for a document."""
    sessions = await chat_service.get_document_sessions(db, document_id)

    result = []
    for session in sessions:
        messages = await chat_service.get_session_messages(db, session.id)
        result.append(ChatSessionResponse(
            id=session.id,
            document_id=session.document_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            messages=[ChatMessageResponse.model_validate(m) for m in messages],
        ))

    return result


@router.post("/sessions/{session_id}/messages", response_model=ChatResponse)
async def send_message(
    session_id: int,
    message: ChatMessageCreate,
    model: str = "llama-4",
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message and get AI response.

    The AI will search the FULL document content to answer your question,
    not just the extracted POIs.
    """
    try:
        user_msg, assistant_msg = await chat_service.send_message(
            db=db,
            session_id=session_id,
            user_message=message.content,
            model=model,
        )

        return ChatResponse(
            message=ChatMessageResponse.model_validate(assistant_msg),
            session_id=session_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and all its messages."""
    session = await chat_service.get_session(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()

    return {"message": "Chat session deleted successfully"}


@router.post("/quick/{document_id}", response_model=ChatResponse)
async def quick_chat(
    document_id: int,
    message: ChatMessageCreate,
    model: str = "llama-4",
    db: AsyncSession = Depends(get_db),
):
    """
    Quick chat - creates a session if needed and sends a message.

    Useful for one-off questions without managing sessions.
    """
    # Get or create session
    sessions = await chat_service.get_document_sessions(db, document_id)

    if sessions:
        session = sessions[0]  # Use most recent session
    else:
        session = await chat_service.create_session(
            db=db,
            document_id=document_id,
            title="Quick Chat",
        )

    try:
        user_msg, assistant_msg = await chat_service.send_message(
            db=db,
            session_id=session.id,
            user_message=message.content,
            model=model,
        )

        return ChatResponse(
            message=ChatMessageResponse.model_validate(assistant_msg),
            session_id=session.id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
