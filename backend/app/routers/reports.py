"""Full analysis report API routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.report_generator import report_generator
from app.models.document import Document, ProcessingStatus
from app.models.report import (
    Report,
    ReportStatus,
    ReportResponse,
    ReportSummary,
    ReportGenerateRequest,
    ReportStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def run_report_generation_background(document_id: int, model: str):
    """Background task to generate full analysis report."""
    from app.services.database import async_session

    async with async_session() as db:
        try:
            await report_generator.generate_full_report(db, document_id, model)
        except Exception as e:
            logger.error(f"Report generation failed for document {document_id}: {e}")


@router.post("/{document_id}/generate", response_model=ReportSummary)
async def generate_report(
    document_id: int,
    background_tasks: BackgroundTasks,
    request: ReportGenerateRequest = ReportGenerateRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Start full analysis report generation for a document.
    
    The report generation runs in the background. Poll the status endpoint to check progress.
    This generates a comprehensive analysis including:
    - Financial metrics tables
    - Segment analysis
    - Cash flow summary
    - Management highlights
    - Earnings quality & red flags analysis
    - Exceptional items breakdown
    """
    # Check document exists and is processed
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.status != ProcessingStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Document must be processed before report generation. Current status: {document.status}",
        )

    # Check if report already in progress (auto-recover from stuck reports after 30s)
    from datetime import datetime, timedelta
    thirty_seconds_ago = datetime.utcnow() - timedelta(seconds=30)
    
    existing_result = await db.execute(
        select(Report)
        .where(Report.document_id == document_id)
        .where(Report.status.in_([ReportStatus.PENDING.value, ReportStatus.PROCESSING.value]))
    )
    existing_report = existing_result.scalar_one_or_none()
    
    if existing_report:
        # If stuck for > 30 seconds (likely interrupted by server restart), mark as failed and proceed
        if existing_report.created_at < thirty_seconds_ago:
            existing_report.status = ReportStatus.FAILED.value
            existing_report.error_message = "Generation interrupted (server restart or timeout)"
            await db.commit()
            logger.info(f"Auto-recovered stuck report {existing_report.id}, proceeding with new generation")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Report generation in progress (started {(datetime.utcnow() - existing_report.created_at).seconds}s ago). Wait 30s and retry.",
            )

    # Create pending report record
    report = Report(
        document_id=document_id,
        company_name=document.company_name,
        reporting_period=document.reporting_period,
        status=ReportStatus.PENDING.value,
        model_used=request.model,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Start background report generation
    background_tasks.add_task(run_report_generation_background, document_id, request.model)

    return ReportSummary(
        id=report.id,
        document_id=report.document_id,
        company_name=report.company_name,
        reporting_period=report.reporting_period,
        status=report.status,
        model_used=report.model_used,
        processing_time_seconds=None,
        created_at=report.created_at,
        completed_at=None,
    )


@router.get("/{document_id}/latest", response_model=ReportResponse)
async def get_latest_report(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest report for a document."""
    report = await report_generator.get_latest_report(db, document_id)

    if not report:
        raise HTTPException(
            status_code=404,
            detail="No report found for this document",
        )

    return ReportResponse.model_validate(report)


@router.get("/detail/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a report by ID."""
    report = await report_generator.get_report(db, report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse.model_validate(report)


@router.get("/{document_id}/status", response_model=ReportStatusResponse)
async def get_report_status(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the status of the latest report generation for a document."""
    report = await report_generator.get_latest_report(db, document_id)

    if not report:
        raise HTTPException(
            status_code=404,
            detail="No report found for this document",
        )

    return ReportStatusResponse(
        id=report.id,
        status=report.status,
        processing_time_seconds=report.processing_time_seconds,
        error_message=report.error_message,
    )


@router.get("/{document_id}/all", response_model=list[ReportSummary])
async def get_all_reports(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all reports for a document."""
    reports = await report_generator.get_reports_for_document(db, document_id)
    
    return [
        ReportSummary(
            id=r.id,
            document_id=r.document_id,
            company_name=r.company_name,
            reporting_period=r.reporting_period,
            status=r.status,
            model_used=r.model_used,
            processing_time_seconds=r.processing_time_seconds,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r in reports
    ]


@router.delete("/{document_id}/all")
async def delete_all_reports(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete all reports for a document (use before generating fresh report)."""
    # Get all reports for document
    result = await db.execute(
        select(Report).where(Report.document_id == document_id)
    )
    reports = result.scalars().all()
    
    count = len(reports)
    
    # Delete all
    for report in reports:
        await db.delete(report)
    
    await db.commit()
    
    logger.info(f"Deleted {count} report(s) for document {document_id}")
    
    return {"deleted": count, "message": f"Deleted {count} report(s)"}
