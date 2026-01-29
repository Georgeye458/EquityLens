"""Chat service for document Q&A with full context access."""

import logging
from typing import List, Optional, Tuple
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.chat import ChatSession, ChatMessage, ChatMessageResponse, CitationDetail
from app.services.scx_client import scx_client
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

# Chat system prompt emphasizing full document access
CHAT_SYSTEM_PROMPT = """You are EquityLens, an AI assistant specialized in analyzing earnings reports and financial documents.

CRITICAL: You have access to the FULL source documents through the provided context. Your responses should be based on the complete document content, not just pre-extracted summaries.

Guidelines:
1. Answer questions thoroughly using information from the provided document chunks
2. ALWAYS cite your sources with page numbers in this format: [Page X]
3. If information is found in multiple places, cite all relevant pages
4. If you're uncertain about something, say so rather than guessing
5. For numerical data, quote the exact figures from the document
6. Distinguish between direct quotes and your interpretation
7. If the question cannot be answered from the provided context, say so clearly

When citing:
- Use [Page X] for single page references
- Use [Pages X-Y] for ranges
- Include brief quotes when particularly relevant

Remember: Users trust you for accurate, well-cited analysis. Quality and traceability are paramount."""


class ChatService:
    """Service for document chat with RAG."""

    async def create_session(
        self,
        db: AsyncSession,
        document_id: int,
        title: Optional[str] = None,
    ) -> ChatSession:
        """Create a new chat session for a document."""
        # Verify document exists
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError(f"Document {document_id} not found")

        session = ChatSession(
            document_id=document_id,
            title=title or f"Chat: {document.company_name}",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        return session

    async def get_session(
        self,
        db: AsyncSession,
        session_id: int,
    ) -> Optional[ChatSession]:
        """Get a chat session by ID."""
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_session_messages(
        self,
        db: AsyncSession,
        session_id: int,
    ) -> List[ChatMessage]:
        """Get all messages for a session."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        return result.scalars().all()

    async def send_message(
        self,
        db: AsyncSession,
        session_id: int,
        user_message: str,
        model: str = "llama-4",
    ) -> Tuple[ChatMessage, ChatMessage]:
        """
        Send a user message and get AI response.

        Args:
            db: Database session
            session_id: Chat session ID
            user_message: User's question
            model: Model to use for response

        Returns:
            Tuple of (user_message, assistant_message)
        """
        # Get session
        session = await self.get_session(db, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Save user message
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=user_message,
        )
        db.add(user_msg)

        # Retrieve relevant chunks from FULL document (per requirements)
        retrieved = await vector_store.search(
            db=db,
            query=user_message,
            document_id=session.document_id,
            top_k=10,  # Get more chunks for comprehensive context
        )

        # Build context from retrieved chunks
        context_parts = []
        citations = []

        for chunk, score in retrieved:
            context_parts.append(
                f"[Page {chunk.page_number}]\n{chunk.content}"
            )
            citations.append({
                "page_number": chunk.page_number,
                "text": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                "relevance_score": score,
            })

        context = "\n\n---\n\n".join(context_parts)

        # Get conversation history
        history = await self.get_session_messages(db, session_id)
        messages = []

        # Add recent history (last 10 messages for context window management)
        for msg in history[-10:]:
            messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        # Add current query with context
        messages.append({
            "role": "user",
            "content": f"""Context from the document:

{context}

---

Question: {user_message}

Please provide a thorough answer with page citations.""",
        })

        # Generate response
        response = await scx_client.chat_completion(
            messages=messages,
            model=model,
            system_prompt=CHAT_SYSTEM_PROMPT,
            temperature=0.7,
        )

        # Extract citations from response
        response_citations = self._extract_citations_from_response(response, citations)

        # Save assistant message
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=response,
            citations=response_citations,
            retrieved_chunks=[c["page_number"] for c in citations],
        )
        db.add(assistant_msg)

        await db.commit()
        await db.refresh(user_msg)
        await db.refresh(assistant_msg)

        return user_msg, assistant_msg

    def _extract_citations_from_response(
        self,
        response: str,
        available_citations: List[dict],
    ) -> List[dict]:
        """Extract page citations mentioned in the response."""
        import re

        # Find all page references in the response
        page_pattern = r'\[Page[s]?\s*(\d+(?:-\d+)?)\]'
        matches = re.findall(page_pattern, response)

        cited_pages = set()
        for match in matches:
            if "-" in match:
                start, end = match.split("-")
                cited_pages.update(range(int(start), int(end) + 1))
            else:
                cited_pages.add(int(match))

        # Filter available citations to only those referenced
        relevant_citations = [
            c for c in available_citations
            if c["page_number"] in cited_pages
        ]

        return relevant_citations

    async def get_document_sessions(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> List[ChatSession]:
        """Get all chat sessions for a document."""
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.document_id == document_id)
            .order_by(ChatSession.updated_at.desc())
        )
        return result.scalars().all()


# Singleton instance
chat_service = ChatService()
