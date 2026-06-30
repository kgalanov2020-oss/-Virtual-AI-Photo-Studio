create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  unique_key text not null unique,
  studio_name text not null,
  city text,
  website text,
  email text,
  phone text,
  source text not null default 'google_places',
  promo_code text not null default 'STUDIO',
  status text not null default 'new' check (
    status in (
      'new',
      'needs_manual_email',
      'needs_review',
      'approved',
      'sent',
      'replied',
      'stop',
      'bad_email',
      'duplicate'
    )
  ),
  last_contacted_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_leads_city_idx on public.outreach_leads (city);
create index if not exists outreach_leads_email_idx on public.outreach_leads (email);
create index if not exists outreach_leads_status_idx on public.outreach_leads (status);
create index if not exists outreach_leads_created_at_idx on public.outreach_leads (created_at desc);

alter table public.outreach_leads enable row level security;

create or replace function public.set_outreach_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_outreach_leads_updated_at on public.outreach_leads;
create trigger set_outreach_leads_updated_at
before update on public.outreach_leads
for each row
execute function public.set_outreach_leads_updated_at();
