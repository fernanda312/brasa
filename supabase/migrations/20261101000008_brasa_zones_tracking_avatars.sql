-- BRASA — delivery zones, tracking status, avatars, times. Run AFTER 0007.
-- * delivery_zones: one clear fee per place (Maputo + Matola), edited in
--   Admin > Definições > Zonas de entrega. The checkout shows the zone
--   list; the server (create-payment) reads the fee from this table —
--   the browser-sent fee is never trusted.
-- * orders gain delivery_zone_id + delivery_zone_name (snapshot, so the
--   order keeps its zone even if the zone is later renamed or removed)
--   and the status 'on_the_way' (A caminho) for delivery tracking.
-- * profiles gain avatar_url: the customer's photo, uploaded by file in
--   Conta, shown to the admin in the chat and in Clientes.
-- * site_settings gain prep_time_text + delivery_time_text, shown at
--   checkout and in the order history.
-- * messages + conversations join the realtime publication so new chat
--   messages arrive instantly (polling stays as a safety net).

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.site_settings
  add column if not exists prep_time_text text not null default '30 a 45 minutos',
  add column if not exists delivery_time_text text not null default '45 a 90 minutos';

alter table public.orders
  add column if not exists delivery_zone_id uuid,
  add column if not exists delivery_zone_name text;

-- Widen the status check to include the tracking step 'on_the_way'.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending_payment', 'paid', 'preparing', 'on_the_way', 'delivered', 'cancelled'));

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_mt integer not null check (fee_mt >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.delivery_zones enable row level security;

drop policy if exists "zones public read" on public.delivery_zones;
create policy "zones public read" on public.delivery_zones
  for select using (true);

drop policy if exists "zones admin" on public.delivery_zones;
create policy "zones admin" on public.delivery_zones
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed zones (initial fees, editable in admin; nothing here is final —
-- the buyer changes names and fees in Admin > Definições).
insert into public.delivery_zones (name, fee_mt, sort_order) values
  ('Cidade da Maputo — Baixa', 100, 1),
  ('Polana / Sommerschield', 150, 2),
  ('Costa do Sol', 150, 3),
  ('Hulene / Mavalane', 150, 4),
  ('Zimpeto', 200, 5),
  ('KaTembe', 250, 6),
  ('Matola Cidade', 200, 7),
  ('Machava / Infulene', 250, 8)
on conflict do nothing;

-- Realtime: new messages arrive instantly in the chat (both sides).
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
end $$;
