-- Lecturas con IA de "Importar datos": una fila por texto estructurado con
-- éxito. Alimenta el cupo mensual por organización (`lib/ia-lecturas.ts`) y
-- deja registro de los tokens consumidos.
-- Solo service role escribe (la action valida admin + cupo antes de llamar
-- a la API); `authenticated` solo lee las de su organización.
create table public.ia_lecturas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  usuario_id uuid references public.profiles (id) on delete set null,
  entidad text not null check (entidad in ('celulares', 'notebooks', 'clientes')),
  filas integer not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

alter table public.ia_lecturas enable row level security;

create policy ia_lecturas_select on public.ia_lecturas for select to authenticated
  using (organization_id = public.current_user_org_id());

grant select on public.ia_lecturas to authenticated;
grant select, insert, update, delete on public.ia_lecturas to service_role;

create index ia_lecturas_org_created_idx on public.ia_lecturas (organization_id, created_at);
