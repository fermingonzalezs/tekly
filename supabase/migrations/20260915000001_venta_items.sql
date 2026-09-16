-- Normaliza VentaItem: pasa de jsonb embebido en ventas.items a una tabla
-- propia venta_items, para poder agregar en SQL (reportes por ítem/categoría
-- -- ej. margenPorTipo real en Analíticas) en vez de traer todas las ventas
-- a la app y sumar en JS.

create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  venta_id uuid not null references public.ventas (id) on delete cascade,
  detalle text not null,
  cantidad numeric not null,
  precio_usd numeric not null,
  costo_usd numeric,
  equipo_id uuid references public.equipos (id),
  categoria text check (categoria in ('equipo', 'servicio', 'otro', 'libre')),
  created_at timestamptz not null default now()
);

alter table public.venta_items enable row level security;

create policy venta_items_select on public.venta_items for select to authenticated
  using (organization_id = public.current_user_org_id());
create policy venta_items_insert on public.venta_items for insert to authenticated
  with check (organization_id = public.current_user_org_id());
create policy venta_items_update on public.venta_items for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());
create policy venta_items_delete on public.venta_items for delete to authenticated
  using (organization_id = public.current_user_org_id());

grant select, insert, update, delete on public.venta_items to authenticated;
grant select, insert, update, delete on public.venta_items to service_role;

create index venta_items_organization_id_idx on public.venta_items (organization_id);
create index venta_items_venta_id_idx on public.venta_items (venta_id);

-- Backfill: al momento de esta migración hay una sola venta con un solo
-- ítem en producción -- de todas formas el insert es genérico, sirve para
-- cualquier volumen.
insert into public.venta_items
  (organization_id, venta_id, detalle, cantidad, precio_usd, costo_usd, equipo_id, categoria)
select
  v.organization_id,
  v.id,
  item ->> 'detalle',
  (item ->> 'cantidad')::numeric,
  (item ->> 'precioUsd')::numeric,
  (item ->> 'costoUsd')::numeric,
  (item ->> 'equipoId')::uuid,
  item ->> 'categoria'
from public.ventas v, jsonb_array_elements(v.items) as item;

alter table public.ventas drop column items;
