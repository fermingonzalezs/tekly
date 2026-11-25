-- Instagram de cada usuario (opcional, solo texto: ver lib/instagram.ts).
-- El CHECK es el espejo de `normalizarInstagram`: minúsculas, letras,
-- números, `.` y `_`, hasta 30, sin punto al principio/al final ni doble.
alter table public.profiles
  add column instagram text
    constraint profiles_instagram_formato
    check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'
           and instagram !~ '^\.' and instagram !~ '\.$' and instagram !~ '\.\.');

-- `update_own_profile` usa coalesce (no permite vaciar): función aparte para
-- que cada uno cargue o borre el suyo. Mismo criterio security definer que
-- update_own_profile: solo toca la fila de auth.uid().
create function public.set_own_instagram(new_instagram text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set instagram = nullif(trim(new_instagram), '')
  where id = auth.uid();
end;
$$;

revoke all on function public.set_own_instagram(text) from public, anon;
grant execute on function public.set_own_instagram(text) to authenticated;
