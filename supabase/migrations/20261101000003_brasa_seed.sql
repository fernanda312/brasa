-- BRASA — seed: the exact catalogue from js/catalog.js, same slugs, same
-- MT prices, same descriptions. Run AFTER the RLS migration.
-- The image paths below are the site paths and are replaced by Storage URLs
-- when the admin uploads a new photo by file.

insert into public.site_settings (id, hero_title, hero_text, hero_video_url, store_text, promo_text, promo1_url, promo2_url, promo3_url) values
  (1, 'ACENDE O SABOR. TRAZ OS AMIGOS', 'Hambúrgueres na brasa, feitos na hora, em Maputo. A BRASA põe fogo em cada dentada.', 'videos/hero-burger.mp4', 'A BRASA está em Maputo, na loja física e online.', 'Promoção quente', 'images/brasa-promo1.jpg', 'images/brasa-promo2.jpg', 'images/brasa-promo3.jpg')
  on conflict (id) do nothing;

insert into public.products (slug, name, category, description, price_mt, image_url, sort_order, published) values
  ('arrachera-piquin', 'Arrachera Piquin', 'Hambúrgueres da Brasa', 'Carne suculenta, queijo americano, fraldinha, guacamole, chipotle, cebola grelhada, molho da casa, alface', 620, 'images/brasa-menu-burgers.jpg', 1, true),
  ('chilli', 'Hambúrguer Chilli', 'Hambúrgueres da Brasa', 'Carne suculenta com queijo americano duplo, bacon, anel de cebola, chilli delicioso, molho chipotle, alface', 580, 'images/brasa-menu-cachorros.jpg', 2, true),
  ('bacon-bbq', 'BACON BBQ', 'Hambúrgueres da Brasa', 'Carne suculenta, molho BBQ, bacon crocante, molho chipotle, queijo americano, cebola grelhada, alface', 580, 'images/brasa-menu-tacos.jpg', 3, true),
  ('supreme', 'Supreme', 'Cachorros', 'Salsicha, chilli, queijo americano derretido, frita, mostarda e ketchup', 320, 'images/photo-1586816001966-79b736744398.jpg', 4, true),
  ('monterrey', 'Monterrey', 'Cachorros', 'Salsicha, bife, queijo mozzarella, cebola grelhada, maionese', 320, 'images/photo-1568901346375-23c9450c58cd.jpg', 5, true),
  ('cali', 'Cali', 'Cachorros', 'Salsicha, carne al pastor, alface, tomate, queijo mozzarella, maionese', 320, 'images/photo-1550547660-d9450f859349.jpg', 6, true),
  ('tacos-3', '3 Tacos', 'Tacos', 'À escolha da carne, servidos com arroz e feijão. Inclui cebola e coentros', 420, 'images/photo-1551504734-5ee1c4a1479b.jpg', 7, true)
  on conflict (slug) do nothing;
