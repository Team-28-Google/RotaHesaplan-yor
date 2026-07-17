-- ============================================================
-- SANA — 0025_client_errors.sql  (5.5-B: test aşaması hata görünürlüğü)
-- Testçi telefonundaki JS hataları buraya düşer — Supabase Table Editor'den izlenir.
-- Sentry DEĞİL: native modül Expo Go'da yok; tam Sentry store yayınında (6.1) gelecek.
-- İstemci YALNIZ YAZAR (insert); okuma politikası yok → kimse başkasının hatasını göremez.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create table if not exists public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  message     text not null,
  stack       text,
  screen      text,                      -- bağlam/ekran ("global" = yakalanmamış)
  fatal       boolean default false,
  platform    text,                      -- "android 34" / "ios 17.5"
  app_version text,                      -- EAS update id ("dev" = Metro)
  created_at  timestamptz default now()
);
create index if not exists client_errors_time_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Giriş öncesi hatalar da (auth/onboarding) kaydolabilsin diye anon dahil.
-- Test aşaması pragmatizmi: anon anahtar publiktir, çöp insert teorik risk —
-- store yayınında Sentry'ye geçilince bu tablo emekliye ayrılır.
create policy "client_errors_insert_any"
  on public.client_errors for insert
  to anon, authenticated
  with check (true);
-- SELECT politikası bilinçli YOK: yalnız Dashboard/service role okur.
