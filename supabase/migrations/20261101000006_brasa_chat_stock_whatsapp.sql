-- BRASA — chat read receipts and stock.
-- read_at on a message = the moment the OTHER side opened the chat and
-- saw it (WhatsApp-style "visto"). Null = sent, not yet seen.
-- stock_qty on a product: null = stock not controlled; 0 = esgotado.
-- whatsapp_url already exists from the core migration; the guard below
-- keeps this file safe to run again.
alter table public.messages
  add column if not exists read_at timestamptz;
alter table public.products
  add column if not exists stock_qty integer;
alter table public.site_settings
  add column if not exists whatsapp_url text not null default '';
