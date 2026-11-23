-- Suscripciones con Mercado Pago (preapproval, una por organización). El
-- webhook (service role) es el único que escribe estas columnas; `plan`,
-- `plan_estado` y `periodo_termina_at` siguen siendo la fuente de verdad del
-- acceso (lib/planes.ts), el webhook las actualiza igual que el admin manual.
alter table public.organizations
  add column mp_preapproval_id text,
  add column mp_estado text check (mp_estado in ('pending', 'authorized', 'paused', 'canceled')),
  add column mp_payer_email text;
