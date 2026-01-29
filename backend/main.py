"""
EquityLens Backend - FastAPI Application
AI-powered earnings report analysis tool
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import documents, analysis, chat
from app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


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
