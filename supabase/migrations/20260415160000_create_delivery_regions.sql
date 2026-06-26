create table if not exists public.delivery_regions (
  id uuid primary key default gen_random_uuid(),
  province_id integer not null,
  province_name text not null,
  city_id integer not null,
  city_name text not null,
  dong_id integer not null,
  dong_name text not null,
  full_label text not null,
  round_trip_price integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dong_id)
);
create index if not exists idx_delivery_regions_city_id on public.delivery_regions(city_id);
create index if not exists idx_delivery_regions_active on public.delivery_regions(active);
