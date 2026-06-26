alter table public.profiles
  add column if not exists birth_date text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists postal_code text,
  add column if not exists address_main text,
  add column if not exists address_detail text,
  add column if not exists profile_status text not null default 'pending_email_verification';

alter table public.profiles
  drop constraint if exists profiles_profile_status_check;

alter table public.profiles
  add constraint profiles_profile_status_check
  check (profile_status in ('pending_email_verification', 'active', 'blocked', 'withdrawn'));

create index if not exists idx_profiles_phone
  on public.profiles (phone);

create index if not exists idx_profiles_profile_status
  on public.profiles (profile_status);

create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_last4 text not null,
  purpose text not null,
  otp_code_hash text not null,
  verification_token_hash text,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  requested_at timestamptz not null default now(),
  cooldown_until timestamptz not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_verifications_status_check
    check (status in ('pending', 'verified', 'consumed', 'expired', 'blocked'))
);

create index if not exists idx_phone_verifications_phone_purpose_created_at
  on public.phone_verifications (phone, purpose, created_at desc);

create index if not exists idx_phone_verifications_status_created_at
  on public.phone_verifications (status, created_at desc);

create unique index if not exists idx_phone_verifications_verification_token_hash
  on public.phone_verifications (verification_token_hash)
  where verification_token_hash is not null;

drop trigger if exists trg_phone_verifications_updated_at on public.phone_verifications;
create trigger trg_phone_verifications_updated_at
before update on public.phone_verifications
for each row
execute function public.set_updated_at();
