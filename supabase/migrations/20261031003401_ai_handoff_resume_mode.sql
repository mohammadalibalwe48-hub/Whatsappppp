-- Keep the bot paused during a human takeover, then restore the chat's AI scope
-- after a person replies.
alter table public.whatsapp_ai_chat_controls
    add column if not exists resume_mode text;

-- Older human-takeover rows predate resume-mode tracking. They were all
-- conversations the assistant had replied to, so restore AI explicitly.
update public.whatsapp_ai_chat_controls
set resume_mode = 'enabled'
where mode = 'human' and resume_mode is null;

alter table public.whatsapp_ai_chat_controls
    drop constraint if exists whatsapp_ai_chat_controls_resume_mode_check;
alter table public.whatsapp_ai_chat_controls
    add constraint whatsapp_ai_chat_controls_resume_mode_check
    check (resume_mode is null or resume_mode in ('inherit', 'enabled'));
