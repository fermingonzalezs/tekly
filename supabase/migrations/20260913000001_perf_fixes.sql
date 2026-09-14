-- Fixes de los performance advisors sobre la migración inicial:
-- índices en FKs nullable + evitar re-evaluar auth.uid() por fila en RLS.

create index compras_proveedor_id_idx on public.compras (proveedor_id);
create index conciliaciones_responsable_id_idx on public.conciliaciones (responsable_id);
create index movimientos_caja_usuario_id_idx on public.movimientos_caja (usuario_id);
create index movimientos_cc_usuario_id_idx on public.movimientos_cc (usuario_id);
create index movimientos_stock_usuario_id_idx on public.movimientos_stock (usuario_id);
create index repuestos_proveedor_id_idx on public.repuestos (proveedor_id);
create index tickets_cliente_id_idx on public.tickets (cliente_id);
create index tickets_tecnico_id_idx on public.tickets (tecnico_id);
create index turnos_cliente_id_idx on public.turnos (cliente_id);
create index turnos_ticket_id_idx on public.turnos (ticket_id);
create index ventas_cliente_id_idx on public.ventas (cliente_id);
create index ventas_vendedor_id_idx on public.ventas (vendedor_id);

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or organization_id = public.current_user_org_id()
  );
