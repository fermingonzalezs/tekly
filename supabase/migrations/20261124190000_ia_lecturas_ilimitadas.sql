-- "Leer con IA" sin cupo para organizaciones puntuales (lo activa a mano el
-- admin de plataforma). Solo service role escribe `organizations`, así que
-- un usuario no puede prendérselo solo.
alter table public.organizations
  add column ia_lecturas_ilimitadas boolean not null default false;

-- Mundo Phone (Elias Garcia), pedido del 2026-11-24.
update public.organizations
  set ia_lecturas_ilimitadas = true
  where id = '6cb98a66-544c-4899-b5ca-da2ae6a39a27';
