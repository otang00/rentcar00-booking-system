create extension if not exists pgcrypto;

create table if not exists public.carmore_holiday_sync_mappings (
  id uuid primary key default gen_random_uuid(),
  ims_reservation_id text not null,
  car_number text not null,
  carmore_rentcar_serial text not null,
  carmore_holiday_serial text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  holiday_start_date date not null,
  holiday_end_date date not null,
  sync_status text not null,
  last_synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carmore_holiday_sync_mappings_end_after_start check (end_at > start_at),
  constraint carmore_holiday_sync_mappings_holiday_date_order check (holiday_end_date >= holiday_start_date),
  constraint carmore_holiday_sync_mappings_status_check check (
    sync_status in ('active', 'deleted', 'sync_failed', 'delete_failed')
  )
);

create unique index if not exists uq_carmore_holiday_sync_mappings_ims_reservation_id
  on public.carmore_holiday_sync_mappings (ims_reservation_id);

create index if not exists idx_carmore_holiday_sync_mappings_status
  on public.carmore_holiday_sync_mappings (sync_status);

create index if not exists idx_carmore_holiday_sync_mappings_last_synced_at
  on public.carmore_holiday_sync_mappings (last_synced_at desc);

create table if not exists public.carmore_sync_runs (
  id uuid primary key default gen_random_uuid(),
  sync_mode text not null default 'dry-run',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  desired_count integer not null default 0,
  actual_count integer not null default 0,
  additions_count integer not null default 0,
  deletions_count integer not null default 0,
  changes_count integer not null default 0,
  unchanged_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_carmore_sync_runs_started_at
  on public.carmore_sync_runs (started_at desc);

create index if not exists idx_carmore_sync_runs_status
  on public.carmore_sync_runs (status);
