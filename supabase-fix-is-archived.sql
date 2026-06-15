-- ============================================================
-- FIX: Tambah kolom is_archived ke conversations
-- Copy PASTE ini saja ke Supabase SQL Editor lalu klik Run
-- ============================================================

-- Tambah kolom is_archived
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Buat index
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON public.conversations(is_archived);
