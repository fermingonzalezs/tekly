-- Canje sin stock: el celular recibido en canje ya no entra al inventario al
-- confirmar la venta. Queda registrado en su compra `origen = 'canje'` con
-- todos sus datos, y se pasa al stock después desde Compras («Pasar al
-- stock», que crea el celular con `compra_id` = esta compra).
--
-- IMEI (`imei`), checklist de testeo (`checklist`) y detalles
-- (`aclaraciones`) ya existían. Se suman modelo, color, condición, batería y
-- si se hizo el testeo.

alter table public.compras
  add column canje_modelo text,
  add column canje_color text,
  add column canje_condicion text,
  add column canje_bateria integer check (canje_bateria is null or canje_bateria between 0 and 100),
  add column canje_testeado boolean not null default false;
