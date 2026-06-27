-- ============================================================
-- SANA — 0003_waypoint_kind.sql
-- Waypoint türü: gezilecek "deneyim" durakları ile pratik "utility"
-- POI'lerini (ücretsiz WC, dinlenme bankı, çeşme) ayırır.
-- 0001 ve 0002'den SONRA çalıştırın.
-- ============================================================

alter table public.waypoints
  add column if not exists kind text not null default 'experience'
    check (kind in ('experience','utility'));

comment on column public.waypoints.kind is
  'experience = gezilecek/deneyimlenecek durak (tarihi yer, kafe, park...); '
  'utility = pratik yardımcı POI (ücretsiz WC, dinlenme bankı, çeşme)';

-- Önerilen category değerleri (serbest metin; zorunlu değil, tutarlılık için rehber):
--   experience: historical_site, museum, mosque, church, park, viewpoint,
--               cafe, restaurant, street_food, bookstore, gallery, bazaar, waterfront
--   utility:    public_toilet, rest_area, water_fountain
-- Ücretsiz/halka açık bilgisi waypoints.metadata veya note alanında tutulur
-- (örn. metadata = {"is_free": true}).

create index if not exists waypoints_kind_idx on public.waypoints (kind);

-- Utility POI'lerin metadata'sı için (is_free vb.) — opsiyonel alan, ileride kullanılabilir
alter table public.waypoints
  add column if not exists metadata jsonb default '{}'::jsonb;
