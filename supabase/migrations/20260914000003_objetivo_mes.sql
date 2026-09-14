-- Objetivo de facturación del mes (Dashboard → "Objetivo del mes"), editable
-- desde Configuración → Datos del negocio. Un solo valor vigente por
-- organización (no historial mes a mes por ahora -- se puede migrar a una
-- tabla aparte el día que haga falta comparar objetivos pasados).
alter table public.organizations
  add column objetivo_mes_usd numeric not null default 65000;
