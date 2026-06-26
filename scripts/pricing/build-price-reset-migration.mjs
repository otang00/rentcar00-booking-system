import fs from 'node:fs'

const inputFile = process.argv[2] || 'data/pricing-reset/ims-source-group-price-reset-20260529.json'
const outputFile = process.argv[3] || 'supabase/migrations/20260529130500_prepare_ims_source_group_price_reset.sql'
const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8'))

function sqlString(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}
function n(value) { return Number(value || 0) }
const values = payload.rows.map((row) => {
  const d = row.derived_prices || {}
  return `  (${n(row.source_group_id)}, ${sqlString(row.vehicle_group_name)}, ${sqlString(row.policy_name)}, ${sqlString(row.pricing_option_type)}, ${sqlString(row.pricing_option_label)}, ${n(row.vehicle_count)}, ${n(row.base_24h_price)}, ${n(row.weekday_rate_percent)}, ${n(row.weekend_rate_percent)}, ${n(row.weekday_24h_price)}, ${n(row.weekend_24h_price)}, ${n(d.hour_1_price)}, ${n(d.week_1_price)}, ${n(d.week_2_price)}, ${n(d.month_1_price)})`
}).join(',\n')

const sql = `-- Prepared only. Do not apply to production without separate approval.
-- Source: ${inputFile}
-- Basis: cars.source_group_id / ${payload.rows.length} groups / weekday 90 / weekend 115

begin;

create temporary table _ims_source_group_price_reset (
  source_group_id bigint primary key,
  vehicle_group_name text not null,
  policy_name text not null,
  pricing_option_type text not null check (pricing_option_type in ('basic', 'semi_premium', 'premium')),
  pricing_option_label text not null,
  vehicle_count integer not null,
  base_24h_price integer not null,
  weekday_rate_percent numeric(5,2) not null,
  weekend_rate_percent numeric(5,2) not null,
  weekday_24h_price integer not null,
  weekend_24h_price integer not null,
  hour_1_price integer not null,
  week_1_price integer not null,
  week_2_price integer not null,
  month_1_price integer not null
) on commit drop;

insert into _ims_source_group_price_reset (
  source_group_id,
  vehicle_group_name,
  policy_name,
  pricing_option_type,
  pricing_option_label,
  vehicle_count,
  base_24h_price,
  weekday_rate_percent,
  weekend_rate_percent,
  weekday_24h_price,
  weekend_24h_price,
  hour_1_price,
  week_1_price,
  week_2_price,
  month_1_price
) values
${values};

do $$
begin
  if (select count(*) from _ims_source_group_price_reset) <> 36 then
    raise exception 'expected 36 rows for price reset';
  end if;

  if exists (
    select 1
    from _ims_source_group_price_reset r
    where r.weekday_rate_percent <> 90
       or r.weekend_rate_percent <> 115
       or r.weekday_24h_price <> ceil((r.base_24h_price * r.weekday_rate_percent / 100.0) / 1000) * 1000
       or r.weekend_24h_price <> ceil((r.base_24h_price * r.weekend_rate_percent / 100.0) / 1000) * 1000
  ) then
    raise exception 'weekday/weekend percent or applied 24h price mismatch';
  end if;
end
$$;

insert into public.car_groups (
  ims_group_id,
  group_name,
  import_type,
  active,
  metadata
)
select
  r.source_group_id,
  concat(r.vehicle_group_name, ' [', r.source_group_id, ']'),
  'ims',
  true,
  jsonb_build_object(
    'source', 'ims-source-group-price-reset-20260529',
    'sourceGroupId', r.source_group_id,
    'vehicleCount', r.vehicle_count
  )
from _ims_source_group_price_reset r
on conflict (ims_group_id) do update
set
  group_name = excluded.group_name,
  active = true,
  metadata = coalesce(public.car_groups.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

create temporary table _price_reset_policy_map (
  source_group_id bigint primary key,
  price_policy_id uuid not null default gen_random_uuid()
) on commit drop;

insert into _price_reset_policy_map (source_group_id)
select source_group_id
from _ims_source_group_price_reset;

insert into public.price_policies (
  id,
  policy_name,
  base_daily_price,
  weekday_1_2d_price,
  weekday_3_4d_price,
  weekday_5_6d_price,
  weekday_7d_plus_price,
  weekend_1_2d_price,
  weekend_3_4d_price,
  weekend_5_6d_price,
  weekend_7d_plus_price,
  hour_1_price,
  hour_6_price,
  hour_12_price,
  active,
  source_file,
  metadata,
  pricing_option_type
)
select
  m.price_policy_id,
  r.policy_name,
  r.base_24h_price,
  r.weekday_24h_price,
  r.weekday_24h_price,
  r.weekday_24h_price,
  r.week_1_price,
  r.weekend_24h_price,
  r.weekend_24h_price,
  r.weekend_24h_price,
  r.week_1_price,
  r.hour_1_price,
  ceil((r.base_24h_price * 0.55)::numeric / 1000) * 1000,
  ceil((r.base_24h_price * 0.80)::numeric / 1000) * 1000,
  true,
  'ims-source-group-price-reset-20260529',
  jsonb_build_object(
    'source', 'ims-source-group-price-reset-20260529',
    'sourceGroupId', r.source_group_id,
    'pricingOptionLabel', r.pricing_option_label,
    'base24h', r.base_24h_price,
    'weekdayPercent', r.weekday_rate_percent,
    'weekendPercent', r.weekend_rate_percent
  ),
  r.pricing_option_type
from _ims_source_group_price_reset r
join _price_reset_policy_map m on m.source_group_id = r.source_group_id;

update public.price_policy_groups ppg
set
  active = false,
  metadata = coalesce(ppg.metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivatedBy', 'ims-source-group-price-reset-20260529',
    'deactivatedAt', now()
  ),
  updated_at = now()
from public.car_groups cg
join _ims_source_group_price_reset r on r.source_group_id = cg.ims_group_id
where ppg.car_group_id = cg.id
  and ppg.active = true;

insert into public.price_policy_groups (
  price_policy_id,
  car_group_id,
  match_source,
  active,
  metadata
)
select
  pp.id,
  cg.id,
  'ims-source-group-price-reset-20260529',
  true,
  jsonb_build_object(
    'source', 'ims-source-group-price-reset-20260529',
    'sourceGroupId', r.source_group_id,
    'vehicleCount', r.vehicle_count
  )
from _ims_source_group_price_reset r
join public.car_groups cg on cg.ims_group_id = r.source_group_id
join _price_reset_policy_map m on m.source_group_id = r.source_group_id
join public.price_policies pp on pp.id = m.price_policy_id
on conflict (price_policy_id, car_group_id) do update
set
  active = true,
  match_source = excluded.match_source,
  metadata = coalesce(public.price_policy_groups.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.pricing_hub_periods (
  price_policy_id,
  period_name,
  active,
  metadata
)
select
  pp.id,
  '상시 기본요금',
  true,
  jsonb_build_object('source', 'ims-source-group-price-reset-20260529')
from _ims_source_group_price_reset r
join _price_reset_policy_map m on m.source_group_id = r.source_group_id
join public.price_policies pp on pp.id = m.price_policy_id
on conflict do nothing;

with target_periods as (
  select distinct on (pp.id)
    pp.id as price_policy_id,
    php.id as pricing_hub_period_id,
    r.*
  from _ims_source_group_price_reset r
  join _price_reset_policy_map m on m.source_group_id = r.source_group_id
  join public.price_policies pp on pp.id = m.price_policy_id
  join public.pricing_hub_periods php on php.price_policy_id = pp.id and php.active = true
  order by pp.id, php.created_at desc
), rate_rows as (
  select pricing_hub_period_id, 'common'::text as rate_scope, base_24h_price as fee_24h, hour_1_price, week_1_price, week_2_price, month_1_price, base_24h_price, weekday_rate_percent, weekend_rate_percent, pricing_option_type from target_periods
  union all
  select pricing_hub_period_id, 'weekday'::text, weekday_24h_price, hour_1_price, week_1_price, week_2_price, month_1_price, base_24h_price, weekday_rate_percent, weekend_rate_percent, pricing_option_type from target_periods
  union all
  select pricing_hub_period_id, 'weekend'::text, weekend_24h_price, hour_1_price, week_1_price, week_2_price, month_1_price, base_24h_price, weekday_rate_percent, weekend_rate_percent, pricing_option_type from target_periods
)
insert into public.pricing_hub_rates (
  pricing_hub_period_id,
  rate_scope,
  fee_6h,
  fee_12h,
  fee_24h,
  fee_1h,
  week_1_price,
  week_2_price,
  month_1_price,
  long_24h_price,
  long_1h_price,
  metadata
)
select
  rr.pricing_hub_period_id,
  rr.rate_scope,
  ceil((rr.fee_24h * 0.55)::numeric / 1000) * 1000,
  ceil((rr.fee_24h * 0.80)::numeric / 1000) * 1000,
  rr.fee_24h,
  rr.hour_1_price,
  rr.week_1_price,
  rr.week_2_price,
  rr.month_1_price,
  rr.fee_24h,
  rr.hour_1_price,
  jsonb_build_object(
    'source', 'ims-source-group-price-reset-20260529',
    'base24h', rr.base_24h_price,
    'weekdayPercent', rr.weekday_rate_percent,
    'weekendPercent', rr.weekend_rate_percent,
    'pricingOptionType', rr.pricing_option_type
  )
from rate_rows rr
on conflict (pricing_hub_period_id, rate_scope) do update
set
  fee_6h = excluded.fee_6h,
  fee_12h = excluded.fee_12h,
  fee_24h = excluded.fee_24h,
  fee_1h = excluded.fee_1h,
  week_1_price = excluded.week_1_price,
  week_2_price = excluded.week_2_price,
  month_1_price = excluded.month_1_price,
  long_24h_price = excluded.long_24h_price,
  long_1h_price = excluded.long_1h_price,
  metadata = coalesce(public.pricing_hub_rates.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

commit;
`
fs.writeFileSync(outputFile, sql)
console.log(outputFile)
