-- ============================================================
-- SWAPPY - TUKAR PANEN
-- Jalankan SQL ini di Supabase SQL Editor (satu kali)
-- Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================


-- ============================================================
-- 1. TABEL USERS (profil publik, terhubung ke auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  location    TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  rating      NUMERIC(3,2) DEFAULT 0,
  total_barters INTEGER   DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Otomatis buat row di public.users saat user baru register
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, location, phone, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'location',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'bio'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Pasang trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. TABEL BARTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.barters (
  id                 BIGSERIAL   PRIMARY KEY,
  user_id            UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  offered_commodity  TEXT        NOT NULL,
  offered_quantity   TEXT        NOT NULL,
  wanted_commodity   TEXT        NOT NULL,
  wanted_quantity    TEXT        NOT NULL,
  category           TEXT        NOT NULL,
  location           TEXT        NOT NULL,
  description        TEXT,
  photo_url          TEXT,
  status             TEXT        NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'negotiating', 'completed', 'cancelled')),
  view_count         INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. TABEL CONVERSATIONS (satu per pasang barter + user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id               BIGSERIAL   PRIMARY KEY,
  barter_id        BIGINT      REFERENCES public.barters(id) ON DELETE SET NULL,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'completed', 'cancelled')),
  is_archived      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 4. TABEL CONVERSATION_PARTICIPANTS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id  BIGINT  NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);


-- ============================================================
-- 5b. TABEL DEAL_PROPOSALS
-- ============================================================
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


-- ============================================================
-- 5c. TABEL MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id               BIGSERIAL   PRIMARY KEY,
  conversation_id  BIGINT      NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content          TEXT        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'text'
                     CHECK (type IN ('text', 'image', 'deal')),
  photo_url        TEXT,
  deal_proposal_id BIGINT      REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Aktifkan RLS di semua tabel
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barters                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_proposals         ENABLE ROW LEVEL SECURITY;


-- ── USERS ───────────────────────────────────────────────────
-- Semua orang bisa lihat profil
CREATE POLICY "users: siapa saja bisa baca"
  ON public.users FOR SELECT USING (true);

-- User hanya bisa update profil sendiri
CREATE POLICY "users: update sendiri"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);


-- ── BARTERS ─────────────────────────────────────────────────
-- Semua orang bisa lihat barter
CREATE POLICY "barters: siapa saja bisa baca"
  ON public.barters FOR SELECT USING (true);

-- Hanya user login yang bisa buat
CREATE POLICY "barters: user login bisa buat"
  ON public.barters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Hanya pemilik yang bisa update/delete
CREATE POLICY "barters: pemilik bisa update"
  ON public.barters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "barters: pemilik bisa delete"
  ON public.barters FOR DELETE
  USING (auth.uid() = user_id);


-- ── CONVERSATIONS ────────────────────────────────────────────
-- Hanya peserta yang bisa lihat percakapan
CREATE POLICY "conversations: peserta bisa baca"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );

-- User login bisa buat percakapan
CREATE POLICY "conversations: user login bisa buat"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Peserta bisa update (misal ubah status)
CREATE POLICY "conversations: peserta bisa update"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );


-- ── CONVERSATION_PARTICIPANTS ────────────────────────────────
CREATE POLICY "conv_participants: peserta bisa baca"
  ON public.conversation_participants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "conv_participants: user login bisa insert"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ── DEAL_PROPOSALS ───────────────────────────────────────────
-- Peserta percakapan bisa lihat deal proposal
CREATE POLICY "deal_proposals: peserta bisa baca"
  ON public.deal_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = deal_proposals.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Peserta percakapan bisa buat deal proposal
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

-- Peserta bisa update status deal (untuk accept/reject)
CREATE POLICY "deal_proposals: peserta bisa update"
  ON public.deal_proposals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = deal_proposals.conversation_id
        AND user_id = auth.uid()
    )
  );


-- ── MESSAGES ────────────────────────────────────────────────
-- Hanya peserta percakapan yang bisa lihat pesan
CREATE POLICY "messages: peserta bisa baca"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Peserta bisa kirim pesan
CREATE POLICY "messages: peserta bisa kirim"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );


-- ============================================================
-- 7. REALTIME (untuk fitur chat live)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_proposals;


-- ============================================================
-- 8. INDEX (performa query)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_barters_user_id      ON public.barters(user_id);
CREATE INDEX IF NOT EXISTS idx_barters_status       ON public.barters(status);
CREATE INDEX IF NOT EXISTS idx_barters_category     ON public.barters(category);
CREATE INDEX IF NOT EXISTS idx_barters_created_at   ON public.barters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_id     ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_conv_id ON public.deal_proposals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_status ON public.deal_proposals(status);
CREATE INDEX IF NOT EXISTS idx_messages_deal_proposal_id ON public.messages(deal_proposal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON public.conversations(is_archived);


-- ============================================================
-- SELESAI! Semua tabel, RLS, trigger, dan index sudah siap.
-- ============================================================
