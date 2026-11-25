-- Toda compra tiene proveedor. En un canje (compra generada por una venta
-- cobrada con «Mercadería») el proveedor es el cliente que entregó el
-- equipo: `proveedor_nombre` = `cliente_nombre`, y `proveedor_id` apunta a
-- un `proveedores` con ese nombre (se crea si no existe en la org), igual
-- que `resolveProveedorId` en `lib/db/inventario.ts`.
--
-- Paso 1 (backfill, idempotente): se aplicó el 25/11/2026.
-- Paso 2 (CHECK): aplicar SOLO después de deployar este cambio -- el código
-- viejo de producción crea canjes sin proveedor y la venta fallaría. Antes
-- del CHECK, volver a correr el paso 1 (cubre los canjes creados mientras
-- tanto).

-- ── Paso 1: canjes sin proveedor → el cliente ──
insert into public.proveedores (organization_id, nombre)
select distinct c.organization_id, trim(c.cliente_nombre)
from public.compras c
where c.origen = 'canje'
  and coalesce(trim(c.proveedor_nombre), '') = ''
  and coalesce(trim(c.cliente_nombre), '') <> ''
  and not exists (
    select 1 from public.proveedores p
    where p.organization_id = c.organization_id
      and lower(p.nombre) = lower(trim(c.cliente_nombre))
  );

update public.compras c
set proveedor_nombre = trim(c.cliente_nombre),
    proveedor_id = (
      select p.id from public.proveedores p
      where p.organization_id = c.organization_id
        and lower(p.nombre) = lower(trim(c.cliente_nombre))
      limit 1
    )
where c.origen = 'canje'
  and coalesce(trim(c.proveedor_nombre), '') = ''
  and coalesce(trim(c.cliente_nombre), '') <> '';

-- ── Paso 2 (después del deploy): proveedor obligatorio ──
-- Verificación previa: debe dar 0.
--   select count(*) from public.compras where coalesce(trim(proveedor_nombre), '') = '';
alter table public.compras
  add constraint compras_proveedor_obligatorio
  check (coalesce(trim(proveedor_nombre), '') <> '');
