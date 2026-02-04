"""Chat service for document Q&A with full context access."""

import logging
from typing import List, Optional, Tuple, Dict, AsyncIterator
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.chat import ChatSession, ChatMessage, ChatMessageResponse, CitationDetail
from app.services.scx_client import scx_client
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

# Chat system prompt emphasizing full document access and multi-document support
CHAT_SYSTEM_PROMPT = """You are EquityLens, an AI assistant specialized in analyzing earnings reports and financial documents.

CRITICAL: You have access to the FULL source documents through the provided context. Your responses should be based on the complete document content, not just pre-extracted summaries.

Guidelines:
1. Answer questions thoroughly using information from the provided document chunks
2. ALWAYS cite your sources with document and page in this format: [TICKER - Page X] (e.g., [WBC - Page 15])
3. When comparing across documents, clearly indicate which document each piece of information comes from
4. If information is found in multiple places, cite all relevant sources
5. If you're uncertain about something, say so rather than guessing
6. For numerical data, quote the exact figures from the document
7. Distinguish between direct quotes and your interpretation
8. If the question cannot be answered from the provided context, say so clearly

When citing:
- Use [TICKER - Page X] for single page references (e.g., [WBC - Page 15])
- Use [TICKER - Pages X-Y] for ranges
- Include brief quotes when particularly relevant

Remember: Users trust you for accurate, well-cited analysis. Quality and traceability are paramount."""


def get_document_label(doc: Document) -> str:
    """Generate a distinctive label for a document based on filename, ticker, and period."""
    import re
    
    # If we have a filename, use it as the primary source
    if doc.filename:
        # Clean up the filename
        name = doc.filename
        # Remove .pdf extension
        name = re.sub(r'\.pdf$', '', name, flags=re.IGNORECASE)
        # Remove timestamp prefix (e.g., "1234567890.123_")
        name = re.sub(r'^\d+\.\d+_', '', name)
        # Replace underscores and hyphens with spaces
        name = re.sub(r'[_-]+', ' ', name)
        # Trim and limit length for citations
        name = name.strip()
        if len(name) > 30:
            name = name[:27] + '...'
        return name
    
    # Fallback: construct from metadata
    parts = []
    
    # Start with ticker or abbreviated company name
    if doc.company_ticker:
        parts.append(doc.company_ticker)
    elif doc.company_name:
        parts.append(doc.company_name[:10])
    
    # Add reporting period
    if doc.reporting_period:
        parts.append(doc.reporting_period)
    
    # Add document type
    type_labels = {
        'annual_report': 'Annual',
        'half_year': 'H1',
        'quarterly': 'Quarterly',
        'asx_announcement': 'ASX',
        'investor_presentation': 'Presentation',
    }
    if doc.document_type and doc.document_type in type_labels:
        parts.append(type_labels[doc.document_type])
    
    return ' '.join(parts) if parts else 'Document'


def strip_thinking_tags(text: str) -> str:
    """
    Remove <think>...</think> tags from DeepSeek-R1 model responses.
    
    DeepSeek-R1 outputs its reasoning process in <think> tags before the actual response.
    This function strips that internal reasoning to show only the final answer to users.
    """
    import re
    
    # Remove thinking blocks (can span multiple lines)
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # Clean up any extra whitespace/newlines left behind
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


class ChatService:
    """Service for document chat with RAG - supports multiple documents."""

    async def create_session(
        self,
        db: AsyncSession,
        document_id: Optional[int] = None,
        document_ids: Optional[List[int]] = None,
        title: Optional[str] = None,
    ) -> ChatSession:
        """Create a new chat session for one or more documents."""
        # Normalize to list
        if document_ids is None and document_id is not None:
            document_ids = [document_id]
        
        if not document_ids:
            raise ValueError("At least one document ID is required")
        
        # Verify all documents exist and are processed
        result = await db.execute(
            select(Document).where(Document.id.in_(document_ids))
        )
        documents = result.scalars().all()
        
        if len(documents) != len(document_ids):
            found_ids = {d.id for d in documents}
            missing = set(document_ids) - found_ids
            raise ValueError(f"Documents not found: {missing}")
        
        # Build title from document labels
        if title is None:
            doc_labels = [get_document_label(d) for d in documents]
            if len(doc_labels) == 1:
                title = f"Chat: {doc_labels[0]}"
            else:
                title = f"Chat: {', '.join(doc_labels[:3])}" + ("..." if len(doc_labels) > 3 else "")
        
        session = ChatSession(
            document_id=document_ids[0] if len(document_ids) == 1 else None,
            document_ids=document_ids,
            title=title,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        return session
    
    async def _get_document_info(
        self,
        db: AsyncSession,
        document_ids: List[int],
    ) -> Dict[int, Document]:
        """Get document info for multiple documents."""
        result = await db.execute(
            select(Document).where(Document.id.in_(document_ids))
        )
        docs = result.scalars().all()
        return {d.id: d for d in docs}

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

        # Get document IDs from session
        document_ids = session.get_document_ids()
        
        if not document_ids:
            raise ValueError("No documents associated with this session")
        
        # Get document info for citations
        doc_info = await self._get_document_info(db, document_ids)

        # Retrieve relevant chunks - use multi-document search if multiple docs
        if len(document_ids) == 1:
            retrieved = await vector_store.search(
                db=db,
                query=user_message,
                document_id=document_ids[0],
                top_k=10,
            )
        else:
            # Search across multiple documents
            retrieved = await vector_store.search_multiple_documents(
                db=db,
                query=user_message,
                document_ids=document_ids,
                top_k=15,  # Get more when searching multiple docs
            )

        # Build context from retrieved chunks with document identifiers
        context_parts = []
        citations = []

        for chunk, score in retrieved:
            doc = doc_info.get(chunk.document_id)
            doc_label = get_document_label(doc) if doc else f"Doc {chunk.document_id}"
            
            context_parts.append(
                f"[{doc_label} - Page {chunk.page_number}]\n{chunk.content}"
            )
            citations.append({
                "page_number": chunk.page_number,
                "text": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                "relevance_score": score,
                "document_id": chunk.document_id,
                "document_name": doc_label,
            })

        context = "\n\n---\n\n".join(context_parts)
        
        # Build document list for context
        doc_list = ", ".join([
            get_document_label(doc_info[did])
            for did in document_ids if did in doc_info
        ])

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
        context_intro = f"Context from documents ({doc_list}):" if len(document_ids) > 1 else "Context from the document:"
        
        messages.append({
            "role": "user",
            "content": f"""{context_intro}

{context}

---

Question: {user_message}

Please provide a thorough answer with citations in the format [TICKER - Page X].""",
        })

        # Generate response
        raw_response = await scx_client.chat_completion(
            messages=messages,
            model=model,
            system_prompt=CHAT_SYSTEM_PROMPT,
            temperature=0.7,
        )
        
        # Strip <think> tags from DeepSeek-R1 responses
        response = strip_thinking_tags(raw_response)

        # Extract citations from response
        response_citations = self._extract_citations_from_response(response, citations)

        # Save assistant message
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=response,
            citations=response_citations,
            retrieved_chunks=[{"document_id": c["document_id"], "page": c["page_number"]} for c in citations],
        )
        db.add(assistant_msg)

        await db.commit()
        await db.refresh(user_msg)
        await db.refresh(assistant_msg)

        return user_msg, assistant_msg

    async def send_message_stream(
        self,
        db: AsyncSession,
        session_id: int,
        user_message: str,
        model: str = "llama-4",
    ) -> AsyncIterator[str]:
        """
        Send a user message and stream AI response.

        Args:
            db: Database session
            session_id: Chat session ID
            user_message: User's question
            model: Model to use for response

        Yields:
            Text chunks as they are generated
        """
        import time
        start_time = time.time()
        
        # Get session first (faster query with indexes now)
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
        await db.commit()
        await db.refresh(user_msg)
        
        logger.info(f"Chat stream: session setup took {time.time() - start_time:.3f}s")

        # Get document IDs from session
        document_ids = session.get_document_ids()
        
        if not document_ids:
            raise ValueError("No documents associated with this session")
        
        # Get document info for citations
        doc_info = await self._get_document_info(db, document_ids)

        retrieval_start = time.time()
        # Retrieve relevant chunks - use multi-document search if multiple docs
        if len(document_ids) == 1:
            retrieved = await vector_store.search(
                db=db,
                query=user_message,
                document_id=document_ids[0],
                top_k=10,
            )
        else:
            # Search across multiple documents
            retrieved = await vector_store.search_multiple_documents(
                db=db,
                query=user_message,
                document_ids=document_ids,
                top_k=15,  # Get more when searching multiple docs
            )
        
        logger.info(f"Chat stream: retrieval took {time.time() - retrieval_start:.3f}s")

        # Build context from retrieved chunks with document identifiers
        context_parts = []
        citations = []

        for chunk, score in retrieved:
            doc = doc_info.get(chunk.document_id)
            doc_label = get_document_label(doc) if doc else f"Doc {chunk.document_id}"
            
            context_parts.append(
                f"[{doc_label} - Page {chunk.page_number}]\n{chunk.content}"
            )
            citations.append({
                "page_number": chunk.page_number,
                "text": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                "relevance_score": score,
                "document_id": chunk.document_id,
                "document_name": doc_label,
            })

        context = "\n\n---\n\n".join(context_parts)
        
        # Build document list for context
        doc_list = ", ".join([
            get_document_label(doc_info[did])
            for did in document_ids if did in doc_info
        ])

        # Get conversation history (optimized: limit query to last 10)
        history_start = time.time()
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
        )
        recent_messages = list(reversed(result.scalars().all()))
        logger.info(f"Chat stream: load history took {time.time() - history_start:.3f}s")
        
        messages = []

        # Add recent history (already limited, exclude current message)
        for msg in recent_messages[:-1]:
            messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        # Add current query with context
        context_intro = f"Context from documents ({doc_list}):" if len(document_ids) > 1 else "Context from the document:"
        
        messages.append({
            "role": "user",
            "content": f"""{context_intro}

{context}

---

Question: {user_message}

Please provide a thorough answer with citations in the format [TICKER - Page X].""",
        })
        
        logger.info(f"Chat stream: total prep took {time.time() - start_time:.3f}s, starting LLM stream...")

        # Stream response with <think> tag filtering for DeepSeek-R1
        full_response = ""
        buffer = ""
        in_thinking = False
        thinking_complete = False
        
        async for chunk in scx_client.chat_completion_stream(
            messages=messages,
            model=model,
            system_prompt=CHAT_SYSTEM_PROMPT,
            temperature=0.7,
        ):
            full_response += chunk
            buffer += chunk
            
            # Check if we're starting a thinking block
            if '<think>' in buffer and not in_thinking:
                in_thinking = True
                # Don't yield anything before <think> if it starts the response
                pre_think = buffer.split('<think>')[0]
                if pre_think.strip():
                    yield pre_think
                buffer = buffer.split('<think>', 1)[1] if '<think>' in buffer else ''
            
            # Check if thinking block is complete
            if in_thinking and '</think>' in buffer:
                in_thinking = False
                thinking_complete = True
                # Get content after </think>
                post_think = buffer.split('</think>', 1)[1]
                buffer = post_think
                # Yield any content after the thinking block
                if buffer.strip():
                    yield buffer
                    buffer = ""
            
            # If we're past the thinking block, yield chunks directly
            elif thinking_complete and not in_thinking:
                yield chunk
                buffer = ""
            
            # If no thinking tags at all and buffer is getting long, yield it
            elif not in_thinking and not thinking_complete and len(buffer) > 100:
                # Check if we might be about to see a <think> tag
                if '<' not in buffer[-10:]:
                    yield buffer
                    buffer = ""
        
        # Yield any remaining buffer (if no thinking tags were ever found)
        if buffer and not in_thinking:
            yield buffer
        
        # Clean the full response for storage
        cleaned_response = strip_thinking_tags(full_response)

        # Extract citations from cleaned response
        response_citations = self._extract_citations_from_response(cleaned_response, citations)

        # Save assistant message after streaming completes
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=cleaned_response,
            citations=response_citations,
            retrieved_chunks=[{"document_id": c["document_id"], "page": c["page_number"]} for c in citations],
        )
        db.add(assistant_msg)
        
        # Commit both user and assistant messages together
        try:
            await db.commit()
        except Exception as commit_error:
            logger.error(f"Failed to commit chat messages: {commit_error}")
            await db.rollback()
            raise

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
