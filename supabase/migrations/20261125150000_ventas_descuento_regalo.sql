-- Plan 026: descuento de la venta e ítems de regalo (versión aplicada 25/11).
--
-- 1) `ventas.descuento_usd`: total descontado (U$, >= 0). El descuento se
--    prorratea en `venta_items.precio_usd` al guardar, así todo lo que suma
--    desde los ítems (margen, Analíticas, dashboard) sigue correcto.
-- 2) `venta_items.precio_lista_usd`: precio antes del descuento, solo cuando
--    la línea fue tocada por el descuento (NULL = el efectivo es el de lista).
-- 3) `venta_items.regalo`: ítem de regalo (precio 0 forzado, conserva el
--    costo).
--
-- Revisión posterior (25/11): `20261125160000_ventas_ajuste_regalo.sql`
-- renombra `descuento_usd` a `ajuste_usd` (firmado: >0 descuenta, <0 recarga)
-- y agrega `ventas.regalo` (la venta entera es un regalo).

alter table public.ventas
  add column descuento_usd numeric not null default 0 check (descuento_usd >= 0);

alter table public.venta_items
  add column regalo boolean not null default false,
  add column precio_lista_usd numeric
    check (precio_lista_usd is null or precio_lista_usd >= 0);

-- Un regalo nunca tiene precio (el server además lo fuerza).
alter table public.venta_items
  add constraint venta_items_regalo_sin_precio check (not regalo or precio_usd = 0);
