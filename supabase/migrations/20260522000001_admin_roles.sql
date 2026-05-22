-- ---------------------------------------------------------------------------
-- OtpWave — admin role system
--
-- Tables:
--   admins              Admin users with role levels
--
-- Features:
--   - Auto-set first admin by email
--   - Role-based access control (super_admin, admin)
--   - Admin-only API endpoints
-- ---------------------------------------------------------------------------

-- admins table
create table if not exists public.admins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    email text not null unique,
    role text not null default 'admin' check (role in ('super_admin', 'admin')),
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),
    constraint email_unique unique (email)
);

-- Index for fast lookups
create index if not exists admins_email_idx on public.admins(email);
create index if not exists admins_user_id_idx on public.admins(user_id);

-- Enable RLS
alter table public.admins enable row level security;

-- Drop existing policies (for idempotency)
drop policy if exists "admins_self_select" on public.admins;
drop policy if exists "admins_admin_select" on public.admins;
drop policy if exists "admins_admin_all" on public.admins;

-- Users can see their own admin record
create policy "admins_self_select" on public.admins
    for select using ((select auth.uid()) = user_id);

-- Service role can do everything (for API backend)
-- Note: Supabase RLS is bypassed for service_role, but we define policies anyway

-- Function to set first admin automatically. Used as an `AFTER INSERT` trigger
-- on auth.users, so it MUST return trigger (not void).
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

-- Trigger to auto-set first admin on user creation
drop trigger if exists on_auth_user_created_set_admin on auth.users;
create trigger on_auth_user_created_set_admin
    after insert on auth.users
    for each row execute function public.set_first_admin();

-- Function to check if current user is admin
create or replace function public.is_current_user_admin()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
    return exists (
        select 1 from public.admins
        where user_id = (select auth.uid())
    );
end;
$$;

-- Function to check if current user is super_admin
create or replace function public.is_current_user_super_admin()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
    return exists (
        select 1 from public.admins
        where user_id = (select auth.uid()) and role = 'super_admin'
    );
end;
$$;

-- Function for admins to promote another user
create or replace function public.add_admin(
    p_user_id uuid,
    p_email text,
    p_role text default 'admin'
)
returns public.admins
language plpgsql
security definer set search_path = public
as $$
declare
    new_admin public.admins;
begin
    -- Only super_admin can add admins
    if not public.is_current_user_super_admin() then
        raise exception 'Only super_admin can add admins';
    end if;
    
    -- Insert or update admin
    insert into public.admins (user_id, email, role, created_by)
    values (p_user_id, p_email, p_role, (select auth.uid()))
    on conflict (email) do update
        set role = p_role,
            user_id = p_user_id
    returning * into new_admin;
    
    return new_admin;
end;
$$;

-- Function to remove admin
create or replace function public.remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
    current_role text;
begin
    -- Only super_admin can remove admins
    if not public.is_current_user_super_admin() then
        raise exception 'Only super_admin can remove admins';
    end if;
    
    -- Prevent removing yourself
    if p_user_id = (select auth.uid()) then
        raise exception 'Cannot remove yourself as admin';
    end if;
    
    delete from public.admins where user_id = p_user_id;
end;
$$;

-- Grant execute permissions to authenticated users for helper functions.
-- set_first_admin() is intentionally NOT granted to authenticated/anon — it's
-- only meant to run from the on_auth_user_created_set_admin trigger (which
-- executes as the function owner) and exposing it via REST would let any
-- signed-in user attempt to seed the first admin.
revoke execute on function public.set_first_admin() from public;
revoke execute on function public.set_first_admin() from anon;
revoke execute on function public.set_first_admin() from authenticated;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.is_current_user_super_admin() to authenticated;
grant execute on function public.add_admin(uuid, text, text) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;