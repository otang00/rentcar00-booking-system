alter table public.sync_events
  add column if not exists last_seen_at timestamptz,
  add column if not exists seen_count integer not null default 1,
  add column if not exists acked_at timestamptz,
  add column if not exists ack_note text;

update public.sync_events
set last_seen_at = coalesce(last_seen_at, occurred_at),
    seen_count = greatest(coalesce(seen_count, 1), 1)
where last_seen_at is null
   or seen_count is null
   or seen_count < 1;

alter table public.sync_events
  drop constraint if exists sync_events_ack_status_check;

alter table public.sync_events
  add constraint sync_events_ack_status_check
  check (ack_status in ('not_required', 'unread', 'acknowledged', 'ignored', 'resolved'));

with duplicate_groups as (
  select
    dedupe_key,
    max(occurred_at) as max_occurred_at,
    count(*)::integer as duplicate_count,
    max(coalesce(last_seen_at, occurred_at)) as max_last_seen_at,
    array_agg(id order by occurred_at desc, created_at desc) as ids
  from public.sync_events
  where requires_ack = true
    and dedupe_key is not null
  group by dedupe_key
  having count(*) > 1
), canonical as (
  select
    dedupe_key,
    ids[1] as keep_id,
    duplicate_count,
    max_occurred_at,
    max_last_seen_at,
    ids[2:array_length(ids, 1)] as remove_ids
  from duplicate_groups
), update_canonical as (
  update public.sync_events event
  set
    occurred_at = canonical.max_occurred_at,
    last_seen_at = canonical.max_last_seen_at,
    seen_count = greatest(coalesce(event.seen_count, 1), canonical.duplicate_count),
    metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
      'dedupedAt', now(),
      'dedupedHistoricalRows', canonical.duplicate_count
    )
  from canonical
  where event.id = canonical.keep_id
  returning event.id
)
delete from public.sync_events event
using canonical
where event.id = any(canonical.remove_ids);

create unique index if not exists uq_sync_events_requires_ack_dedupe_key
  on public.sync_events (dedupe_key)
  where requires_ack = true and dedupe_key is not null;

create index if not exists idx_sync_events_ack_status_last_seen
  on public.sync_events (ack_status, last_seen_at desc);
