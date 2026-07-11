-- ============================================================
-- SANA — 0012_collaborators.sql  (3.7 ortak rota düzenleme)
-- Rota sahibi davet linki üretir (gizli token); linke tıklayan kullanıcı
-- collaborator olur ve rotanın DURAKLARINI düzenleyebilir (ekle/çıkar).
-- Rota metadata'sı (başlık/silme) sahibinde kalır.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

-- 1) Davet token'ları — routes'tan AYRI tabloda (routes select_all olduğu için
--    token'ı orada tutmak herkese sızdırırdı; burada yalnız sahibi okur/üretir).
create table if not exists public.route_share_tokens (
  route_id   uuid primary key references public.routes(id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz default now()
);
alter table public.route_share_tokens enable row level security;

create policy "share_tokens_owner_select"
  on public.route_share_tokens for select
  using (exists (select 1 from public.routes r
                 where r.id = route_share_tokens.route_id and r.author_id = auth.uid()));

create policy "share_tokens_owner_insert"
  on public.route_share_tokens for insert
  with check (exists (select 1 from public.routes r
                      where r.id = route_share_tokens.route_id and r.author_id = auth.uid()));

-- 2) Collaborator'lar
create table if not exists public.route_collaborators (
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (route_id, user_id)
);
alter table public.route_collaborators enable row level security;

-- Kendi collaborator kayıtlarını görebilir (app "düzenleyebilir miyim?" diye bakar)
create policy "collab_select_own"
  on public.route_collaborators for select
  using (auth.uid() = user_id);

-- Ekleme YALNIZ join_route RPC'siyle (security definer) — doğrudan insert yok.

-- 3) Linke tıklayanı collaborator yapan RPC: token doğruysa route_id döner.
create or replace function public.join_route(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route uuid;
begin
  if auth.uid() is null then
    return null; -- giriş yapmamış
  end if;
  select route_id into v_route from route_share_tokens where token = p_token;
  if v_route is null then
    return null; -- geçersiz token
  end if;
  insert into route_collaborators (route_id, user_id)
  values (v_route, auth.uid())
  on conflict do nothing;
  return v_route;
end;
$$;
grant execute on function public.join_route(uuid) to authenticated;

-- 4) Waypoint yazma hakkı: sahibi VEYA collaborator
drop policy if exists "waypoints_write_route_owner" on public.waypoints;
create policy "waypoints_write_owner_or_collab"
  on public.waypoints for all
  using (
    exists (
      select 1 from public.routes r
      where r.id = waypoints.route_id
        and (r.author_id = auth.uid()
             or exists (select 1 from public.route_collaborators c
                        where c.route_id = r.id and c.user_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = waypoints.route_id
        and (r.author_id = auth.uid()
             or exists (select 1 from public.route_collaborators c
                        where c.route_id = r.id and c.user_id = auth.uid()))
    )
  );
