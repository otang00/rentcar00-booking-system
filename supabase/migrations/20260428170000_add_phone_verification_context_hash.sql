alter table public.phone_verifications
  add column if not exists context_hash text;

create index if not exists idx_phone_verifications_purpose_context_hash
  on public.phone_verifications (purpose, context_hash)
  where context_hash is not null;
