alter table public.cars
  add column if not exists ims_can_general_rental boolean,
  add column if not exists ims_can_monthly_rental boolean,
  add column if not exists ims_vehicle_synced_at timestamptz;

create index if not exists idx_cars_ims_can_general_rental
  on public.cars (ims_can_general_rental);

