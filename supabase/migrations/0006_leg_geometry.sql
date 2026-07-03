-- 0006: Yürüme bacağı geometrisi (Google Routes API — yazım anında hesaplanır)
-- leg_* alanları, waypoint'e BİR ÖNCEKİ deneyim durağından gelen bacağı tanımlar.
-- leg_geometry: [{"lat": 41.0, "lng": 28.9}, ...] sokak takip eden nokta dizisi.

alter table public.waypoints
  add column if not exists leg_geometry    jsonb,
  add column if not exists leg_distance_m  int,
  add column if not exists leg_duration_min int;

comment on column public.waypoints.leg_geometry is
  'Önceki duraktan bu durağa yürüme geometrisi (Google Routes, [{lat,lng}...]); null = kuş uçuşu çiz';
