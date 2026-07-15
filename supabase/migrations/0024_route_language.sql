-- ============================================================
-- SANA — 0024_route_language.sql
-- Dile göre rota havuzu: keşif akışı (Home/Map feed + şehir sayaçları) aktif
-- arayüz diline göre filtrelenir. EN modu → İngilizce rotalar, TR modu → Türkçe.
-- Mevcut tüm rotalar Türkçe olduğundan varsayılan 'tr'.
-- NOT: Kullanıcının KENDİ rotaları ve profil vitrini bu filtreye tabi DEĞİL
-- (kişisel içerik; dil değişince kaybolmasın) — o filtre istemci tarafında yok.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

-- 1) lang kolonu — mevcut satırlar 'tr'
alter table public.routes
  add column if not exists lang text not null default 'tr'
    check (lang in ('tr', 'en'));

-- Feed sorgusu (city + lang) için bileşik indeks
create index if not exists routes_city_lang_idx on public.routes (city, lang);

-- 2) Şehir sayaçları — dil filtreli (p_lang null → tüm diller, geriye dönük güvenli)
-- Eski imzalı fonksiyonu düşür (no-arg) — yeni imza p_lang alır.
drop function if exists public.city_route_counts();
drop function if exists public.city_route_counts(text);

create or replace function public.city_route_counts(p_lang text default null)
returns table (city text, n int)
language sql
security definer
set search_path = public
stable
as $$
  select city, count(*)::int
  from public.routes
  where is_public = true
    and city is not null
    and (p_lang is null or lang = p_lang)
  group by city;
$$;
grant execute on function public.city_route_counts(text) to anon, authenticated;
