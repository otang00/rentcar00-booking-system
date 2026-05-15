create unique index if not exists uq_booking_orders_payment_reference
  on public.booking_orders (payment_provider, payment_reference_id);
