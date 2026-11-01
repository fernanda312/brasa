-- BRASA — Row Level Security. Run AFTER 20261101000001.
-- Rules, in plain words:
--  * anyone may read published products and the settings row;
--  * a customer sees only their own profile, orders and chats;
--  * an admin (profiles.is_admin = true) sees and manages everything;
--  * nobody may change another customer's data.
-- The admin email gate in admin.html is a second, UI-level check; RLS is
-- the real enforcement. The owner must grant is_admin to the admin account
-- in the SQL editor (see ATIVAR-BRASA.md) — the site never sets it by itself.

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- profiles: own row readable/writable; admin reads all.
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles admin" on public.profiles;
create policy "profiles admin" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- products: public read of published only; admin writes.
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (published = true);
drop policy if exists "products admin" on public.products;
create policy "products admin" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- site_settings: public read; admin writes.
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings
  for select using (true);
drop policy if exists "settings admin" on public.site_settings;
create policy "settings admin" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: own only; admin all. Insert is by the signed-in owner.
drop policy if exists "orders own" on public.orders;
create policy "orders own" on public.orders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "orders admin" on public.orders;
create policy "orders admin" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- order_items: visible when the parent order is visible to the caller.
drop policy if exists "order_items own" on public.order_items;
create policy "order_items own" on public.order_items
  for all using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
drop policy if exists "order_items admin" on public.order_items;
create policy "order_items admin" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- conversations: own only; admin all.
drop policy if exists "conversations own" on public.conversations;
create policy "conversations own" on public.conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "conversations admin" on public.conversations;
create policy "conversations admin" on public.conversations
  for all using (public.is_admin()) with check (public.is_admin());

-- messages: visible when the conversation belongs to the caller.
drop policy if exists "messages own" on public.messages;
create policy "messages own" on public.messages
  for all using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
drop policy if exists "messages admin" on public.messages;
create policy "messages admin" on public.messages
  for all using (public.is_admin()) with check (public.is_admin());
