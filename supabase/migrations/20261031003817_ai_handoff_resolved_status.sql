alter table public.whatsapp_ai_reply_events
    drop constraint if exists whatsapp_ai_reply_events_status_check;
alter table public.whatsapp_ai_reply_events
    add constraint whatsapp_ai_reply_events_status_check
    check (status in ('processing', 'sent', 'skipped', 'failed', 'handoff', 'resolved'));
