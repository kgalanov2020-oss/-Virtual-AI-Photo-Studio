alter table public.user_profiles
  alter column free_images_remaining set default 2;

alter table public.generated_images
  add column if not exists is_watermarked boolean not null default false;

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
    is_favorite,
    is_watermarked
  ) values (
    p_job_id,
    p_user_id,
    p_studio_shot_id,
    p_image_url,
    null,
    p_variation_index,
    false,
    payment_job.product_code in ('free_1', 'free_2')
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
