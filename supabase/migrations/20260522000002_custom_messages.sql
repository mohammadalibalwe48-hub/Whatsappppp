-- ---------------------------------------------------------------------------
-- Add message_template to api_keys
-- ---------------------------------------------------------------------------

alter table public.api_keys
    add column if not exists message_template text;
