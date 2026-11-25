-- Plan 026 (revisión 25/11): la diferencia de la venta pasa a ser **firmada**
-- y el regalo es de la **venta entera**.
--
-- 1) `ventas.descuento_usd` -> `ventas.ajuste_usd`: >0 descuenta, <0 recarga.
--    Los datos existentes (>= 0) siguen siendo válidos como descuentos.
--    Se suelta el CHECK de `>= 0` (de cualquier nombre) antes de renombrar.
-- 2) `ventas.regalo`: la venta entera es un regalo (total 0, sin pagos). Los
--    ítems quedan con `regalo = true` y precio 0, conservando su costo.
--
-- `venta_items.regalo` / `precio_lista_usd` ya existen desde la migración
-- `20261125150000_ventas_descuento_regalo.sql`.
--
-- Verificación después de aplicar: `get_advisors` (security) sin avisos
-- nuevos, y `select ajuste_usd, regalo from ventas limit 1` responde.

-- El check automático de `descuento_usd >= 0` (nombre variable según cómo se
-- haya aplicado) se busca por su definición.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.ventas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%descuento_usd%'
  loop
    execute format('alter table public.ventas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.ventas rename column descuento_usd to ajuste_usd;

alter table public.ventas
  add column regalo boolean not null default false;
