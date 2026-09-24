-- Entrega de ticket (Reparaciones): pago registrado al entregar el equipo
-- (mismo shape que Venta.pagos/Turno.pagos, ver lib/types.ts) + el link para
-- que el movimiento de caja/cuenta corriente que genera sepa de qué ticket
-- vino -- mismo patrón que movimientos_caja.venta_id/movimientos_cc.venta_id
-- (20260917000002_medios_pago_y_venta_links.sql).

alter table public.tickets
  add column pagos jsonb;

alter table public.movimientos_caja
  add column ticket_id bigint references public.tickets (id) on delete set null;
create index movimientos_caja_ticket_id_idx on public.movimientos_caja (ticket_id);

alter table public.movimientos_cc
  add column ticket_id bigint references public.tickets (id) on delete set null;
create index movimientos_cc_ticket_id_idx on public.movimientos_cc (ticket_id);
