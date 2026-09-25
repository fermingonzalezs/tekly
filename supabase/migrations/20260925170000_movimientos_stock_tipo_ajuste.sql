-- Un ajuste de stock disparado al resolver un recuento ("ajustado a N") es
-- un evento propio, distinto del resto de "recuento" (que solo documenta qué
-- se contó/decidió) -- se lo separa como su propio tipo para que la tabla de
-- Movimientos lo distinga con su propio color/label (`movimientoTipo` en
-- lib/status.ts).
alter table public.movimientos_stock drop constraint movimientos_stock_tipo_check;
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check
  check (tipo in ('ingreso', 'egreso', 'edicion', 'baja', 'recuento', 'ajuste'));
