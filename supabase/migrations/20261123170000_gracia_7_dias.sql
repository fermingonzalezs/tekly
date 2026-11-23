-- Gracia de 7 días sobre periodo_termina_at (antes 3): cubre los reintentos
-- de Mercado Pago cuando falla un débito. Espejo de GRACIA_DIAS en
-- lib/planes.ts: si cambia una, cambiar las dos.
create or replace function public.org_puede_escribir()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (
      select
        (o.plan_estado = 'activo'
          and (o.periodo_termina_at is null
               or now() < o.periodo_termina_at + interval '7 days'))
        or (o.plan_estado = 'trial'
          and (o.trial_termina_at is null or now() < o.trial_termina_at))
      from public.organizations o
      where o.id = public.current_user_org_id()
    ),
    false
  );
$function$;
