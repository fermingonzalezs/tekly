-- «Reportar un problema» con respuesta: el admin de plataforma marca el
-- reporte como resuelto contando qué se arregló, y al usuario que lo mandó le
-- aparece en la campanita de notificaciones hasta que la ve.
--
-- Todo se lee/escribe por service role (la tabla sigue sin policy de select
-- ni de update para `authenticated`): el admin pasa por
-- `requirePlatformAdmin`, y el usuario solo toca sus propios reportes
-- (`usuario_id = sesión`) desde `lib/db/reportes.ts`.

alter table public.reportes_bugs
  add column estado text not null default 'abierto'
    check (estado in ('abierto', 'resuelto')),
  add column respuesta text,
  add column resuelto_at timestamptz,
  -- Cuándo vio el usuario la respuesta (null = notificación sin leer).
  add column visto_at timestamptz;

grant update on public.reportes_bugs to service_role;

create index reportes_bugs_usuario_resueltos_idx
  on public.reportes_bugs (usuario_id, resuelto_at desc)
  where estado = 'resuelto';
