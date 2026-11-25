-- En el SKU la condición va solo como NUEVO o USADO (los grados A+/A/B+/B/C
-- son todos usados), igual que `condicionSku`/`skuSugerido` de
-- `lib/variantes.ts`. La clave de la variante NO cambia (sigue con el grado).

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
    'CELULAR'
  )
$$;

revoke all on function public.slug_celular(text, text, text) from public, anon;

-- SKU ya creados con un grado en vez de NUEVO/USADO (24/11/2026: solo
-- IPHONE-13-128GB-A). Solo si el SKU nuevo no choca con otro de la org.
update public.variantes v
set sku = public.slug_celular(v.modelo, v.almacenamiento, v.condicion),
    updated_at = now()
where v.categoria = 'celular'
  and upper(trim(v.condicion)) not in ('', 'NUEVO')
  -- solo los SKU que armó el sistema (MODELO-ALMACENAMIENTO-GRADO), no los editados a mano
  and v.sku = public.slug_celular(v.modelo, v.almacenamiento, '')
            || '-' || regexp_replace(upper(public.norm_txt(v.condicion)), '[^A-Z0-9]+', '', 'g')
  and not exists (
    select 1 from public.variantes o
    where o.organization_id = v.organization_id
      and o.id <> v.id
      and o.sku = public.slug_celular(v.modelo, v.almacenamiento, v.condicion)
  );
