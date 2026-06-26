create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  marketing_agree boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email
  on public.profiles (email);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.booking_orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_booking_orders_user_id_created_at
  on public.booking_orders (user_id, created_at desc);
