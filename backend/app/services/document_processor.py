"""Document processing service for PDF ingestion."""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

import pdfplumber
from pypdf import PdfReader

from app.config import settings

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Process PDF documents for analysis."""

    def __init__(self):
        """Initialize the document processor."""
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap
        self.max_pages = settings.max_pages

    async def process_pdf(
        self,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Process a PDF file and extract text with page tracking.

        Args:
            file_path: Path to the PDF file

        Returns:
            Dictionary with extracted text, page count, and metadata
        """
        try:
            pages = []
            full_text = ""

            with pdfplumber.open(file_path) as pdf:
                page_count = len(pdf.pages)

                if page_count > self.max_pages:
                    raise ValueError(
                        f"Document has {page_count} pages, exceeding limit of {self.max_pages}"
                    )

                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text() or ""

                    # Extract tables if present
                    tables = page.extract_tables()
                    table_text = self._format_tables(tables)

                    combined_text = page_text
                    if table_text:
                        combined_text += "\n\n" + table_text

                    pages.append({
                        "page_number": i + 1,
                        "text": combined_text,
                        "has_tables": bool(tables),
                    })

                    full_text += f"\n\n[Page {i + 1}]\n{combined_text}"

            return {
                "pages": pages,
                "full_text": full_text,
                "page_count": page_count,
                "file_path": file_path,
            }

        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")
            raise

    def _format_tables(self, tables: List[List[List[str]]]) -> str:
        """Format extracted tables as text."""
        if not tables:
            return ""

        formatted = []
        for table_idx, table in enumerate(tables):
            if not table:
                continue

            table_lines = [f"[Table {table_idx + 1}]"]
            for row in table:
                if row:
                    # Clean and join cells
                    cleaned_cells = [
                        str(cell).strip() if cell else ""
                        for cell in row
                    ]
                    table_lines.append(" | ".join(cleaned_cells))

            formatted.append("\n".join(table_lines))

        return "\n\n".join(formatted)

    def create_chunks(
        self,
        pages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Create overlapping chunks from pages for vector embedding.

        Args:
            pages: List of page dictionaries with text and metadata

        Returns:
            List of chunk dictionaries with content and metadata
        """
        chunks = []
        chunk_index = 0

        for page in pages:
            page_text = page["text"]
            page_number = page["page_number"]

            if not page_text.strip():
                continue

            # Split page into sentences/paragraphs
            paragraphs = self._split_into_paragraphs(page_text)

            current_chunk = ""
            for para in paragraphs:
                # Check if adding paragraph exceeds chunk size
                if len(current_chunk) + len(para) > self.chunk_size:
                    if current_chunk:
                        chunks.append({
                            "content": current_chunk.strip(),
                            "page_number": page_number,
                            "chunk_index": chunk_index,
                            "metadata": {
                                "has_tables": page.get("has_tables", False),
                            },
                        })
                        chunk_index += 1

                        # Keep overlap
                        overlap_text = current_chunk[-self.chunk_overlap:]
                        current_chunk = overlap_text + " " + para
                    else:
                        # Paragraph itself is too long, force split
                        for i in range(0, len(para), self.chunk_size - self.chunk_overlap):
                            chunk_text = para[i:i + self.chunk_size]
                            chunks.append({
                                "content": chunk_text.strip(),
                                "page_number": page_number,
                                "chunk_index": chunk_index,
                                "metadata": {},
                            })
                            chunk_index += 1
                        current_chunk = ""
                else:
                    current_chunk += " " + para

            # Don't forget the last chunk
            if current_chunk.strip():
                chunks.append({
                    "content": current_chunk.strip(),
                    "page_number": page_number,
                    "chunk_index": chunk_index,
                    "metadata": {
                        "has_tables": page.get("has_tables", False),
                    },
                })
                chunk_index += 1

        return chunks

    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        # Split on double newlines or single newlines followed by capital letters
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

            return {
                "page_count": len(reader.pages),
                "title": info.title if info else None,
                "author": info.author if info else None,
                "subject": info.subject if info else None,
                "file_size_bytes": os.path.getsize(file_path),
            }
        except Exception as e:
            logger.error(f"Error getting PDF metadata: {e}")
            return {
                "page_count": 0,
                "file_size_bytes": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            }


# Singleton instance
document_processor = DocumentProcessor()
