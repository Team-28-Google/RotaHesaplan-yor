-- ============================================================
-- SANA — 0016_collections.sql  (3.10 ortak koleksiyonlar)
-- Instagram tarzı: arkadaşınla ortak rota koleksiyonu — davet linkiyle
-- katılım (3.7 deseni), üyeler rota ekler/çıkarır, herkes güncel görür.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  emoji      text default '📁',
  created_at timestamptz default now()
);

create table if not exists public.collection_members (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (collection_id, user_id)
);

create table if not exists public.collection_routes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  route_id      uuid not null references public.routes(id) on delete cascade,
  added_by      uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  primary key (collection_id, route_id)
);

create table if not exists public.collection_share_tokens (
  collection_id uuid primary key references public.collections(id) on delete cascade,
  token         uuid not null default gen_random_uuid(),
  created_at    timestamptz default now()
);

-- Üyelik kontrolü — SECURITY DEFINER: RLS içinde kendi tablosuna bakarken
-- sonsuz özyinelemeye düşmemek için (klasik Postgres RLS deseni)
create or replace function public.is_collection_member(cid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from collection_members
                 where collection_id = cid and user_id = auth.uid());
$$;

alter table public.collections            enable row level security;
alter table public.collection_members     enable row level security;
alter table public.collection_routes      enable row level security;
alter table public.collection_share_tokens enable row level security;

-- collections: üyeler görür; oluşturma/silme sahibinde
create policy "collections_select_member"
  on public.collections for select
  using (owner_id = auth.uid() or public.is_collection_member(id));
create policy "collections_insert_own"
  on public.collections for insert
  with check (owner_id = auth.uid());
create policy "collections_delete_own"
  on public.collections for delete
  using (owner_id = auth.uid());

-- members: üyeler üye listesini görür; sahibi KENDİNİ ekler (oluşturma anı);
-- başkaları yalnız join_collection RPC'siyle katılır
create policy "collection_members_select"
  on public.collection_members for select
  using (public.is_collection_member(collection_id));
create policy "collection_members_insert_owner_self"
  on public.collection_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.collections c
                where c.id = collection_id and c.owner_id = auth.uid())
  );

-- routes bağlantıları: üyeler görür/ekler/çıkarır
create policy "collection_routes_select"
  on public.collection_routes for select
  using (public.is_collection_member(collection_id));
create policy "collection_routes_insert_member"
  on public.collection_routes for insert
  with check (public.is_collection_member(collection_id) and added_by = auth.uid());
create policy "collection_routes_delete_member"
  on public.collection_routes for delete
  using (public.is_collection_member(collection_id));

-- token: yalnız sahibi okur/üretir (routes'taki desenle aynı)
create policy "collection_tokens_owner_select"
  on public.collection_share_tokens for select
  using (exists (select 1 from public.collections c
                 where c.id = collection_id and c.owner_id = auth.uid()));
create policy "collection_tokens_owner_insert"
  on public.collection_share_tokens for insert
  with check (exists (select 1 from public.collections c
                      where c.id = collection_id and c.owner_id = auth.uid()));

-- Davet linkiyle katılım: token doğruysa üye yap, collection_id döndür
create or replace function public.join_collection(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  select collection_id into v_col from collection_share_tokens where token = p_token;
  if v_col is null then
    return null;
  end if;
  insert into collection_members (collection_id, user_id)
  values (v_col, auth.uid())
  on conflict do nothing;
  return v_col;
end;
$$;
grant execute on function public.join_collection(uuid) to authenticated;
