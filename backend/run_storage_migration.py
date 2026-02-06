"""Run migration to add storage-related columns to documents table."""

import asyncio
from sqlalchemy import text
from app.services.database import engine


async def migrate():
    """Add new columns for S3 storage, content hashing, and UUID."""
    async with engine.begin() as conn:
        # Add UUID column
        await conn.execute(text(
            'ALTER TABLE documents ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) UNIQUE'
        ))
        print('Added uuid column')
        
        # Add S3 key column
        await conn.execute(text(
            'ALTER TABLE documents ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500)'
        ))
        print('Added s3_key column')
        
        # Add content hash column
        await conn.execute(text(
            'ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)'
        ))
        print('Added content_hash column')
        
        # Create indexes
        await conn.execute(text(
            'CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid)'
        ))
        await conn.execute(text(
            'CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash)'
        ))
        print('Created indexes')
        
    print('Migration completed successfully!')


if __name__ == '__main__':
    asyncio.run(migrate())
