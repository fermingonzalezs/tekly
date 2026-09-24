-- Espacio de "Aclaraciones" al final del Ticket de ingreso, editable por
-- organización en Configuración → Recibos -- mismo patrón que los
-- reparacion_terminos_* (ver 20260923150000_reparacion_terminos_split.sql).

alter table public.organizations
  add column reparacion_aclaraciones_ingreso text;
