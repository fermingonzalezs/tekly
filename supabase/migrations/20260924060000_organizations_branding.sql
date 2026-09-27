-- Branding por organización: paleta de color de la app y logo. La paleta
-- es un enum de 6 presets curados (lib/theme-presets.ts), default 'indigo'
-- (la paleta que tuvo la app hasta acá, para no romper nada visualmente).
-- El logo vive en el bucket público `logos` de Storage (creado aparte, no
-- en esta migración) y acá solo queda la URL pública. Escrituras admin-only
-- vía service role (updateNegocio / uploadLogo), sin policies nuevas.

alter table public.organizations
  add column color_tema text not null default 'indigo',
  add column logo_url text;

alter table public.organizations
  add constraint organizations_color_tema_check
  check (color_tema in ('indigo', 'azul', 'verde', 'violeta', 'rosa', 'naranja'));
