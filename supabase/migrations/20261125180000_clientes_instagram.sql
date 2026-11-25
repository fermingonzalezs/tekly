-- Instagram del cliente (opcional, solo texto). Mismo formato que
-- `profiles.instagram`: lo normaliza `normalizarInstagram` (lib/instagram.ts)
-- y este CHECK es su espejo.
alter table public.clientes
  add column instagram text
    constraint clientes_instagram_formato
    check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'
           and instagram !~ '^\.' and instagram !~ '\.$' and instagram !~ '\.\.');
