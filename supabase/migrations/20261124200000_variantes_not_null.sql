-- Plan 024, paso final: aplicar SOLO después de deployar el código del plan
-- 024 a producción (si no, el código viejo no puede crear celulares).
--
-- 1) Celulares cargados sin variante entre la migración
--    `20261124193000_variantes_celulares` y el deploy: se asignan a la
--    variante «cualquier color» con su misma clave, creándola si no existe.
-- 2) `variante_id` pasa a NOT NULL.
--
-- Verificación: select count(*) from public.celulares where variante_id is null; -- 0
--               select count(*) from public.notebooks where variante_id is null;  -- 0

with huerfanos as (
  select
    c.organization_id,
    coalesce(nullif(trim(c.modelo), ''), 'Celular') as modelo,
    trim(coalesce(c.almacenamiento, '')) as almacenamiento,
    trim(coalesce(c.condicion, '')) as condicion,
    public.clave_celular(coalesce(nullif(trim(c.modelo), ''), 'Celular'), c.almacenamiento, c.condicion, '') as clave,
    c.precio_usd,
    c.created_at
  from public.celulares c
  where c.variante_id is null
),
nuevas as (
  select distinct on (organization_id, clave)
    organization_id, clave, modelo, almacenamiento, condicion, precio_usd
  from huerfanos h
  where not exists (
    select 1 from public.variantes v
    where v.organization_id = h.organization_id and v.categoria = 'celular' and v.clave = h.clave
  )
  order by organization_id, clave, created_at
)
insert into public.variantes (organization_id, categoria, grupo, sku, modelo, almacenamiento, condicion, color, clave, precio_usd)
select
  n.organization_id, 'celular', n.modelo,
  -- SKU con sufijo corto para no chocar con uno existente.
  public.slug_celular(n.modelo, n.almacenamiento, n.condicion) || '-' || substr(md5(n.clave), 1, 4),
  n.modelo, n.almacenamiento, n.condicion, '', n.clave, coalesce(n.precio_usd, 0)
from nuevas n;

update public.celulares c
set variante_id = v.id,
    precio_propio = (c.precio_usd is distinct from v.precio_usd)
from public.variantes v
where c.variante_id is null
  and v.organization_id = c.organization_id
  and v.categoria = 'celular'
  and v.clave = public.clave_celular(coalesce(nullif(trim(c.modelo), ''), 'Celular'), c.almacenamiento, c.condicion, '');

alter table public.celulares alter column variante_id set not null;

-- ── Notebooks (variantes de notebooks, `20261124230000_variantes_notebooks`) ──

with huerfanas as (
  select
    n.organization_id,
    coalesce(nullif(trim(n.modelo), ''), 'Notebook') as modelo,
    trim(coalesce(n.memoria, '')) as memoria,
    trim(coalesce(n.almacenamiento, '')) as almacenamiento,
    n.condicion,
    public.clave_notebook(coalesce(nullif(trim(n.modelo), ''), 'Notebook'), n.memoria, n.almacenamiento, n.condicion) as clave,
    n.precio_usd,
    n.created_at
  from public.notebooks n
  where n.variante_id is null
),
nuevas as (
  select distinct on (organization_id, clave)
    organization_id, clave, modelo, memoria, almacenamiento, condicion, precio_usd
  from huerfanas h
  where not exists (
    select 1 from public.variantes v
    where v.organization_id = h.organization_id and v.categoria = 'notebook' and v.clave = h.clave
  )
  order by organization_id, clave, created_at
)
insert into public.variantes (organization_id, categoria, grupo, sku, modelo, memoria, almacenamiento, condicion, color, clave, precio_usd)
select
  n.organization_id, 'notebook', n.modelo,
  public.slug_notebook(n.modelo, n.memoria, n.almacenamiento, n.condicion) || '-' || substr(md5(n.clave), 1, 4),
  n.modelo, n.memoria, n.almacenamiento, n.condicion, '', n.clave, coalesce(n.precio_usd, 0)
from nuevas n;

update public.notebooks n
set variante_id = v.id,
    precio_propio = (n.precio_usd is distinct from v.precio_usd)
from public.variantes v
where n.variante_id is null
  and v.organization_id = n.organization_id
  and v.categoria = 'notebook'
  and v.clave = public.clave_notebook(coalesce(nullif(trim(n.modelo), ''), 'Notebook'), n.memoria, n.almacenamiento, n.condicion);

alter table public.notebooks alter column variante_id set not null;
