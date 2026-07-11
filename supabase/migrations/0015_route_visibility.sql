-- ============================================================
-- SANA — 0015_route_visibility.sql  (3.13 fork & yayınlama modeli)
-- Yeni kural: kullanıcının oluşturduğu/kopyaladığı rota ÖZEL başlar
-- ("Rotalarım"da yalnız kendisi görür); "🌍 Rotanı paylaş" deyince
-- herkese açılır. Mevcut rotalar public kalır (sürpriz yok).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

alter table public.routes
  add column if not exists is_public boolean not null default true;

-- Rota görünürlüğü: herkese açık VEYA sahibi VEYA collaborator
drop policy if exists "routes_select_all" on public.routes;
create policy "routes_select_visible"
  on public.routes for select
  using (
    is_public
    or author_id = auth.uid()
    or exists (select 1 from public.route_collaborators c
               where c.route_id = routes.id and c.user_id = auth.uid())
  );

-- Duraklar rotanın görünürlüğünü izler (özel rotanın durakları da sızmasın)
drop policy if exists "waypoints_select_all" on public.waypoints;
create policy "waypoints_select_visible"
  on public.waypoints for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = waypoints.route_id
        and (r.is_public
             or r.author_id = auth.uid()
             or exists (select 1 from public.route_collaborators c
                        where c.route_id = r.id and c.user_id = auth.uid()))
    )
  );
