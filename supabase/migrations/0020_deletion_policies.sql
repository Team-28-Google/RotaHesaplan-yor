-- ============================================================
-- SANA — 0020_deletion_policies.sql  (review düşük: eksik silme/yönetim politikaları)
-- Kullanıcının kendi verisini yönetebilmesi için eksik kalan RLS'ler:
--   • journeys        → kendi yolculuğunu silebilir
--   • storage.objects → kendi klasöründeki fotoğrafı silebilir
--   • collections     → sahibi yeniden adlandırabilir (update)
--   • collection_members → üye kendi üyeliğinden çıkabilir; sahibi üye çıkarabilir
--   • *_share_tokens  → sahibi token'ı silebilir (davet linkini iptal = revoke)
-- Uygula: Supabase Dashboard → SQL Editor → yapıştır → Run.
-- ============================================================

-- 1) Yolculuk silme (kendi kaydı)
create policy "journeys_delete_own"
  on public.journeys for delete
  using (auth.uid() = user_id);

-- 2) Fotoğraf silme — yalnız kendi uid/ klasöründeki objeler
create policy "photos_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Koleksiyon yeniden adlandırma (sahibi)
create policy "collections_update_own"
  on public.collections for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 4) Üyelikten çıkış: üye KENDİNİ çıkarır, koleksiyon sahibi HERKESİ çıkarabilir
--    (sahibin kendini çıkarmasını engellemeye gerek yok — koleksiyonu silmek ayrı yol)
create policy "collection_members_delete_self_or_owner"
  on public.collection_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.collections c
               where c.id = collection_id and c.owner_id = auth.uid())
  );

-- 5) Davet linki iptali (revoke): sahibi token satırını siler → link ölür
create policy "route_tokens_owner_delete"
  on public.route_share_tokens for delete
  using (exists (select 1 from public.routes r
                 where r.id = route_share_tokens.route_id and r.author_id = auth.uid()));

create policy "collection_tokens_owner_delete"
  on public.collection_share_tokens for delete
  using (exists (select 1 from public.collections c
                 where c.id = collection_share_tokens.collection_id and c.owner_id = auth.uid()));
