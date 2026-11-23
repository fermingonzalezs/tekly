-- Resumen mensual: una fila por (organización, mes) con los números del mes
-- ya calculados y congelados. Lo escribe un cron (pg_cron -> ruta
-- /api/cron/resumen-mensual, con service role) el día 1 de cada mes; nunca la
-- app con la sesión de un usuario, por eso no hay policies de escritura para
-- `authenticated`. Información sensible (costos, márgenes, saldos): solo la
-- lee el admin de la organización.

create table public.resumenes_mensuales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  /** Primer día del mes resumido (`2026-09-01`). */
  periodo date not null check (extract(day from periodo) = 1),
  /** Columnas sueltas para listar/graficar sin abrir el jsonb. */
  facturado_usd numeric not null default 0,
  ventas_cantidad integer not null default 0,
  ganancia_usd numeric,
  cobrado_reparaciones_usd numeric not null default 0,
  compras_usd numeric not null default 0,
  patrimonio_usd numeric,
  /** Detalle completo (ventas, reparaciones, caja, inventario, clientes,
   *  turnos, patrimonio…). Shape versionado por `version`. */
  datos jsonb not null,
  version integer not null default 1,
  /** `cron` = generado a fin de mes; `manual` = lo pidió un admin. */
  origen text not null default 'cron' check (origen in ('cron', 'manual')),
  /** Las fotos al cierre (inventario, saldos, caja, patrimonio) solo son
   *  fieles si se generó pasado el cierre del mes; un resumen manual de un
   *  mes viejo queda en `false` (los flujos por fecha siguen siendo reales). */
  foto_fiable boolean not null default true,
  generado_at timestamptz not null default now(),
  unique (organization_id, periodo)
);

create index resumenes_mensuales_organization_id_idx
  on public.resumenes_mensuales (organization_id, periodo desc);

alter table public.resumenes_mensuales enable row level security;

create policy resumenes_mensuales_select on public.resumenes_mensuales
  for select to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.resumenes_mensuales from anon;
grant select on public.resumenes_mensuales to authenticated;
grant select, insert, update, delete on public.resumenes_mensuales to service_role;
