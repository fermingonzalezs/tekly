-- Compras / Ingresos (plan 025, fase 1): toda entrada de stock pasa por una
-- compra. Una compra puede «subir al stock» (crea las unidades) o no (gasto).
--
-- 1) `compras.sube_stock`, `costos_adicionales_usd`, `notas`.
-- 2) `compra_items`: un renglón por ítem de una compra que sube al stock,
--    con el vínculo a la unidad/ítem creado. Es el historial de Ingresos.
--    `compras.items` (jsonb) sigue siendo el snapshot que leen Analíticas,
--    resúmenes y el detalle -- no se toca.
-- 3) `celulares.compra_id`, `notebooks.compra_id` y
--    `movimientos_stock.compra_id`: de qué compra vino cada ingreso.

alter table public.compras
  add column sube_stock boolean not null default false,
  add column costos_adicionales_usd numeric not null default 0
    check (costos_adicionales_usd >= 0),
  add column notas text;

create table public.compra_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  compra_id uuid not null references public.compras (id) on delete cascade,
  tipo text not null check (tipo in ('celular', 'notebook', 'repuesto', 'otro')),
  detalle text not null,
  cantidad integer not null default 1 check (cantidad > 0),
  costo_usd numeric not null default 0 check (costo_usd >= 0),
  costo_adicional_usd numeric not null default 0 check (costo_adicional_usd >= 0),
  serie text,
  variante_id uuid references public.variantes (id) on delete set null,
  celular_id uuid references public.celulares (id) on delete set null,
  notebook_id uuid references public.notebooks (id) on delete set null,
  repuesto_id uuid references public.repuestos (id) on delete set null,
  otro_id uuid references public.otros_items (id) on delete set null,
  created_at timestamptz not null default now()
);

create index compra_items_org_created_idx on public.compra_items (organization_id, created_at desc);
create index compra_items_compra_idx on public.compra_items (compra_id);
create index compra_items_variante_idx on public.compra_items (variante_id);
create index compra_items_celular_idx on public.compra_items (celular_id);
create index compra_items_notebook_idx on public.compra_items (notebook_id);
create index compra_items_repuesto_idx on public.compra_items (repuesto_id);
create index compra_items_otro_idx on public.compra_items (otro_id);

alter table public.compra_items enable row level security;

create policy compra_items_select on public.compra_items
  for select to authenticated
  using (organization_id = public.current_user_org_id());

create policy compra_items_insert on public.compra_items
  for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy compra_items_update on public.compra_items
  for update to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir())
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

-- Sin rol admin a propósito (igual que `compras`): `createCompra` compensa
-- una falla borrando lo que alcanzó a crear con la sesión de un técnico.
create policy compra_items_delete on public.compra_items
  for delete to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir());

revoke all on public.compra_items from anon;
grant select, insert, update, delete on public.compra_items to authenticated, service_role;

alter table public.celulares
  add column compra_id uuid references public.compras (id) on delete set null;
create index celulares_compra_idx on public.celulares (compra_id);

alter table public.notebooks
  add column compra_id uuid references public.compras (id) on delete set null;
create index notebooks_compra_idx on public.notebooks (compra_id);

alter table public.movimientos_stock
  add column compra_id uuid references public.compras (id) on delete set null;
create index movimientos_stock_compra_idx on public.movimientos_stock (compra_id);

-- Quién cargó el ingreso (columna del historial «Ingresos»).
alter table public.compra_items add column usuario_nombre text;
