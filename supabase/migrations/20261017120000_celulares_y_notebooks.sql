-- Plan 018: "Equipos" pasa a "Celulares" y se suma la categoría "Notebooks".
--
-- 1) Renombra `equipos` -> `celulares` (policies, índices y constraints
--    incluidos) y las columnas/valores guardados que apuntan a ella.
-- 2) Crea `notebooks` (unidad única con número de serie, mismos estados que
--    celulares) con RLS de las 4 policies + org_puede_escribir() + delete admin.
-- 3) Habilita 'notebook' en venta_items / movimientos_stock.
--
-- OJO: el código desplegado que lea `equipos` deja de andar al aplicar esto.


-- ── 1) equipos -> celulares ────────────────────────────────────────────
alter table public.equipos rename to celulares;
alter index public.equipos_organization_id_idx rename to celulares_organization_id_idx;
alter table public.celulares rename constraint equipos_organization_id_imei_key to celulares_organization_id_imei_key;
alter table public.celulares rename constraint equipos_organization_id_fkey to celulares_organization_id_fkey;
alter table public.celulares rename constraint equipos_estado_check to celulares_estado_check;
alter table public.celulares rename constraint equipos_pkey to celulares_pkey;

alter policy equipos_select on public.celulares rename to celulares_select;
alter policy equipos_insert on public.celulares rename to celulares_insert;
alter policy equipos_update on public.celulares rename to celulares_update;
alter policy equipos_delete on public.celulares rename to celulares_delete;

-- venta_items.equipo_id -> celular_id
alter table public.venta_items rename column equipo_id to celular_id;
alter table public.venta_items rename constraint venta_items_equipo_id_fkey to venta_items_celular_id_fkey;

-- turnos.equipo_ids -> celular_ids
alter table public.turnos rename column equipo_ids to celular_ids;

-- Valores guardados: categoria de venta_items, item_type de movimientos_stock
-- y tipo de recuentos_stock. Se suelta el check, se migran los datos y se
-- vuelve a crear con el vocabulario nuevo.
alter table public.venta_items drop constraint venta_items_categoria_check;
update public.venta_items set categoria = 'celular' where categoria = 'equipo';

alter table public.movimientos_stock drop constraint movimientos_stock_item_type_check;
update public.movimientos_stock set item_type = 'celular' where item_type = 'equipo';
alter table public.movimientos_stock add constraint movimientos_stock_item_type_check
  check (item_type in ('celular', 'notebook', 'repuesto', 'otro'));

alter table public.recuentos_stock drop constraint recuentos_stock_tipo_check;
update public.recuentos_stock set tipo = 'celulares' where tipo = 'equipos';
alter table public.recuentos_stock add constraint recuentos_stock_tipo_check
  check (tipo in ('celulares', 'repuestos', 'otros'));

-- Listas de Difusión: las entradas `tipo: "equipo"` (jsonb anidado en
-- `secciones`) pasan a `"celular"`. Hoy no hay filas con eso; queda por si
-- aparece alguna antes de aplicar.
update public.listas_difusion
set secciones = replace(secciones::text, '"tipo": "equipo"', '"tipo": "celular"')::jsonb
where secciones::text like '%"tipo": "equipo"%';
update public.listas_difusion
set secciones = replace(secciones::text, '"tipo":"equipo"', '"tipo":"celular"')::jsonb
where secciones::text like '%"tipo":"equipo"%';

-- ── 2) notebooks ───────────────────────────────────────────────────────
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  modelo text not null,
  cpu text,
  memoria text,
  almacenamiento text,
  pantalla text,
  color text,
  idioma text,
  numero_serie text,
  garantia text,
  notas text,
  costo_usd numeric not null default 0,
  precio_usd numeric not null default 0,
  estado text not null default 'en_revision' check (estado in (
    'en_revision', 'disponible', 'reservado', 'vendido', 'extraviado'
  )),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, numero_serie)
);

create index notebooks_organization_id_idx on public.notebooks (organization_id);

alter table public.notebooks enable row level security;

create policy notebooks_select on public.notebooks
  for select to authenticated
  using (organization_id = public.current_user_org_id());

create policy notebooks_insert on public.notebooks
  for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy notebooks_update on public.notebooks
  for update to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir())
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy notebooks_delete on public.notebooks
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.notebooks from anon;
grant select, insert, update, delete on public.notebooks to authenticated, service_role;

-- ── 3) ventas de notebooks ─────────────────────────────────────────────
alter table public.venta_items
  add column notebook_id uuid references public.notebooks (id);

alter table public.venta_items add constraint venta_items_categoria_check
  check (categoria in ('celular', 'notebook', 'servicio', 'otro', 'libre'));

