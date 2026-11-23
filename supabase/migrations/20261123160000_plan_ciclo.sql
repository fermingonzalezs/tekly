-- Ciclo de cobro del plan: mensual o anual (2 meses gratis). Lo escribe el
-- webhook de Mercado Pago (service role) junto con plan/plan_estado.
alter table public.organizations
  add column plan_ciclo text not null default 'mensual' check (plan_ciclo in ('mensual', 'anual'));
