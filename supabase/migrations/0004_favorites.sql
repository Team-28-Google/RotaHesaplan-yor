-- ============================================================
-- SANA — 0004_favorites.sql
-- Favori = Kaydet (tek aksiyon). Favori eklenince routes.like_count otomatik artar.
-- 0001-0003'ten SONRA çalıştırın.
-- ============================================================

create table if not exists public.route_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  route_id   uuid not null references public.routes(id)   on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, route_id)      -- aynı rotayı 2 kez favorileyemez
);
create index if not exists route_favorites_route_idx on public.route_favorites (route_id);

-- ------------------------------------------------------------
-- like_count senkronu (favori ekle/sil → sayaç güncelle)
-- ------------------------------------------------------------
create or replace function public.bump_like_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.routes set like_count = like_count + 1 where id = new.route_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.routes set like_count = greatest(like_count - 1, 0) where id = old.route_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists route_favorites_count on public.route_favorites;
create trigger route_favorites_count
  after insert or delete on public.route_favorites
  for each row execute function public.bump_like_count();

-- ------------------------------------------------------------
-- RLS: herkes SADECE kendi favorilerini görür/yönetir
-- (rotaların public like_count'u routes.select_all ile zaten görünür)
-- ------------------------------------------------------------
alter table public.route_favorites enable row level security;

create policy "route_favorites_select_own"
  on public.route_favorites for select
  using (auth.uid() = user_id);

create policy "route_favorites_insert_own"
  on public.route_favorites for insert
  with check (auth.uid() = user_id);

create policy "route_favorites_delete_own"
  on public.route_favorites for delete
  using (auth.uid() = user_id);
