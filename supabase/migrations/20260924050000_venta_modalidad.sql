-- Mayorista/minorista por venta (no por cliente -- el mismo cliente puede
-- comprar de una forma u otra según la ocasión). Default 'minorista' para
-- que las ventas ya cargadas queden clasificadas sin tener que migrarlas a
-- mano.

alter table public.ventas
  add column modalidad text not null default 'minorista'
    check (modalidad in ('mayorista', 'minorista'));
