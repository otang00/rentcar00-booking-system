create extension if not exists pgcrypto;
create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  source_car_id bigint not null unique,
  source_group_id bigint,
  car_number text not null unique,
  name text not null,
  display_name text,
  image_url text,
  model_year integer,
  fuel_type text,
  seats integer,
  color text,
  rent_age integer,
  active boolean not null default true,
  options_json jsonb not null default '{"ids":[],"names":[],"other":null}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cars_source_group_id on public.cars(source_group_id);
create index if not exists idx_cars_active on public.cars(active);
create index if not exists idx_cars_name on public.cars(name);
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_cars_updated_at on public.cars;
create trigger trg_cars_updated_at
before update on public.cars
for each row
execute function public.set_updated_at();
