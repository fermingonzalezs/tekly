-- Plan 020: «Mercadería» (canje) deja de ser una caja.
--
-- El canje sigue siendo un medio de pago de la venta, pero ya no es una caja
-- ni genera `movimientos_caja`: el equipo recibido entra al inventario como
-- celular `en_revision` (el código nuevo lo hace en `createVenta`). Esta
-- migración limpia los datos viejos:
--
--   1) Los pagos de ventas con `medio = 'canje'` dejan de apuntar a la caja.
--   2) Se borra el ingreso fantasma y la caja de canje.
--
-- ⚠️ APLICAR RECIÉN CON EL CÓDIGO DEL PLAN 020 DESPLEGADO: la app vieja sigue
-- pidiendo una caja de canje para cobrar con «Mercadería». Antes de correrla,
-- confirmar con el dueño que el movimiento a borrar es dato de prueba (la
-- caja «CANJE» debe estar sin conciliar y su movimiento ser un seed).
--
-- Estado relevado el 2026-10-17 (proyecto `tekly`): una caja «CANJE» (USD,
-- org UPDATE TECH) con 1 movimiento (ingreso USD 210, «Venta a Valentina
-- López», `venta_id` seed) y 1 venta con un pago `canje` apuntándole; 0
-- compras de canje y 0 conciliaciones con esa caja.

-- 1) Los pagos canje dejan de apuntar a la caja.
update public.ventas v
set pagos = (
  select coalesce(jsonb_agg(
           case when p->>'medio' = 'canje' then (p - 'cajaId') else p end), '[]'::jsonb)
  from jsonb_array_elements(v.pagos) p)
where exists (
  select 1 from jsonb_array_elements(v.pagos) p where p->>'medio' = 'canje'
);

-- 2) Fuera el ingreso fantasma y la caja.
delete from public.movimientos_caja
where caja_id in (select id from public.cajas where medio_pago = 'canje');

delete from public.cajas where medio_pago = 'canje';
