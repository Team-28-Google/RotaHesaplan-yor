-- ============================================================
-- SANA — 0022_favorite_visibility.sql  (review kozmetik: özel rota beğeni şişirme)
-- SORUN: route_favorites insert yalnız "auth.uid() = user_id" kontrol ediyordu →
-- uuid'yi bilen, GÖREMEDİĞİ özel bir rotayı favoriye ekleyip like_count'unu
-- artırabiliyordu. (Yazar liderliği 0018'de zaten özel rotaları saymıyor; bu, kalan
-- like_count hijyeni.) ÇÖZÜM: yalnız GÖRÜNÜR rota favorilenebilir.
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

drop policy if exists "route_favorites_insert_own" on public.route_favorites;
create policy "route_favorites_insert_visible"
  on public.route_favorites for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.routes r
      where r.id = route_favorites.route_id
        and (r.is_public
             or r.author_id = auth.uid()
             or exists (select 1 from public.route_collaborators c
                        where c.route_id = r.id and c.user_id = auth.uid()))
    )
  );
