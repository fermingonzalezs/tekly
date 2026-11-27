-- Notebooks (27/11):
--
-- 1) La variante de una notebook incluye el tamaño de pantalla:
--    `variantes.pantalla` ('' en celulares) y la clave pasa a
--    modelo|memoria|almacenamiento|pantalla|CONDICIÓN (`claveVariante` con
--    `categoria: "notebook"` en `lib/variantes.ts`). La pantalla se compara
--    sin espacios, comillas ni «pulgadas» y con coma = punto (13,6" = 13.6).
--    Backfill: la variante toma la pantalla de sus unidades si todas tienen
--    la misma; si no, queda vacía (cada notebook conserva la suya).
-- 2) Resolución de pantalla y ciclos de batería en `notebooks` (opcionales;
--    los ciclos solo tienen sentido en las usadas).
-- 3) Equipos usados = precio propio por defecto: las unidades usadas no
--    vendidas pasan a `precio_propio = true` (mismo precio que hoy; solo
--    dejan de seguir al de la variante).

-- ── 1) Pantalla en la variante ──
alter table public.variantes
  add column pantalla text not null default '';

create or replace function public.norm_pantalla(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    replace(public.norm_txt(p), ',', '.'),
    '(pulgadas|pulg|["''”″]|\s)', '', 'g'
  )
$$;

create or replace function public.clave_notebook(
  p_modelo text,
  p_memoria text,
  p_almacenamiento text,
  p_pantalla text,
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
         public.norm_pantalla(p_pantalla) || '|' ||
         upper(trim(coalesce(p_condicion, '')))
$$;

-- La versión de 4 argumentos (la usa `20261124200000_variantes_not_null.sql`)
-- queda como «sin pantalla», con el formato nuevo.
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
  select public.clave_notebook(p_modelo, p_memoria, p_almacenamiento, '', p_condicion)
$$;

revoke all on function public.norm_pantalla(text) from public, anon;
revoke all on function public.clave_notebook(text, text, text, text, text) from public, anon;

with pantallas as (
  select n.variante_id,
         min(trim(n.pantalla)) as pantalla
  from public.notebooks n
  where n.variante_id is not null
  group by n.variante_id
  having count(*) filter (where coalesce(trim(n.pantalla), '') = '') = 0
     and count(distinct public.norm_pantalla(n.pantalla)) = 1
)
update public.variantes v
set pantalla = p.pantalla
from pantallas p
where v.id = p.variante_id
  and v.categoria = 'notebook';

update public.variantes
set clave = public.clave_notebook(modelo, memoria, almacenamiento, pantalla, condicion)
where categoria = 'notebook';

-- ── 2) Resolución y ciclos de batería ──
alter table public.notebooks
  add column resolucion text,
  add column ciclos_bateria integer
    constraint notebooks_ciclos_bateria_check check (ciclos_bateria is null or ciclos_bateria >= 0);

-- ── 3) Usados con precio propio ──
update public.celulares
set precio_propio = true
where precio_propio = false
  and estado <> 'vendido'
  and upper(trim(coalesce(condicion, ''))) <> 'NUEVO';

update public.notebooks
set precio_propio = true
where precio_propio = false
  and estado <> 'vendido'
  and condicion = 'usado';
