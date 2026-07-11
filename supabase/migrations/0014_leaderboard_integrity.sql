-- ============================================================
-- SANA — 0014_leaderboard_integrity.sql  (3.11 hile koruması + 3.12 yazar liderliği)
-- 1) Yolculuk ancak duraklarda GERÇEKTEN bulunulduysa (GPS varış tespiti,
--    durakların en az yarısı) "doğrulanmış" sayılır; haftalık liderliğe
--    yalnız doğrulanmış yolculuklar girer.
-- 2) "En çok beğenilen rota yazarları" liderliği (rotalarının toplam ❤️'si).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

alter table public.journeys
  add column if not exists verified boolean not null default false;

-- Haftalık gezgin liderliği: yalnız DOĞRULANMIŞ yolculuklar (hile koruması)
create or replace view public.weekly_leaderboard as
  select
    j.user_id,
    coalesce(p.username, 'gezgin')  as username,
    p.avatar_url,
    count(*)::int                   as journey_count,
    coalesce(sum(j.distance_m), 0)::int as total_distance_m
  from public.journeys j
  left join public.profiles p on p.id = j.user_id
  where j.created_at >= now() - interval '7 days'
    and j.verified = true
  group by j.user_id, p.username, p.avatar_url
  order by total_distance_m desc
  limit 10;

-- Rota yazarı liderliği: kullanıcı rotalarının toplam beğenisi (seed'ler hariç)
create or replace view public.author_likes_leaderboard as
  select
    r.author_id                     as user_id,
    coalesce(p.username, 'gezgin')  as username,
    p.avatar_url,
    coalesce(sum(r.like_count), 0)::int as total_likes,
    count(*)::int                   as route_count
  from public.routes r
  left join public.profiles p on p.id = r.author_id
  where r.is_seed = false
  group by r.author_id, p.username, p.avatar_url
  having coalesce(sum(r.like_count), 0) > 0
  order by total_likes desc
  limit 10;

grant select on public.author_likes_leaderboard to anon, authenticated;
