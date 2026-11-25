-- Variantes (SKU) también para notebooks: modelo · memoria · almacenamiento ·
-- condición (sin color). Mismo modelo grupo › variante › unidad que los
-- celulares (plan 024), en la misma tabla `variantes` con `categoria`.
--
-- 1) `variantes.memoria` ('' en celulares) y `categoria` acepta 'notebook'.
-- 2) Helpers `clave_notebook`/`slug_notebook`: equivalen a `claveVariante`/
--    `skuSugerido` de `lib/variantes.ts` con `categoria: "notebook"`.
-- 3) `notebooks.variante_id` (FK, on delete restrict) + `precio_propio`.
-- 4) Backfill: una variante por clave, precio = moda de las unidades.
--
-- `variante_id` queda NULLABLE acá (producción todavía corre código que
-- inserta notebooks sin variante); el NOT NULL va en
-- `20261124200000_variantes_not_null.sql`, junto con el de celulares.

alter table public.variantes
  add column memoria text not null default '';

alter table public.variantes drop constraint variantes_categoria_check;
alter table public.variantes
  add constraint variantes_categoria_check check (categoria in ('celular', 'notebook'));

-- Clave: modelo|memoria|almacenamiento|CONDICIÓN (memoria y almacenamiento sin
-- espacios: «16 GB» = «16GB»).
create or replace function public.clave_notebook(
  p_modelo text,
  p_memoria text,
  p_almacenamiento text,
  p_condicion text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.norm_txt(p_modelo) || '|' ||
         replace(public.norm_txt(coalesce(p_memoria, '')), ' ', '') || '|' ||
         replace(public.norm_txt(coalesce(p_almacenamiento, '')), ' ', '') || '|' ||
         upper(trim(coalesce(p_condicion, '')))
$$;

-- SKU: MODELO-MEMORIA-ALMACENAMIENTO-NUEVO|USADO.
create or replace function public.slug_notebook(
  p_modelo text,
  p_memoria text,
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
          replace(public.norm_txt(coalesce(p_memoria, '')), ' ', '') || '-' ||
          replace(public.norm_txt(coalesce(p_almacenamiento, '')), ' ', '') || '-' ||
          case
            when trim(coalesce(p_condicion, '')) = '' then ''
            when upper(trim(p_condicion)) = 'NUEVO' then 'nuevo'
            else 'usado'
          end
        ),
        '[^A-Z0-9]+', '-', 'g'
      )),
      ''
    ),
    'NOTEBOOK'
  )
$$;

revoke all on function public.clave_notebook(text, text, text, text) from public, anon;
revoke all on function public.slug_notebook(text, text, text, text) from public, anon;

alter table public.notebooks
  add column variante_id uuid references public.variantes (id) on delete restrict,
  add column precio_propio boolean not null default false;

create index notebooks_variante_id_idx on public.notebooks (variante_id);

-- ── Backfill ──
with base as (
  select
    n.organization_id,
    coalesce(nullif(trim(n.modelo), ''), 'Notebook') as modelo,
    trim(coalesce(n.memoria, '')) as memoria,
    trim(coalesce(n.almacenamiento, '')) as almacenamiento,
    n.condicion,
    public.clave_notebook(
      coalesce(nullif(trim(n.modelo), ''), 'Notebook'), n.memoria, n.almacenamiento, n.condicion
    ) as clave,
    n.precio_usd,
    n.created_at
  from public.notebooks n
),
grupos as (
  select
    organization_id,
    clave,
    (array_agg(modelo order by created_at))[1] as modelo,
    (array_agg(memoria order by created_at))[1] as memoria,
    (array_agg(almacenamiento order by created_at))[1] as almacenamiento,
    (array_agg(condicion order by created_at))[1] as condicion
  from base
  group by organization_id, clave
),
moda as (
  select organization_id, clave, precio_usd
  from (
    select organization_id, clave, precio_usd,
      row_number() over (
        partition by organization_id, clave order by count(*) desc, precio_usd desc
      ) as rn
    from base
    group by organization_id, clave, precio_usd
  ) ranking
  where rn = 1
),
con_sku as (
  select g.*, m.precio_usd,
    public.slug_notebook(g.modelo, g.memoria, g.almacenamiento, g.condicion) as slug,
    row_number() over (
      partition by g.organization_id,
        public.slug_notebook(g.modelo, g.memoria, g.almacenamiento, g.condicion)
      order by g.clave
    ) as duplicado
  from grupos g
  join moda m on m.organization_id = g.organization_id and m.clave = g.clave
)
insert into public.variantes (
  organization_id, categoria, grupo, sku, modelo, memoria, almacenamiento,
  condicion, color, clave, precio_usd
)
select
  c.organization_id, 'notebook', c.modelo,
  -- Sufijo si el slug ya lo usa otra variante de la org (o se repite acá).
  c.slug || case
    when c.duplicado > 1 then '-' || c.duplicado
    when exists (
      select 1 from public.variantes v
      where v.organization_id = c.organization_id and v.sku = c.slug
    ) then '-' || substr(md5(c.clave), 1, 4)
    else ''
  end,
  c.modelo, c.memoria, c.almacenamiento, c.condicion, '', c.clave, coalesce(c.precio_usd, 0)
from con_sku c;

update public.notebooks n
set variante_id = v.id,
    precio_propio = (n.precio_usd is distinct from v.precio_usd)
from public.variantes v
where v.organization_id = n.organization_id
  and v.categoria = 'notebook'
  and v.clave = public.clave_notebook(
    coalesce(nullif(trim(n.modelo), ''), 'Notebook'), n.memoria, n.almacenamiento, n.condicion
  );
