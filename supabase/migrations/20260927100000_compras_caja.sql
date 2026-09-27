-- Compras a proveedor alimentan Finanzas igual que Ventas: la caja de la que
-- salió el pago y el vínculo inverso para poder revertir el egreso al borrar
-- la compra -- mismo patrón que `ventas.venta_id` en `movimientos_caja`
-- (ver lib/db/ventas.ts).

-- 1) `compras` necesita saber a qué caja se debitó el pago (hoy solo guarda
--    medioPago, no cajaId -- con más de una caja para el mismo medio no hay
--    forma de saber cuál, mismo problema que Ventas resolvió con
--    `Pago.cajaId`).
alter table public.compras
  add column caja_id uuid references public.cajas(id) on delete set null;

-- 2) `movimientos_caja` necesita la referencia inversa para poder revertir
--    (borrar el movimiento) si se borra la compra, igual que venta_id.
alter table public.movimientos_caja
  add column compra_id uuid references public.compras(id) on delete set null;
create index movimientos_caja_compra_id_idx on public.movimientos_caja (compra_id);
