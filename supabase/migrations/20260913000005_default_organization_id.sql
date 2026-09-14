-- Ninguna tabla de negocio tenía DEFAULT en organization_id -- todo insert
-- sin pasarlo a mano rompía la policy de RLS (WITH CHECK organization_id =
-- current_user_org_id()), porque quedaba NULL. Se descubrió migrando
-- Inventario (insert de equipos), pero afecta a las 16 tablas por igual,
-- incluida `clientes` (su lib/db tampoco lo pasaba). Con el default, el
-- insert de la app no necesita mandarlo, y sigue sin poder spoofearlo
-- (la policy WITH CHECK lo sigue validando igual si alguien lo manda a mano).
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
      'alter table public.%I alter column organization_id set default public.current_user_org_id()',
      t
    );
  end loop;
end $$;
