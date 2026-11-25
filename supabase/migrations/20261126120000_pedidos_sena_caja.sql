-- La seña de un pedido es plata real: genera un ingreso en `movimientos_caja`
-- (caja elegida, monto en la moneda de esa caja, cotización del momento),
-- vinculado al pedido por `pedido_id` -- mismo patrón que `ticket_id`/
-- `venta_id`. `pedidos.sena_usd` sigue siendo el equivalente en USD (lo usan
-- el saldo y el chip); el movimiento es la fuente de la caja.
--
-- `on delete set null`: borrar el pedido borra desde la app la seña sin
-- conciliar; una ya conciliada queda en la caja (su conciliación la contó).
-- Las policies/grants de `movimientos_caja` ya cubren la columna nueva.

alter table public.movimientos_caja
  add column pedido_id uuid references public.pedidos(id) on delete set null;

create index movimientos_caja_pedido_id_idx
  on public.movimientos_caja (pedido_id)
  where pedido_id is not null;
