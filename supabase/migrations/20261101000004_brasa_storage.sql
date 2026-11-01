-- BRASA — Storage buckets and policies. Run AFTER the RLS migration.
-- Buckets (create in the dashboard if they do not exist yet, both public):
--   brasa-media       — product photos, logo, hero video and promo photos,
--                       uploaded by admin (photos up to 5 MB, video up to 50 MB,
--                       limits checked in code)
--   chat-attachments  — chat files and audio, up to 5 MB (checked in code)
-- Storage policies mirror the table rules: customers read their own chat
-- files, admins manage everything, product images are publicly readable.

insert into storage.buckets (id, name, public)
  values ('brasa-media', 'brasa-media', true),
         ('chat-attachments', 'chat-attachments', true)
  on conflict (id) do nothing;

-- brasa-media: public read; admin write/delete.
drop policy if exists "brasa-media public read" on storage.objects;
create policy "brasa-media public read" on storage.objects
  for select using (bucket_id = 'brasa-media');
drop policy if exists "brasa-media admin write" on storage.objects;
create policy "brasa-media admin write" on storage.objects
  for insert with check (bucket_id = 'brasa-media' and public.is_admin());
drop policy if exists "brasa-media admin delete" on storage.objects;
create policy "brasa-media admin delete" on storage.objects
  for delete using (bucket_id = 'brasa-media' and public.is_admin());

-- chat-attachments: the owner of the folder (first path segment = user id)
-- and admins may read/write; nobody else may.
drop policy if exists "chat own read" on storage.objects;
create policy "chat own read" on storage.objects
  for select using (
    bucket_id = 'chat-attachments' and
    (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );
drop policy if exists "chat own write" on storage.objects;
create policy "chat own write" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
