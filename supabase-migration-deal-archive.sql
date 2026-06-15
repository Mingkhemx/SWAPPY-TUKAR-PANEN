-- ============================================================
-- MIGRATION: Deal Card + Archive Feature (Idempotent)
-- Jalankan SQL ini di Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → paste → Run
-- Bisa di-run berulang kali tanpa error
-- ============================================================

-- 1. Buat tabel deal_proposals (IF NOT EXISTS = aman)
CREATE TABLE IF NOT EXISTS public.deal_proposals (
  id                  BIGSERIAL   PRIMARY KEY,
  conversation_id     BIGINT      NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  proposer_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected')),
  offered_commodity   TEXT,
  offered_quantity    TEXT,
  wanted_commodity    TEXT,
  wanted_quantity     TEXT,
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambah kolom deal_proposal_id ke messages (cek dulu baru tambah)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'deal_proposal_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN deal_proposal_id BIGINT REFERENCES public.deal_proposals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Tambah tipe 'deal' ke CHECK constraint messages.type
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'deal'));

-- 4. Tambah kolom is_archived ke conversations (cek dulu baru tambah)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 5. Aktifkan RLS untuk deal_proposals
ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies (DROP dulu baru CREATE = aman di-run ulang)
DROP POLICY IF EXISTS "deal_proposals: peserta bisa baca" ON public.deal_proposals;
CREATE POLICY "deal_proposals: peserta bisa baca"
  ON public.deal_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = deal_proposals.conversation_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deal_proposals: peserta bisa buat" ON public.deal_proposals;
CREATE POLICY "deal_proposals: peserta bisa buat"
  ON public.deal_proposals FOR INSERT
  WITH CHECK (
    auth.uid() = proposer_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = deal_proposals.conversation_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deal_proposals: peserta bisa update" ON public.deal_proposals;
CREATE POLICY "deal_proposals: peserta bisa update"
  ON public.deal_proposals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = deal_proposals.conversation_id
        AND user_id = auth.uid()
    )
  );

-- 7. Realtime untuk deal_proposals
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_proposals;

-- 8. Index untuk performa (IF NOT EXISTS = aman)
CREATE INDEX IF NOT EXISTS idx_deal_proposals_conv_id ON public.deal_proposals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_status ON public.deal_proposals(status);
CREATE INDEX IF NOT EXISTS idx_messages_deal_proposal_id ON public.messages(deal_proposal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON public.conversations(is_archived);
