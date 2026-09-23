-- Falta "egreso" (repuestos consumidos por una venta/reparación, stock que
-- sale sin ser una baja del ítem en sí) -- ver lib/db/ventas.ts.
alter table public.movimientos_stock drop constraint movimientos_stock_tipo_check;
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check
  check (tipo in ('ingreso', 'egreso', 'edicion', 'baja', 'recuento'));
