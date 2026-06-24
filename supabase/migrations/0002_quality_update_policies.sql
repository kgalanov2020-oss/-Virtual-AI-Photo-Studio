-- Allow an authenticated user to move their own upload job through quality review.

create policy "Users can update own jobs"
on public.jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can update own selfies"
on public.uploaded_selfies
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
