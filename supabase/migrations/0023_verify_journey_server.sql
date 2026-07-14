-- ============================================================
-- SANA — 0023_verify_journey_server.sql  (güvenlik review #4)
-- SORUN: journeys.verified istemciden geliyordu → modifiye istemci
-- "verified=true" gönderip liderliğe sahte doğrulanmış yolculuk yazabilirdi.
-- ÇÖZÜM: SUNUCU, gönderilen GPS izini (path) rotanın gerçek duraklarıyla
-- karşılaştırıp verified'ı KENDİSİ hesaplar (BEFORE INSERT/UPDATE trigger).
-- Kural (istemcideki 3.11 mantığının sunucu hali): iz, deneyim duraklarının
-- en az yarısına (min 2) ~150 m yakınından geçmişse verified. İz yoksa false.
-- (150 m eşiği: iz downsample + Roads snap kaymasını tolere eder; amaç gerçek
--  yürüyeni doğrulamak, koltuktan "Bitir"i elemek.)
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

-- İki nokta arası metre (haversine, harici uzantı gerektirmez)
create or replace function public._haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- İzi duraklarla karşılaştırıp verified döndürür
create or replace function public._journey_verified(p_route uuid, p_path jsonb)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_stops   int := 0;
  v_arr     int := 0;
  w         record;
  pt        jsonb;
  v_near    boolean;
begin
  if p_route is null or p_path is null or jsonb_array_length(p_path) < 2 then
    return false;
  end if;
  for w in
    select lat, lng from waypoints
    where route_id = p_route and kind = 'experience'
  loop
    v_stops := v_stops + 1;
    v_near := false;
    for pt in select * from jsonb_array_elements(p_path)
    loop
      if _haversine_m(w.lat, w.lng,
                      (pt->>'lat')::double precision,
                      (pt->>'lng')::double precision) <= 150 then
        v_near := true;
        exit;
      end if;
    end loop;
    if v_near then v_arr := v_arr + 1; end if;
  end loop;
  if v_stops = 0 then
    return false;
  end if;
  return v_arr >= greatest(2, ceil(v_stops::numeric / 2));
end;
$$;

-- Trigger: istemcinin gönderdiği verified YOK SAYILIR, sunucu hesaplar
create or replace function public._set_journey_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.verified := public._journey_verified(new.route_id, new.path);
  return new;
end;
$$;

drop trigger if exists journeys_verify on public.journeys;
create trigger journeys_verify
  before insert or update of path, route_id on public.journeys
  for each row execute function public._set_journey_verified();

-- Mevcut kayıtları da sunucu kuralıyla yeniden değerlendir (geçmiş temizliği)
update public.journeys
set verified = public._journey_verified(route_id, path);
