-- Keep a small, editable long-term memory for each WhatsApp conversation.
alter table public.whatsapp_ai_chat_controls
    drop constraint if exists whatsapp_ai_chat_controls_memory_summary_check;

alter table public.whatsapp_ai_chat_controls
    add column if not exists memory_summary text;

alter table public.whatsapp_ai_chat_controls
    add constraint whatsapp_ai_chat_controls_memory_summary_check
    check (memory_summary is null or char_length(memory_summary) <= 2000);
