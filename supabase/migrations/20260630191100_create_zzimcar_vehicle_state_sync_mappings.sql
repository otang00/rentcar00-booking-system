create table if not exists public.zzimcar_vehicle_state_sync_mappings (
  id uuid primary key default gen_random_uuid(),
  car_number text not null,
  local_car_id uuid references public.cars(id) on delete set null,
  ims_car_id text,
  zzimcar_vehicle_pid text not null,
  observed_is_publish integer,
  decided_is_publish integer not null,
  applied_is_publish integer,
  active_monthly_reservation_ids jsonb not null default '[]'::jsonb,
  reason jsonb not null default '[]'::jsonb,
  sync_status text not null default 'planned',
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zzimcar_vehicle_state_sync_mappings_status_check check (
    sync_status in ('planned', 'synced', 'failed', 'skipped')
  ),
  constraint zzimcar_vehicle_state_sync_mappings_observed_publish_check check (
    observed_is_publish is null or observed_is_publish in (0, 1)
  ),
  constraint zzimcar_vehicle_state_sync_mappings_decided_publish_check check (
    decided_is_publish in (0, 1)
  ),
  constraint zzimcar_vehicle_state_sync_mappings_applied_publish_check check (
    applied_is_publish is null or applied_is_publish in (0, 1)
  )
);

create unique index if not exists uq_zzimcar_vehicle_state_sync_mappings_vehicle_pid
  on public.zzimcar_vehicle_state_sync_mappings (zzimcar_vehicle_pid);

create index if not exists idx_zzimcar_vehicle_state_sync_mappings_car_number
  on public.zzimcar_vehicle_state_sync_mappings (car_number);

create index if not exists idx_zzimcar_vehicle_state_sync_mappings_status
  on public.zzimcar_vehicle_state_sync_mappings (sync_status);

create index if not exists idx_zzimcar_vehicle_state_sync_mappings_last_synced_at
  on public.zzimcar_vehicle_state_sync_mappings (last_synced_at desc);
