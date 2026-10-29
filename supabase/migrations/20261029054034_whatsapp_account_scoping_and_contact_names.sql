-- Preserve existing inbox data as an explicitly unassigned historical account,
-- then isolate every future conversation by the linked WhatsApp identity.
alter table public.whatsapp_chats
    add column if not exists account_jid text not null default 'legacy';

alter table public.whatsapp_messages
    add column if not exists account_jid text not null default 'legacy';

alter table public.whatsapp_contacts
    add column if not exists account_jid text not null default 'legacy',
    add column if not exists phone_jid text,
    add column if not exists lid text,
    add column if not exists phonebook_name text;

create table if not exists public.whatsapp_accounts (
    user_id uuid not null references auth.users(id) on delete cascade,
    account_jid text not null,
    phone_number text,
    last_connected_at timestamptz,
    created_at timestamptz not null default now(),
    primary key (user_id, account_jid)
);

create table if not exists public.whatsapp_active_accounts (
    user_id uuid not null primary key references auth.users(id) on delete cascade,
    account_jid text not null,
    updated_at timestamptz not null default now(),
    foreign key (user_id, account_jid)
        references public.whatsapp_accounts(user_id, account_jid) on delete cascade
);

insert into public.whatsapp_accounts (user_id, account_jid, phone_number, last_connected_at)
select distinct user_id, 'legacy', null::text, null::timestamptz
from (
    select user_id from public.whatsapp_chats
    union
    select user_id from public.whatsapp_messages
    union
    select user_id from public.whatsapp_contacts
) as prior_inbox_users
on conflict (user_id, account_jid) do nothing;

alter table public.whatsapp_messages
    drop constraint whatsapp_messages_user_id_chat_jid_fkey;

alter table public.whatsapp_chats
    drop constraint whatsapp_chats_pkey,
    add constraint whatsapp_chats_pkey primary key (user_id, account_jid, jid);

alter table public.whatsapp_messages
    drop constraint whatsapp_messages_pkey,
    add constraint whatsapp_messages_pkey primary key (user_id, account_jid, chat_jid, message_id),
    add constraint whatsapp_messages_account_chat_fkey
        foreign key (user_id, account_jid, chat_jid)
        references public.whatsapp_chats(user_id, account_jid, jid) on delete cascade;

alter table public.whatsapp_contacts
    drop constraint whatsapp_contacts_pkey,
    add constraint whatsapp_contacts_pkey primary key (user_id, account_jid, jid);

create index if not exists whatsapp_chats_account_recent_idx
    on public.whatsapp_chats (user_id, account_jid, is_archived, last_message_at desc nulls last, updated_at desc);

create index if not exists whatsapp_messages_account_chat_time_idx
    on public.whatsapp_messages (user_id, account_jid, chat_jid, sent_at desc, message_id desc);

create index if not exists whatsapp_contacts_account_name_idx
    on public.whatsapp_contacts (user_id, account_jid, name);

create index if not exists whatsapp_contacts_account_phone_jid_idx
    on public.whatsapp_contacts (user_id, account_jid, phone_jid);

create index if not exists whatsapp_contacts_account_lid_idx
    on public.whatsapp_contacts (user_id, account_jid, lid);

alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_active_accounts enable row level security;

revoke all on table public.whatsapp_accounts from anon, authenticated;
revoke all on table public.whatsapp_active_accounts from anon, authenticated;

grant select, insert, update, delete on table public.whatsapp_accounts to service_role;
grant select, insert, update, delete on table public.whatsapp_active_accounts to service_role;
