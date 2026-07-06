-- ============================================================
-- SANA — 0007_journeys.sql  (3.4 Journey log → Supabase + 3.5 liderlik)
-- Tamamlanan yolculuklar cihaz yerine buluta yazılır (çok cihaz + liderlik).
-- Uygula: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- ============================================================

create table if not exists public.journeys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  route_id     uuid references public.routes(id) on delete set null,
  title        text not null,
  city         text,
  distance_m   int not null default 0,
  duration_min int not null default 0,
  stops        int not null default 0,
  created_at   timestamptz default now()
);
create index if not exists journeys_user_idx on public.journeys (user_id, created_at desc);
create index if not exists journeys_created_idx on public.journeys (created_at);

alter table public.journeys enable row level security;

create policy "journeys_select_own"
  on public.journeys for select
  using (auth.uid() = user_id);

create policy "journeys_insert_own"
  on public.journeys for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Haftalık liderlik (3.5): ham journey satırı sızdırmaz — yalnızca
-- toplulaştırılmış ilk 10. View sahibi (postgres) yetkisiyle çalıştığı
-- için RLS'e takılmadan aggregate okur; bilinçli tasarım.
-- ------------------------------------------------------------
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
  group by j.user_id, p.username, p.avatar_url
  order by total_distance_m desc
  limit 10;

grant select on public.weekly_leaderboard to anon, authenticated;
