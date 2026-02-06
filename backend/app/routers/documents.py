"""Document management API routes."""

import os
import shutil
import hashlib
import uuid as uuid_lib
from typing import List, Optional
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.processing_queue import processing_queue
from app.services.storage import storage_service
from app.models.document import (
    Document,
    DocumentCreate,
    DocumentResponse,
    DocumentListResponse,
    DocumentType,
    ProcessingStatus,
)
from app.config import settings

router = APIRouter()

# Ensure uploads directory exists (fallback for local storage)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash of file content for deduplication."""
    return hashlib.sha256(content).hexdigest()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    company_name: str = Form(...),
    company_ticker: Optional[str] = Form(None),
    document_type: DocumentType = Form(DocumentType.OTHER),
    reporting_period: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document for analysis.

    The document will be processed sequentially in a queue to manage memory.
    Documents are stored in S3 for persistence (if configured) with local fallback.
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    # Read file content
    file_content = await file.read()
    file_size = len(file_content)

    max_size = settings.max_file_size_mb * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum of {settings.max_file_size_mb}MB",
        )

    # Compute content hash for deduplication
    content_hash = compute_content_hash(file_content)
    
    # Check for duplicate document
    existing = await db.execute(
        select(Document).where(Document.content_hash == content_hash)
    )
    existing_doc = existing.scalar_one_or_none()
    if existing_doc:
        raise HTTPException(
            status_code=400,
            detail=f"This document has already been uploaded as '{existing_doc.filename}' (ID: {existing_doc.id})",
        )

    # Generate UUID for the document
    doc_uuid = str(uuid_lib.uuid4())
    
    # Save file locally first (needed for processing)
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.utcnow().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    # Create document record
    document = Document(
        uuid=doc_uuid,
        filename=file.filename,
        company_name=company_name,
        company_ticker=company_ticker,
        document_type=document_type.value,
        reporting_period=reporting_period,
        file_path=file_path,
        content_hash=content_hash,
        file_size_bytes=file_size,
        status=ProcessingStatus.PENDING.value,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Upload to S3 for persistent storage (async, non-blocking)
    if storage_service.is_enabled:
        try:
            s3_key = await storage_service.upload_document(
                document_id=document.id,
                filename=file.filename,
                file_content=file_content,
            )
            if s3_key:
                document.s3_key = s3_key
                await db.commit()
                await db.refresh(document)
        except Exception as e:
            # Log but don't fail - local file still exists for processing
            import logging
            logging.getLogger(__name__).warning(f"S3 upload failed for document {document.id}: {e}")

    # Add to sequential processing queue (memory-safe)
    await processing_queue.add_document(document.id, file_path)

    return DocumentResponse.from_document(document)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    company_name: Optional[str] = None,
    status: Optional[ProcessingStatus] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all documents with optional filtering."""
    query = select(Document)

    if company_name:
        query = query.where(Document.company_name.ilike(f"%{company_name}%"))

    if status:
        query = query.where(Document.status == status.value)

    # Get total count
    count_query = select(func.count()).select_from(Document)
    if company_name:
        count_query = count_query.where(Document.company_name.ilike(f"%{company_name}%"))
    if status:
        count_query = count_query.where(Document.status == status.value)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get documents
    query = query.order_by(Document.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentResponse.from_document(d) for d in documents],
        total=total,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a document by ID."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse.from_document(document)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    company_name: Optional[str] = Form(None),
    company_ticker: Optional[str] = Form(None),
    document_type: Optional[str] = Form(None),
    reporting_period: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Update document metadata."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update fields if provided
    if company_name is not None:
        document.company_name = company_name
    if company_ticker is not None:
        document.company_ticker = company_ticker
    if document_type is not None:
        document.document_type = document_type
    if reporting_period is not None:
        document.reporting_period = reporting_period

    document.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(document)

    return DocumentResponse.from_document(document)


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and all associated data."""
    from sqlalchemy import delete as sql_delete
    from app.models.chat import ChatSession, ChatMessage
    from app.models.analysis import Analysis, PointOfInterest
    from app.models.report import Report
    from app.models.document import DocumentChunk
    
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete related data in correct order (respecting foreign keys)
    
    # 1. Delete chat messages for sessions associated with this document
    await db.execute(
        sql_delete(ChatMessage).where(
            ChatMessage.session_id.in_(
                select(ChatSession.id).where(ChatSession.document_id == document_id)
            )
        )
    )
    
    # 2. Delete chat sessions
    await db.execute(
        sql_delete(ChatSession).where(ChatSession.document_id == document_id)
    )
    
    # 3. Delete POIs
    await db.execute(
        sql_delete(PointOfInterest).where(
            PointOfInterest.analysis_id.in_(
                select(Analysis.id).where(Analysis.document_id == document_id)
            )
        )
    )
    
    # 4. Delete analyses
    await db.execute(
        sql_delete(Analysis).where(Analysis.document_id == document_id)
    )
    
    # 5. Delete reports
    await db.execute(
        sql_delete(Report).where(Report.document_id == document_id)
    )
    
    # 6. Delete document chunks
    await db.execute(
        sql_delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    
    # 7. Delete files (S3 and local)
    if document.s3_key and storage_service.is_enabled:
        try:
            await storage_service.delete_document(document.s3_key)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to delete S3 file for document {document_id}: {e}")
    
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    # 8. Finally delete the document
    await db.delete(document)
    await db.commit()

    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get document processing status."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": document.id,
        "status": document.status,
        "error_message": document.error_message,
        "page_count": document.page_count,
        "processed_at": document.processed_at,
    }


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Reprocess a failed or stuck document."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.status == ProcessingStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail="Document is already processed successfully"
        )

    # Reset status and add to queue
    document.status = ProcessingStatus.PENDING.value
    document.error_message = None
    await db.commit()

    # Add to processing queue
    await processing_queue.add_document(document.id, document.file_path)

    queue_status = processing_queue.get_queue_status()

    return {
        "message": "Document queued for reprocessing",
        "document_id": document.id,
        "queue_position": queue_status["queue_length"],
    }


@router.get("/queue/status")
async def get_queue_status():
    """Get the current processing queue status."""
    return processing_queue.get_queue_status()


@router.get("/{document_id}/pdf")
async def get_document_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the original PDF file for viewing.
    
    Returns the PDF file with appropriate headers for browser viewing.
    Tries S3 first (persistent), falls back to local storage.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Try S3 first (persistent storage)
    if document.s3_key and storage_service.is_enabled:
        try:
            pdf_content = await storage_service.download_document(document.s3_key)
            if pdf_content:
                return StreamingResponse(
                    BytesIO(pdf_content),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f"inline; filename=\"{document.filename}\"",
                        "Cache-Control": "public, max-age=3600",
                    }
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"S3 download failed for document {document_id}: {e}")
            # Fall through to local storage

    # Fallback to local storage
    if document.file_path and os.path.exists(document.file_path):
        return FileResponse(
            path=document.file_path,
            media_type="application/pdf",
            filename=document.filename,
            headers={
                "Content-Disposition": f"inline; filename=\"{document.filename}\"",
                "Cache-Control": "public, max-age=3600",
            }
        )

    # Neither S3 nor local file available
    raise HTTPException(
        status_code=404,
        detail="PDF file not available. The file may have been removed during a server restart. Please re-upload the document."
    )
