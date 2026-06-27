-- Storage setup for selfie uploads.
-- Run this after the initial schema.
-- The app stores files under: selfies/{user_id}/{job_id}/{file_name}

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'selfies',
  'selfies',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own selfies"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'selfies'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can read own selfies"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'selfies'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can update own selfies"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'selfies'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'selfies'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "Users can delete own selfies"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'selfies'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
