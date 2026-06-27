-- ============================================================
-- SANA — 0001_schema.sql
-- Çekirdek şema: profiller, rotalar, waypoint'ler, flood yorumları,
-- AI hafıza embedding'leri (pgvector) + semantik arama RPC'si.
-- Supabase SQL editöründe çalıştırın.
-- ============================================================

-- pgvector eklentisi
create extension if not exists vector;

-- ------------------------------------------------------------
-- 1) PROFILES (auth.users'ı genişletir)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  bio         text,
  home_city   text,
  onboarding  jsonb default '{}'::jsonb,   -- ham onboarding yanıtları
  created_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- 2) ROUTES (paylaşılan "flood"/rota)
-- ------------------------------------------------------------
create table if not exists public.routes (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references public.profiles(id) on delete cascade,
  title              text not null,
  description        text,
  city               text not null,
  vibe_tags          text[] default '{}',                       -- {sakin, kafa-dinleme, butce-dostu}
  budget_level       int check (budget_level between 1 and 4),   -- waypoint price_level'dan türetilir
  weather_fit        text check (weather_fit in ('indoor','outdoor','any')) default 'any',
  cover_photo_url    text,
  total_distance_m   int,
  total_duration_min int,
  is_seed            boolean default false,                      -- tohum/demo rota işareti
  like_count         int default 0,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists routes_city_idx   on public.routes (city);
create index if not exists routes_budget_idx on public.routes (budget_level);

-- ------------------------------------------------------------
-- 3) WAYPOINTS (rota noktaları — sıralı)
-- ------------------------------------------------------------
create table if not exists public.waypoints (
  id            uuid primary key default gen_random_uuid(),
  route_id      uuid not null references public.routes(id) on delete cascade,
  seq           int not null,                       -- rotadaki sıra (0,1,2,...)
  name          text not null,
  place_id      text,                               -- Google Places place_id
  lat           double precision not null,
  lng           double precision not null,
  category      text,                               -- cafe, bookstore, park...
  price_level   int check (price_level between 0 and 4),
  opening_hours jsonb,
  note          text,                               -- yazarın kişisel notu
  photo_urls    text[] default '{}',
  arrival_time  time,
  created_at    timestamptz default now(),
  unique (route_id, seq)
);
create index if not exists waypoints_route_idx on public.waypoints (route_id);

-- ------------------------------------------------------------
-- 4) FLOOD_COMMENTS (Proof of Experience)
-- ------------------------------------------------------------
create table if not exists public.flood_comments (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references public.routes(id) on delete cascade,
  waypoint_id uuid references public.waypoints(id) on delete cascade,  -- null = tüm rotaya
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text,
  photo_urls  text[] default '{}',
  rating      int check (rating between 1 and 5),
  created_at  timestamptz default now()
);
create index if not exists flood_comments_route_idx on public.flood_comments (route_id);

-- ------------------------------------------------------------
-- 5) AI_MEMORY_EMBEDDINGS (pgvector — hafıza)
-- NOT: vector(1024) = NVIDIA nv-embedqa-e5-v5. Gemini text-embedding-004
-- kullanırsanız 768'e çevirin (EMBED_DIM ile tutarlı olmalı).
-- ------------------------------------------------------------
create table if not exists public.ai_memory_embeddings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles(id) on delete cascade,  -- onboarding/preference için
  route_id     uuid references public.routes(id) on delete cascade,    -- rota embedding'i için
  source_type  text not null check (source_type in
                 ('onboarding','route','comment','preference_update')),
  content      text not null,                 -- embed edilen ham metin
  embedding    vector(1024) not null,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
-- Semantik arama indeksi (cosine)
create index if not exists ai_memory_embeddings_vec_idx
  on public.ai_memory_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- RPC: rota semantik arama (Social Memory Agent buradan çeker)
-- ------------------------------------------------------------
create or replace function public.match_routes(
  query_embedding vector(1024),
  match_count int default 5,
  filter_city text default null,
  max_budget int default 4
) returns table (route_id uuid, content text, similarity float)
language sql stable as $$
  select e.route_id, e.content,
         1 - (e.embedding <=> query_embedding) as similarity
  from public.ai_memory_embeddings e
  join public.routes r on r.id = e.route_id
  where e.source_type = 'route'
    and (filter_city is null or r.city = filter_city)
    and r.budget_level <= max_budget
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- ------------------------------------------------------------
-- updated_at otomatik güncelleme (routes)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();
