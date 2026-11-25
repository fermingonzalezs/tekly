-- Ventas solo con ítems del stock: un ítem de «Otros» (accesorios, AirPods,
-- fundas…) vendido o regalado descuenta su stock. Para saber qué devolver al
-- borrar la venta, el renglón guarda el producto y, si es serializado, la
-- unidad (serial).
alter table public.venta_items
  add column otro_id uuid references public.otros_items (id) on delete set null,
  add column otro_serial text;

create index venta_items_otro_idx on public.venta_items (otro_id);
