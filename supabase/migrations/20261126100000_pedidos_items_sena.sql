-- Pedidos: los productos dejan de ser un solo texto (`descripcion`) y pasan a
-- una tabla embebida, con precio por ítem y seña abonada. `descripcion` se
-- mantiene (not null) porque la derivan la app y los pedidos viejos; el total
-- y el saldo NO se guardan: se calculan en `lib/pedidos.ts`.
--
-- `items` es un snapshot embebido en jsonb, mismo criterio que `Turno.pagos`
-- o `Compra.items`: no se agrega por ítem en SQL. Shape:
--   [{ "detalle": "...", "cantidad": 1, "precioUsd": 0 }]
-- Sin backfill: un pedido anterior queda con `items = '[]'` y `sena_usd = 0`.
-- Las policies y grants existentes ya cubren las columnas nuevas.

alter table public.pedidos
  add column items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array'),
  add column sena_usd numeric(12,2) not null default 0
    check (sena_usd >= 0);
