-- BRASA — delivery fee. Run AFTER 20261101000006.
-- The customer pays the order and the delivery fee together, in one
-- single M-Pesa payment. Pickup has no fee. The fee itself lives in
-- site_settings (id = 1) and the admin changes it in Admin > Definições
-- > Taxa de entrega — no redeploy is needed when it changes.
-- No RLS change is needed: site_settings is already public-read /
-- admin-write and orders are already own-or-admin (see 0002).
alter table public.site_settings
  add column if not exists delivery_fee_mt integer not null default 150;

alter table public.orders
  add column if not exists subtotal_mt integer,
  add column if not exists delivery_fee_mt integer not null default 0,
  add column if not exists delivery_type text not null default 'pickup'
    check (delivery_type in ('delivery', 'pickup')),
  add column if not exists delivery_address text;

update public.site_settings set delivery_fee_mt = 150 where id = 1;

-- The older delivery text claimed free delivery; the fee now exists, so
-- correct it only where it still carries that claim (an admin-customised
-- text is left untouched).
update public.site_settings
  set delivery_text = 'Entrega ao domicílio em Maputo em 1 a 3 dias úteis, com taxa de entrega, ou levantamento na loja em Maputo. Fora de Maputo, fala connosco no chat antes de pagar, para confirmar o prazo.'
  where id = 1 and delivery_text like '%sem custo de entrega%';
