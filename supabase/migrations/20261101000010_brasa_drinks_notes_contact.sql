-- BRASA — drinks, sides, order notes, contact. Run AFTER 0009.
-- * New products (also in js/catalog.js and in the payment function's
--   trusted prices): 4 drinks + batata frita. Image is empty on purpose:
--   the menu renders a gradient name card when there is no photo, and
--   the admin can upload a real photo per product later.
-- * orders.customer_note: the customer's removals/observations
--   ("Sem cebola", "pouco sal"), shown in Admin > Encomendas and in
--   the customer's order history. The payment function never overwrites
--   it (it only updates its own columns).
-- * site_settings.contact_phone: the phone shown in the contact card,
--   edited in Admin > Definições. whatsapp_url gets a placeholder link
--   ONLY where it is still empty, so a real link set by the admin is
--   never overwritten.

insert into public.products (slug, name, category, description, price_mt, image_url, sort_order, published) values
  ('coca-cola', 'Coca-Cola (lata)', 'Bebidas', 'Refrigerante gelado, lata de 330 ml', 150, null, 20, true),
  ('fanta', 'Fanta Laranja (lata)', 'Bebidas', 'Refrigerante de laranja gelado, lata de 330 ml', 150, null, 21, true),
  ('sprite', 'Sprite (lata)', 'Bebidas', 'Refrigerante de limão gelado, lata de 330 ml', 150, null, 22, true),
  ('agua', 'Água mineral (500 ml)', 'Bebidas', 'Água mineral fresca, garrafa de 500 ml', 80, null, 23, true),
  ('batata-frita', 'Batata frita', 'Acompanhamentos', 'Batata frita crocante com sal, porção individual', 200, null, 24, true)
on conflict (slug) do nothing;

alter table public.orders
  add column if not exists customer_note text;

alter table public.site_settings
  add column if not exists contact_phone text not null default '+258 84 000 0000';

update public.site_settings
  set whatsapp_url = 'https://wa.me/258840000000'
  where id = 1 and (whatsapp_url is null or whatsapp_url = '');
