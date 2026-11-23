-- Prueba gratis: 14 -> 30 días (`TRIAL_DIAS` en lib/planes.ts). Solo cambia
-- el default para las organizaciones nuevas; las que ya están en prueba
-- conservan su `trial_termina_at`.
alter table public.organizations
  alter column trial_termina_at set default (now() + interval '30 days');
