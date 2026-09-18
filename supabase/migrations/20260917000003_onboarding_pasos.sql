-- Checklist de onboarding para organizaciones nuevas (Dashboard →
-- Bienvenida, ver lib/onboarding.ts): qué pasos del setup inicial marcó el
-- admin como completados. Persistido a mano (no inferido de datos reales)
-- para poder tildar "ya lo hice" aunque el paso no deje rastro consultable
-- (ej. invitar gente por fuera de la app) -- jsonb libre en vez de una
-- columna por paso, así la lista de pasos puede cambiar sin migración.
alter table public.organizations
  add column onboarding_pasos jsonb not null default '{}'::jsonb;
