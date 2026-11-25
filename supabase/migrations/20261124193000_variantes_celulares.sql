-- Plan 024: variantes (SKU) de celulares -- grupo › variante › unidad.
--
-- 1) Tabla `variantes` (una por org) + RLS/grants como cualquier tabla de
--    negocio (org_puede_escribir en insert/update/delete, delete admin).
-- 2) Columnas nuevas en `celulares`: `variante_id` (FK, on delete restrict) y
--    `precio_propio`.
-- 3) Backfill: una variante por (modelo, almacenamiento, condición)
--    normalizados, **sin color** (cualquier color), con precio = moda de las
--    unidades y SKU derivado del slug (desambiguado con -2, -3…).
-- 4) `variante_id` queda NOT NULL: ninguna vía futura puede crear un celular
--    sin variante.
--
-- La lógica de negocio (clave, SKU, stock, precios) vive en TypeScript
-- (`lib/variantes.ts` + `lib/db/variantes.ts`); acá solo hay integridad.
--
-- Verificación (correr después de aplicar; todas deben dar 0 / lo esperado):
--   V1  select count(*) from public.celulares where variante_id is null;   -- 0
--   V2  select count(*) from public.celulares c join public.variantes v
--         on v.id = c.variante_id
--       where v.clave <> public.clave_celular(
--         coalesce(nullif(trim(c.modelo), ''), 'Celular'),
--         c.almacenamiento, c.condicion, '');                              -- 0
--   V3  select count(*) from public.variantes v
--       where not exists (select 1 from public.celulares c where c.variante_id = v.id); -- 0
--   V4  select count(*) from (select organization_id, sku from public.variantes
--         group by 1, 2 having count(*) > 1) x;                            -- 0
--   V5  select has_table_privilege('anon', 'public.variantes', 'select');  -- false


-- ── 1) Helpers de normalización (solo para el backfill y verificaciones) ──
-- Equivalen a `normalizar`/`claveVariante` de `lib/variantes.ts`.

create or replace function public.norm_txt(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(
    translate(
      trim(coalesce(p, '')),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    ),
    '\s+', ' ', 'g'
  ))
$$;

create or replace function public.clave_celular(
  p_modelo text,
  p_almacenamiento text,
  p_condicion text,
  p_color text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.norm_txt(p_modelo) || '|' ||
         replace(public.norm_txt(coalesce(p_almacenamiento, '')), ' ', '') || '|' ||
         upper(trim(coalesce(p_condicion, ''))) || '|' ||
         public.norm_txt(coalesce(p_color, ''))
$$;

-- Slug del SKU: mismo formato que `skuSugerido` (MODELO-ALMACENAMIENTO-CONDICIÓN).
create or replace function public.slug_celular(
  p_modelo text,
  p_almacenamiento text,
  p_condicion text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        upper(
          public.norm_txt(p_modelo) || '-' ||
          replace(public.norm_txt(coalesce(p_almacenamiento, '')), ' ', '') || '-' ||
          public.norm_txt(coalesce(p_condicion, ''))
        ),
        '[^A-Z0-9]+', '-', 'g'
      )),
      ''
    ),
    'CELULAR'
  )
$$;

revoke all on function public.norm_txt(text) from public, anon;
revoke all on function public.clave_celular(text, text, text, text) from public, anon;
revoke all on function public.slug_celular(text, text, text) from public, anon;


-- ── 2) Tabla `variantes` ─────────────────────────────────────────────────

create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  -- Se amplía cuando las notebooks también tengan variantes.
  categoria text not null default 'celular' check (categoria in ('celular')),
  grupo text not null check (trim(grupo) <> ''),
  sku text not null check (trim(sku) <> ''),
  modelo text not null check (trim(modelo) <> ''),
  almacenamiento text not null default '',
  condicion text not null default '',
  -- '' = cualquier color: cada unidad carga el suyo.
  color text not null default '',
  -- `claveVariante(...)` de `lib/variantes.ts` (modelo|almacenamiento|COND|color).
  clave text not null,
  precio_usd numeric not null default 0 check (precio_usd >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  unique (organization_id, categoria, clave)
);

create index variantes_organization_id_grupo_idx
  on public.variantes (organization_id, grupo);

alter table public.variantes enable row level security;

create policy variantes_select on public.variantes
  for select to authenticated
  using (organization_id = public.current_user_org_id());

create policy variantes_insert on public.variantes
  for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy variantes_update on public.variantes
  for update to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir())
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy variantes_delete on public.variantes
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.variantes from anon;
grant select, insert, update, delete on public.variantes to authenticated, service_role;


-- ── 3) Unidades: variante + precio propio ────────────────────────────────

alter table public.celulares
  add column variante_id uuid references public.variantes (id) on delete restrict,
  add column precio_propio boolean not null default false;

create index celulares_variante_id_idx on public.celulares (variante_id);


-- ── 4) Backfill: una variante sin color por modelo/almacenamiento/condición ──

with base as (
  select
    c.organization_id,
    coalesce(nullif(trim(c.modelo), ''), 'Celular') as modelo,
    trim(coalesce(c.almacenamiento, '')) as almacenamiento,
    trim(coalesce(c.condicion, '')) as condicion,
    public.clave_celular(
      coalesce(nullif(trim(c.modelo), ''), 'Celular'),
      c.almacenamiento,
      c.condicion,
      ''
    ) as clave,
    c.precio_usd,
    c.created_at
  from public.celulares c
),
grupos as (
  select
    organization_id,
    clave,
    (array_agg(modelo order by created_at, clave))[1] as modelo,
    (array_agg(almacenamiento order by created_at, clave))[1] as almacenamiento,
    (array_agg(condicion order by created_at, clave))[1] as condicion
  from base
  group by organization_id, clave
),
moda as (
  select organization_id, clave, precio_usd
  from (
    select
      organization_id,
      clave,
      precio_usd,
      row_number() over (
        partition by organization_id, clave
        order by count(*) desc, precio_usd desc
      ) as rn
    from base
    group by organization_id, clave, precio_usd
  ) ranking
  where rn = 1
),
con_sku as (
  select
    g.*,
    m.precio_usd,
    row_number() over (
      partition by g.organization_id,
        public.slug_celular(g.modelo, g.almacenamiento, g.condicion)
      order by g.clave
    ) as duplicado
  from grupos g
  join moda m
    on m.organization_id = g.organization_id
   and m.clave = g.clave
)
insert into public.variantes (
  organization_id, categoria, grupo, sku, modelo, almacenamiento,
  condicion, color, clave, precio_usd, stock_minimo, activa
)
select
  organization_id,
  'celular',
  modelo,
  public.slug_celular(modelo, almacenamiento, condicion)
    || case when duplicado > 1 then '-' || duplicado else '' end,
  modelo,
  almacenamiento,
  condicion,
  '',
  clave,
  coalesce(precio_usd, 0),
  0,
  true
from con_sku;

-- Asignar cada unidad a su variante (todas son «cualquier color»).
update public.celulares c
set variante_id = v.id
from public.variantes v
where v.organization_id = c.organization_id
  and v.categoria = 'celular'
  and v.clave = public.clave_celular(
    coalesce(nullif(trim(c.modelo), ''), 'Celular'),
    c.almacenamiento,
    c.condicion,
    ''
  );

-- Normalizar en la unidad los campos clave (solo mayúsculas/espacios de más).
update public.celulares c
set modelo = v.modelo,
    almacenamiento = nullif(v.almacenamiento, ''),
    condicion = nullif(v.condicion, '')
from public.variantes v
where v.id = c.variante_id
  and (
    c.modelo is distinct from v.modelo
    or coalesce(c.almacenamiento, '') is distinct from v.almacenamiento
    or coalesce(c.condicion, '') is distinct from v.condicion
  );

-- La unidad conserva su precio cuando difiere del de la variante.
update public.celulares c
set precio_propio = (c.precio_usd is distinct from v.precio_usd)
from public.variantes v
where v.id = c.variante_id;

-- `variante_id` NO queda NOT NULL acá: local y producción comparten la base y
-- el código de producción (anterior al plan 024) inserta celulares sin
-- variante. El NOT NULL va en `20261124200000_variantes_not_null.sql`, que se
-- aplica recién después de deployar el plan 024 (re-asigna los celulares que
-- se cargaron sin variante mientras tanto).
