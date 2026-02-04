"""Sequential document processing queue with memory-optimized streaming."""

import asyncio
import gc
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from collections import deque

from sqlalchemy import select

from app.models.document import Document, DocumentChunk, ProcessingStatus
from app.services.scx_client import scx_client

logger = logging.getLogger(__name__)

# Maximum memory-safe batch size for embeddings
# Increased from 5 to 25 for 5x faster processing
EMBEDDING_BATCH_SIZE = 25

# Number of parallel embedding batches to process simultaneously
PARALLEL_BATCHES = 3


class ProcessingQueue:
    """
    Sequential document processing queue with streaming.
    
    Processes documents one at a time with page-by-page streaming
    to minimize memory usage on constrained environments.
    """
    
    def __init__(self):
        self._queue: deque = deque()
        self._processing: bool = False
        self._lock = asyncio.Lock()
        self._current_document_id: Optional[int] = None
    
    async def add_document(self, document_id: int, file_path: str):
        """Add a document to the processing queue."""
        async with self._lock:
            self._queue.append((document_id, file_path))
            logger.info(f"Document {document_id} added to queue. Queue size: {len(self._queue)}")
        
        # Start processing if not already running
        if not self._processing:
            asyncio.create_task(self._process_queue())
    
    async def _process_queue(self):
        """Process documents in the queue one at a time."""
        async with self._lock:
            if self._processing:
                return
            self._processing = True
        
        try:
            while True:
                # Get next document
                async with self._lock:
                    if not self._queue:
                        self._processing = False
                        self._current_document_id = None
                        return
                    
                    document_id, file_path = self._queue.popleft()
                    self._current_document_id = document_id
                
                logger.info(f"Starting processing for document {document_id}")
                
                try:
                    await self._process_document_streaming(document_id, file_path)
                except Exception as e:
                    logger.error(f"Error processing document {document_id}: {e}")
                    await self._mark_document_failed(document_id, str(e))
                
                # Force garbage collection after each document
                gc.collect()
                logger.info(f"Completed processing document {document_id}, memory cleaned up")
                
                # Small delay to allow memory to settle
                await asyncio.sleep(1.0)
        
        except Exception as e:
            logger.error(f"Queue processing error: {e}")
        finally:
            async with self._lock:
                self._processing = False
                self._current_document_id = None
    
    async def _process_document_streaming(self, document_id: int, file_path: str):
        """
        Process a document with streaming page-by-page approach.
        
        This method:
        1. Streams pages one at a time from the PDF
        2. Creates chunks from each page immediately
        3. Generates embeddings in small batches
        4. Commits to database frequently
        5. Clears memory after each step
        """
        from app.services.database import async_session
        from app.services.document_processor import document_processor
        
        async with async_session() as db:
            # Get document
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            
            if not document:
                logger.warning(f"Document {document_id} not found")
                return
            
            # Skip if already completed
            if document.status == ProcessingStatus.COMPLETED.value:
                logger.info(f"Document {document_id} already completed")
                return
            
            # Update status to processing
            document.status = ProcessingStatus.PROCESSING.value
            document.error_message = None
            await db.commit()
            
            try:
                # Get page count first (low memory operation)
                page_count = document_processor.get_page_count(file_path)
                document.page_count = page_count
                await db.commit()
                
                logger.info(f"Document {document_id}: {page_count} pages to process")
                
                # Process with streaming (each batch uses its own session)
                await self._stream_and_embed(document_id, file_path, document_processor)
                
                # Mark as completed
                document.status = ProcessingStatus.COMPLETED.value
                document.processed_at = datetime.utcnow()
                await db.commit()
                
                logger.info(f"Document {document_id} processing completed successfully")
                
            except Exception as e:
                logger.error(f"Error processing document {document_id}: {e}")
                document.status = ProcessingStatus.FAILED.value
                document.error_message = str(e)[:500]  # Limit error message length
                await db.commit()
                raise
    
    async def _stream_and_embed(
        self,
        document_id: int,
        file_path: str,
        processor,
    ):
        """
        Stream pages and create embeddings incrementally with parallel batch processing.
        
        This processes the PDF page by page, creating chunks and embeddings
        in parallel batches for maximum speed while maintaining memory efficiency.
        Each embedding batch uses its own database session to avoid concurrency issues.
        """
        chunk_buffer: List[Dict[str, Any]] = []
        chunk_index = 0
        overlap_text = ""
        pages_processed = 0
        pending_batches: List[asyncio.Task] = []
        
        # Stream pages from PDF
        for page in processor.stream_pages(file_path):
            pages_processed += 1
            
            # Create chunks from this page
            page_chunks, chunk_index, overlap_text = processor.create_chunks_from_page(
                page, chunk_index, overlap_text
            )
            
            chunk_buffer.extend(page_chunks)
            
            # Process buffer when it reaches batch size
            while len(chunk_buffer) >= EMBEDDING_BATCH_SIZE:
                batch = chunk_buffer[:EMBEDDING_BATCH_SIZE]
                chunk_buffer = chunk_buffer[EMBEDDING_BATCH_SIZE:]
                
                # Create task for parallel processing
                # Each batch gets its own session to avoid concurrency issues
                task = asyncio.create_task(
                    self._embed_and_save_batch(document_id, batch)
                )
                pending_batches.append(task)
                
                # Wait for some batches if we have too many in flight
                if len(pending_batches) >= PARALLEL_BATCHES:
                    # Wait for the oldest batch to complete
                    completed_task = pending_batches.pop(0)
                    await completed_task
                    gc.collect()
            
            # Log progress every 10 pages
            if pages_processed % 10 == 0:
                logger.info(f"Document {document_id}: processed {pages_processed} pages")
            
            # Clear page data
            del page
            del page_chunks
        
        # Wait for all pending batches to complete
        if pending_batches:
            await asyncio.gather(*pending_batches, return_exceptions=True)
            pending_batches.clear()
            gc.collect()
        
        # Process remaining chunks in buffer
        if chunk_buffer:
            await self._embed_and_save_batch(document_id, chunk_buffer)
        
        # Handle final overlap text as last chunk
        if overlap_text.strip():
            final_chunk = [{
                "content": overlap_text.strip(),
                "page_number": pages_processed,
                "chunk_index": chunk_index,
                "metadata": {},
            }]
            await self._embed_and_save_batch(document_id, final_chunk)
        
        logger.info(f"Document {document_id}: finished processing {pages_processed} pages")
    
    async def _embed_and_save_batch(
        self,
        document_id: int,
        chunks: List[Dict[str, Any]],
    ):
        """Generate embeddings for a batch of chunks and save to database.
        
        Each batch gets its own database session to avoid concurrent transaction conflicts.
        """
        if not chunks:
            return
        
        from app.services.database import async_session
        
        try:
            # Extract texts
            texts = [chunk["content"] for chunk in chunks]
            
            # Generate embeddings
            embeddings = await scx_client.create_embeddings(texts)
            
            # Use a dedicated session for this batch to avoid concurrency issues
            async with async_session() as db:
                # Create database records
                for chunk, embedding in zip(chunks, embeddings):
                    db_chunk = DocumentChunk(
                        document_id=document_id,
                        content=chunk["content"],
                        page_number=chunk.get("page_number"),
                        chunk_index=chunk["chunk_index"],
                        embedding=embedding,
                        chunk_metadata=chunk.get("metadata"),
                    )
                    db.add(db_chunk)
                
                # Commit this batch
                await db.commit()
            
            # Clear references
            del texts
            del embeddings
            
        except Exception as e:
            logger.error(f"Error embedding batch for document {document_id}: {e}")
            raise
    
    async def _mark_document_failed(self, document_id: int, error_message: str):
        """Mark a document as failed."""
        from app.services.database import async_session
        
        async with async_session() as db:
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            
            if document:
                document.status = ProcessingStatus.FAILED.value
                document.error_message = error_message[:500]
                await db.commit()
    
    def get_queue_status(self) -> dict:
        """Get current queue status."""
        return {
            "queue_length": len(self._queue),
            "is_processing": self._processing,
            "current_document_id": self._current_document_id,
        }


# Singleton instance
processing_queue = ProcessingQueue()
