alter table public.zzimcar_disable_time_sync_mappings
  add column if not exists child_block_key text;

update public.zzimcar_disable_time_sync_mappings
set child_block_key = concat_ws(':', ims_reservation_id, start_at::text, end_at::text)
where child_block_key is null;

alter table public.zzimcar_disable_time_sync_mappings
  alter column child_block_key set not null;

create unique index if not exists uq_zzimcar_disable_time_sync_mappings_child_block
  on public.zzimcar_disable_time_sync_mappings (ims_reservation_id, child_block_key);

alter table public.carmore_holiday_sync_mappings
  add column if not exists child_holiday_key text;

update public.carmore_holiday_sync_mappings
set child_holiday_key = concat_ws(':', ims_reservation_id, holiday_start_date::text, holiday_end_date::text)
where child_holiday_key is null;

alter table public.carmore_holiday_sync_mappings
  alter column child_holiday_key set not null;

create unique index if not exists uq_carmore_holiday_sync_mappings_child_holiday
  on public.carmore_holiday_sync_mappings (ims_reservation_id, child_holiday_key);
