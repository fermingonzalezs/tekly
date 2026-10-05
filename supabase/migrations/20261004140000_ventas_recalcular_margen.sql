-- Recalcula `ventas.margen_pct` histórico con el criterio nuevo (sin cambios
-- de schema): solo ítems con `costo_usd` cargado, ponderado por facturación
-- -- mismo criterio que `margenVenta` (lib/ventas.ts) y `margenPorTipo`
-- (lib/analiticas.ts). Antes un ítem sin costo contaba como costo 0 = margen
-- 100 %. 0 si ningún ítem tiene costo (la columna no admite "sin dato"; la
-- UI muestra "—" calculándolo desde los ítems, no desde esta columna).
--
-- NO reconstruye la cotización de los pagos en pesos de ventas anteriores:
-- esa se guarda solo de ahora en más (`Pago.cotizacion`/`Pago.montoArs`,
-- ver `createVenta`); una venta vieja muestra su pago en USD.
update public.ventas v
set margen_pct = coalesce(m.margen, 0)
from (
  select
    vi.venta_id,
    round(
      100
        * (sum(vi.precio_usd * vi.cantidad) - sum(vi.costo_usd * vi.cantidad))
        / nullif(sum(vi.precio_usd * vi.cantidad), 0),
      1
    ) as margen
  from public.venta_items vi
  where vi.costo_usd is not null
  group by vi.venta_id
) m
where m.venta_id = v.id;

-- Ventas sin ningún ítem con costo cargado: 0 ("sin dato" en la UI).
update public.ventas v
set margen_pct = 0
where not exists (
  select 1
  from public.venta_items vi
  where vi.venta_id = v.id
    and vi.costo_usd is not null
);
