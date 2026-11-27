-- Vuelto de una venta (reporte de Mundo Phone, 26/11): cuánto, en qué medio
-- y de qué caja se le devolvió plata al cliente. Snapshot jsonb con el shape
-- de `VueltoVenta` (lib/types.ts); el egreso real vive en movimientos_caja
-- (venta_id), como el resto de los pagos. La seña no necesita columna: es un
-- pago más con `sena: true` dentro de `ventas.pagos`.
alter table public.ventas add column if not exists vuelto jsonb;

comment on column public.ventas.vuelto is
  'Vuelto entregado al cliente: {medio, cajaId, caja, montoUsd, cotizacion?, montoArs?}. null = sin vuelto.';
