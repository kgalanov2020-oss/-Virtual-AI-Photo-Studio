alter table public.jobs
add column if not exists height_cm integer
check (height_cm is null or height_cm between 120 and 230);

alter table public.jobs
add column if not exists weight_kg numeric(5, 1)
check (weight_kg is null or weight_kg between 30 and 250);

alter table public.jobs
add column if not exists body_bmi numeric(4, 1)
check (body_bmi is null or body_bmi between 10 and 80);

alter table public.jobs
add column if not exists body_build text
check (
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
);
