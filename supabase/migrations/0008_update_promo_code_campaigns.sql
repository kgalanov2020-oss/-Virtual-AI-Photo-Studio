alter table public.promo_codes
drop constraint if exists promo_codes_credit_amount_check;

alter table public.promo_codes
add constraint promo_codes_credit_amount_check
check (credit_amount between 1 and 120);

update public.promo_codes
set is_active = false
where code in ('START3', 'WELCOME5', 'FRIEND5');

insert into public.promo_codes (code, credit_amount, description, max_redemptions, is_active)
values
  ('START', 20, 'Одна промо-генерация на 20 бесплатных фото', 100, true),
  ('WELCOME', 40, 'Две промо-генерации по 20 бесплатных фото', 100, true),
  ('FRIEND', 60, 'Приведи друга: три промо-генерации по 20 бесплатных фото', null, true)
on conflict (code) do update
set
  credit_amount = excluded.credit_amount,
  description = excluded.description,
  max_redemptions = excluded.max_redemptions,
  is_active = excluded.is_active;
