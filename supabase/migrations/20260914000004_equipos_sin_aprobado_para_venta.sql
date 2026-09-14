-- Se sacó el estado "aprobado_para_venta" (redundante con "disponible" --
-- ambos se trataban igual en Ventas/Difusión, no había ninguna regla que
-- los distinguiera). No hay filas que lo usen hoy, así que no hace falta
-- backfill.
alter table public.equipos drop constraint equipos_estado_check;
alter table public.equipos add constraint equipos_estado_check
  check (estado in ('en_revision', 'disponible', 'reservado', 'vendido'));
