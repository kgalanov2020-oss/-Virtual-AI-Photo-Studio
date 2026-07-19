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
  generation_mode text not null default 'standard'
    check (generation_mode in ('standard', 'child_safe')),
  height_cm integer check (height_cm is null or height_cm between 120 and 230),
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 30 and 250),
  body_bmi numeric(4, 1) check (body_bmi is null or body_bmi between 10 and 80),
  body_build text check (
    body_build is null
    or body_build in (
      'very_thin',
      'thin',
      'fitness',
      'normal',
      'athletic',
      'solid',
      'large',
      'full',
      'very_full'
    )
  ),
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_payment', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'failed')),
  paid_at timestamptz,
  amount_cents integer not null default 99000,
  currency text not null default 'rub',
  product_code text not null default 'studio_40',
  target_image_count integer not null default 40 check (target_image_count between 1 and 40),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'failed', 'refunded', 'refund_pending')),
  provider text not null default 'yookassa',
  provider_idempotence_key text not null default gen_random_uuid()::text,
  provider_session_id text unique,
  provider_payment_id text,
  checkout_url text,
  is_active_payment_attempt boolean not null default false,
  reconciliation_reason text,
  amount_cents integer not null,
  currency text not null default 'rub',
  product_code text not null default 'studio_40',
  product_name text not null default 'AI-фотосессия 40 фото',
  target_image_count integer not null default 40 check (target_image_count between 1 and 40),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists orders_provider_idempotence_key_uidx
on public.orders(provider_idempotence_key);

create unique index if not exists orders_provider_payment_id_uidx
on public.orders(provider_payment_id)
where provider_payment_id is not null;

create unique index if not exists orders_one_active_yookassa_attempt_uidx
on public.orders(job_id)
where provider = 'yookassa'
  and status = 'pending'
  and is_active_payment_attempt;

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

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  free_images_remaining integer not null default 5 check (free_images_remaining >= 0),
  legal_terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  personal_data_accepted_at timestamptz,
  photo_rights_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  credit_amount integer not null check (credit_amount between 1 and 120),
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

alter table public.studios enable row level security;
alter table public.studio_shots enable row level security;
alter table public.jobs enable row level security;
alter table public.uploaded_selfies enable row level security;
alter table public.generated_images enable row level security;
alter table public.orders enable row level security;
alter table public.payment_conversion_events enable row level security;
alter table public.user_profiles enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

revoke insert, update, delete on public.jobs from authenticated;
revoke insert, update, delete on public.user_profiles from authenticated;
revoke insert, update, delete on public.orders from authenticated;
revoke all on public.payment_conversion_events from public, anon, authenticated;
revoke insert, update, delete on public.uploaded_selfies from authenticated;
revoke insert, update, delete on public.generated_images from authenticated;
revoke insert, update, delete on public.promo_redemptions from authenticated;

grant select on public.user_profiles to authenticated;
grant select on public.jobs to authenticated;
grant select on public.orders to authenticated;
grant select on public.uploaded_selfies to authenticated;
grant insert (job_id, user_id, file_url) on public.uploaded_selfies to authenticated;
grant select on public.generated_images to authenticated;
grant update (is_favorite) on public.generated_images to authenticated;
grant select on public.promo_redemptions to authenticated;

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

create policy "Users can read own selfies"
on public.uploaded_selfies
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own draft job selfies"
on public.uploaded_selfies
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.jobs
    where jobs.id = uploaded_selfies.job_id
      and jobs.user_id = (select auth.uid())
      and jobs.status = 'draft'
  )
);

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

create policy "Users can read own orders"
on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own promo redemptions"
on public.promo_redemptions
for select
to authenticated
using ((select auth.uid()) = user_id);


create or replace function public.settle_job_from_photo_balance(
  p_job_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_job public.jobs%rowtype;
  payment_order public.orders%rowtype;
  remaining_credits integer;
begin
  -- Keep the same lock order as reserve/settle: job -> order -> profile.
  select *
  into payment_job
  from public.jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Photo-balance job not found';
  end if;

  if payment_job.payment_status = 'paid' then
    return jsonb_build_object('status', 'already_paid');
  end if;

  if payment_job.status <> 'awaiting_payment'
    or payment_job.payment_status not in ('unpaid', 'pending')
  then
    raise exception using
      errcode = 'P0001',
      message = 'Photo-balance job is not awaiting payment';
  end if;

  -- A provider payment may already be in flight even before its payment id is
  -- saved. Do not mutate the job snapshot while any pending order exists.
  select *
  into payment_order
  from public.orders
  where job_id = p_job_id
    and user_id = p_user_id
    and provider = 'yookassa'
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'status', 'provider_attempt_exists',
      'order_id', payment_order.id,
      'provider_session_id', payment_order.provider_session_id
    );
  end if;

  select free_images_remaining
  into remaining_credits
  from public.user_profiles
  where user_id = p_user_id
    and free_images_remaining >= payment_job.target_image_count
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Photo credit balance is insufficient';
  end if;

  update public.jobs
  set status = 'queued',
      payment_status = 'paid',
      paid_at = now(),
      amount_cents = 0,
      progress = greatest(progress, 5),
      queued_at = coalesce(queued_at, now()),
      error_message = null
  where id = payment_job.id;

  return jsonb_build_object(
    'status', 'balance_settled',
    'free_images_remaining', remaining_credits
  );
end;
$$;

create or replace function public.delete_job_without_payment_history(
  p_job_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deletion_job public.jobs%rowtype;
  payment_order public.orders%rowtype;
begin
  select *
  into deletion_job
  from public.jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if deletion_job.status = 'running' then
    return 'running';
  end if;

  if deletion_job.payment_status = 'paid' then
    return 'payment_history';
  end if;

  -- The job row lock serializes this check against payment reservation, which
  -- also locks job before inserting an order.
  select *
  into payment_order
  from public.orders
  where job_id = p_job_id
  order by created_at desc
  limit 1
  for update;

  if found then
    return 'payment_history';
  end if;

  delete from public.jobs
  where id = p_job_id
    and user_id = p_user_id;

  return 'deleted';
end;
$$;


-- Payment settlement is atomic and idempotent across the browser confirmation
-- flow and the YooKassa webhook.
create or replace function public.settle_yookassa_payment(
  p_provider_session_id text,
  p_provider_payment_id text,
  p_job_id uuid,
  p_user_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_product_code text,
  p_target_image_count integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_order public.orders%rowtype;
  payment_job public.jobs%rowtype;
  has_other_paid_order boolean := false;
  job_matches_order boolean := false;
begin
  if p_provider_payment_id <> p_provider_session_id then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa provider payment id does not match its session id';
  end if;

  -- Every payment flow takes locks in the same order: job -> order -> profile.
  -- This avoids a deadlock with reserve_yookassa_payment_attempt.
  select *
  into payment_job
  from public.jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa job not found';
  end if;

  select *
  into payment_order
  from public.orders
  where provider_session_id = p_provider_session_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa order not found';
  end if;

  if payment_order.provider <> 'yookassa'
    or payment_order.job_id <> p_job_id
    or payment_order.user_id <> p_user_id
    or payment_order.amount_cents <> p_amount_cents
    or lower(payment_order.currency) <> lower(p_currency)
    or payment_order.product_code <> p_product_code
    or payment_order.target_image_count <> p_target_image_count
  then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa order parameters do not match';
  end if;

  job_matches_order := payment_job.amount_cents = p_amount_cents
    and lower(payment_job.currency) = lower(p_currency)
    and payment_job.product_code = p_product_code
    and payment_job.target_image_count = p_target_image_count;

  -- A paid job can legitimately have a different current snapshot when it was
  -- settled from photo balance after this provider order was created. The
  -- immutable server-created order remains the source of truth in that case.
  if payment_job.payment_status <> 'paid' and not job_matches_order then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa job parameters do not match';
  end if;

  if payment_order.status = 'paid' then
    if payment_order.provider_payment_id is distinct from p_provider_payment_id then
      raise exception using
        errcode = 'P0001',
        message = 'YooKassa payment is in an inconsistent state';
    end if;

    if payment_job.payment_status <> 'paid' then
      update public.jobs
      set status = 'queued',
          payment_status = 'paid',
          paid_at = coalesce(paid_at, payment_order.paid_at, now()),
          progress = greatest(progress, 5),
          queued_at = coalesce(queued_at, now()),
          error_message = null
      where id = payment_job.id;

      update public.orders
      set reconciliation_reason = coalesce(
            reconciliation_reason,
            'legacy_paid_order_job_reconciled'
          ),
          updated_at = now()
      where id = payment_order.id;
    end if;

    return 'already_processed';
  end if;

  if payment_order.status = 'refund_pending' then
    if payment_order.provider_payment_id is distinct from p_provider_payment_id then
      raise exception using
        errcode = 'P0001',
        message = 'YooKassa duplicate payment is in an inconsistent state';
    end if;

    return 'already_processed';
  end if;

  if payment_order.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa order is not pending';
  end if;

  if payment_job.payment_status = 'paid' then
    select exists (
      select 1
      from public.orders
      where job_id = payment_order.job_id
        and id <> payment_order.id
        and provider = 'yookassa'
        and status = 'paid'
    ) into has_other_paid_order;

    if not has_other_paid_order and job_matches_order then
      update public.orders
      set status = 'paid',
          provider_payment_id = p_provider_payment_id,
          paid_at = coalesce(paid_at, payment_job.paid_at, now()),
          is_active_payment_attempt = false,
          reconciliation_reason = 'legacy_paid_job_order_reconciled',
          updated_at = now()
      where id = payment_order.id;

      return 'already_processed';
    end if;

    update public.user_profiles
    set free_images_remaining = free_images_remaining + p_target_image_count,
        updated_at = now()
    where user_id = p_user_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'YooKassa user profile not found';
    end if;

    update public.orders
    set status = 'paid',
        provider_payment_id = p_provider_payment_id,
        paid_at = now(),
        is_active_payment_attempt = false,
        reconciliation_reason = case
          when not job_matches_order then 'late_provider_payment_after_balance_credited'
          else 'duplicate_succeeded_payment_credited'
        end,
        updated_at = now()
    where id = payment_order.id;

    return 'duplicate_payment_credited';
  end if;

  if payment_job.payment_status not in ('unpaid', 'pending') then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa job is not payable';
  end if;

  update public.user_profiles
  set free_images_remaining = free_images_remaining + p_target_image_count,
      updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa user profile not found';
  end if;

  update public.orders
  set status = 'paid',
      provider_payment_id = p_provider_payment_id,
      paid_at = now(),
      is_active_payment_attempt = false,
      reconciliation_reason = null,
      updated_at = now()
  where id = payment_order.id;

  update public.orders
  set is_active_payment_attempt = false,
      reconciliation_reason = coalesce(reconciliation_reason, 'superseded_by_paid_order'),
      updated_at = now()
  where job_id = payment_order.job_id
    and id <> payment_order.id
    and provider = 'yookassa'
    and status = 'pending';

  update public.jobs
  set status = 'queued',
      payment_status = 'paid',
      paid_at = now(),
      progress = 5,
      queued_at = now(),
      error_message = null
  where id = payment_job.id;

  return 'processed';
end;
$$;

revoke all on function public.settle_yookassa_payment(
  text,
  text,
  uuid,
  uuid,
  integer,
  text,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.settle_yookassa_payment(
  text,
  text,
  uuid,
  uuid,
  integer,
  text,
  text,
  integer
) to service_role;

create or replace function public.reserve_yookassa_payment_attempt(
  p_job_id uuid,
  p_user_id uuid,
  p_product_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_job public.jobs%rowtype;
  payment_order public.orders%rowtype;
  was_created boolean := false;
begin
  select *
  into payment_job
  from public.jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'YooKassa job not found';
  end if;

  if payment_job.status <> 'awaiting_payment'
    or payment_job.payment_status not in ('unpaid', 'pending')
  then
    raise exception using errcode = 'P0001', message = 'YooKassa job is not awaiting payment';
  end if;

  select *
  into payment_order
  from public.orders
  where job_id = p_job_id
    and user_id = p_user_id
    and provider = 'yookassa'
    and status = 'pending'
    and is_active_payment_attempt
  order by created_at desc
  limit 1
  for update;

  if not found then
    select *
    into payment_order
    from public.orders
    where job_id = p_job_id
      and user_id = p_user_id
      and provider = 'yookassa'
      and status = 'pending'
    order by created_at desc
    limit 1
    for update;

    if found then
      update public.orders
      set is_active_payment_attempt = true,
          updated_at = now()
      where id = payment_order.id
      returning * into payment_order;
    else
      insert into public.orders (
        job_id,
        user_id,
        status,
        provider,
        provider_idempotence_key,
        is_active_payment_attempt,
        amount_cents,
        currency,
        product_code,
        product_name,
        target_image_count
      )
      values (
        payment_job.id,
        payment_job.user_id,
        'pending',
        'yookassa',
        gen_random_uuid()::text,
        true,
        payment_job.amount_cents,
        payment_job.currency,
        payment_job.product_code,
        p_product_name,
        payment_job.target_image_count
      )
      returning * into payment_order;

      was_created := true;
    end if;
  end if;

  return jsonb_build_object(
    'id', payment_order.id,
    'job_id', payment_order.job_id,
    'user_id', payment_order.user_id,
    'provider', payment_order.provider,
    'provider_idempotence_key', payment_order.provider_idempotence_key,
    'provider_session_id', payment_order.provider_session_id,
    'checkout_url', payment_order.checkout_url,
    'amount_cents', payment_order.amount_cents,
    'currency', payment_order.currency,
    'product_code', payment_order.product_code,
    'target_image_count', payment_order.target_image_count,
    'created', was_created
  );
end;
$$;

create or replace function public.finalize_yookassa_payment_attempt(
  p_order_id uuid,
  p_job_id uuid,
  p_user_id uuid,
  p_provider_idempotence_key text,
  p_provider_session_id text,
  p_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_order public.orders%rowtype;
begin
  select *
  into payment_order
  from public.orders
  where id = p_order_id
    and job_id = p_job_id
    and user_id = p_user_id
    and provider = 'yookassa'
    and provider_idempotence_key = p_provider_idempotence_key
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'YooKassa payment attempt not found';
  end if;

  if payment_order.status <> 'pending' or not payment_order.is_active_payment_attempt then
    raise exception using errcode = 'P0001', message = 'YooKassa payment attempt is not active';
  end if;

  if payment_order.provider_session_id is not null
    and payment_order.provider_session_id <> p_provider_session_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'YooKassa payment attempt has a different provider payment';
  end if;

  update public.orders
  set provider_session_id = p_provider_session_id,
      checkout_url = coalesce(p_checkout_url, checkout_url),
      updated_at = now()
  where id = payment_order.id
  returning * into payment_order;

  return jsonb_build_object(
    'id', payment_order.id,
    'job_id', payment_order.job_id,
    'user_id', payment_order.user_id,
    'provider', payment_order.provider,
    'provider_idempotence_key', payment_order.provider_idempotence_key,
    'provider_session_id', payment_order.provider_session_id,
    'checkout_url', payment_order.checkout_url,
    'amount_cents', payment_order.amount_cents,
    'currency', payment_order.currency,
    'product_code', payment_order.product_code,
    'target_image_count', payment_order.target_image_count,
    'created', false
  );
end;
$$;

create or replace function public.consume_user_photo_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_credits integer;
begin
  update public.user_profiles
  set free_images_remaining = free_images_remaining - 1,
      updated_at = now()
  where user_id = p_user_id
    and free_images_remaining > 0
  returning free_images_remaining into remaining_credits;

  if not found then
    raise exception using errcode = 'P0001', message = 'Photo credit balance is empty';
  end if;

  return remaining_credits;
end;
$$;

create or replace function public.refund_user_photo_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_credits integer;
begin
  update public.user_profiles
  set free_images_remaining = free_images_remaining + 1,
      updated_at = now()
  where user_id = p_user_id
  returning free_images_remaining into remaining_credits;

  if not found then
    raise exception using errcode = 'P0001', message = 'Photo credit profile not found';
  end if;

  return remaining_credits;
end;
$$;

create or replace function public.record_generated_image_with_credit(
  p_job_id uuid,
  p_user_id uuid,
  p_studio_shot_id uuid,
  p_image_url text,
  p_variation_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_job public.jobs%rowtype;
  remaining_credits integer;
  completed_count integer;
begin
  select *
  into payment_job
  from public.jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;

  if not found or payment_job.payment_status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'Generation job is not paid';
  end if;

  if exists (
    select 1
    from public.generated_images
    where job_id = p_job_id
      and studio_shot_id = p_studio_shot_id
      and variation_index = p_variation_index
  ) then
    select count(*)::integer into completed_count
    from public.generated_images
    where job_id = p_job_id;

    return jsonb_build_object('inserted', false, 'completed_count', completed_count);
  end if;

  update public.user_profiles
  set free_images_remaining = free_images_remaining - 1,
      updated_at = now()
  where user_id = p_user_id
    and free_images_remaining > 0
  returning free_images_remaining into remaining_credits;

  if not found then
    raise exception using errcode = 'P0001', message = 'Photo credit balance is empty';
  end if;

  insert into public.generated_images (
    job_id,
    user_id,
    studio_shot_id,
    image_url,
    seed,
    variation_index,
    is_favorite
  ) values (
    p_job_id,
    p_user_id,
    p_studio_shot_id,
    p_image_url,
    null,
    p_variation_index,
    false
  );

  select count(*)::integer into completed_count
  from public.generated_images
  where job_id = p_job_id;

  return jsonb_build_object(
    'inserted', true,
    'completed_count', completed_count,
    'free_images_remaining', remaining_credits
  );
end;
$$;

create or replace function public.grant_user_photo_credits(
  p_user_id uuid,
  p_email text,
  p_credit_count integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_credits integer;
begin
  if p_credit_count <= 0 then
    raise exception using errcode = 'P0001', message = 'Photo credit grant must be positive';
  end if;

  insert into public.user_profiles (
    user_id,
    email,
    free_images_remaining,
    updated_at
  ) values (
    p_user_id,
    p_email,
    p_credit_count,
    now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      free_images_remaining = public.user_profiles.free_images_remaining + excluded.free_images_remaining,
      updated_at = now()
  returning free_images_remaining into remaining_credits;

  return remaining_credits;
end;
$$;

create or replace function public.redeem_promo_code(
  p_code text,
  p_user_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  promo public.promo_codes%rowtype;
  remaining_credits integer;
begin
  if nullif(btrim(p_code), '') is null then
    raise exception using errcode = 'P0001', message = 'Promo code is required';
  end if;

  if p_user_id is null or nullif(btrim(p_email), '') is null then
    raise exception using errcode = 'P0001', message = 'Promo code user is invalid';
  end if;

  -- Serialize redemption count and all eligibility checks for this code.
  select *
  into promo
  from public.promo_codes
  where code = upper(btrim(p_code))
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Promo code not found';
  end if;

  if not promo.is_active then
    raise exception using errcode = 'P0001', message = 'Promo code is inactive';
  end if;

  if promo.starts_at is not null and promo.starts_at > now() then
    raise exception using errcode = 'P0001', message = 'Promo code has not started';
  end if;

  if promo.expires_at is not null and promo.expires_at < now() then
    raise exception using errcode = 'P0001', message = 'Promo code has expired';
  end if;

  if promo.max_redemptions is not null
    and promo.redeemed_count >= promo.max_redemptions
  then
    raise exception using errcode = 'P0001', message = 'Promo code limit reached';
  end if;

  if exists (
    select 1
    from public.promo_redemptions
    where promo_code_id = promo.id
      and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'Promo code already redeemed';
  end if;

  insert into public.promo_redemptions (
    promo_code_id,
    user_id,
    email,
    credits_granted
  ) values (
    promo.id,
    p_user_id,
    p_email,
    promo.credit_amount
  );

  insert into public.user_profiles (
    user_id,
    email,
    free_images_remaining,
    updated_at
  ) values (
    p_user_id,
    p_email,
    promo.credit_amount,
    now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      free_images_remaining = public.user_profiles.free_images_remaining + excluded.free_images_remaining,
      updated_at = now()
  returning free_images_remaining into remaining_credits;

  update public.promo_codes
  set redeemed_count = redeemed_count + 1
  where id = promo.id;

  return jsonb_build_object(
    'credits_granted', promo.credit_amount,
    'free_images_remaining', remaining_credits
  );
end;
$$;

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

revoke all on function public.reserve_yookassa_payment_attempt(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.reserve_yookassa_payment_attempt(uuid, uuid, text)
to service_role;

revoke all on function public.finalize_yookassa_payment_attempt(uuid, uuid, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.finalize_yookassa_payment_attempt(uuid, uuid, uuid, text, text, text)
to service_role;

revoke all on function public.settle_job_from_photo_balance(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.settle_job_from_photo_balance(uuid, uuid)
to service_role;

revoke all on function public.delete_job_without_payment_history(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_job_without_payment_history(uuid, uuid)
to service_role;

revoke all on function public.consume_user_photo_credit(uuid)
from public, anon, authenticated;
grant execute on function public.consume_user_photo_credit(uuid)
to service_role;

revoke all on function public.refund_user_photo_credit(uuid)
from public, anon, authenticated;
grant execute on function public.refund_user_photo_credit(uuid)
to service_role;

revoke all on function public.record_generated_image_with_credit(uuid, uuid, uuid, text, integer)
from public, anon, authenticated;
grant execute on function public.record_generated_image_with_credit(uuid, uuid, uuid, text, integer)
to service_role;

revoke all on function public.grant_user_photo_credits(uuid, text, integer)
from public, anon, authenticated;
grant execute on function public.grant_user_photo_credits(uuid, text, integer)
to service_role;

revoke all on function public.redeem_promo_code(text, uuid, text)
from public, anon, authenticated;
grant execute on function public.redeem_promo_code(text, uuid, text)
to service_role;

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
