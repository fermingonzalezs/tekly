-- Configuración: datos del negocio + plantillas de WhatsApp.

-- "Datos del negocio" es 1:1 con la organización (no hace falta una tabla
-- aparte) -- reusa organizations.nombre para el nombre del negocio.
alter table public.organizations
  add column direccion text,
  add column telefono text,
  add column cuit text,
  add column horario text;

-- Sin policy de update para authenticated (igual que ya era): editar datos
-- del negocio es admin-only, va por server action con service role +
-- requireRole("admin"), mismo criterio que signUp/inviteMember en lib/auth.

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade default current_user_org_id(),
  nombre text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

create index whatsapp_templates_organization_id_idx on public.whatsapp_templates (organization_id);

alter table public.whatsapp_templates enable row level security;

create policy whatsapp_templates_select on public.whatsapp_templates
  for select to authenticated
  using (organization_id = public.current_user_org_id());
create policy whatsapp_templates_insert on public.whatsapp_templates
  for insert to authenticated
  with check (organization_id = public.current_user_org_id());
create policy whatsapp_templates_update on public.whatsapp_templates
  for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());
create policy whatsapp_templates_delete on public.whatsapp_templates
  for delete to authenticated
  using (organization_id = public.current_user_org_id());

grant select, insert, update, delete on public.whatsapp_templates to authenticated;
grant select, insert, update, delete on public.whatsapp_templates to service_role;
-- (organizations ya tiene grant completo para service_role desde la
-- migración de grants inicial -- no hace falta repetirlo acá)
