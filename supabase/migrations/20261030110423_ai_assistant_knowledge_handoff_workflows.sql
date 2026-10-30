-- Knowledge, conversation-level controls, handoff state, and guided collection
-- workflows for the opt-in WhatsApp AI assistant.

alter table public.whatsapp_ai_settings
    add column if not exists reply_scope text not null default 'all'
        check (reply_scope in ('all', 'selected')),
    add column if not exists workflow_config jsonb not null default '{}'::jsonb;

create table if not exists public.whatsapp_ai_knowledge_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null default 'faq'
        check (kind in ('business', 'faq', 'policy', 'website')),
    source_url text check (source_url is null or source_url ~ '^https://'),
    title text not null check (char_length(title) between 1 and 120),
    content text not null check (char_length(content) between 1 and 6000),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists whatsapp_ai_knowledge_items_user_active_idx
    on public.whatsapp_ai_knowledge_items (user_id, active, updated_at desc);

create table if not exists public.whatsapp_ai_chat_controls (
    user_id uuid not null references auth.users(id) on delete cascade,
    account_jid text not null,
    chat_jid text not null,
    mode text not null default 'inherit'
        check (mode in ('inherit', 'enabled', 'paused', 'blocked', 'human')),
    handoff_reason text,
    workflow_state jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, account_jid, chat_jid)
);

create index if not exists whatsapp_ai_chat_controls_user_mode_idx
    on public.whatsapp_ai_chat_controls (user_id, mode, updated_at desc);

alter table public.whatsapp_ai_reply_events
    drop constraint if exists whatsapp_ai_reply_events_status_check;
alter table public.whatsapp_ai_reply_events
    add constraint whatsapp_ai_reply_events_status_check
    check (status in ('processing', 'sent', 'skipped', 'failed', 'handoff'));

alter table public.whatsapp_ai_knowledge_items enable row level security;
alter table public.whatsapp_ai_chat_controls enable row level security;

revoke all on table public.whatsapp_ai_knowledge_items from anon, authenticated;
revoke all on table public.whatsapp_ai_chat_controls from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_ai_knowledge_items to service_role;
grant select, insert, update, delete on table public.whatsapp_ai_chat_controls to service_role;
