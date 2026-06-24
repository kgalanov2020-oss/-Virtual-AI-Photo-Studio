-- Initial schema draft for the AI Photo Studio MVP.
-- Review in a Supabase project before applying to production.

create extension if not exists "pgcrypto";

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  preview_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_shots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  slug text not null,
  name text not null,
  camera_angle text not null,
  pose text not null,
  crop text not null,
  prompt text not null,
  negative_prompt text not null,
  variations integer not null default 4 check (variations between 1 and 8),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (studio_id, slug)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.uploaded_selfies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  quality_score numeric(4, 3),
  face_angle text,
  is_approved boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  studio_shot_id uuid not null references public.studio_shots(id),
  image_url text not null,
  seed bigint,
  variation_index integer not null default 1,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.studios enable row level security;
alter table public.studio_shots enable row level security;
alter table public.jobs enable row level security;
alter table public.uploaded_selfies enable row level security;
alter table public.generated_images enable row level security;

create policy "Anyone can read active studios"
on public.studios
for select
to anon, authenticated
using (is_active = true);

create policy "Anyone can read shots for active studios"
on public.studio_shots
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.studios
    where studios.id = studio_shots.studio_id
      and studios.is_active = true
  )
);

create policy "Users can read own jobs"
on public.jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own jobs"
on public.jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own selfies"
on public.uploaded_selfies
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own selfies"
on public.uploaded_selfies
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own generated images"
on public.generated_images
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own generated image favorites"
on public.generated_images
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
