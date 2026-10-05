-- Snapshot de la cotización del dólar (ARS por USD) usada al registrar cada
-- movimiento de caja. Analíticas > Finanzas convertía los movimientos en
-- pesos a USD con el blue de HOY (useDolar), así que los totales cambiaban
-- solos cada día. Con esta columna la conversión usa la cotización del
-- momento y nunca se recalcula.
--
-- Solo de ahora en más: los movimientos anteriores quedan en null a
-- propósito (no se reconstruyen cotizaciones históricas). La app los
-- informa aparte, en pesos, sin sumarlos a los totales en USD.
--
-- Es una columna en una tabla existente: RLS y GRANTs no cambian.
alter table public.movimientos_caja add column cotizacion numeric;

comment on column public.movimientos_caja.cotizacion is
  'Dólar (ARS por USD) usado al registrar el movimiento. Snapshot: nunca se recalcula. Null en movimientos anteriores a esta columna.';
