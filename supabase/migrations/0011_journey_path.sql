-- ============================================================
-- SANA — 0011_journey_path.sql  (4.2 gerçek iz kaydı)
-- Yolculuk sırasında kaydedilen GPS izi ([{lat,lng}, ...], ≤200 nokta).
-- Paylaşım kartındaki "👣 Yürüdüğüm iz" seçeneğini besler (3.1b).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

alter table public.journeys
  add column if not exists path jsonb;
