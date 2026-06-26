create table if not exists public.ops_app_reservation_event_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null references public.booking_orders(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  event_payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  response_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_app_reservation_event_outbox_status_check check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  constraint ops_app_reservation_event_outbox_attempts_check check (attempts >= 0)
);

create unique index if not exists uq_ops_app_reservation_event_outbox_event_id
  on public.ops_app_reservation_event_outbox (event_id);

create index if not exists idx_ops_app_reservation_event_outbox_status_next_attempt
  on public.ops_app_reservation_event_outbox (status, next_attempt_at, created_at);

create index if not exists idx_ops_app_reservation_event_outbox_booking_order_created_at
  on public.ops_app_reservation_event_outbox (booking_order_id, created_at desc);
