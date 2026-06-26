create table if not exists public.reservation_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null references public.booking_orders(id) on delete cascade,
  event_type text not null,
  event_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservation_status_events_booking_order_created_at
  on public.reservation_status_events (booking_order_id, created_at desc);

create index if not exists idx_reservation_status_events_event_type_created_at
  on public.reservation_status_events (event_type, created_at desc);

create table if not exists public.booking_lookup_keys (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null references public.booking_orders(id) on delete cascade,
  lookup_type text not null,
  lookup_value_hash text not null,
  lookup_value_last4 text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_lookup_keys_last4_len check (
    lookup_value_last4 is null or char_length(lookup_value_last4) = 4
  )
);

create index if not exists idx_booking_lookup_keys_type_hash
  on public.booking_lookup_keys (lookup_type, lookup_value_hash);

create index if not exists idx_booking_lookup_keys_booking_order_created_at
  on public.booking_lookup_keys (booking_order_id, created_at desc);

create unique index if not exists uq_booking_lookup_keys_booking_order_lookup_type
  on public.booking_lookup_keys (booking_order_id, lookup_type);
