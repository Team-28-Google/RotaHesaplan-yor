-- ============================================================
-- SANA — 0017_private_profile_fields.sql  (güvenlik review #2)
-- SORUN: profiles_select_all (herkes okur) + 0010'un eklediği birth_date/gender
-- → her kullanıcı herkesin doğum tarihini/cinsiyetini okuyabiliyordu (KVKK).
-- ÇÖZÜM: hassas kolonlar yalnız sahibinin okuyabildiği ayrı tabloya taşınır;
-- profiles'ta yalnız kamusal alanlar kalır (username, avatar, home_city...).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create table if not exists public.profiles_private (
  id         uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  gender     text,
  created_at timestamptz default now()
);

alter table public.profiles_private enable row level security;

create policy "profiles_private_select_own"
  on public.profiles_private for select
  using (auth.uid() = id);

create policy "profiles_private_insert_own"
  on public.profiles_private for insert
  with check (auth.uid() = id);

create policy "profiles_private_update_own"
  on public.profiles_private for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Mevcut veriyi taşı (varsa)
insert into public.profiles_private (id, birth_date, gender)
select id, birth_date, gender
from public.profiles
where birth_date is not null or gender is not null
on conflict (id) do update
  set birth_date = excluded.birth_date,
      gender     = excluded.gender;

-- Hassas kolonları kamusal tablodan kaldır
alter table public.profiles drop column if exists birth_date;
alter table public.profiles drop column if exists gender;
