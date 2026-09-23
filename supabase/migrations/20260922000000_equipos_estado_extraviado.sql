-- Nuevo estado "extraviado" para Equipos: lo pone el Recuento de Inventario
-- cuando un equipo no aparece en la auditoría física (ver lib/db/inventario.ts
-- -> recuentoEquipos). No reemplaza a ningún estado existente, se suma.
alter table public.equipos drop constraint equipos_estado_check;
alter table public.equipos add constraint equipos_estado_check
  check (estado in ('en_revision', 'disponible', 'reservado', 'vendido', 'extraviado'));
