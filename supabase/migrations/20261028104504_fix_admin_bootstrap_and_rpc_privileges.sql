-- These SECURITY DEFINER functions are not called by the dashboard. Admin
-- changes go through the API, which authenticates the Supabase user before
-- using service_role. Remove both the default PUBLIC grant and the explicit
-- authenticated grants from the original admin-role migration.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_first_admin() from public, anon, authenticated;
revoke execute on function public.is_current_user_admin() from public, anon, authenticated;
revoke execute on function public.is_current_user_super_admin() from public, anon, authenticated;
revoke execute on function public.add_admin(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.remove_admin(uuid) from public, anon, authenticated;
