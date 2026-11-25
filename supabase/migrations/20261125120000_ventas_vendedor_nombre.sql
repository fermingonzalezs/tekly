-- Vendedor escrito a mano en Nueva venta (alguien que no es usuario de la
-- organización). Solo se completa cuando `vendedor_id` es null: si la venta
-- tiene un usuario, el nombre sale de `profiles` como siempre.
alter table public.ventas
  add column vendedor_nombre text
    check (vendedor_nombre is null or length(trim(vendedor_nombre)) between 1 and 80);
