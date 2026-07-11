-- ============================================================
-- SANA — 0013_journey_spend.sql  (3.8 gerçek harcama bildirimi)
-- Yolculuk bitiren "ne kadar harcadım" bildirir (opsiyonel);
-- rota detayında toplulaştırılmış ortalama görünür (ham satır sızmaz).
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

alter table public.journeys
  add column if not exists spent_try int check (spent_try >= 0);

-- Harcama, yolculuk kaydından SONRA seçilir → kendi kaydını güncelleme izni
create policy "journeys_update_own"
  on public.journeys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Rota başına harcama istatistiği: yalnız ortalama + bildiren sayısı döner
create or replace function public.route_spend_stats(p_route uuid)
returns table (avg_try int, reports int)
language sql
security definer
set search_path = public
as $$
  select coalesce(round(avg(spent_try))::int, 0) as avg_try,
         count(*)::int as reports
  from public.journeys
  where route_id = p_route and spent_try is not null;
$$;
grant execute on function public.route_spend_stats(uuid) to anon, authenticated;
