-- ============================================================
-- SANA — 0010_profile_details.sql  (5.1 kayıt alanları)
-- Kayıt olurken opsiyonel doğum tarihi + cinsiyet (profil zenginliği;
-- ileride yaş/cinsiyete göre öneri kişiselleştirmesine zemin).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender text
    check (gender in ('kadin', 'erkek', 'belirtmedi'));
