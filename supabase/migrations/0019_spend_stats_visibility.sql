-- ============================================================
-- SANA — 0019_spend_stats_visibility.sql  (güvenlik review #5)
-- SORUN: route_spend_stats(uuid) görünürlük kontrolü yapmıyordu → uuid'yi bilen
-- ÖZEL bir rotanın harcama ortalamasını görebiliyordu (küçük ama sızıntı).
-- ÇÖZÜM: fonksiyon yalnız HERKESE AÇIK rota VEYA çağıranın SAHİBİ olduğu rota için
-- veri döner; aksi halde sıfır. (Harcama zaten toplulaştırılmış — ham satır sızmaz.)
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create or replace function public.route_spend_stats(p_route uuid)
returns table (avg_try int, reports int)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(round(avg(spent_try))::int, 0) as avg_try,
         count(*)::int as reports
  from public.journeys
  where route_id = p_route
    and spent_try is not null
    and exists (                       -- görünürlük kapısı (#5)
      select 1 from public.routes r
      where r.id = p_route
        and (r.is_public or r.author_id = auth.uid())
    );
$$;
grant execute on function public.route_spend_stats(uuid) to anon, authenticated;
