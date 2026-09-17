-- Baja lógica para las tablas que otras filas referencian con FK NO ACTION
-- (equipos.id via venta_items, clientes.id via ventas/tickets/turnos/
-- movimientos_cc) -- un DELETE real ahí rompería esas referencias. Se
-- filtran en los list*() de lib/db/inventario.ts y lib/db/clientes.ts.
alter table public.equipos add column activo boolean not null default true;
alter table public.repuestos add column activo boolean not null default true;
alter table public.otros_items add column activo boolean not null default true;
alter table public.clientes add column activo boolean not null default true;
