-- Etapa 1 del rework de medios de pago: recargo por medio (config del
-- negocio), y los vínculos que le faltaban a `ventas` para poder revertir
-- todo lo que generó al borrarla (movimiento de caja, movimiento de cuenta
-- corriente, repuestos consumidos).

alter table public.organizations
  add column recargos_medios_pago jsonb not null default '{}'::jsonb;

alter table public.movimientos_caja
  add column venta_id uuid references public.ventas (id) on delete set null;
create index movimientos_caja_venta_id_idx on public.movimientos_caja (venta_id);

alter table public.movimientos_cc
  add column venta_id uuid references public.ventas (id) on delete set null;
create index movimientos_cc_venta_id_idx on public.movimientos_cc (venta_id);

-- Repuestos usados en un ítem de venta (solo ítems de servicio, ver
-- ventas-client.tsx) -- primer vínculo real entre `repuestos` y `ventas`.
create table public.venta_item_repuestos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  venta_item_id uuid not null references public.venta_items (id) on delete cascade,
  repuesto_id uuid not null references public.repuestos (id),
  cantidad numeric not null check (cantidad > 0)
);

alter table public.venta_item_repuestos enable row level security;

create policy venta_item_repuestos_select on public.venta_item_repuestos for select to authenticated
  using (organization_id = public.current_user_org_id());
create policy venta_item_repuestos_insert on public.venta_item_repuestos for insert to authenticated
  with check (organization_id = public.current_user_org_id());
create policy venta_item_repuestos_update on public.venta_item_repuestos for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());
create policy venta_item_repuestos_delete on public.venta_item_repuestos for delete to authenticated
  using (organization_id = public.current_user_org_id());

grant select, insert, update, delete on public.venta_item_repuestos to authenticated;
grant select, insert, update, delete on public.venta_item_repuestos to service_role;

create index venta_item_repuestos_venta_item_id_idx on public.venta_item_repuestos (venta_item_id);
create index venta_item_repuestos_repuesto_id_idx on public.venta_item_repuestos (repuesto_id);
