-- Precio mayorista + diferencia aceptada en ventas.
--
-- 1. `precio_mayorista_usd` (opcional) en variantes y en cada unidad
--    (celulares, notebooks). La unidad que no tiene uno propio usa el de su
--    variante (`precioMayoristaDe`, lib/precios.ts). Nueva venta lo usa como
--    precio de cada equipo cuando la modalidad es «Mayorista».
-- 2. `ventas.diferencia_usd`: lo que faltó cobrar y se aceptó igual al
--    confirmar la venta (cartel «¿Seguro…?»). El total y los ítems no
--    cambian; 0 = se cobró completo.
--
-- Columnas nuevas en tablas que ya tienen RLS + grants: no hace falta tocar
-- policies.

alter table public.variantes
  add column precio_mayorista_usd numeric(12,2)
    check (precio_mayorista_usd is null or precio_mayorista_usd >= 0);

alter table public.celulares
  add column precio_mayorista_usd numeric(12,2)
    check (precio_mayorista_usd is null or precio_mayorista_usd >= 0);

alter table public.notebooks
  add column precio_mayorista_usd numeric(12,2)
    check (precio_mayorista_usd is null or precio_mayorista_usd >= 0);

alter table public.ventas
  add column diferencia_usd numeric(12,2) not null default 0
    check (diferencia_usd >= 0);
