-- Store generation prompt mode per job.
-- `child_safe` uses age-appropriate, fully clothed, child-safe prompts.

alter table public.jobs
add column if not exists generation_mode text not null default 'standard'
check (generation_mode in ('standard', 'child_safe'));
