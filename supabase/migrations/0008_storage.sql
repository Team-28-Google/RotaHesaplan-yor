-- ============================================================
-- SANA — 0008_storage.sql  (3.2 foto yükleme)
-- 'photos' bucket'ı: authenticated kullanıcı KENDİ klasörüne (uid/...) yükler,
-- okuma herkese açık (yorum/durak fotoğrafları akışta görünür).
-- Uygula: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos_select_public"
  on storage.objects for select
  using (bucket_id = 'photos');
