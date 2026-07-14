-- ============================================================
-- SANA — 0018_leaderboard_functions.sql  (Security Advisor: definer view uyarısı)
-- SORUN: weekly_leaderboard ve author_likes_leaderboard VIEW'ları sahibinin
-- yetkisiyle çalışıyordu (SECURITY DEFINER davranışı) → Supabase Advisor CRITICAL.
-- ÇÖZÜM: aynı toplulaştırılmış çıktıyı veren KONTROLLÜ security-definer
-- FONKSİYONLAR (search_path sabit, yalnız aggregate döner); view'lar kaldırılır.
-- BONUS: yazar liderliği artık yalnız HERKESE AÇIK rotaların beğenisini sayar.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run (0017'den sonra).
-- ============================================================

drop view if exists public.weekly_leaderboard;
drop view if exists public.author_likes_leaderboard;

-- Haftalık gezgin liderliği: son 7 gün, yalnız DOĞRULANMIŞ yolculuklar, ilk 10.
-- Ham journey satırı sızdırmaz — yalnız toplamlar + kamusal profil alanları.
create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, avatar_url text,
               journey_count int, total_distance_m int)
language sql
security definer
set search_path = public
stable
as $$
  select
    j.user_id,
    coalesce(p.username, 'gezgin'),
    p.avatar_url,
    count(*)::int,
    coalesce(sum(j.distance_m), 0)::int
  from journeys j
  left join profiles p on p.id = j.user_id
  where j.created_at >= now() - interval '7 days'
    and j.verified = true
  group by j.user_id, p.username, p.avatar_url
  order by coalesce(sum(j.distance_m), 0) desc
  limit 10;
$$;
grant execute on function public.weekly_leaderboard() to anon, authenticated;

-- En beğenilen rota yazarları: yalnız HERKESE AÇIK, seed olmayan rotalar.
create or replace function public.author_likes_leaderboard()
returns table (user_id uuid, username text, avatar_url text,
               total_likes int, route_count int)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.author_id,
    coalesce(p.username, 'gezgin'),
    p.avatar_url,
    coalesce(sum(r.like_count), 0)::int,
    count(*)::int
  from routes r
  left join profiles p on p.id = r.author_id
  where r.is_seed = false
    and r.is_public = true
  group by r.author_id, p.username, p.avatar_url
  having coalesce(sum(r.like_count), 0) > 0
  order by coalesce(sum(r.like_count), 0) desc
  limit 10;
$$;
grant execute on function public.author_likes_leaderboard() to anon, authenticated;
