-- ============================================================
-- SWAPPY - Enable Realtime for Stats Dashboard
-- Tambahkan tabel barters & users ke supabase_realtime
-- agar statistik di halaman utama bisa update realtime.
-- ============================================================

-- Tambahkan tabel barters ke realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.barters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
