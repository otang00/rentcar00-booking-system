create table if not exists public.zzimcar_disable_time_sync_mappings (
  id uuid primary key default gen_random_uuid(),
  ims_reservation_id text not null,
  car_number text not null,
  zzimcar_vehicle_pid text not null,
  zzimcar_disable_time_pid text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  sync_status text not null,
  last_synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zzimcar_disable_time_sync_mappings_end_after_start check (end_at > start_at),
  constraint zzimcar_disable_time_sync_mappings_status_check check (
    sync_status in ('active', 'deleted', 'sync_failed', 'delete_failed')
  )
);

create unique index if not exists uq_zzimcar_disable_time_sync_mappings_ims_reservation_id
  on public.zzimcar_disable_time_sync_mappings (ims_reservation_id);

create index if not exists idx_zzimcar_disable_time_sync_mappings_status
  on public.zzimcar_disable_time_sync_mappings (sync_status);

create index if not exists idx_zzimcar_disable_time_sync_mappings_last_synced_at
  on public.zzimcar_disable_time_sync_mappings (last_synced_at desc);
