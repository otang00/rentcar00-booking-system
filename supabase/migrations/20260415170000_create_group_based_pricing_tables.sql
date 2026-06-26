create table if not exists public.car_groups (
  id uuid primary key default gen_random_uuid(),
  ims_group_id bigint not null unique,
  group_name text not null unique,
  grade text,
  import_type text not null default 'ims',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_car_groups_active on public.car_groups(active);
create index if not exists idx_car_groups_grade on public.car_groups(grade);

create table if not exists public.price_policies (
  id uuid primary key default gen_random_uuid(),
  policy_name text not null,
  base_daily_price integer not null check (base_daily_price >= 0),
  weekday_rate_percent numeric(5,2) not null check (weekday_rate_percent >= 0),
  weekend_rate_percent numeric(5,2) not null check (weekend_rate_percent >= 0),
  weekday_1_2d_price integer not null check (weekday_1_2d_price >= 0),
  weekday_3_4d_price integer not null check (weekday_3_4d_price >= 0),
  weekday_5_6d_price integer not null check (weekday_5_6d_price >= 0),
  weekday_7d_plus_price integer not null check (weekday_7d_plus_price >= 0),
  weekend_1_2d_price integer not null check (weekend_1_2d_price >= 0),
  weekend_3_4d_price integer not null check (weekend_3_4d_price >= 0),
  weekend_5_6d_price integer not null check (weekend_5_6d_price >= 0),
  weekend_7d_plus_price integer not null check (weekend_7d_plus_price >= 0),
  hour_1_price integer not null default 0 check (hour_1_price >= 0),
  hour_6_price integer not null default 0 check (hour_6_price >= 0),
  hour_12_price integer not null default 0 check (hour_12_price >= 0),
  effective_from timestamptz,
  effective_to timestamptz,
  active boolean not null default true,
  source_file text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_policies_effective_window_ck check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  )
);

create index if not exists idx_price_policies_active on public.price_policies(active);
create index if not exists idx_price_policies_window on public.price_policies(effective_from, effective_to);
create index if not exists idx_price_policies_policy_name on public.price_policies(policy_name);

create table if not exists public.price_policy_groups (
  id uuid primary key default gen_random_uuid(),
  price_policy_id uuid not null references public.price_policies(id) on delete cascade,
  car_group_id uuid not null references public.car_groups(id) on delete cascade,
  match_source text not null default 'xlsx',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_policy_id, car_group_id)
);

create index if not exists idx_price_policy_groups_policy_id on public.price_policy_groups(price_policy_id);
create index if not exists idx_price_policy_groups_car_group_id on public.price_policy_groups(car_group_id);
create index if not exists idx_price_policy_groups_active on public.price_policy_groups(active);

create or replace view public.v_active_group_price_policies as
select
  cg.ims_group_id,
  cg.group_name,
  ppg.price_policy_id,
  pp.policy_name,
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
  pp.metadata as policy_metadata,
  cg.metadata as group_metadata,
  ppg.metadata as mapping_metadata
from public.price_policy_groups ppg
join public.price_policies pp on pp.id = ppg.price_policy_id
join public.car_groups cg on cg.id = ppg.car_group_id
where pp.active = true
  and ppg.active = true
  and cg.active = true;

drop trigger if exists trg_car_groups_updated_at on public.car_groups;
create trigger trg_car_groups_updated_at
before update on public.car_groups
for each row
execute function public.set_updated_at();

drop trigger if exists trg_price_policies_updated_at on public.price_policies;
create trigger trg_price_policies_updated_at
before update on public.price_policies
for each row
execute function public.set_updated_at();

drop trigger if exists trg_price_policy_groups_updated_at on public.price_policy_groups;
create trigger trg_price_policy_groups_updated_at
before update on public.price_policy_groups
for each row
execute function public.set_updated_at();
