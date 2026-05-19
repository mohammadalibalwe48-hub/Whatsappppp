-- ---------------------------------------------------------------------------
-- OtpWave — initial schema
--
-- Tables:
--   profiles            One row per Supabase auth user (display info)
--   api_keys            Hashed API keys (one user can hold many)
--   otp_logs            Audit log of every OTP generated
--   webhook_endpoints   User-configured webhook destinations
--   webhook_deliveries  Delivery attempts log
--
-- All tables use Row-Level Security so each Supabase user can only see their
-- own rows. The API uses the service role for server-side writes and bypasses
-- RLS where appropriate.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- profiles --------------------------------------------------------------------

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- api_keys --------------------------------------------------------------------

create table if not exists public.api_keys (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    prefix text not null,
    key_hash text not null unique,
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);
create index if not exists api_keys_user_idx on public.api_keys(user_id);

-- otp_logs --------------------------------------------------------------------

create table if not exists public.otp_logs (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    api_key_id uuid references public.api_keys(id) on delete set null,
    phone_number text not null,
    app_name text,
    status text not null check (status in ('pending', 'verified', 'expired', 'failed')),
    attempts int not null default 0,
    resend_count int not null default 0,
    delivered_at timestamptz,
    verified_at timestamptz,
    expires_at timestamptz not null,
    failure_reason text,
    ip text,
    user_agent text,
    created_at timestamptz not null default now()
);
create index if not exists otp_logs_user_created_idx on public.otp_logs(user_id, created_at desc);
create index if not exists otp_logs_user_status_idx on public.otp_logs(user_id, status);
create index if not exists otp_logs_user_phone_idx on public.otp_logs(user_id, phone_number);

-- webhook_endpoints -----------------------------------------------------------

create table if not exists public.webhook_endpoints (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    url text not null,
    events text[] not null default '{}',
    secret text not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);
create index if not exists webhook_endpoints_user_idx on public.webhook_endpoints(user_id);

-- webhook_deliveries ----------------------------------------------------------

create table if not exists public.webhook_deliveries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
    event text not null,
    payload text not null,
    status_code int,
    response_body text,
    error text,
    attempt int not null default 1,
    delivered boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_endpoint_idx
    on public.webhook_deliveries(endpoint_id, created_at desc);
create index if not exists webhook_deliveries_user_idx
    on public.webhook_deliveries(user_id, created_at desc);

-- Row level security ----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.otp_logs enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Helper: drop existing policies so this migration is idempotent.
do $$
declare
    pol record;
begin
    for pol in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('profiles', 'api_keys', 'otp_logs', 'webhook_endpoints', 'webhook_deliveries')
    loop
        execute format('drop policy if exists %I on %I.%I',
            pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end$$;

create policy "profiles_self_select" on public.profiles
    for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "api_keys_self_select" on public.api_keys
    for select using (auth.uid() = user_id);

create policy "otp_logs_self_select" on public.otp_logs
    for select using (auth.uid() = user_id);

create policy "webhook_endpoints_self_select" on public.webhook_endpoints
    for select using (auth.uid() = user_id);

create policy "webhook_deliveries_self_select" on public.webhook_deliveries
    for select using (auth.uid() = user_id);

-- The service role bypasses RLS entirely, so the API backend can still write
-- to these tables on the user's behalf without exposing a write policy here.
