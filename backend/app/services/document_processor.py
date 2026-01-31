"""Document processing service for PDF ingestion with memory optimization."""

import os
import gc
import logging
from typing import List, Dict, Any, Optional, Generator, Tuple
from datetime import datetime

from pypdf import PdfReader

from app.config import settings

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Process PDF documents for analysis with memory-efficient streaming."""

    def __init__(self):
        """Initialize the document processor."""
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap
        self.max_pages = settings.max_pages

    def get_page_count(self, file_path: str) -> int:
        """Get page count without loading full document."""
        try:
            reader = PdfReader(file_path)
            return len(reader.pages)
        except Exception as e:
            logger.error(f"Error getting page count: {e}")
            raise

    async def process_pdf(
        self,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Process a PDF file with memory-efficient page-by-page extraction.
        
        Uses pypdf for basic text extraction (lower memory than pdfplumber).
        Only falls back to pdfplumber for complex table extraction if needed.

        Args:
            file_path: Path to the PDF file

        Returns:
            Dictionary with extracted pages, page count, and metadata
        """
        try:
            # Use pypdf for memory-efficient extraction
            reader = PdfReader(file_path)
            page_count = len(reader.pages)

            if page_count > self.max_pages:
                raise ValueError(
                    f"Document has {page_count} pages, exceeding limit of {self.max_pages}"
                )

            pages = []
            
            # Process pages one at a time
            for i in range(page_count):
                page = reader.pages[i]
                page_text = page.extract_text() or ""
                
                pages.append({
                    "page_number": i + 1,
                    "text": page_text,
                    "has_tables": False,  # pypdf doesn't extract tables
                })
                
                # Clear page reference and collect garbage every 10 pages
                del page
                if i % 10 == 0:
                    gc.collect()

            # Clear reader
            del reader
            gc.collect()

            return {
                "pages": pages,
                "page_count": page_count,
                "file_path": file_path,
            }

        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")
            raise

    def stream_pages(self, file_path: str) -> Generator[Dict[str, Any], None, None]:
        """
        Stream pages one at a time for memory-efficient processing.
        
        Yields:
            Page dictionaries with text and metadata
        """
        try:
            reader = PdfReader(file_path)
            page_count = len(reader.pages)

            if page_count > self.max_pages:
                raise ValueError(
                    f"Document has {page_count} pages, exceeding limit of {self.max_pages}"
                )

            for i in range(page_count):
                page = reader.pages[i]
                page_text = page.extract_text() or ""
                
                yield {
                    "page_number": i + 1,
                    "text": page_text,
                    "has_tables": False,
                    "total_pages": page_count,
                }
                
                # Clear references
                del page
                if i % 5 == 0:
                    gc.collect()

            del reader
            gc.collect()

        except Exception as e:
            logger.error(f"Error streaming PDF {file_path}: {e}")
            raise

    def create_chunks_from_page(
        self,
        page: Dict[str, Any],
        start_chunk_index: int = 0,
        overlap_text: str = "",
    ) -> Tuple[List[Dict[str, Any]], int, str]:
        """
        Create chunks from a single page.
        
        Args:
            page: Page dictionary with text and metadata
            start_chunk_index: Starting index for chunks
            overlap_text: Overlap text from previous page
            
        Returns:
            Tuple of (chunks, next_chunk_index, overlap_for_next_page)
        """
        chunks = []
        chunk_index = start_chunk_index
        page_text = page["text"]
        page_number = page["page_number"]
        
        if not page_text.strip():
            return chunks, chunk_index, overlap_text
        
        # Start with overlap from previous page
        current_chunk = overlap_text
        
        # Split into paragraphs
        paragraphs = self._split_into_paragraphs(page_text)
        
        for para in paragraphs:
            if len(current_chunk) + len(para) > self.chunk_size:
                if current_chunk.strip():
                    chunks.append({
                        "content": current_chunk.strip(),
                        "page_number": page_number,
                        "chunk_index": chunk_index,
                        "metadata": {"has_tables": page.get("has_tables", False)},
                    })
                    chunk_index += 1
                    
                    # Keep overlap for continuity
                    overlap = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                    current_chunk = overlap + " " + para
                else:
                    # Paragraph too long, force split
                    for i in range(0, len(para), self.chunk_size - self.chunk_overlap):
                        chunk_text = para[i:i + self.chunk_size]
                        if chunk_text.strip():
                            chunks.append({
                                "content": chunk_text.strip(),
                                "page_number": page_number,
                                "chunk_index": chunk_index,
                                "metadata": {},
                            })
                            chunk_index += 1
                    current_chunk = ""
            else:
                current_chunk += " " + para if current_chunk else para
        
        # Return remaining text as overlap for next page
        return chunks, chunk_index, current_chunk

    def create_chunks(
        self,
        pages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Create overlapping chunks from pages for vector embedding.
        Memory-efficient: processes page by page.

        Args:
            pages: List of page dictionaries with text and metadata

        Returns:
            List of chunk dictionaries with content and metadata
        """
        all_chunks = []
        chunk_index = 0
        overlap_text = ""
        
        for page in pages:
            page_chunks, chunk_index, overlap_text = self.create_chunks_from_page(
                page, chunk_index, overlap_text
            )
            all_chunks.extend(page_chunks)
            
            # Clear processed page data
            del page_chunks
        
        # Don't forget the last overlap if it has content
        if overlap_text.strip():
            all_chunks.append({
                "content": overlap_text.strip(),
                "page_number": pages[-1]["page_number"] if pages else 1,
                "chunk_index": chunk_index,
                "metadata": {},
            })
        
        return all_chunks

    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        paragraphs = []
        current = ""

        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                if current:
                    paragraphs.append(current)
                    current = ""
            else:
                if current:
                    current += " " + line
                else:
                    current = line

        if current:
            paragraphs.append(current)

        return paragraphs

    def get_file_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get metadata about a PDF file."""
        try:
            reader = PdfReader(file_path)
            info = reader.metadata

            result = {
                "page_count": len(reader.pages),
                "title": info.title if info else None,
                "author": info.author if info else None,
                "subject": info.subject if info else None,
                "file_size_bytes": os.path.getsize(file_path),
            }
            
            del reader
            gc.collect()
            
            return result
        except Exception as e:
            logger.error(f"Error getting PDF metadata: {e}")
            return {
                "page_count": 0,
                "file_size_bytes": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            }


# Singleton instance
document_processor = DocumentProcessor()
