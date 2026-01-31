"""Database connection and session management."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def init_db():
    """Initialize database tables."""
    from sqlalchemy import text
    
    async with engine.begin() as conn:
        # Enable pgvector extension if available
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            pass  # Extension might not be available
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Run migrations for new columns
        # Add document_ids column to chat_sessions if it doesn't exist
        try:
            await conn.execute(text(
                "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS document_ids JSON"
            ))
        except Exception:
            pass  # Column might already exist or table doesn't exist yet


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
