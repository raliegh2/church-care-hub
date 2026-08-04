revoke all on function public.admin_manage_user(uuid, public.app_role, boolean) from anon;
revoke all on function public.admin_manage_user(uuid, public.app_role, boolean) from public;
grant execute on function public.admin_manage_user(uuid, public.app_role, boolean) to authenticated, service_role;
