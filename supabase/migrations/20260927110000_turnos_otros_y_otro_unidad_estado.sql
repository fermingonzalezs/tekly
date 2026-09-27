-- Turnos de compra pueden llevar ítems de "Otros" además de equipos: el
-- carrito de "Agendar turno" (turnos-client.tsx) guarda un snapshot jsonb de
-- lo elegido (mismo criterio que el resto de estructuras anidadas de la app,
-- ver "Backend y multi-tenancy" en CLAUDE.md) -- array de
-- { otroId, nombre, precioUsd, serial? (si es serializado),
--   cantidad? (si no lo es) }.
--
-- `equipo_ids` (uuid[]) no alcanza para un `OtroUnidad`: no es una fila con
-- id propio, vive embebida en el jsonb `unidades` de `otros_items`,
-- identificada por `serial`.
alter table public.turnos
  add column items_otros jsonb;

-- La reserva de una unidad puntual de "Otros" para un turno de compra
-- necesita un `estado` propio por unidad -- `Equipo` ya lo tiene
-- (disponible/reservado/vendido), un `OtroUnidad` no. No es una columna nueva
-- (`unidades` ya es jsonb): es un campo nuevo dentro de cada elemento del
-- array, que se completa desde la aplicación al reservar. No hace falta
-- backfill: un elemento sin "estado" se lee como "disponible" (mismo criterio
-- que `Checklist.items`, parcial por diseño).
