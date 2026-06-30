create table if not exists public.carmore_vehicle_state_sync_mappings (
  id uuid primary key default gen_random_uuid(),
  car_number text not null,
  local_car_id uuid references public.cars(id) on delete set null,
  ims_car_id text,
  carmore_rentcar_serial text not null,
  observed_app_flag text,
  observed_month_flag text,
  decided_app_flag text not null,
  decided_month_flag text not null,
  applied_app_flag text,
  applied_month_flag text,
  active_monthly_reservation_ids jsonb not null default '[]'::jsonb,
  reason jsonb not null default '[]'::jsonb,
  sync_status text not null default 'planned',
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carmore_vehicle_state_sync_mappings_status_check check (
    sync_status in ('planned', 'synced', 'failed', 'skipped')
  ),
  constraint carmore_vehicle_state_sync_mappings_app_flag_check check (
    observed_app_flag is null or observed_app_flag in ('0', '1')
  ),
  constraint carmore_vehicle_state_sync_mappings_month_flag_check check (
    observed_month_flag is null or observed_month_flag in ('0', '1')
  ),
  constraint carmore_vehicle_state_sync_mappings_decided_app_flag_check check (
    decided_app_flag in ('0', '1')
  ),
  constraint carmore_vehicle_state_sync_mappings_decided_month_flag_check check (
    decided_month_flag in ('0', '1')
  ),
  constraint carmore_vehicle_state_sync_mappings_applied_app_flag_check check (
    applied_app_flag is null or applied_app_flag in ('0', '1')
  ),
  constraint carmore_vehicle_state_sync_mappings_applied_month_flag_check check (
    applied_month_flag is null or applied_month_flag in ('0', '1')
  )
);

create unique index if not exists uq_carmore_vehicle_state_sync_mappings_serial
  on public.carmore_vehicle_state_sync_mappings (carmore_rentcar_serial);

create index if not exists idx_carmore_vehicle_state_sync_mappings_car_number
  on public.carmore_vehicle_state_sync_mappings (car_number);

create index if not exists idx_carmore_vehicle_state_sync_mappings_status
  on public.carmore_vehicle_state_sync_mappings (sync_status);

create index if not exists idx_carmore_vehicle_state_sync_mappings_last_synced_at
  on public.carmore_vehicle_state_sync_mappings (last_synced_at desc);
