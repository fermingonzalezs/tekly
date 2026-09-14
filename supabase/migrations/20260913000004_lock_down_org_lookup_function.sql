-- Igual que update_own_profile/set_member_role: nadie sin sesión necesita
-- poder invocar esto directo por RPC (aunque sea inofensivo -- devuelve
-- null sin auth.uid()).
revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;
