alter table if exists public.reservations
  rename to ims_sync_reservations;

alter table if exists public.ims_sync_reservations
  rename constraint reservations_end_after_start to ims_sync_reservations_end_after_start;

alter index if exists public.uq_reservations_ims_reservation_id
  rename to uq_ims_sync_reservations_ims_reservation_id;

alter index if exists public.idx_reservations_car_period
  rename to idx_ims_sync_reservations_car_period;

alter index if exists public.idx_reservations_status
  rename to idx_ims_sync_reservations_status;

alter index if exists public.idx_reservations_last_synced_at
  rename to idx_ims_sync_reservations_last_synced_at;

drop index if exists public.uq_reservations_ims_reservation_id;

create unique index if not exists uq_ims_sync_reservations_ims_reservation_id
  on public.ims_sync_reservations (ims_reservation_id);
