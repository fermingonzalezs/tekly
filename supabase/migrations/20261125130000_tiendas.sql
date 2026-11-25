-- Tiendas / páginas de la organización: un negocio puede manejar más de
-- una página desde la misma cuenta (ej. Hellstore y Heavenstore). La venta
-- guarda de qué tienda salió; `tienda_id` null = la tienda principal (el
-- nombre de la organización).
create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index tiendas_org_nombre_uidx on public.tiendas (organization_id, lower(trim(nombre)));

alter table public.tiendas enable row level security;

create policy tiendas_select on public.tiendas
  for select to authenticated
  using (organization_id = public.current_user_org_id());

create policy tiendas_insert on public.tiendas
  for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy tiendas_update on public.tiendas
  for update to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir())
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy tiendas_delete on public.tiendas
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.tiendas from anon;
grant select, insert, update, delete on public.tiendas to authenticated, service_role;

alter table public.ventas
  add column tienda_id uuid references public.tiendas (id) on delete set null;
create index ventas_tienda_idx on public.ventas (tienda_id);
