"""
EquityLens Backend - FastAPI Application
AI-powered earnings report analysis tool
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import documents, analysis, chat, reports
from app.services.database import init_db

# Configure logging to console so diagnostic logs show in terminal
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)


async def requeue_pending_documents():
    """Requeue any documents that were pending/processing when server restarted."""
    from sqlalchemy import select
    from app.services.database import async_session
    from app.services.processing_queue import processing_queue
    from app.models.document import Document, ProcessingStatus
    
    try:
        async with async_session() as db:
            # Find documents that are pending or processing (stuck from previous run)
            result = await db.execute(
                select(Document).where(
                    Document.status.in_([
                        ProcessingStatus.PENDING.value,
                        ProcessingStatus.PROCESSING.value,
                    ])
                ).order_by(Document.created_at)
            )
            stuck_docs = result.scalars().all()
            
            if stuck_docs:
                logger.info(f"Found {len(stuck_docs)} documents to requeue on startup")
                
                for doc in stuck_docs:
                    if doc.file_path:
                        # Reset status to pending
                        doc.status = ProcessingStatus.PENDING.value
                        await db.commit()
                        
                        # Add to queue
                        await processing_queue.add_document(doc.id, doc.file_path)
                        logger.info(f"Requeued document {doc.id}: {doc.filename}")
                
            else:
                logger.info("No pending documents to requeue on startup")
                
    except Exception as e:
        logger.error(f"Error requeuing pending documents: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await init_db()
    
    # Requeue any stuck documents after a short delay
    # (allow time for database connection to stabilize)
    asyncio.create_task(delayed_requeue())
    
    yield
    # Shutdown
    pass


async def delayed_requeue():
    """Delay requeue slightly to ensure database is ready."""
    await asyncio.sleep(2)
    await requeue_pending_documents()


app = FastAPI(
    title="EquityLens API",
    description="AI-powered earnings report analysis tool for equity analysts",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "EquityLens API",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "ai_service": "configured",
    }
