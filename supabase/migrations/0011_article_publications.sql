create table if not exists public.article_publications (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null,
  article_title text not null,
  platform text not null,
  url text not null unique,
  status text not null default 'published' check (
    status in ('planned', 'published', 'archived')
  ),
  published_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_publications_slug_idx
on public.article_publications (article_slug);

create index if not exists article_publications_status_idx
on public.article_publications (status);

create index if not exists article_publications_created_at_idx
on public.article_publications (created_at desc);

alter table public.article_publications enable row level security;

create or replace function public.set_article_publications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_article_publications_updated_at on public.article_publications;
create trigger set_article_publications_updated_at
before update on public.article_publications
for each row
execute function public.set_article_publications_updated_at();
