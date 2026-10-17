-- Plan 019 · fase 2: foto diaria del patrimonio para ver la evolución.
--
-- Una fila por (organización, día). Se escribe de forma perezosa al abrir
-- /patrimonio (no hay cron). Información sensible de costos y saldos: solo el
-- admin la lee y la escribe, y la escritura respeta el plan (solo lectura).

create table public.patrimonio_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  fecha date not null,
  cotizacion numeric not null,
  activo_usd numeric not null,
  pasivo_usd numeric not null,
  patrimonio_usd numeric not null,
  /** Desglose por línea (disponibilidades, créditos, inventario, anticipos). */
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, fecha)
);

create index patrimonio_snapshots_organization_id_idx
  on public.patrimonio_snapshots (organization_id, fecha desc);

alter table public.patrimonio_snapshots enable row level security;

create policy patrimonio_snapshots_select on public.patrimonio_snapshots
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_rol() = 'admin'
  );

create policy patrimonio_snapshots_insert on public.patrimonio_snapshots
  for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

create policy patrimonio_snapshots_update on public.patrimonio_snapshots
  for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

create policy patrimonio_snapshots_delete on public.patrimonio_snapshots
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.patrimonio_snapshots from anon;
grant select, insert, update, delete on public.patrimonio_snapshots to authenticated, service_role;
