-- Plan 023: Turnos → Agenda. Duración, quién atiende y estados atendido / no_vino.
-- Sin policies nuevas: la tabla ya tiene las 4 (organization_id + org_puede_escribir()).

alter table public.turnos
  add column if not exists duracion_min int not null default 30
    check (duracion_min between 5 and 480),
  add column if not exists atiende_id uuid references public.profiles(id) on delete set null;

create index if not exists turnos_atiende_id_idx on public.turnos (atiende_id);
create index if not exists turnos_org_fecha_idx on public.turnos (organization_id, fecha);

-- El check de `estado` se llama distinto según cómo se creó la tabla: se
-- borra el que mire esa columna y se vuelve a crear con los estados nuevos.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.turnos'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.turnos drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.turnos
  add constraint turnos_estado_check
  check (estado in ('pendiente', 'confirmado', 'atendido', 'no_vino', 'cancelado'));
