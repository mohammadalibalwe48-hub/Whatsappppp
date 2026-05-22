-- ---------------------------------------------------------------------------
-- Supabase advisor fixes (security + performance lints from the dashboard).
--
-- Addresses:
--   * security: handle_new_user() SECURITY DEFINER is callable via REST by
--     anon and authenticated roles. Revoke EXECUTE from those roles + public;
--     the trigger keeps working because it runs as the function owner.
--   * performance: every RLS policy calls auth.uid() directly, which makes
--     postgres re-evaluate it for each row. Wrapping the call in
--     `(select auth.uid())` lets postgres cache the result for the duration
--     of the statement. (auth_rls_initplan lint.)
--   * performance: otp_logs.api_key_id has no covering index. Adds one.
--
-- All steps are idempotent: drop-and-recreate for the policies, IF EXISTS
-- guards for the others.
-- ---------------------------------------------------------------------------

-- 1. handle_new_user(): tighten the grants. -----------------------------------

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
-- service_role is intentionally left alone so admin paths can still call it.

-- 2. RLS policies: cache auth.uid() per-statement. ---------------------------

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
    for select using ((select auth.uid()) = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
    for update using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists api_keys_self_select on public.api_keys;
create policy api_keys_self_select on public.api_keys
    for select using ((select auth.uid()) = user_id);

drop policy if exists otp_logs_self_select on public.otp_logs;
create policy otp_logs_self_select on public.otp_logs
    for select using ((select auth.uid()) = user_id);

drop policy if exists webhook_endpoints_self_select on public.webhook_endpoints;
create policy webhook_endpoints_self_select on public.webhook_endpoints
    for select using ((select auth.uid()) = user_id);

drop policy if exists webhook_deliveries_self_select on public.webhook_deliveries;
create policy webhook_deliveries_self_select on public.webhook_deliveries
    for select using ((select auth.uid()) = user_id);

-- 3. Cover otp_logs.api_key_id with an index. --------------------------------

create index if not exists otp_logs_api_key_idx
    on public.otp_logs (api_key_id);
