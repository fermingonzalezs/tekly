-- Un canje (pago de una venta con la caja CANJE) genera una compra real:
-- qué equipo se recibió, en qué estado (checklist de ingreso, mismo shape
-- que tickets.checklist_ingreso de Reparaciones), de qué cliente y a qué
-- precio -- ver "Ventas"/"Compras" en CLAUDE.md.

alter table public.compras
  add column origen text not null default 'proveedor',
  add column cliente_id uuid references public.clientes(id) on delete set null,
  add column cliente_nombre text,
  add column venta_id uuid references public.ventas(id) on delete set null,
  add column marca text,
  add column imei text,
  add column checklist jsonb,
  add column aclaraciones text;

alter table public.compras
  add constraint compras_origen_check check (origen in ('proveedor', 'canje'));

alter table public.compras
  alter column proveedor_nombre drop not null;

alter table public.compras
  add constraint compras_contraparte_check check (
    (origen = 'proveedor' and proveedor_nombre is not null) or
    (origen = 'canje' and cliente_nombre is not null)
  );
