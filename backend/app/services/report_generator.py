"""Report generator service for full analysis reports."""

import time
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, ProcessingStatus
from app.models.report import Report, ReportStatus
from app.services.scx_client import scx_client
from app.services.vector_store import vector_store
from app.prompts.master_analysis import build_master_prompt, MASTER_ANALYSIS_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# Maximum characters to include in prompt (approximately 100k tokens worth)
MAX_DOCUMENT_CHARS = 150000

# Targeted queries for retrieval-based context (like chat) so the model sees focused, relevant chunks
# Optimized to 3 queries to balance speed vs coverage
REPORT_RETRIEVAL_QUERIES = [
    "financial metrics revenue EBITDA NPAT balance sheet total assets shareholders equity margins ROE ratios segment analysis",
    "cash flow operating free capital expenditure dividend payments working capital earnings quality provisions",
    "management commentary outlook guidance strategic initiatives market conditions exceptional items non-recurring",
]
REPORT_TOP_K_PER_QUERY = 10  # Reduced from 12 for faster generation


class ReportGenerator:
    """Service for generating full analysis reports."""

    async def generate_full_report(
        self,
        db: AsyncSession,
        document_id: int,
        model: str = "llama-4",
    ) -> Report:
        """
        Generate a full analysis report for a document.
        
        Args:
            db: Database session
            document_id: ID of the document to analyze
            model: AI model to use for generation
            
        Returns:
            Report object with generated content
        """
        start_time = time.time()
        
        # Get the document
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        if document.status != ProcessingStatus.COMPLETED.value:
            raise ValueError(f"Document {document_id} is not processed yet")
        
        # Create a new report record
        report = Report(
            document_id=document_id,
            company_name=document.company_name,
            reporting_period=document.reporting_period,
            status=ReportStatus.PROCESSING.value,
            model_used=model,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        try:
            # Get all document chunks ordered by page (returns content, and optional truncation info)
            document_content, pages_included, pages_skipped = await self._get_document_content(db, document_id)
            
            # Build the master prompt
            prompt = build_master_prompt(
                company_name=document.company_name,
                period=document.reporting_period or "latest period",
                document_content=document_content,
            )
            logger.info(
                f"Full report document_id={document_id}: retrieval-based context, "
                f"doc_content={len(document_content)} chars, pages_included={pages_included}, "
                f"pages_skipped={pages_skipped}, prompt_len={len(prompt)}"
            )
            
            # Call the AI to generate the report
            messages = [{"role": "user", "content": prompt}]
            
            report_content = await scx_client.chat_completion(
                messages=messages,
                model=model,
                temperature=0.3,  # Lower temperature for factual analysis
                system_prompt=MASTER_ANALYSIS_SYSTEM_PROMPT,
            )
            
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Update report with results
            report.content = report_content
            report.status = ReportStatus.COMPLETED.value
            report.processing_time_seconds = processing_time
            report.completed_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(report)
            
            logger.info(f"Report {report.id} generated in {processing_time:.2f}s")
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating report for document {document_id}: {e}")
            
            # Update report with error
            report.status = ReportStatus.FAILED.value
            report.error_message = str(e)
            report.processing_time_seconds = time.time() - start_time
            
            await db.commit()
            await db.refresh(report)
            
            raise

    async def _get_document_content(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> tuple[str, int, int]:
        """
        Get document content using retrieval (like chat) so the model sees focused,
        relevant chunks instead of the entire document. This matches how chat gets
        "complete data" by sending only the most relevant chunks per section.

        Runs multiple targeted queries covering financial metrics, segments,
        cash flow, management, earnings quality; merges and dedupes chunks;
        returns content ordered by page, capped at MAX_DOCUMENT_CHARS.

        Returns:
            Tuple of (content_string, pages_included, pages_skipped)
        """
        import asyncio
        
        seen_ids: set[int] = set()
        chunks_with_order: list[tuple[int, int, object]] = []  # (page_num, chunk_index, chunk)

        # Run all searches in parallel for faster execution
        search_tasks = [
            vector_store.search(
                db=db,
                query=query,
                document_id=document_id,
                top_k=REPORT_TOP_K_PER_QUERY,
            )
            for query in REPORT_RETRIEVAL_QUERIES
        ]
        all_results = await asyncio.gather(*search_tasks)
        
        # Process all results and dedupe
        for retrieved in all_results:
            for chk, _score in retrieved:
                if chk.id in seen_ids:
                    continue
                seen_ids.add(chk.id)
                page_num = chk.page_number or 0
                chunk_index = getattr(chk, "chunk_index", 0)
                chunks_with_order.append((page_num, chunk_index, chk))

        if not chunks_with_order:
            raise ValueError(f"No chunks found for document {document_id}")

        # Sort by page then chunk_index so content flows in document order
        chunks_with_order.sort(key=lambda x: (x[0], x[1]))
        ordered_chunks = [c for _p, _i, c in chunks_with_order]

        # Group by page and build content, capping at MAX_DOCUMENT_CHARS
        pages: dict[int, list[str]] = {}
        for chunk in ordered_chunks:
            page_num = chunk.page_number or 0
            if page_num not in pages:
                pages[page_num] = []
            pages[page_num].append(chunk.content)

        sorted_page_nums = sorted(pages.keys())
        content_parts = []
        total_chars = 0
        pages_included = 0
        pages_skipped = 0

        for page_num in sorted_page_nums:
            page_content = "\n".join(pages[page_num])

            if total_chars + len(page_content) > MAX_DOCUMENT_CHARS:
                remaining_pages = len([p for p in sorted_page_nums if p > page_num])
                content_parts.append(
                    f"\n\n[Additional pages omitted due to length limits]"
                )
                pages_skipped = remaining_pages
                break

            content_parts.append(f"[Page {page_num}]\n{page_content}")
            total_chars += len(page_content)
            pages_included += 1

        return "\n\n---\n\n".join(content_parts), pages_included, pages_skipped

    async def get_report(
        self,
        db: AsyncSession,
        report_id: int,
    ) -> Optional[Report]:
        """Get a report by ID."""
        result = await db.execute(
            select(Report).where(Report.id == report_id)
        )
        return result.scalar_one_or_none()

    async def get_latest_report(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> Optional[Report]:
        """Get the latest report for a document."""
        result = await db.execute(
            select(Report)
            .where(Report.document_id == document_id)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_reports_for_document(
        self,
        db: AsyncSession,
        document_id: int,
    ) -> list[Report]:
        """Get all reports for a document."""
        result = await db.execute(
            select(Report)
            .where(Report.document_id == document_id)
            .order_by(Report.created_at.desc())
        )
        return list(result.scalars().all())


# Singleton instance
report_generator = ReportGenerator()
