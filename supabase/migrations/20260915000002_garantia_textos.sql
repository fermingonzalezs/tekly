-- Textos editables del recibo de garantía (Configuración → Recibos, ver
-- lib/db/configuracion.ts). `garantia_causales` es texto plano, una línea
-- por causal -- se parsea en el componente, no hace falta jsonb para una
-- lista tan simple.
alter table public.organizations
  add column garantia_texto text,
  add column garantia_condiciones text,
  add column garantia_importante text,
  add column garantia_causales text;
