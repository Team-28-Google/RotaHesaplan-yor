-- ============================================================
-- SANA — 0009_fix_like_count.sql  (beğeni sayacı düzeltmesi)
-- SORUN: bump_like_count() SECURITY DEFINER değildi → trigger, beğenen
-- kullanıcının yetkisiyle koştu; routes update RLS'i (yalnız sahibi) yüzünden
-- sayaç güncellemesi sessizce 0 satır etkiledi. Beğeniler kaydedildi, sayaç 0 kaldı.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

create or replace function public.bump_like_count()
returns trigger
language plpgsql
security definer                -- rotanın sahibinden bağımsız, RLS'e takılmadan sayaç günceller
set search_path = public
as $$
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

-- Mevcut favorilerden sayaçları geri doldur (trigger bozukken atılan beğeniler)
update public.routes r
set like_count = coalesce(
  (select count(*)::int from public.route_favorites rf where rf.route_id = r.id), 0);
