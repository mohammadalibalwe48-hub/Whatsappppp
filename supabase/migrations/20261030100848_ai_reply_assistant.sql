-- Per-user AI assistant configuration and an idempotency/audit ledger for
-- automatic WhatsApp replies. Provider credentials are encrypted by the API.

create table if not exists public.whatsapp_ai_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    provider text not null default 'gemini'
        check (provider in ('gemini', 'groq', 'openai_compatible')),
    model text not null default 'gemini-2.5-flash',
    base_url text,
    api_key_ciphertext text,
    system_prompt text not null default '',
    enabled boolean not null default false,
    max_replies_per_day integer not null default 100
        check (max_replies_per_day between 1 and 500),
    updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_ai_reply_events (
    user_id uuid not null references auth.users(id) on delete cascade,
    account_jid text not null,
    chat_jid text not null,
    source_message_id text not null,
    reply_message_id text,
    status text not null default 'processing'
        check (status in ('processing', 'sent', 'skipped', 'failed')),
    reason text,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    primary key (user_id, account_jid, source_message_id)
);

create index if not exists whatsapp_ai_reply_events_user_recent_idx
    on public.whatsapp_ai_reply_events (user_id, created_at desc);
create index if not exists whatsapp_ai_reply_events_daily_count_idx
    on public.whatsapp_ai_reply_events (user_id, created_at)
    where status in ('processing', 'sent');

alter table public.whatsapp_ai_settings enable row level security;
alter table public.whatsapp_ai_reply_events enable row level security;

-- Provider credentials and reply history are accessible only by the trusted API.
revoke all on table public.whatsapp_ai_settings from anon, authenticated;
revoke all on table public.whatsapp_ai_reply_events from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_ai_settings to service_role;
grant select, insert, update, delete on table public.whatsapp_ai_reply_events to service_role;
