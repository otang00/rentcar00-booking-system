create table if not exists public.search_shadow_diffs (
  id uuid primary key default gen_random_uuid(),
  search_hash text not null,
  search_params jsonb not null,
  partner jsonb not null,
  db jsonb not null,
  diff jsonb not null,
  execution_meta jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_search_shadow_diffs_hash on public.search_shadow_diffs(search_hash);
create index if not exists idx_search_shadow_diffs_created_at on public.search_shadow_diffs(created_at desc);
