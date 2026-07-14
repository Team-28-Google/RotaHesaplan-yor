-- ============================================================
-- SANA — 0021_city_route_counts.sql  (review düşük: CityPicker sayaç verimliliği)
-- SORUN: CityPicker şehir sayaçlarını "select city from routes" ile TÜM satırları
-- çekip istemcide sayıyordu → veri büyüyünce ağırlaşır + özel rotaları da sayar.
-- ÇÖZÜM: sunucuda gruplayan fonksiyon; yalnız HERKESE AÇIK rotalar sayılır.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create or replace function public.city_route_counts()
returns table (city text, n int)
language sql
security definer
set search_path = public
stable
as $$
  select city, count(*)::int
  from public.routes
  where is_public = true and city is not null
  group by city;
$$;
grant execute on function public.city_route_counts() to anon, authenticated;
