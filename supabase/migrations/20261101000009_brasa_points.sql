-- BRASA — pickup points + contact texts. Run AFTER 0008.
-- * pickup_points: the several order points (Maputo + Matola) shown in
--   the home page contact section. The customer picks the nearest point
--   and orders in the app — this is an ordering app, not a walk-in guide,
--   so no "Como Chegar" directions are shown. Every point is edited in
--   Admin > Pontos (name, area, city, hours, on/off, add, remove).
-- * site_settings gains contact_text (contact intro) and cta_text
--   (final call-to-action), both edited in Admin > Textos.

create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  city text not null default 'Maputo',
  hours text not null default '11h – 21h',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pickup_points enable row level security;

drop policy if exists "points public read" on public.pickup_points;
create policy "points public read" on public.pickup_points
  for select using (true);

drop policy if exists "points admin" on public.pickup_points;
create policy "points admin" on public.pickup_points
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed points (initial, editable in admin; the buyer replaces them).
insert into public.pickup_points (name, area, city, hours, sort_order) values
  ('BRASA Baixa', 'Baixa', 'Maputo', '11h – 21h', 1),
  ('BRASA Polana', 'Polana', 'Maputo', '11h – 21h', 2),
  ('BRASA Costa do Sol', 'Costa do Sol', 'Maputo', '11h – 21h', 3),
  ('BRASA Zimpeto', 'Zimpeto', 'Maputo', '11h – 21h', 4),
  ('BRASA Matola', 'Matola Cidade', 'Matola', '11h – 21h', 5),
  ('BRASA Machava', 'Machava', 'Matola', '11h – 21h', 6)
on conflict do nothing;

alter table public.site_settings
  add column if not exists contact_text text not null default 'Vem provar o fogo na BRASA, em Maputo. Estamos prontos para acender o teu paladar.',
  add column if not exists cta_text text not null default 'Encomenda pelo aplicativo e recebe em casa ou levanta no ponto mais perto de ti.';
