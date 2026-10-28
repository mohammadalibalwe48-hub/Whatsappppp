-- WhatsApp inbox cache. The API writes these rows with the service role;
-- dashboard clients cannot access message data directly through the Data API.

create table if not exists public.whatsapp_chats (
    user_id uuid not null references auth.users(id) on delete cascade,
    jid text not null,
    name text,
    is_group boolean not null default false,
    unread_count integer not null default 0 check (unread_count >= 0),
    last_message_id text,
    last_message_text text,
    last_message_type text,
    last_message_at timestamptz,
    is_archived boolean not null default false,
    is_pinned boolean not null default false,
    muted_until timestamptz,
    labels text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, jid)
);

create index if not exists whatsapp_chats_user_recent_idx
    on public.whatsapp_chats (user_id, is_archived, last_message_at desc nulls last, updated_at desc);
create index if not exists whatsapp_chats_labels_idx
    on public.whatsapp_chats using gin (labels);

create table if not exists public.whatsapp_messages (
    user_id uuid not null references auth.users(id) on delete cascade,
    chat_jid text not null,
    message_id text not null,
    participant_jid text,
    is_from_me boolean not null default false,
    message_type text not null default 'unknown',
    text_body text,
    caption text,
    mime_type text,
    file_name text,
    latitude double precision,
    longitude double precision,
    location_name text,
    quoted_message_id text,
    status text not null default 'received'
        check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
    reactions jsonb not null default '[]'::jsonb,
    sent_at timestamptz not null,
    created_at timestamptz not null default now(),
    primary key (user_id, chat_jid, message_id),
    foreign key (user_id, chat_jid)
        references public.whatsapp_chats(user_id, jid) on delete cascade
);

create index if not exists whatsapp_messages_chat_time_idx
    on public.whatsapp_messages (user_id, chat_jid, sent_at desc, message_id desc);
create index if not exists whatsapp_messages_user_time_idx
    on public.whatsapp_messages (user_id, sent_at desc);

create table if not exists public.whatsapp_contacts (
    user_id uuid not null references auth.users(id) on delete cascade,
    jid text not null,
    name text,
    notify text,
    verified_name text,
    updated_at timestamptz not null default now(),
    primary key (user_id, jid)
);

create index if not exists whatsapp_contacts_user_name_idx
    on public.whatsapp_contacts (user_id, name);

alter table public.whatsapp_chats enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_contacts enable row level security;

-- These tables are accessed only by the server-side service-role API.
revoke all on table public.whatsapp_chats from anon, authenticated;
revoke all on table public.whatsapp_messages from anon, authenticated;
revoke all on table public.whatsapp_contacts from anon, authenticated;

grant select, insert, update, delete on table public.whatsapp_chats to service_role;
grant select, insert, update, delete on table public.whatsapp_messages to service_role;
grant select, insert, update, delete on table public.whatsapp_contacts to service_role;
