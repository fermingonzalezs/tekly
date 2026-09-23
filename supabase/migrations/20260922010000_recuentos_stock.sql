-- Recuento de inventario como entidad propia (mismo criterio que
-- `conciliaciones` en Cajas): alguien cuenta (encontrado/no encontrado para
-- equipos, cantidad real para repuestos/otros) y el resultado queda
-- `pendiente` -- no toca `equipos`/`repuestos`/`otros_items` todavía. Un
-- admin lo revisa después, línea por línea (ver `resolverRecuento` en
-- lib/db/inventario.ts) y recién ahí se aplican los cambios reales.
create table public.recuentos_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  tipo text not null check (tipo in ('equipos', 'repuestos', 'otros')),
  fecha timestamptz not null default now(),
  responsable_id uuid references public.profiles (id),
  responsable_nombre text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revisado')),
  revisado_por_id uuid references public.profiles (id),
  revisado_por_nombre text,
  revisado_en timestamptz,
  -- Array de RecuentoLineaEquipo | RecuentoLineaCantidad (lib/types.ts) --
  -- solo las diferencias, no cada ítem contado.
  lineas jsonb not null default '[]'
);

alter table public.recuentos_stock enable row level security;

create policy recuentos_stock_select on public.recuentos_stock for select to authenticated
  using (organization_id = public.current_user_org_id());
create policy recuentos_stock_insert on public.recuentos_stock for insert to authenticated
  with check (organization_id = public.current_user_org_id());
create policy recuentos_stock_update on public.recuentos_stock for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());
create policy recuentos_stock_delete on public.recuentos_stock for delete to authenticated
  using (organization_id = public.current_user_org_id());

grant select, insert, update, delete on public.recuentos_stock to authenticated;
grant select, insert, update, delete on public.recuentos_stock to service_role;

create index recuentos_stock_organization_id_idx on public.recuentos_stock (organization_id);
create index recuentos_stock_estado_idx on public.recuentos_stock (estado);
