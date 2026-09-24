-- "Reportar un problema": cualquier usuario de cualquier organización puede
-- mandar un reporte libre desde el UserMenu. Solo lo lee el operador de la
-- app (yo) -- no hay policy de select para `authenticated`, mismo criterio
-- que organizations/profiles pero invertido: ahí el insert es privilegiado
-- y el select es público; acá el insert es público y el select queda
-- afuera de la API para todos los tenants.

create table public.reportes_bugs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  usuario_id uuid references public.profiles (id),
  usuario_nombre text not null,
  usuario_email text not null,
  rol text not null,
  ruta text,
  descripcion text not null,
  created_at timestamptz not null default now()
);

alter table public.reportes_bugs enable row level security;

create policy reportes_bugs_insert on public.reportes_bugs for insert to authenticated
  with check (organization_id = public.current_user_org_id());

grant insert on public.reportes_bugs to authenticated;
grant select, insert on public.reportes_bugs to service_role;
