"""Document management API routes."""

import os
import shutil
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.document_processor import document_processor
from app.services.vector_store import vector_store
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

# Ensure uploads directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def process_document_background(
    document_id: int,
    file_path: str,
):
    """Background task to process uploaded document."""
    from app.services.database import async_session

    async with async_session() as db:
        try:
            # Get document
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()

            if not document:
                return

            # Update status
            document.status = ProcessingStatus.PROCESSING.value
            await db.commit()

            # Process PDF
            processed = await document_processor.process_pdf(file_path)

            # Update document metadata
            document.page_count = processed["page_count"]

            # Create chunks
            chunks = document_processor.create_chunks(processed["pages"])

            # Add chunks to vector store
            await vector_store.add_chunks(db, document_id, chunks)

            # Update status
            document.status = ProcessingStatus.COMPLETED.value
            document.processed_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            # Mark as failed
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            if document:
                document.status = ProcessingStatus.FAILED.value
                document.error_message = str(e)
                await db.commit()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    company_name: str = Form(...),
    company_ticker: Optional[str] = Form(None),
    document_type: DocumentType = Form(DocumentType.OTHER),
    reporting_period: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document for analysis.

    The document will be processed in the background.
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    max_size = settings.max_file_size_mb * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum of {settings.max_file_size_mb}MB",
        )

    # Save file
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.utcnow().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create document record
    document = Document(
        filename=file.filename,
        company_name=company_name,
        company_ticker=company_ticker,
        document_type=document_type.value,
        reporting_period=reporting_period,
        file_path=file_path,
        file_size_bytes=file_size,
        status=ProcessingStatus.PENDING.value,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Start background processing
    background_tasks.add_task(
        process_document_background,
        document.id,
        file_path,
    )

    return document


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
        documents=[DocumentResponse.model_validate(d) for d in documents],
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

    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and all associated data."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file if exists
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    # Delete document (cascades to chunks, analyses, etc.)
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
