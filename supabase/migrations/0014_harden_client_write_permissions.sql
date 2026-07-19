-- Apply only after deploying the matching /api/profile, /api/jobs and
-- /api/jobs/[jobId] routes plus their frontend callers.

revoke insert, update, delete on public.jobs from authenticated;
grant select on public.jobs to authenticated;
drop policy if exists "Users can create own jobs" on public.jobs;
drop policy if exists "Users can update own jobs" on public.jobs;

revoke insert, update, delete on public.user_profiles from authenticated;
grant select on public.user_profiles to authenticated;
drop policy if exists "Users can create own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

revoke insert, update, delete on public.orders from authenticated;
grant select on public.orders to authenticated;

-- Orders are fiscal/audit records and must never disappear through a jobs
-- cascade. The deployed DELETE route rejects these deletions before this
-- database-level backstop is enabled.
alter table public.orders
drop constraint if exists orders_job_id_fkey;

alter table public.orders
add constraint orders_job_id_fkey
foreign key (job_id) references public.jobs(id) on delete restrict;

revoke insert, update, delete on public.uploaded_selfies from authenticated;
grant select on public.uploaded_selfies to authenticated;
grant insert (job_id, user_id, file_url) on public.uploaded_selfies to authenticated;

drop policy if exists "Users can create own selfies" on public.uploaded_selfies;
drop policy if exists "Users can update own selfies" on public.uploaded_selfies;
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

revoke insert, update, delete on public.generated_images from authenticated;
grant select on public.generated_images to authenticated;
grant update (is_favorite) on public.generated_images to authenticated;

revoke insert, update, delete on public.promo_redemptions from authenticated;
grant select on public.promo_redemptions to authenticated;
