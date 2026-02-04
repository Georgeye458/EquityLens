"""Vector store service for document retrieval."""

import gc
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import logging
import numpy as np
from functools import lru_cache

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocumentChunk
from app.services.scx_client import scx_client

logger = logging.getLogger(__name__)


class VectorStore:
    """Vector store for document embeddings and retrieval."""

    def __init__(self):
        """Initialize the vector store."""
        self.embedding_dim = 1536  # Typical embedding dimension
        self._embedding_cache: Dict[int, Tuple[List, np.ndarray]] = {}  # document_id -> (chunks, embeddings_matrix)

    async def add_chunks(
        self,
        db: AsyncSession,
        document_id: int,
        chunks: List[Dict[str, Any]],
    ) -> List[DocumentChunk]:
        """
        Add document chunks with embeddings to the vector store.

        Args:
            db: Database session
            document_id: ID of the parent document
            chunks: List of chunk dictionaries with content and metadata

        Returns:
            List of created DocumentChunk objects
        """
        # Extract texts for embedding
        texts = [chunk["content"] for chunk in chunks]

        # Create embeddings in batches
        batch_size = 20
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = await scx_client.create_embeddings(batch)
            all_embeddings.extend(embeddings)

        # Create chunk records
        db_chunks = []
        for chunk, embedding in zip(chunks, all_embeddings):
            db_chunk = DocumentChunk(
                document_id=document_id,
                content=chunk["content"],
                page_number=chunk.get("page_number"),
                chunk_index=chunk["chunk_index"],
                embedding=embedding,
                metadata=chunk.get("metadata"),
            )
            db.add(db_chunk)
            db_chunks.append(db_chunk)

        await db.commit()

        return db_chunks

    async def add_chunks_memory_safe(
        self,
        db: AsyncSession,
        document_id: int,
        chunks: List[Dict[str, Any]],
        batch_size: int = 5,
    ) -> int:
        """
        Add document chunks with memory-conscious embedding generation.
        
        Processes chunks in small batches with garbage collection between
        batches to minimize memory footprint.
        
        Args:
            db: Database session
            document_id: ID of the parent document
            chunks: List of chunk dictionaries with content and metadata
            batch_size: Number of chunks to process at once (smaller = less memory)
            
        Returns:
            Number of chunks successfully processed
        """
        total_chunks = len(chunks)
        processed_count = 0
        
        logger.info(f"Processing {total_chunks} chunks in batches of {batch_size}")
        
        for i in range(0, total_chunks, batch_size):
            batch_chunks = chunks[i:i + batch_size]
            batch_texts = [chunk["content"] for chunk in batch_chunks]
            
            try:
                # Generate embeddings for this batch
                logger.debug(f"Generating embeddings for batch {i // batch_size + 1}")
                embeddings = await scx_client.create_embeddings(batch_texts)
                
                # Create and save chunk records
                for chunk, embedding in zip(batch_chunks, embeddings):
                    db_chunk = DocumentChunk(
                        document_id=document_id,
                        content=chunk["content"],
                        page_number=chunk.get("page_number"),
                        chunk_index=chunk["chunk_index"],
                        embedding=embedding,
                        chunk_metadata=chunk.get("metadata"),
                    )
                    db.add(db_chunk)
                    processed_count += 1
                
                # Commit this batch
                await db.commit()
                
                # Clear batch data and force garbage collection
                del batch_texts
                del embeddings
                gc.collect()
                
                logger.info(f"Processed {min(i + batch_size, total_chunks)}/{total_chunks} chunks")
                
                # Small delay between batches to allow memory to settle
                if i + batch_size < total_chunks:
                    await asyncio.sleep(0.2)
                    
            except Exception as e:
                logger.error(f"Error processing batch starting at {i}: {e}")
                # Rollback this batch but continue with next
                await db.rollback()
                raise
        
        logger.info(f"Successfully processed {processed_count} chunks")
        return processed_count

    async def search(
        self,
        db: AsyncSession,
        query: str,
        document_id: int,
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Search for similar chunks using vector similarity (optimized with vectorized ops).

        Args:
            db: Database session
            query: Search query
            document_id: Document to search within
            top_k: Number of results to return

        Returns:
            List of (chunk, similarity_score) tuples
        """
        import time
        search_start = time.time()
        
        # Get query embedding
        embed_start = time.time()
        query_embedding = await scx_client.create_embedding(query)
        logger.info(f"Vector search: embedding took {time.time() - embed_start:.3f}s")

        # Check cache first
        db_start = time.time()
        if document_id in self._embedding_cache:
            chunks, chunk_embeddings = self._embedding_cache[document_id]
            logger.info(f"Vector search: loaded from CACHE in {time.time() - db_start:.3f}s for {len(chunks)} chunks")
        else:
            # Get all chunks for the document
            result = await db.execute(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == document_id)
                .where(DocumentChunk.embedding.isnot(None))
            )
            chunks = result.scalars().all()
            
            if not chunks:
                return []
            
            # Build embeddings matrix and cache it
            chunk_embeddings = np.array([chunk.embedding for chunk in chunks])
            self._embedding_cache[document_id] = (chunks, chunk_embeddings)
            logger.info(f"Vector search: DB query + load took {time.time() - db_start:.3f}s for {len(chunks)} chunks (CACHED for next time)")

        if not chunks:
            return []

        # Vectorized similarity calculation (MUCH faster than loop)
        calc_start = time.time()
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)
        
        if query_norm == 0:
            return []

        # chunk_embeddings already loaded from cache or DB
        
        # Normalize query vector
        query_normalized = query_vec / query_norm
        
        # Compute all similarities at once (vectorized)
        chunk_norms = np.linalg.norm(chunk_embeddings, axis=1)
        
        # Avoid division by zero
        valid_mask = chunk_norms > 0
        similarities = np.zeros(len(chunks))
        
        if valid_mask.any():
            chunk_embeddings_normalized = chunk_embeddings[valid_mask] / chunk_norms[valid_mask, np.newaxis]
            similarities[valid_mask] = np.dot(chunk_embeddings_normalized, query_normalized)
        
        # Get top_k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        logger.info(f"Vector search: similarity calculation took {time.time() - calc_start:.3f}s")
        logger.info(f"Vector search: TOTAL took {time.time() - search_start:.3f}s")
        
        # Return chunks with scores
        return [(chunks[i], float(similarities[i])) for i in top_indices]

    async def search_multiple_documents(
        self,
        db: AsyncSession,
        query: str,
        document_ids: List[int],
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Search across multiple documents (optimized with vectorized ops and parallel loading).

        Args:
            db: Database session
            query: Search query
            document_ids: Documents to search within
            top_k: Number of results to return

        Returns:
            List of (chunk, similarity_score) tuples
        """
        import asyncio
        
        # Get query embedding
        query_embedding = await scx_client.create_embedding(query)

        # Separate cached and uncached documents
        cached_docs = []
        uncached_docs = []
        
        for doc_id in document_ids:
            if doc_id in self._embedding_cache:
                cached_docs.append(doc_id)
            else:
                uncached_docs.append(doc_id)
        
        # Load all uncached documents in parallel
        async def load_document_chunks(doc_id: int):
            result = await db.execute(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == doc_id)
                .where(DocumentChunk.embedding.isnot(None))
            )
            chunks = result.scalars().all()
            if chunks:
                embeddings = np.array([chunk.embedding for chunk in chunks])
                self._embedding_cache[doc_id] = (chunks, embeddings)
                return chunks, embeddings
            return [], None
        
        # Load uncached documents in parallel
        if uncached_docs:
            loaded_results = await asyncio.gather(
                *[load_document_chunks(doc_id) for doc_id in uncached_docs],
                return_exceptions=True
            )
        else:
            loaded_results = []
        
        # Collect all chunks and embeddings
        all_chunks = []
        all_embeddings = []
        
        # Add cached documents
        for doc_id in cached_docs:
            chunks, embeddings = self._embedding_cache[doc_id]
            all_chunks.extend(chunks)
            all_embeddings.append(embeddings)
        
        # Add newly loaded documents (filter out errors)
        for result in loaded_results:
            if isinstance(result, tuple) and not isinstance(result, Exception):
                chunks, embeddings = result
                if chunks and embeddings is not None:
                    all_chunks.extend(chunks)
                    all_embeddings.append(embeddings)
        
        if not all_chunks:
            return []
        
        chunks = all_chunks
        chunk_embeddings = np.vstack(all_embeddings) if len(all_embeddings) > 1 else all_embeddings[0]

        # Vectorized similarity calculation (MUCH faster than loop)
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)
        
        if query_norm == 0:
            return []

        # chunk_embeddings already loaded from cache or DB
        
        # Normalize query vector
        query_normalized = query_vec / query_norm
        
        # Compute all similarities at once (vectorized)
        chunk_norms = np.linalg.norm(chunk_embeddings, axis=1)
        
        # Avoid division by zero
        valid_mask = chunk_norms > 0
        similarities = np.zeros(len(chunks))
        
        if valid_mask.any():
            chunk_embeddings_normalized = chunk_embeddings[valid_mask] / chunk_norms[valid_mask, np.newaxis]
            similarities[valid_mask] = np.dot(chunk_embeddings_normalized, query_normalized)
        
        # Get top_k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        # Return chunks with scores
        return [(chunks[i], float(similarities[i])) for i in top_indices]

    async def get_document_chunks(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> List[DocumentChunk]:
        """Get all chunks for a document."""
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        return result.scalars().all()

    async def preload_cache(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> bool:
        """
        Preload embeddings into cache for a document.
        Call this when chat page loads to make first query instant.
        
        Returns True if loaded, False if already cached.
        """
        if document_id in self._embedding_cache:
            logger.info(f"Preload: document {document_id} already in cache")
            return False
        
        import time
        start = time.time()
        
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .where(DocumentChunk.embedding.isnot(None))
        )
        chunks = result.scalars().all()
        
        if chunks:
            chunk_embeddings = np.array([chunk.embedding for chunk in chunks])
            self._embedding_cache[document_id] = (chunks, chunk_embeddings)
            logger.info(f"Preload: cached {len(chunks)} chunks for document {document_id} in {time.time() - start:.3f}s")
            return True
        
        return False

    def is_cached(self, document_id: int) -> bool:
        """Check if document embeddings are in cache."""
        return document_id in self._embedding_cache


# Singleton instance
vector_store = VectorStore()
