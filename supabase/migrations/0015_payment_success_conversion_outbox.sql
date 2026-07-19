-- Apply before deploying the matching checkout and payment confirmation code.
-- A conversion row is created in the same transaction that first marks a
-- YooKassa order paid. The browser receives an undelivered row and acknowledges
-- it only after the analytics call has been queued, so a lost HTTP response can
-- be retried without losing the conversion.

create table if not exists public.payment_conversion_events (
  id uuid primary key default gen_random_uuid(),
  goal text not null default 'payment_success' check (goal = 'payment_success'),
  provider text not null check (provider = 'yookassa'),
  provider_payment_id text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  product_code text not null,
  target_image_count integer not null check (target_image_count between 1 and 40),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (goal, provider, provider_payment_id)
);

alter table public.payment_conversion_events enable row level security;
revoke all on public.payment_conversion_events from public, anon, authenticated;

create or replace function public.capture_yookassa_payment_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.payment_conversion_events (
    goal,
    provider,
    provider_payment_id,
    order_id,
    job_id,
    user_id,
    amount_cents,
    currency,
    product_code,
    target_image_count
  ) values (
    'payment_success',
    'yookassa',
    new.provider_payment_id,
    new.id,
    new.job_id,
    new.user_id,
    new.amount_cents,
    lower(new.currency),
    new.product_code,
    new.target_image_count
  )
  on conflict (goal, provider, provider_payment_id) do nothing;

  return new;
end;
$$;

drop trigger if exists capture_yookassa_payment_conversion on public.orders;
create trigger capture_yookassa_payment_conversion
after update of status, provider_payment_id on public.orders
for each row
when (
  new.provider = 'yookassa'
  and new.status = 'paid'
  and old.status is distinct from 'paid'
  and new.provider_payment_id is not null
  and new.amount_cents > 0
)
execute function public.capture_yookassa_payment_conversion();

create or replace function public.claim_payment_success_conversion(
  p_provider_payment_id text,
  p_job_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conversion public.payment_conversion_events%rowtype;
begin
  select * into conversion
  from public.payment_conversion_events
  where goal = 'payment_success'
    and provider = 'yookassa'
    and provider_payment_id = p_provider_payment_id
    and job_id = p_job_id
    and user_id = p_user_id
    and delivered_at is null
  limit 1;

  if not found then
    return jsonb_build_object('should_track', false);
  end if;

  return jsonb_build_object(
    'should_track', true,
    'conversion_id', conversion.id,
    'amount_cents', conversion.amount_cents,
    'currency', conversion.currency,
    'product_code', conversion.product_code,
    'target_image_count', conversion.target_image_count
  );
end;
$$;

create or replace function public.ack_payment_success_conversion(
  p_conversion_id uuid,
  p_job_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.payment_conversion_events
  set delivered_at = coalesce(delivered_at, now())
  where id = p_conversion_id
    and goal = 'payment_success'
    and provider = 'yookassa'
    and job_id = p_job_id
    and user_id = p_user_id;

  return found;
end;
$$;

revoke all on function public.capture_yookassa_payment_conversion()
from public, anon, authenticated;

revoke all on function public.claim_payment_success_conversion(text, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.claim_payment_success_conversion(text, uuid, uuid)
to service_role;

revoke all on function public.ack_payment_success_conversion(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.ack_payment_success_conversion(uuid, uuid, uuid)
to service_role;
