-- Storage bucket for generated AI photo results.
-- Generated images are public in the MVP so the frontend can render gallery URLs directly.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'generated',
  'generated',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
