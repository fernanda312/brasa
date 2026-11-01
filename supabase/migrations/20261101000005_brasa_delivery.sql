-- BRASA — delivery / how-it-works / trust texts, editable in admin.
-- New columns on the single site_settings row. Defaults fill the
-- existing row, so the site shows these texts even before the buyer
-- changes them in admin. The buyer changes them in admin > Textos.
alter table public.site_settings
  add column if not exists how_text text not null default '1. Escolhe o produto. 2. Cria a conta com email e senha. 3. Paga por M-Pesa e confirma o PIN no telemóvel. 4. Recebes o recibo no chat e a encomenda na tua conta.',
  add column if not exists delivery_text text not null default 'Entrega em Maputo em 1 a 3 dias úteis, sem custo de entrega. Levantamento na loja em Maputo. Fora de Maputo, fala connosco no chat antes de pagar, para confirmar o prazo.',
  add column if not exists trust_text text not null default 'Loja real em Maputo. Pagamento só por M-Pesa. Cada encomenda paga fica registada na tua conta, com recibo no chat.';
