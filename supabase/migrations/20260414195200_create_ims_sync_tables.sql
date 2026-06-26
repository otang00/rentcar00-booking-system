create extension if not exists pgcrypto;
create table if not exists public.reservation_sync_runs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  cursor_from text,
  cursor_to text,
  fetched_count integer not null default 0,
  parsed_count integer not null default 0,
  upserted_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reservation_sync_runs_started_at
  on public.reservation_sync_runs (started_at desc);
create index if not exists idx_reservation_sync_runs_status
  on public.reservation_sync_runs (status);
create table if not exists public.ims_reservations_raw (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.reservation_sync_runs(id) on delete cascade,
  ims_reservation_id text not null,
  ims_status text,
  ims_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  parse_status text not null default 'pending',
  parse_error text,
  created_at timestamptz not null default now(),
  unique (sync_run_id, ims_reservation_id)
);
create index if not exists idx_ims_reservations_raw_ims_reservation_id
  on public.ims_reservations_raw (ims_reservation_id);
create index if not exists idx_ims_reservations_raw_fetched_at
  on public.ims_reservations_raw (fetched_at desc);
create index if not exists idx_ims_reservations_raw_parse_status
  on public.ims_reservations_raw (parse_status);
create table if not exists public.ims_sync_reservations (
  id uuid primary key default gen_random_uuid(),
  ims_reservation_id text,
  source text not null default 'ims',
  source_updated_at timestamptz,
  car_id text not null,
  car_number text,
  car_group_id text,
  status text not null,
  status_raw text,
  pickup_option text,
  delivery_region_id text,
  pickup_address text,
  dropoff_address text,
  delivery_address text,
  customer_name text,
  customer_phone text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  cancelled_at timestamptz,
  confirmed_at timestamptz,
  quoted_price_snapshot jsonb,
  confirmed_price_snapshot jsonb,
  raw_payload_ref_id uuid references public.ims_reservations_raw(id) on delete set null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ims_sync_reservations_end_after_start check (end_at > start_at)
);
create unique index if not exists uq_ims_sync_reservations_ims_reservation_id
  on public.ims_sync_reservations (ims_reservation_id)
  where ims_reservation_id is not null;
create index if not exists idx_ims_sync_reservations_car_period
  on public.ims_sync_reservations (car_id, start_at, end_at);
create index if not exists idx_ims_sync_reservations_status
  on public.ims_sync_reservations (status);
create index if not exists idx_ims_sync_reservations_last_synced_at
  on public.ims_sync_reservations (last_synced_at desc);
create table if not exists public.reservation_sync_errors (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.reservation_sync_runs(id) on delete cascade,
  ims_reservation_id text,
  stage text not null,
  error_code text,
  error_message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_reservation_sync_errors_sync_run_id
  on public.reservation_sync_errors (sync_run_id);
create index if not exists idx_reservation_sync_errors_ims_reservation_id
  on public.reservation_sync_errors (ims_reservation_id);
create index if not exists idx_reservation_sync_errors_stage
  on public.reservation_sync_errors (stage);
