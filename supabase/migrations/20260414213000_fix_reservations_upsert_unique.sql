drop index if exists public.uq_ims_sync_reservations_ims_reservation_id;
create unique index if not exists uq_ims_sync_reservations_ims_reservation_id
  on public.ims_sync_reservations (ims_reservation_id);
