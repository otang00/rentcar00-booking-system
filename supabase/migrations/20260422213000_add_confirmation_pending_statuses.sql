alter table public.booking_orders
  drop constraint if exists booking_orders_booking_status_check;

alter table public.booking_orders
  add constraint booking_orders_booking_status_check check (
    booking_status in (
      'confirmation_pending',
      'confirmed_pending_sync',
      'confirmed',
      'in_use',
      'cancelled',
      'completed',
      'manual_review_required'
    )
  );

alter table public.booking_orders
  drop constraint if exists booking_orders_payment_status_check;

alter table public.booking_orders
  add constraint booking_orders_payment_status_check check (
    payment_status in (
      'pending',
      'paid',
      'cancelled',
      'refund_pending',
      'refunded'
    )
  );
