-- ---------------------------------------------------------------------------
-- PR A: Custom OTP length / alphabet per API key
--
-- Add two columns to api_keys for per-key defaults that /v1/otp/send falls
-- back to when the request doesn't override `length` or `alphabet`.
--
-- Backwards compatible:
--   * existing rows get length=6, alphabet='numeric' (the current behaviour).
--   * the public `/v1/otp/send` body schema is widened only — old callers
--     that omit `alphabet` still get numeric.
-- ---------------------------------------------------------------------------

alter table public.api_keys
    add column if not exists default_otp_length int not null default 6
        check (default_otp_length between 4 and 10);

alter table public.api_keys
    add column if not exists default_otp_alphabet text not null default 'numeric'
        check (default_otp_alphabet in ('numeric', 'alphanumeric', 'alphabetic'));
