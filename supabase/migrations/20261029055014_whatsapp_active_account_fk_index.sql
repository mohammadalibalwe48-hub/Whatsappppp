-- Index the composite foreign key used to verify a user's active WhatsApp account.
create index if not exists whatsapp_active_accounts_user_account_idx
    on public.whatsapp_active_accounts (user_id, account_jid);
