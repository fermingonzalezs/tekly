-- Categoría de gasto para movimientos_caja (solo tiene sentido en egresos).
-- Nullable: movimientos existentes -- y los ingresos, que no la usan --
-- quedan sin categoría, misma resolución "sin dato = no entra en el
-- cálculo" que el resto de campos opcionales agregados sobre una tabla ya
-- poblada (ver Cliente.fecha_nacimiento, VentaItem.costoUsd).
alter table public.movimientos_caja
  add column categoria text check (categoria in (
    'alquiler', 'sueldos', 'servicios', 'insumos_repuestos',
    'impuestos', 'mantenimiento', 'otros'
  ));
