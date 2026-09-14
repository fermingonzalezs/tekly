-- RLS filtra FILAS, pero antes de eso Postgres exige permiso de tabla --
-- crear las tablas vía migración (en vez del flujo normal del dashboard,
-- que hace esto solo) se saltó ese GRANT. Sin esto, cualquier query da
-- "permission denied for table X" antes de que la policy de RLS entre en
-- juego. Ver: https://supabase.com/docs/guides/api/securing-your-api

-- organizations / profiles: authenticated solo lee (altas/cambios de rol
-- van por service role o por las RPC security definer ya creadas).
grant select on public.organizations to authenticated;
grant select on public.profiles to authenticated;

-- Tablas de negocio: authenticated hace las 4 operaciones -- ya están
-- acotadas por sus policies de RLS (organization_id = la propia).
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'servicios', 'proveedores', 'tickets', 'equipos',
    'repuestos', 'otros_items', 'movimientos_stock', 'turnos', 'ventas',
    'cajas', 'conciliaciones', 'movimientos_caja', 'movimientos_cc',
    'compras', 'listas_difusion'
  ]
  loop
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      t
    );
  end loop;
end $$;

-- service_role bypassa RLS pero igual necesita el GRANT de base -- se usa
-- desde lib/auth (signup, invitaciones) y para scripts/administración.
grant select, insert, update, delete on all tables in schema public to service_role;
