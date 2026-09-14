-- Comentario general de la conciliación (además del comentario por línea/caja
-- que ya vivía en el jsonb `lineas`).
alter table public.conciliaciones add column comentario text;
