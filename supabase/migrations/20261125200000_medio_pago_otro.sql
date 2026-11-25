-- Medio de pago «otro» (ej. MercadoPago, una billetera, un cheque): una caja
-- puede ser de cualquier forma de cobro que no sea efectivo, transferencia,
-- cripto ni tarjeta. Se suma a los CHECK de las tres tablas que guardan el
-- medio.
alter table public.cajas drop constraint cajas_medio_pago_check;
alter table public.cajas add constraint cajas_medio_pago_check
  check (medio_pago = any (array['pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'otro', 'canje']));

alter table public.movimientos_caja drop constraint movimientos_caja_medio_pago_check;
alter table public.movimientos_caja add constraint movimientos_caja_medio_pago_check
  check (medio_pago = any (array['pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'otro', 'canje']));

alter table public.compras drop constraint compras_medio_pago_check;
alter table public.compras add constraint compras_medio_pago_check
  check (medio_pago = any (array['pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'otro', 'canje']));
