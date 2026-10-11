-- Plan 016: el plan y el rol se hacen cumplir también en la base.
--
-- Hasta acá la solo-lectura por prueba vencida y los permisos por rol vivían
-- solo en las server actions: la anon key es pública, así que un usuario
-- autenticado podía escribir directo contra la API REST. Ahora:
--   * insert/update/delete de las tablas de negocio exigen
--     `org_puede_escribir()` (espejo de `estadoDeAcceso` en lib/planes.ts).
--   * delete de tablas cuyo borrado en la app es admin-only exige rol admin.
-- No se tocan las tablas por las que pasan los flujos de Ventas de un
-- vendedor (ventas, venta_items, movimientos_caja, movimientos_cc, compras):
-- ahí el delete sigue siendo "de la organización" porque createVenta compensa
-- una falla a mitad de camino borrando lo que alcanzó a crear.

create or replace function public.org_puede_escribir()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        (o.plan_estado = 'activo'
          and (o.periodo_termina_at is null
               or now() < o.periodo_termina_at + interval '3 days'))
        or (o.plan_estado = 'trial'
          and (o.trial_termina_at is null or now() < o.trial_termina_at))
      from public.organizations o
      where o.id = public.current_user_org_id()
    ),
    false
  );
$$;

create or replace function public.current_user_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.rol from public.profiles p where p.id = auth.uid() and p.activo;
$$;

revoke all on function public.org_puede_escribir() from public, anon;
revoke all on function public.current_user_rol() from public, anon;
grant execute on function public.org_puede_escribir() to authenticated;
grant execute on function public.current_user_rol() to authenticated;

do $$
declare
  r record;
  tablas text[] := array[
    'cajas','clientes','compras','conciliaciones','equipos','listas_difusion',
    'movimientos_caja','movimientos_cc','movimientos_stock','otros_items',
    'proveedores','recuentos_stock','repuestos','servicios','tickets','turnos',
    'venta_item_repuestos','venta_items','ventas'
  ];
  delete_admin text[] := array[
    'cajas','clientes','conciliaciones','equipos','listas_difusion',
    'movimientos_stock','otros_items','proveedores','recuentos_stock',
    'repuestos','servicios','tickets','turnos'
  ];
begin
  for r in
    select policyname, tablename, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = any (tablas)
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    if r.cmd = 'INSERT' then
      execute format(
        'alter policy %I on public.%I with check ((%s) and public.org_puede_escribir())',
        r.policyname, r.tablename, r.with_check
      );
    elsif r.cmd = 'UPDATE' then
      execute format(
        'alter policy %I on public.%I using ((%s) and public.org_puede_escribir()) with check ((%s) and public.org_puede_escribir())',
        r.policyname, r.tablename, r.qual, r.with_check
      );
    else
      execute format(
        'alter policy %I on public.%I using ((%s) and public.org_puede_escribir()%s)',
        r.policyname, r.tablename, r.qual,
        case when r.tablename = any (delete_admin)
             then ' and public.current_user_rol() = ''admin'''
             else '' end
      );
    end if;
  end loop;
end
$$;

-- Función de event trigger de Supabase: no tiene por qué ser llamable por RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
