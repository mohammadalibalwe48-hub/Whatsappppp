-- Restore the repository's original first-admin bootstrap after applying
-- permissions hardening. The owner account can be granted admin after signup.
create or replace function public.set_first_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    admin_email text := 'moalibalwe1@gmail.com';
    existing_count int;
    target_user auth.users%rowtype;
begin
    select count(*) into existing_count from public.admins;

    if existing_count = 0 then
        select * into target_user
        from auth.users
        where email = admin_email
        limit 1;

        if found then
            insert into public.admins (user_id, email, role)
            values (target_user.id, admin_email, 'super_admin')
            on conflict (email) do nothing;
            raise notice 'First admin set: %', admin_email;
        else
            raise notice 'User % not found yet. Admin will be set on first login.', admin_email;
        end if;
    end if;

    return new;
end;
$$;

revoke execute on function public.set_first_admin() from public, anon, authenticated;
