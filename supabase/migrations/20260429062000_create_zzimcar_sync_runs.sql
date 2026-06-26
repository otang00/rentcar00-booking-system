create extension if not exists pgcrypto;

create table if not exists public.zzimcar_sync_runs (
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

create index if not exists idx_zzimcar_sync_runs_started_at
  on public.zzimcar_sync_runs (started_at desc);

create index if not exists idx_zzimcar_sync_runs_status
  on public.zzimcar_sync_runs (status);
