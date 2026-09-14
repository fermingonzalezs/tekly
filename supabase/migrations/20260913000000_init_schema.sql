-- Tekly: schema inicial multi-tenant.
-- Modelo: organizations + profiles (1 org por usuario) + una tabla por
-- dominio de negocio, todas con organization_id y RLS por organización.
-- Ver CLAUDE.md "Backend y multi-tenancy" para las reglas generales.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Organizaciones y usuarios
-- ---------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rol text not null check (rol in ('admin', 'vendedor', 'tecnico')),
  nombre text not null,
  alias text,
  email text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

-- Resuelve la organización del usuario autenticado. security invoker (por
-- defecto): corre con los privilegios del caller, que ya puede leer su
-- propia fila de profiles por la policy de abajo -- no hace falta
-- security definer ni bypass de RLS.
create function public.current_user_org_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_user_org_id());

-- Sin insert/update/delete para authenticated: alta de organización y
-- cambios de plan van por service role desde server actions (ver lib/auth).

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or organization_id = public.current_user_org_id());

-- Sin insert/update/delete directo para authenticated -- ver
-- update_own_profile / set_member_role más abajo y el flujo de signup/invite
-- en lib/auth, que usan service role. Esto cierra la puerta a que un
-- usuario se auto-asigne otro rol/organización escribiendo directo a la
-- tabla.

create function public.update_own_profile(new_nombre text, new_alias text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set nombre = coalesce(new_nombre, nombre),
      alias = coalesce(new_alias, alias)
  where id = auth.uid();
end;
$$;

revoke all on function public.update_own_profile(text, text) from public;
grant execute on function public.update_own_profile(text, text) to authenticated;

create function public.set_member_role(target_profile_id uuid, new_rol text)
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

  update public.profiles set rol = new_rol where id = target_profile_id;
end;
$$;

revoke all on function public.set_member_role(uuid, text) from public;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Tablas de negocio (todas con organization_id)
-- ---------------------------------------------------------------------

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  desde timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- compras / reparaciones / gastado_usd NO se guardan como columnas: se
-- derivan de ventas/tickets en el momento de la consulta (lib/db/clientes.ts)
-- para que no puedan desincronizarse del dato real.

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  precio_usd numeric not null default 0,
  garantia_dias int not null default 0,
  activo boolean not null default true
);

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  contacto text,
  telefono text,
  rubro text,
  ubicacion text
);

create table public.tickets (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cliente_id uuid references public.clientes (id),
  equipo text not null,
  imei text,
  falla text,
  tecnico_id uuid references public.profiles (id),
  estado text not null check (estado in (
    'recibido', 'diagnosticado', 'presupuestado', 'aprobado',
    'en_reparacion', 'esperando_repuesto', 'listo', 'entregado'
  )),
  ingreso timestamptz not null default now(),
  presupuesto_usd numeric not null default 0,
  servicios jsonb not null default '[]',
  nota text
);

create table public.equipos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  modelo text not null,
  almacenamiento text,
  color text,
  imei text,
  bateria int,
  condicion text,
  costo_usd numeric not null default 0,
  precio_usd numeric not null default 0,
  estado text not null check (estado in (
    'en_revision', 'aprobado_para_venta', 'disponible', 'reservado', 'vendido'
  )),
  created_at timestamptz not null default now(),
  unique (organization_id, imei)
);

create table public.repuestos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sku text,
  nombre text not null,
  modelo text,
  stock int not null default 0,
  stock_min int not null default 0,
  costo_usd numeric not null default 0,
  proveedor_id uuid references public.proveedores (id)
);

create table public.otros_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  descripcion text,
  categoria text not null check (categoria in ('ipad', 'airpods', 'tablet', 'accesorio', 'otro')),
  precio_usd numeric not null default 0,
  serializado boolean not null,
  cantidad int,
  costo_usd numeric,
  unidades jsonb,
  check (
    (serializado and unidades is not null)
    or (not serializado and cantidad is not null and costo_usd is not null)
  )
);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_type text not null check (item_type in ('equipo', 'repuesto', 'otro')),
  item_id uuid not null,
  fecha timestamptz not null default now(),
  detalle text not null,
  usuario_id uuid references public.profiles (id),
  usuario_nombre text not null
);

create index movimientos_stock_item_idx on public.movimientos_stock (item_type, item_id);

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fecha date not null,
  hora time not null,
  cliente text not null,
  cliente_id uuid references public.clientes (id),
  tipo text not null check (tipo in ('compra', 'deja', 'retira', 'cotizar')),
  estado text not null check (estado in ('pendiente', 'confirmado', 'llego', 'cancelado')),
  ticket_id bigint references public.tickets (id),
  equipo_ids uuid[],
  pagos jsonb,
  nota text
);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fecha timestamptz not null default now(),
  cliente_id uuid references public.clientes (id),
  cliente text not null,
  vendedor_id uuid references public.profiles (id),
  procedencia text,
  items jsonb not null,
  total_usd numeric not null,
  pagos jsonb not null,
  margen_pct numeric,
  tipo text not null check (tipo in ('venta', 'reparacion'))
);

create table public.cajas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  moneda text not null check (moneda in ('usd', 'ars')),
  activa boolean not null default true,
  descripcion text,
  medio_pago text not null check (medio_pago in (
    'pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'canje'
  )),
  created_at timestamptz not null default now()
);

create table public.conciliaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fecha timestamptz not null default now(),
  responsable_id uuid references public.profiles (id),
  responsable_nombre text not null,
  lineas jsonb not null
);

create table public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  caja_id uuid not null references public.cajas (id),
  fecha timestamptz not null default now(),
  concepto text not null,
  medio_pago text not null check (medio_pago in (
    'pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'canje'
  )),
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric not null,
  usuario_id uuid references public.profiles (id),
  usuario_nombre text not null,
  conciliacion_id uuid references public.conciliaciones (id)
);

create index movimientos_caja_caja_idx on public.movimientos_caja (caja_id);
create index movimientos_caja_conciliacion_idx on public.movimientos_caja (conciliacion_id);

create table public.movimientos_cc (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id),
  fecha timestamptz not null default now(),
  concepto text not null,
  tipo text not null check (tipo in ('cargo', 'pago')),
  monto_usd numeric not null,
  usuario_id uuid references public.profiles (id),
  usuario_nombre text not null
);

create index movimientos_cc_cliente_idx on public.movimientos_cc (cliente_id);

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fecha timestamptz not null default now(),
  proveedor_id uuid references public.proveedores (id),
  proveedor_nombre text not null,
  items jsonb not null,
  total_usd numeric not null,
  medio_pago text not null check (medio_pago in (
    'pesos', 'dolares', 'transferencia', 'cripto', 'tarjeta', 'canje'
  )),
  estado text not null check (estado in ('pendiente', 'recibida')),
  monto_ars numeric,
  cotizacion numeric
);

create table public.listas_difusion (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null,
  mensaje_inicial text,
  mensaje_final text,
  descuento_tipo text not null default 'ninguno' check (descuento_tipo in ('ninguno', 'monto', 'porcentaje')),
  descuento_valor numeric not null default 0,
  secciones jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: aislamiento por organización en todas las tablas de negocio.
-- Mismo shape en las 16 tablas -> se aplica con un loop en vez de repetir
-- 64 policies casi idénticas a mano.
-- ---------------------------------------------------------------------

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
    execute format('alter table public.%I enable row level security', t);

    execute format(
      $f$create policy %I on public.%I for select to authenticated
         using (organization_id = public.current_user_org_id())$f$,
      t || '_select', t
    );
    execute format(
      $f$create policy %I on public.%I for insert to authenticated
         with check (organization_id = public.current_user_org_id())$f$,
      t || '_insert', t
    );
    execute format(
      $f$create policy %I on public.%I for update to authenticated
         using (organization_id = public.current_user_org_id())
         with check (organization_id = public.current_user_org_id())$f$,
      t || '_update', t
    );
    execute format(
      $f$create policy %I on public.%I for delete to authenticated
         using (organization_id = public.current_user_org_id())$f$,
      t || '_delete', t
    );
  end loop;
end $$;

-- Índices de organization_id en toda tabla de negocio (RLS los filtra por
-- esta columna en cada query).
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
      'create index %I on public.%I (organization_id)',
      t || '_organization_id_idx', t
    );
  end loop;
end $$;
