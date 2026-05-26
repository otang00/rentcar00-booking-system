alter table public.cars
  add column if not exists homepage_rental_enabled boolean not null default true,
  add column if not exists homepage_long_rental_enabled boolean not null default true;

create index if not exists idx_cars_homepage_rental_enabled
  on public.cars (homepage_rental_enabled);

create index if not exists idx_cars_homepage_long_rental_enabled
  on public.cars (homepage_long_rental_enabled);
