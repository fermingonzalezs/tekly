-- Plan 029: un usuario puede tener más de un rol a la vez (caso real:
-- Vendedor + Técnico). `profiles.roles text[]` es la fuente de verdad para
-- permisos; `profiles.rol` se conserva como **rol principal derivado** por
-- trigger, porque `current_user_rol() = 'admin'` está en ~15 policies y en
-- el panel de plataforma, y como solo se compara contra `admin` sigue siendo
-- correcto sin tocar ninguna policy.
--
-- Admin absorbe al resto: `['admin']` (no `['admin','vendedor']`).
-- Los permisos de la app son la unión de `roles` (`tieneRol` en lib/roles.ts).

alter table public.profiles add column roles text[];

-- Backfill: cada perfil arranca con su rol actual.
update public.profiles set roles = array[rol];

alter table public.profiles
  alter column roles set default '{}'::text[],
  alter column roles set not null;

-- Sin duplicados: se usa en el CHECK, así que tiene que ser inmutable y no
-- leer tablas.
create or replace function public.roles_sin_duplicados(r text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select cardinality(coalesce(r, '{}'::text[]))
       = cardinality(array(select distinct unnest(coalesce(r, '{}'::text[]))))
$$;

-- Normaliza un array de roles: solo valores válidos, sin duplicados y en
-- orden fijo (admin, vendedor, tecnico). `admin` absorbe al resto.
create or replace function public.normalizar_roles(r text[])
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when 'admin' = any(coalesce(array_agg(v.r order by v.ord), '{}'::text[]))
      then array['admin']::text[]
    else coalesce(array_agg(v.r order by v.ord), '{}'::text[])
  end
  from (select distinct unnest(coalesce(r, '{}'::text[])) as r) d
  join (values ('admin', 1), ('vendedor', 2), ('tecnico', 3)) as v(r, ord)
    on v.r = d.r
$$;

alter table public.profiles
  add constraint profiles_roles_check check (
    cardinality(roles) between 1 and 3
    and roles <@ array['admin', 'vendedor', 'tecnico']
    and public.roles_sin_duplicados(roles)
  );

-- Mantiene `roles` normalizado y deriva `rol` (principal: admin > tecnico >
-- vendedor). Un insert/update que solo mande `rol` (signup, código viejo,
-- `set_member_role`) sigue funcionando: se toma ese valor como el rol pedido.
create or replace function public.profiles_normalizar_roles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text[];
begin
  if tg_op = 'UPDATE'
     and new.roles is not distinct from old.roles
     and new.rol is distinct from old.rol then
    base := array[new.rol];
  else
    base := coalesce(new.roles, '{}'::text[]);
    if cardinality(base) = 0 and new.rol is not null then
      base := array[new.rol];
    end if;
  end if;

  base := public.normalizar_roles(base);

  if cardinality(base) = 0 then
    raise exception 'El usuario necesita al menos un rol (admin, vendedor o tecnico)';
  end if;

  new.roles := base;
  new.rol := case
    when 'admin' = any(base) then 'admin'
    when 'tecnico' = any(base) then 'tecnico'
    else 'vendedor'
  end;
  return new;
end;
$$;

drop trigger if exists profiles_roles_normalizar on public.profiles;
create trigger profiles_roles_normalizar
  before insert or update of roles, rol on public.profiles
  for each row execute function public.profiles_normalizar_roles();

-- Helper para policies nuevas que necesiten preguntar por un rol puntual.
-- No reemplaza a `current_user_rol()` (las policies existentes siguen igual).
create or replace function public.current_user_tiene_rol(r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r = any(p.roles) from public.profiles p where p.id = auth.uid() and p.activo),
    false
  );
$$;

revoke all on function public.current_user_tiene_rol(text) from public, anon;
grant execute on function public.current_user_tiene_rol(text) to authenticated;

-- Cambio de roles de otro miembro: valida caller admin + misma org + roles
-- válidos + que no quede la organización sin ningún admin activo.
create or replace function public.set_member_roles(target_profile_id uuid, new_roles text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid;
  caller_rol text;
  target_org uuid;
  target_rol text;
  pedidos text[];
  admins_restantes integer;
begin
  select organization_id, rol into caller_org, caller_rol
  from public.profiles where id = auth.uid();

  if caller_rol is distinct from 'admin' then
    raise exception 'Solo un admin puede cambiar roles';
  end if;

  pedidos := public.normalizar_roles(new_roles);

  if cardinality(pedidos) = 0 then
    raise exception 'Elegí al menos un rol';
  end if;

  select organization_id, rol into target_org, target_rol
  from public.profiles where id = target_profile_id;

  if target_org is distinct from caller_org then
    raise exception 'El usuario no pertenece a tu organización';
  end if;

  if target_rol = 'admin' and not ('admin' = any(pedidos)) then
    select count(*) into admins_restantes
    from public.profiles
    where organization_id = caller_org
      and activo
      and id <> target_profile_id
      and 'admin' = any(roles);

    if admins_restantes = 0 then
      raise exception 'La organización necesita al menos un admin activo';
    end if;
  end if;

  update public.profiles set roles = pedidos where id = target_profile_id;
end;
$$;

revoke all on function public.set_member_roles(uuid, text[]) from public, anon;
grant execute on function public.set_member_roles(uuid, text[]) to authenticated;

-- `set_member_role` (singular) se mantiene hasta que no quede código que la
-- llame; ahora escribe `roles` para que el trigger derive `rol`.
create or replace function public.set_member_role(target_profile_id uuid, new_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_org uuid;
  caller_rol text;
  target_org uuid;
begin
  select organization_id, rol into caller_org, caller_rol
  from public.profiles where id = auth.uid();

  if caller_rol is distinct from 'admin' then
    raise exception 'Solo un admin puede cambiar roles';
  end if;

  if new_rol not in ('admin', 'vendedor', 'tecnico') then
    raise exception 'Rol inválido: %', new_rol;
  end if;

  select organization_id into target_org
  from public.profiles where id = target_profile_id;

  if target_org is distinct from caller_org then
    raise exception 'El usuario no pertenece a tu organización';
  end if;

  update public.profiles set roles = array[new_rol] where id = target_profile_id;
end;
$$;

revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;
