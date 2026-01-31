"""Vector store service for document retrieval."""

import gc
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import logging
import numpy as np

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
        Search for similar chunks using vector similarity.

        Args:
            db: Database session
            query: Search query
            document_id: Document to search within
            top_k: Number of results to return

        Returns:
            List of (chunk, similarity_score) tuples
        """
        # Get query embedding
        query_embedding = await scx_client.create_embedding(query)

        # Get all chunks for the document
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .where(DocumentChunk.embedding.isnot(None))
        )
        chunks = result.scalars().all()

        if not chunks:
            return []

        # Calculate cosine similarity
        scored_chunks = []
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)

        for chunk in chunks:
            if chunk.embedding:
                chunk_vec = np.array(chunk.embedding)
                chunk_norm = np.linalg.norm(chunk_vec)

                if query_norm > 0 and chunk_norm > 0:
                    similarity = np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm)
                    scored_chunks.append((chunk, float(similarity)))

        # Sort by similarity and return top_k
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    async def search_multiple_documents(
        self,
        db: AsyncSession,
        query: str,
        document_ids: List[int],
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Search across multiple documents.

        Args:
            db: Database session
            query: Search query
            document_ids: Documents to search within
            top_k: Number of results to return

        Returns:
            List of (chunk, similarity_score) tuples
        """
        # Get query embedding
        query_embedding = await scx_client.create_embedding(query)

        # Get chunks for all specified documents
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id.in_(document_ids))
            .where(DocumentChunk.embedding.isnot(None))
        )
        chunks = result.scalars().all()

        if not chunks:
            return []

        # Calculate cosine similarity
        scored_chunks = []
        query_vec = np.array(query_embedding)
        query_norm = np.linalg.norm(query_vec)

        for chunk in chunks:
            if chunk.embedding:
                chunk_vec = np.array(chunk.embedding)
                chunk_norm = np.linalg.norm(chunk_vec)

                if query_norm > 0 and chunk_norm > 0:
                    similarity = np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm)
                    scored_chunks.append((chunk, float(similarity)))

        # Sort by similarity and return top_k
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

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


# Singleton instance
vector_store = VectorStore()
