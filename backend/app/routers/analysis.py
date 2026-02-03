"""Analysis and POI extraction API routes."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.database import get_db
from app.services.poi_extractor import poi_extractor
from app.models.document import Document, ProcessingStatus
from app.models.analysis import (
    Analysis,
    PointOfInterest,
    AnalysisResponse,
    AnalysisSummary,
    POIResponse,
    POIsByCategory,
    POICategory,
)

router = APIRouter()


async def run_analysis_background(document_id: int, model: str):
    """Background task to run POI extraction."""
    from app.services.database import async_session

    async with async_session() as db:
        try:
            await poi_extractor.extract_pois(db, document_id, model)
        except Exception as e:
            # Log error - analysis record will be marked as failed
            import logging
            logging.error(f"Analysis failed for document {document_id}: {e}")


@router.post("/{document_id}/analyze", response_model=AnalysisSummary)
async def start_analysis(
    document_id: int,
    background_tasks: BackgroundTasks,
    model: str = "llama-4",
    db: AsyncSession = Depends(get_db),
):
    """
    Start POI extraction analysis for a document.

    The analysis runs in the background. Poll the status endpoint to check progress.
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
            detail=f"Document must be processed before analysis. Current status: {document.status}",
        )

    # Check if analysis already exists
    existing = await db.execute(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .where(Analysis.status.in_(["pending", "processing"]))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Analysis already in progress for this document",
        )

    # Create pending analysis record
    analysis = Analysis(
        document_id=document_id,
        status="pending",
        model_used=model,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # Start background analysis
    background_tasks.add_task(run_analysis_background, document_id, model)

    return AnalysisSummary(
        id=analysis.id,
        document_id=analysis.document_id,
        status=analysis.status,
        poi_count=0,
        created_at=analysis.created_at,
    )


@router.get("/{document_id}/latest", response_model=AnalysisResponse)
async def get_latest_analysis(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest analysis for a document."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No analysis found for this document",
        )

    # Get POIs
    poi_result = await db.execute(
        select(PointOfInterest)
        .where(PointOfInterest.analysis_id == analysis.id)
    )
    pois = poi_result.scalars().all()

    return AnalysisResponse(
        id=analysis.id,
        document_id=analysis.document_id,
        status=analysis.status,
        summary=analysis.summary,
        model_used=analysis.model_used,
        processing_time_seconds=analysis.processing_time_seconds,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        pois=[POIResponse.model_validate(p) for p in pois],
    )


@router.get("/detail/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get an analysis by ID."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get POIs
    poi_result = await db.execute(
        select(PointOfInterest)
        .where(PointOfInterest.analysis_id == analysis.id)
    )
    pois = poi_result.scalars().all()

    return AnalysisResponse(
        id=analysis.id,
        document_id=analysis.document_id,
        status=analysis.status,
        summary=analysis.summary,
        model_used=analysis.model_used,
        processing_time_seconds=analysis.processing_time_seconds,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        pois=[POIResponse.model_validate(p) for p in pois],
    )


@router.get("/{document_id}/pois", response_model=List[POIsByCategory])
async def get_pois_by_category(
    document_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get POIs grouped by category for a document."""
    # Get latest analysis
    result = await db.execute(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .where(Analysis.status == "completed")
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No completed analysis found for this document",
        )

    # Get POIs
    poi_result = await db.execute(
        select(PointOfInterest)
        .where(PointOfInterest.analysis_id == analysis.id)
    )
    pois = poi_result.scalars().all()

    # Group by category
    category_display = {
        POICategory.FINANCIAL_METRICS.value: "Financial Metrics",
        POICategory.SEGMENT_ANALYSIS.value: "Segment Analysis",
        POICategory.CASH_FLOW.value: "Cash Flow",
        POICategory.EARNINGS_QUALITY.value: "Earnings Quality",
        POICategory.MANAGEMENT_COMMENTARY.value: "Management Commentary",
    }

    grouped = {}
    for poi in pois:
        category = poi.category
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(POIResponse.model_validate(poi))

    # Convert to list
    result_list = []
    for category, category_pois in grouped.items():
        result_list.append(POIsByCategory(
            category=category,
            category_display=category_display.get(category, category.replace("_", " ").title()),
            pois=category_pois,
        ))

    return result_list


@router.get("/status/{analysis_id}")
async def get_analysis_status(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get analysis processing status."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Count POIs
    poi_result = await db.execute(
        select(PointOfInterest)
        .where(PointOfInterest.analysis_id == analysis.id)
    )
    pois = poi_result.scalars().all()

    # Human-readable message for incremental UX
    if analysis.status == "processing" or analysis.status == "pending":
        message = "Extracting key points and generating summary…"
    elif analysis.status == "completed":
        message = "Complete"
    elif analysis.status == "failed":
        message = "Failed"
    else:
        message = analysis.status

    return {
        "id": analysis.id,
        "status": analysis.status,
        "message": message,
        "poi_count": len(pois),
        "processing_time_seconds": analysis.processing_time_seconds,
        "completed_at": analysis.completed_at,
    }
