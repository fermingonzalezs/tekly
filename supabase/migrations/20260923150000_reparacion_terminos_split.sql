-- "Términos y condiciones" de Reparaciones deja de ser un solo texto
-- compartido -- cada documento (Ticket de ingreso / Presupuesto / Ticket de
-- egreso) tiene el suyo, editable por separado en Configuración → Recibos.

alter table public.organizations
  rename column reparacion_terminos to reparacion_terminos_ingreso;

alter table public.organizations
  add column reparacion_terminos_presupuesto text,
  add column reparacion_terminos_egreso text;
