"""Sequential document processing queue to manage memory usage."""

import asyncio
import gc
import logging
from typing import Optional
from datetime import datetime
from collections import deque

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, ProcessingStatus

logger = logging.getLogger(__name__)


class ProcessingQueue:
    """
    Sequential document processing queue.
    
    Ensures only one document is processed at a time to prevent
    memory exhaustion on limited-resource environments.
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
                    await self._process_single_document(document_id, file_path)
                except Exception as e:
                    logger.error(f"Error processing document {document_id}: {e}")
                    await self._mark_document_failed(document_id, str(e))
                
                # Force garbage collection after each document
                gc.collect()
                logger.info(f"Completed processing document {document_id}, memory cleaned up")
                
                # Small delay to allow memory to settle
                await asyncio.sleep(0.5)
        
        except Exception as e:
            logger.error(f"Queue processing error: {e}")
        finally:
            async with self._lock:
                self._processing = False
                self._current_document_id = None
    
    async def _process_single_document(self, document_id: int, file_path: str):
        """Process a single document with memory-conscious approach."""
        from app.services.database import async_session
        from app.services.document_processor import document_processor
        from app.services.vector_store import vector_store
        
        async with async_session() as db:
            # Get document
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            
            if not document:
                logger.warning(f"Document {document_id} not found")
                return
            
            # Skip if already completed or failed (re-processing can be triggered separately)
            if document.status in [ProcessingStatus.COMPLETED.value, ProcessingStatus.FAILED.value]:
                logger.info(f"Document {document_id} already processed (status: {document.status})")
                return
            
            # Update status to processing
            document.status = ProcessingStatus.PROCESSING.value
            await db.commit()
            
            try:
                # Process PDF with streaming approach
                logger.info(f"Extracting text from document {document_id}")
                processed = await document_processor.process_pdf(file_path)
                
                # Update page count
                document.page_count = processed["page_count"]
                await db.commit()
                
                # Create chunks
                logger.info(f"Creating chunks for document {document_id}")
                chunks = document_processor.create_chunks(processed["pages"])
                
                # Clear processed data to free memory
                del processed
                gc.collect()
                
                # Add chunks to vector store with memory-conscious batching
                logger.info(f"Generating embeddings for {len(chunks)} chunks")
                await vector_store.add_chunks_memory_safe(db, document_id, chunks)
                
                # Clear chunks to free memory
                del chunks
                gc.collect()
                
                # Mark as completed
                document.status = ProcessingStatus.COMPLETED.value
                document.processed_at = datetime.utcnow()
                document.error_message = None
                await db.commit()
                
                logger.info(f"Document {document_id} processing completed successfully")
                
            except Exception as e:
                logger.error(f"Error processing document {document_id}: {e}")
                document.status = ProcessingStatus.FAILED.value
                document.error_message = str(e)
                await db.commit()
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
                document.error_message = error_message
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
