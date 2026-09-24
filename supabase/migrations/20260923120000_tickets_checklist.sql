-- Ticket de ingreso/egreso de Reparaciones: datos adicionales del equipo +
-- checklist de estado físico/funcional relevado al recibir y al entregar.
-- Columnas nuevas sobre tablas existentes -- ya tienen RLS + policies +
-- DEFAULT current_user_org_id() en organization_id, no hace falta nada más.

alter table public.tickets
  add column marca text,
  add column reparacion_solicitada text,
  add column clave_codigo text,
  add column descripcion_equipo text,
  add column checklist_ingreso jsonb,
  add column checklist_egreso jsonb;

-- Términos y condiciones de los tickets de reparación (ingreso/egreso/
-- presupuesto) -- mismo criterio que garantia_* de Ventas: texto libre
-- editable en Configuración → Recibos.
alter table public.organizations
  add column reparacion_terminos text;
