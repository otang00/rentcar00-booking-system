create extension if not exists pgcrypto;

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  provider text not null,
  run_id text,
  stage text,
  action text,
  severity text not null default 'info',
  event_type text not null default 'sync_event',
  ims_reservation_id text,
  car_number text,
  error_code text,
  message text not null default '',
  requires_ack boolean not null default false,
  ack_status text not null default 'not_required',
  ack_key text,
  visibility text not null default 'ops',
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sync_events_provider_check check (provider in ('ims', 'zzimcar', 'carmore', 'system')),
  constraint sync_events_severity_check check (severity in ('debug', 'info', 'warn', 'error', 'critical')),
  constraint sync_events_visibility_check check (visibility in ('ops', 'admin', 'internal')),
  constraint sync_events_ack_status_check check (ack_status in ('not_required', 'unread', 'acknowledged'))
);

create index if not exists idx_sync_events_occurred_at
  on public.sync_events (occurred_at desc);

create index if not exists idx_sync_events_provider_occurred_at
  on public.sync_events (provider, occurred_at desc);

create index if not exists idx_sync_events_severity_occurred_at
  on public.sync_events (severity, occurred_at desc);

create index if not exists idx_sync_events_visibility_occurred_at
  on public.sync_events (visibility, occurred_at desc);

create index if not exists idx_sync_events_event_type_occurred_at
  on public.sync_events (event_type, occurred_at desc);

create index if not exists idx_sync_events_requires_ack
  on public.sync_events (requires_ack, ack_status, occurred_at desc);

