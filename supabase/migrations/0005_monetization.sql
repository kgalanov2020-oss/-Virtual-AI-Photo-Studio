-- Add minimal monetization support.
-- Generation is allowed only after jobs.payment_status = 'paid'.

alter table public.jobs
drop constraint if exists jobs_status_check;

alter table public.jobs
add constraint jobs_status_check
check (status in ('draft', 'awaiting_payment', 'queued', 'running', 'completed', 'failed', 'cancelled'));

alter table public.jobs
add column if not exists payment_status text not null default 'unpaid'
check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'failed')),
add column if not exists paid_at timestamptz,
add column if not exists amount_cents integer not null default 99000,
add column if not exists currency text not null default 'rub',
add column if not exists product_code text not null default 'studio_40';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'failed', 'refunded')),
  provider text not null default 'yookassa',
  provider_session_id text unique,
  provider_payment_id text,
  checkout_url text,
  amount_cents integer not null,
  currency text not null default 'rub',
  product_code text not null default 'studio_40',
  product_name text not null default 'AI-фотосессия 40 фото',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists orders_job_id_idx on public.orders(job_id);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_provider_session_id_idx on public.orders(provider_session_id);

alter table public.orders
alter column provider set default 'yookassa';

alter table public.orders enable row level security;

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders"
on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id);
