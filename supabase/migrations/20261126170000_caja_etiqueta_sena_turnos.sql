-- Seña / vuelto como tipo propio del movimiento de caja (pedido del 26/11):
-- `etiqueta` marca los ingresos de seña (ventas, pedidos, turnos) y los
-- egresos de vuelto (ventas), para verlos y filtrarlos en Cajas.
alter table public.movimientos_caja
  add column if not exists etiqueta text
  check (etiqueta in ('sena', 'vuelto'));

-- Seña tomada al agendar un turno: mismo circuito que la de los pedidos
-- (`pedido_id`). Al borrar el turno la seña conciliada queda en la caja.
alter table public.movimientos_caja
  add column if not exists turno_id uuid references public.turnos(id) on delete set null;
create index if not exists movimientos_caja_turno_id_idx
  on public.movimientos_caja (turno_id) where turno_id is not null;

-- Lo que ya existía: señas de pedidos y señas/vueltos de ventas (concepto).
update public.movimientos_caja set etiqueta = 'sena'
  where etiqueta is null and (pedido_id is not null or concepto like 'Seña · %');
update public.movimientos_caja set etiqueta = 'vuelto'
  where etiqueta is null and concepto like 'Vuelto · %';
