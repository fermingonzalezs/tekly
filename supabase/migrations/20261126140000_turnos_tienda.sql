-- Turnos: a qué tienda / página corresponde (mismo criterio que
-- `ventas.tienda_id`, ver 20261125130000_tiendas.sql). `null` = la tienda
-- principal (el nombre de la organización). Las policies de `turnos` no
-- cambian: `tiendas` ya está acotada a la organización por su propia RLS.
alter table public.turnos
  add column tienda_id uuid references public.tiendas (id) on delete set null;
create index turnos_tienda_idx on public.turnos (tienda_id);
