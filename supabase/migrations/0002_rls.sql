-- ============================================================
-- SANA — 0002_rls.sql
-- Row Level Security (RLS) politikaları.
-- Kural özeti:
--   profiles        → SELECT herkes, INSERT/UPDATE sadece kendi
--   routes          → SELECT herkes, yazma sadece author
--   waypoints       → SELECT herkes, yazma sadece rota sahibi
--   flood_comments  → SELECT herkes, yazma sadece author
--   ai_memory_*     → SELECT/yazma: service_role (AI servisi); onboarding satırı sahibi okuyabilir
-- Not: service_role anahtarı RLS'i bypass eder; aşağıdaki policy'ler anon/auth içindir.
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.routes              enable row level security;
alter table public.waypoints           enable row level security;
alter table public.flood_comments      enable row level security;
alter table public.ai_memory_embeddings enable row level security;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- ROUTES
-- ------------------------------------------------------------
create policy "routes_select_all"
  on public.routes for select
  using (true);

create policy "routes_insert_own"
  on public.routes for insert
  with check (auth.uid() = author_id);

create policy "routes_update_own"
  on public.routes for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "routes_delete_own"
  on public.routes for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- WAYPOINTS (yazma yetkisi: ilgili rotanın sahibi)
-- ------------------------------------------------------------
create policy "waypoints_select_all"
  on public.waypoints for select
  using (true);

create policy "waypoints_write_route_owner"
  on public.waypoints for all
  using (
    exists (
      select 1 from public.routes r
      where r.id = waypoints.route_id and r.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = waypoints.route_id and r.author_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- FLOOD_COMMENTS
-- ------------------------------------------------------------
create policy "flood_comments_select_all"
  on public.flood_comments for select
  using (true);

create policy "flood_comments_insert_own"
  on public.flood_comments for insert
  with check (auth.uid() = author_id);

create policy "flood_comments_update_own"
  on public.flood_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "flood_comments_delete_own"
  on public.flood_comments for delete
  using (auth.uid() = author_id);

-- ------------------------------------------------------------
-- AI_MEMORY_EMBEDDINGS
-- Yazma işlemleri AI servisi (service_role) üzerinden yapılır → RLS bypass.
-- Son kullanıcıya yalnızca kendi onboarding/preference hafızasını okuma izni.
-- ------------------------------------------------------------
create policy "ai_memory_select_own"
  on public.ai_memory_embeddings for select
  using (auth.uid() = owner_id);
