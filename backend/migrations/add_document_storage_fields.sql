-- Migration: Add S3 storage, content hashing, and UUID fields to documents table
-- Run this migration after deploying the updated backend

-- Add UUID column for distributed system compatibility
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) UNIQUE;

-- Add S3 storage key column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);

-- Add content hash column for deduplication
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_s3_key ON documents(s3_key);

-- Backfill UUIDs for existing documents (optional - new uploads will get UUIDs automatically)
-- Uncomment if you want all existing documents to have UUIDs
-- UPDATE documents SET uuid = gen_random_uuid()::text WHERE uuid IS NULL;
