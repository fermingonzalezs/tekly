-- Agrega el preset "negro" a la paleta de color por organización
-- (lib/theme-presets.ts). Mismo criterio que organizations_branding: solo
-- se amplía el enum del check constraint, sin tocar el default ('indigo').

alter table public.organizations
  drop constraint organizations_color_tema_check;

alter table public.organizations
  add constraint organizations_color_tema_check
  check (color_tema in ('indigo', 'azul', 'verde', 'violeta', 'rosa', 'naranja', 'negro'));
