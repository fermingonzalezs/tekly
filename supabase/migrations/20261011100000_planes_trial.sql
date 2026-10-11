-- Planes y prueba gratis (plan 015): cada organización nueva arranca en
-- `trial` por 14 días sin tarjeta; después pasa a solo lectura hasta que se
-- le asigne un plan pago (por ahora a mano desde /admin, cobro por
-- transferencia). Las reglas viven en lib/planes.ts (puro, con test).
--
-- Las columnas las escribe solo service role (organizations no tiene policy
-- de update para authenticated): el signup usa los defaults de acá.

alter table public.organizations
  add column if not exists plan_estado text not null default 'trial',
  add column if not exists trial_termina_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists periodo_termina_at timestamptz;

-- Las organizaciones que ya existían (plan 'free', sin tiers) quedan
-- habilitadas sin vencimiento: no se las bloquea por un cambio de producto.
update public.organizations
set plan = 'business_plus', plan_estado = 'activo'
where plan = 'free';

alter table public.organizations alter column plan set default 'trial';

alter table public.organizations
  add constraint organizations_plan_check
    check (plan in ('trial', 'starter', 'business', 'business_plus')),
  add constraint organizations_plan_estado_check
    check (plan_estado in ('trial', 'activo', 'vencido', 'cancelado'));
