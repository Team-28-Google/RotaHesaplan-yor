-- ============================================================
-- SANA — 0005_transport.sql
-- Ulaşım: bir önceki duraktan BU durağa nasıl gelindiği (vapur, metro, yürüyüş...).
-- Ulaşım iki durak arasındaki bağ olduğu için varış durağına iliştirilir.
-- 0001-0004'ten SONRA çalıştırın.
-- ============================================================

alter table public.waypoints
  add column if not exists transport_mode text default 'walk'
    check (transport_mode in (
      'start','walk','ferry','metro','tram','marmaray',
      'bus','metrobus','funicular','teleferik','minibus','taxi','bike','other'
    )),
  add column if not exists transport_note text;   -- örn. "Karaköy–Kadıköy vapuru ~20 dk", hat: T1

comment on column public.waypoints.transport_mode is
  'Bir önceki duraktan BU durağa ulaşım türü. Rotanın ilk durağı = start.';
comment on column public.waypoints.transport_note is
  'Ulaşım detayı: hat/sefer/süre (örn. "Beşiktaş–Karaköy vapuru ~15 dk").';
