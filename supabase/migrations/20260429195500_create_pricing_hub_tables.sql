create table if not exists public.pricing_hub_periods (
  id uuid primary key default gen_random_uuid(),
  price_policy_id uuid not null references public.price_policies(id) on delete cascade,
  period_name text not null,
  start_at timestamptz,
  end_at timestamptz,
  apply_mon boolean not null default true,
  apply_tue boolean not null default true,
  apply_wed boolean not null default true,
  apply_thu boolean not null default true,
  apply_fri boolean not null default true,
  apply_sat boolean not null default true,
  apply_sun boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_hub_periods_window_ck check (
    end_at is null or start_at is null or end_at >= start_at
  )
);

create index if not exists idx_pricing_hub_periods_policy_id on public.pricing_hub_periods(price_policy_id);
create index if not exists idx_pricing_hub_periods_active on public.pricing_hub_periods(active);

create table if not exists public.pricing_hub_rates (
  id uuid primary key default gen_random_uuid(),
  pricing_hub_period_id uuid not null references public.pricing_hub_periods(id) on delete cascade,
  rate_scope text not null,
  fee_6h integer not null default 0 check (fee_6h >= 0),
  fee_12h integer not null default 0 check (fee_12h >= 0),
  fee_24h integer not null default 0 check (fee_24h >= 0),
  fee_1h integer not null default 0 check (fee_1h >= 0),
  discount_percent numeric(5,2),
  discount_amount integer,
  week_1_price integer,
  week_2_price integer,
  month_1_price integer,
  long_24h_price integer,
  long_1h_price integer,
  weekend_days text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pricing_hub_period_id, rate_scope)
);

create index if not exists idx_pricing_hub_rates_period_id on public.pricing_hub_rates(pricing_hub_period_id);

create table if not exists public.pricing_hub_overrides (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  field_name text not null,
  override_type text not null,
  override_value numeric(12,2) not null,
  start_at timestamptz,
  end_at timestamptz,
  priority integer not null default 100,
  reason text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_hub_overrides_window_ck check (
    end_at is null or start_at is null or end_at >= start_at
  )
);

create index if not exists idx_pricing_hub_overrides_target on public.pricing_hub_overrides(target_type, target_id);
create index if not exists idx_pricing_hub_overrides_status on public.pricing_hub_overrides(status);

create table if not exists public.pricing_hub_previews (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  status text not null default 'ready',
  summary_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_hub_preview_items (
  id uuid primary key default gen_random_uuid(),
  pricing_hub_preview_id uuid not null references public.pricing_hub_previews(id) on delete cascade,
  car_group_id uuid references public.car_groups(id) on delete set null,
  target_type text not null,
  target_id text not null,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  diff_json jsonb not null default '{}'::jsonb,
  warning_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_hub_preview_items_preview_id on public.pricing_hub_preview_items(pricing_hub_preview_id);
create index if not exists idx_pricing_hub_preview_items_target on public.pricing_hub_preview_items(target_type, target_id);

create table if not exists public.pricing_hub_publishes (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  target_channel text not null,
  status text not null default 'ready',
  success_count integer not null default 0,
  failure_count integer not null default 0,
  request_snapshot_json jsonb not null default '{}'::jsonb,
  result_snapshot_json jsonb not null default '{}'::jsonb,
  created_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.pricing_hub_publish_items (
  id uuid primary key default gen_random_uuid(),
  pricing_hub_publish_id uuid not null references public.pricing_hub_publishes(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  status text not null,
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_hub_publish_items_publish_id on public.pricing_hub_publish_items(pricing_hub_publish_id);

create table if not exists public.pricing_hub_channel_mappings (
  id uuid primary key default gen_random_uuid(),
  source_channel text not null,
  source_type text not null,
  source_id text not null,
  source_name text,
  car_group_id uuid not null references public.car_groups(id) on delete cascade,
  mapping_status text not null default 'linked',
  mapping_confidence numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_channel, source_type, source_id)
);

create index if not exists idx_pricing_hub_channel_mappings_car_group_id on public.pricing_hub_channel_mappings(car_group_id);

create or replace view public.v_pricing_hub_policy_editor as
select
  cg.id as car_group_id,
  cg.ims_group_id,
  cg.group_name,
  pp.id as price_policy_id,
  pp.policy_name,
  ppg.id as price_policy_group_id,
  pp.base_daily_price,
  pp.weekday_rate_percent,
  pp.weekend_rate_percent,
  pp.weekday_1_2d_price,
  pp.weekday_3_4d_price,
  pp.weekday_5_6d_price,
  pp.weekday_7d_plus_price,
  pp.weekend_1_2d_price,
  pp.weekend_3_4d_price,
  pp.weekend_5_6d_price,
  pp.weekend_7d_plus_price,
  pp.hour_1_price,
  pp.hour_6_price,
  pp.hour_12_price,
  pp.effective_from,
  pp.effective_to,
  pp.active as policy_active
from public.price_policy_groups ppg
join public.car_groups cg on cg.id = ppg.car_group_id
join public.price_policies pp on pp.id = ppg.price_policy_id;

drop trigger if exists trg_pricing_hub_periods_updated_at on public.pricing_hub_periods;
create trigger trg_pricing_hub_periods_updated_at
before update on public.pricing_hub_periods
for each row
execute function public.set_updated_at();

drop trigger if exists trg_pricing_hub_rates_updated_at on public.pricing_hub_rates;
create trigger trg_pricing_hub_rates_updated_at
before update on public.pricing_hub_rates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_pricing_hub_overrides_updated_at on public.pricing_hub_overrides;
create trigger trg_pricing_hub_overrides_updated_at
before update on public.pricing_hub_overrides
for each row
execute function public.set_updated_at();

drop trigger if exists trg_pricing_hub_channel_mappings_updated_at on public.pricing_hub_channel_mappings;
create trigger trg_pricing_hub_channel_mappings_updated_at
before update on public.pricing_hub_channel_mappings
for each row
execute function public.set_updated_at();
