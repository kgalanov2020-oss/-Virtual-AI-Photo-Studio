insert into public.promo_codes (code, credit_amount, description, max_redemptions, is_active)
values
  ('STUDIO', 40, 'Outreach для фотостудий: две промо-генерации по 20 бесплатных фото', 300, true)
on conflict (code) do update
set
  credit_amount = excluded.credit_amount,
  description = excluded.description,
  max_redemptions = excluded.max_redemptions,
  is_active = excluded.is_active;
