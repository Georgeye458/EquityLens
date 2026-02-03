"""Chat API routes for document Q&A."""

from typing import List, Optional
import json
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.chat_service import chat_service
from app.services.vector_store import vector_store
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
    """Create a new chat session for one or more documents."""
    # Get document IDs - support both single and multiple
    document_ids = session_data.document_ids or ([session_data.document_id] if session_data.document_id else [])
    
    if not document_ids:
        raise HTTPException(status_code=400, detail="At least one document ID is required")
    
    # Verify all documents exist and are processed
    result = await db.execute(
        select(Document).where(Document.id.in_(document_ids))
    )
    documents = list(result.scalars().all())
    
    if len(documents) != len(document_ids):
        found_ids = {d.id for d in documents}
        missing = set(document_ids) - found_ids
        raise HTTPException(status_code=404, detail=f"Documents not found: {missing}")
    
    # Check all documents are processed
    not_processed = [d for d in documents if d.status != ProcessingStatus.COMPLETED.value]
    if not_processed:
        names = [d.filename for d in not_processed]
        raise HTTPException(
            status_code=400,
            detail=f"Documents must be processed before starting a chat: {names}",
        )

    session = await chat_service.create_session(
        db=db,
        document_ids=document_ids,
        title=session_data.title,
    )

    return ChatSessionResponse(
        id=session.id,
        document_id=session.document_id,
        document_ids=session.document_ids,
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
        document_ids=session.document_ids,
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
            document_ids=session.document_ids,
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
    Send a message and get AI response (non-streaming).

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


@router.post("/sessions/{session_id}/messages/stream")
async def send_message_stream(
    session_id: int,
    message: ChatMessageCreate,
    model: str = "llama-4",
):
    """
    Send a message and get streaming AI response.

    Returns Server-Sent Events (SSE) for real-time streaming.
    
    Note: Creates its own database session to avoid FastAPI closing the session
    before streaming completes.
    """
    async def generate():
        # Create independent DB session for the generator's lifetime
        from app.services.database import async_session
        
        async with async_session() as db:
            try:
                async for chunk in chat_service.send_message_stream(
                    db=db,
                    session_id=session_id,
                    user_message=message.content,
                    model=model,
                ):
                    # Send as SSE format
                    yield f"data: {json.dumps({'type': 'content', 'data': chunk})}\n\n"
                    await asyncio.sleep(0)  # Allow other tasks to run
                
                # Send completion signal
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
            except ValueError as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': f'Chat error: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


@router.post("/preload/{document_id}")
async def preload_document_cache(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Preload document embeddings into memory cache.
    Call this when entering chat page to make first query instant.
    Returns immediately if already cached.
    """
    # Check if already cached (instant return)
    if vector_store.is_cached(document_id):
        return {"status": "already_cached", "document_id": document_id}
    
    # Verify document exists
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Preload cache in background (non-blocking for frontend)
    loaded = await vector_store.preload_cache(db, document_id)
    
    return {
        "status": "loaded" if loaded else "no_chunks",
        "document_id": document_id,
    }


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
            document_ids=[document_id],
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


class MultiDocChatRequest(BaseModel):
    """Request for multi-document quick chat."""
    document_ids: List[int]
    content: str
    model: str = "llama-4"


@router.post("/quick-multi", response_model=ChatResponse)
async def quick_chat_multi(
    request: MultiDocChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Quick multi-document chat - creates a session for multiple documents.

    Useful for comparing or analyzing across documents.
    """
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="At least one document ID required")
    
    # Always create a new session for multi-document queries
    session = await chat_service.create_session(
        db=db,
        document_ids=request.document_ids,
        title="Multi-Document Chat",
    )

    try:
        user_msg, assistant_msg = await chat_service.send_message(
            db=db,
            session_id=session.id,
            user_message=request.content,
            model=request.model,
        )

        return ChatResponse(
            message=ChatMessageResponse.model_validate(assistant_msg),
            session_id=session.id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
