-- Pedidos (encargos) de la Agenda: un equipo/producto que no está en stock
-- y se le entrega a un cliente en una fecha. Se muestran en la fila
-- «Todo el día» del calendario, en su fecha de entrega.
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_user_org_id()
    references public.organizations (id) on delete cascade,
  cliente text not null check (trim(cliente) <> ''),
  cliente_id uuid references public.clientes (id) on delete set null,
  descripcion text not null check (trim(descripcion) <> ''),
  fecha_entrega date not null,
  estado text not null default 'pedido' check (estado in (
    'pedido', 'llego', 'entregado', 'cancelado'
  )),
  nota text,
  created_at timestamptz not null default now()
);

create index pedidos_org_fecha_idx on public.pedidos (organization_id, fecha_entrega);
create index pedidos_cliente_id_idx on public.pedidos (cliente_id);

alter table public.pedidos enable row level security;

create policy pedidos_select on public.pedidos
  for select to authenticated
  using (organization_id = public.current_user_org_id());

create policy pedidos_insert on public.pedidos
  for insert to authenticated
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy pedidos_update on public.pedidos
  for update to authenticated
  using (organization_id = public.current_user_org_id() and public.org_puede_escribir())
  with check (organization_id = public.current_user_org_id() and public.org_puede_escribir());

create policy pedidos_delete on public.pedidos
  for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.org_puede_escribir()
    and public.current_user_rol() = 'admin'
  );

revoke all on public.pedidos from anon;
grant select, insert, update, delete on public.pedidos to authenticated, service_role;
