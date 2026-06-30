create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  credit_amount integer not null check (credit_amount between 1 and 40),
  description text,
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  credits_granted integer not null check (credits_granted > 0),
  created_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

grant select on public.promo_redemptions to authenticated;

drop policy if exists "Users can read own promo redemptions" on public.promo_redemptions;
create policy "Users can read own promo redemptions"
on public.promo_redemptions
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.promo_codes (code, credit_amount, description, max_redemptions)
values
  ('START3', 3, 'Промокод на 3 бесплатных фото', 100),
  ('WELCOME5', 5, 'Промокод на 5 бесплатных фото', 100),
  ('FRIEND5', 5, 'Приведи друга: 5 бесплатных фото', null)
on conflict (code) do nothing;
