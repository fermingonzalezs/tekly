-- Nota libre para todo el recuento (no por ítem) -- se carga una sola vez al
-- guardar el recuento desde el modal de Repuestos/Otros. Ver
-- Recuento.comentarioGeneral en lib/types.ts.
alter table public.recuentos_stock add column comentario_general text;
