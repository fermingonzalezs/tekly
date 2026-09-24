-- Espacio de "Aclaraciones" al final del Ticket de egreso, editable por
-- organización en Configuración → Recibos -- mismo patrón que
-- reparacion_aclaraciones_ingreso (ver 20260924000000_reparacion_aclaraciones_ingreso.sql).

alter table public.organizations
  add column reparacion_aclaraciones_egreso text;
