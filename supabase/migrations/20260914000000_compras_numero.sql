-- Compras no tenía una columna de referencia legible (el mock usaba
-- "C-102"). Mismo patrón que `ventas.numero` -- bigint identity, se
-- expone como "C-<numero>" en lib/db/compras.ts.
alter table public.compras add column numero bigint generated always as identity;
