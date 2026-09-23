-- Categoría estructurada del movimiento -- hasta ahora `detalle` era texto
-- libre, sin forma confiable de filtrar/pintar un badge por tipo sin
-- adivinar por prefijo de texto. `detalle` se mantiene tal cual, sigue
-- siendo la descripción legible; `tipo` es solo para filtrar/agrupar.
alter table public.movimientos_stock add column tipo text;

update public.movimientos_stock set tipo = case
  when detalle ilike 'ingreso%' or detalle ilike 'importación%' then 'ingreso'
  when detalle ilike 'baja%' then 'baja'
  when detalle ilike 'recuento%' then 'recuento'
  else 'edicion'
end;

alter table public.movimientos_stock alter column tipo set not null;
alter table public.movimientos_stock alter column tipo set default 'edicion';
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check
  check (tipo in ('ingreso', 'edicion', 'baja', 'recuento'));

create index movimientos_stock_tipo_idx on public.movimientos_stock (tipo);
