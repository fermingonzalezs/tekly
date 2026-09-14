-- current_user_org_id() es security invoker (default) y lee de `profiles`,
-- que tiene una policy de RLS que llama a current_user_org_id() -- Postgres
-- reevalúa esa policy dentro de la propia función y entra en recursión
-- infinita ("stack depth limit exceeded"). Fix: security definer, así el
-- lookup interno no dispara RLS de nuevo. Sigue siendo seguro: no toma
-- parámetros, solo puede devolver la organización del propio auth.uid().
create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;
