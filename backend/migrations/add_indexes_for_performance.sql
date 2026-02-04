-- Performance optimization indexes for EquityLens
-- Run this script to add indexes to speed up chat queries

-- Add index on chat_sessions.document_id for faster document session lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_document_id ON chat_sessions(document_id);

-- Add index on chat_sessions.created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

-- Add index on chat_sessions.updated_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);

-- Add index on chat_messages.session_id for faster message lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- Add index on chat_messages.created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Verify indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('chat_sessions', 'chat_messages')
ORDER BY tablename, indexname;
