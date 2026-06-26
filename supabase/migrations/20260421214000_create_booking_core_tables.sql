create table if not exists public.booking_orders (
  id uuid primary key default gen_random_uuid(),
  public_reservation_code text not null,
  booking_channel text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_phone_last4 text not null,
  car_id uuid not null references public.cars(id),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  pickup_method text not null,
  pickup_location_snapshot jsonb,
  return_location_snapshot jsonb,
  quoted_total_amount numeric(12, 2) not null,
  pricing_snapshot jsonb,
  payment_provider text not null,
  payment_reference_id text not null,
  booking_status text not null,
  payment_status text not null,
  sync_status text not null,
  manual_review_required boolean not null default false,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_orders_return_after_pickup check (return_at > pickup_at),
  constraint booking_orders_amount_nonnegative check (quoted_total_amount >= 0),
  constraint booking_orders_customer_phone_last4_len check (char_length(customer_phone_last4) = 4),
  constraint booking_orders_booking_status_check check (
    booking_status in (
      'confirmed_pending_sync',
      'confirmed',
      'in_use',
      'cancelled',
      'completed',
      'manual_review_required'
    )
  ),
  constraint booking_orders_payment_status_check check (
    payment_status in (
      'paid',
      'cancelled',
      'refund_pending',
      'refunded'
    )
  ),
  constraint booking_orders_sync_status_check check (
    sync_status in (
      'not_required',
      'pending',
      'syncing',
      'synced',
      'sync_failed',
      'cancel_sync_pending',
      'cancel_synced',
      'cancel_sync_failed',
      'stale_check_required'
    )
  ),
  constraint booking_orders_booking_channel_check check (
    booking_channel in ('website', 'phone', 'manual_admin')
  ),
  constraint booking_orders_pickup_method_check check (
    pickup_method in ('pickup', 'delivery')
  )
);

create unique index if not exists uq_booking_orders_public_reservation_code
  on public.booking_orders (public_reservation_code);

create index if not exists idx_booking_orders_car_period
  on public.booking_orders (car_id, pickup_at, return_at);

create index if not exists idx_booking_orders_booking_status_created_at
  on public.booking_orders (booking_status, created_at desc);

create index if not exists idx_booking_orders_payment_status_created_at
  on public.booking_orders (payment_status, created_at desc);

create index if not exists idx_booking_orders_sync_status_updated_at
  on public.booking_orders (sync_status, updated_at desc);

create index if not exists idx_booking_orders_customer_phone_last4_created_at
  on public.booking_orders (customer_phone_last4, created_at desc);

create table if not exists public.reservation_mappings (
  id uuid primary key default gen_random_uuid(),
  booking_order_id uuid not null references public.booking_orders(id) on delete cascade,
  external_system text not null,
  external_reservation_id text,
  ims_reservation_id text,
  mapping_status text not null,
  external_request_key text,
  last_sync_attempt_at timestamptz,
  last_sync_success_at timestamptz,
  last_sync_error_code text,
  last_sync_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_mappings_external_system_check check (
    external_system in ('ims')
  ),
  constraint reservation_mappings_mapping_status_check check (
    mapping_status in (
      'pending',
      'linked',
      'sync_failed',
      'cancel_pending',
      'cancel_failed',
      'manual_review_required',
      'closed'
    )
  )
);

create unique index if not exists uq_reservation_mappings_booking_order_active
  on public.reservation_mappings (booking_order_id)
  where mapping_status <> 'closed';

create unique index if not exists uq_reservation_mappings_ims_reservation_id
  on public.reservation_mappings (ims_reservation_id)
  where ims_reservation_id is not null;

create unique index if not exists uq_reservation_mappings_external_request_key
  on public.reservation_mappings (external_request_key)
  where external_request_key is not null;

create index if not exists idx_reservation_mappings_mapping_status_updated_at
  on public.reservation_mappings (mapping_status, updated_at desc);

drop trigger if exists trg_booking_orders_updated_at on public.booking_orders;
create trigger trg_booking_orders_updated_at
before update on public.booking_orders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_reservation_mappings_updated_at on public.reservation_mappings;
create trigger trg_reservation_mappings_updated_at
before update on public.reservation_mappings
for each row
execute function public.set_updated_at();
