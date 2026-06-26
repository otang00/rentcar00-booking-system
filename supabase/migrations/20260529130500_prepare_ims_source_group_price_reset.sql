-- Prepared only. Do not apply to production without separate approval.
-- Source: data/pricing-reset/ims-source-group-price-reset-20260529.json
-- Basis: cars.source_group_id / 36 groups / weekday 90 / weekend 115

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
  (22015, 'CN7 아반떼 LPI', 'CN7 아반떼 LPI', 'basic', '표준', 2, 72000, 90, 115, 65000, 83000, 9000, 396000, 540000, 648000),
  (22016, 'DN8 쏘나타 LPI', 'DN8 쏘나타 LPI', 'basic', '표준', 8, 75000, 90, 115, 68000, 87000, 9000, 413000, 563000, 675000),
  (25142, '모닝 어반 (2020년) 가솔린', '모닝 어반 (2020년) 가솔린', 'basic', '표준', 1, 55000, 90, 115, 50000, 64000, 7000, 303000, 413000, 495000),
  (22017, '신형K5 LPI', '신형K5 LPI', 'basic', '표준', 3, 70000, 90, 115, 63000, 81000, 9000, 385000, 525000, 630000),
  (22019, '신형IG 그렌져 가솔린', '신형IG 그렌져 가솔린', 'semi_premium', '준프리미엄', 1, 78000, 90, 115, 71000, 90000, 10000, 429000, 624000, 858000),
  (22020, '신형IG 그렌져 LPI', '신형IG 그렌져 LPI', 'semi_premium', '준프리미엄', 1, 78000, 90, 115, 71000, 90000, 10000, 429000, 624000, 858000),
  (22022, '신형IG 그렌져 LPI', '신형IG 그렌져 LPI', 'semi_premium', '준프리미엄', 5, 82000, 90, 115, 74000, 95000, 10000, 451000, 656000, 902000),
  (22023, 'GN7 그렌져 휘발유', 'GN7 그렌져 휘발유', 'semi_premium', '준프리미엄', 2, 120000, 90, 115, 108000, 138000, 15000, 660000, 960000, 1320000),
  (22024, 'K7 LPI', 'K7 LPI', 'semi_premium', '준프리미엄', 1, 77000, 90, 115, 70000, 89000, 10000, 424000, 616000, 847000),
  (22025, 'K7프리미어 LPI', 'K7프리미어 LPI', 'semi_premium', '준프리미엄', 1, 80000, 90, 115, 72000, 92000, 10000, 440000, 640000, 880000),
  (22026, '코나 2.0 휘발유', '코나 2.0 휘발유', 'semi_premium', '준프리미엄', 1, 60000, 90, 115, 54000, 69000, 8000, 330000, 480000, 660000),
  (22027, '셀토스 휘발유', '셀토스 휘발유', 'semi_premium', '준프리미엄', 2, 72000, 90, 115, 65000, 83000, 9000, 396000, 576000, 792000),
  (22029, '스포티지 휘발유 그라파이트', '스포티지 휘발유 그라파이트', 'semi_premium', '준프리미엄', 1, 85000, 90, 115, 77000, 98000, 11000, 468000, 680000, 935000),
  (22179, '셀토스 휘발유', '셀토스 휘발유', 'semi_premium', '준프리미엄', 2, 72000, 90, 115, 65000, 83000, 9000, 396000, 576000, 792000),
  (22318, '신형K5 LPI', '신형K5 LPI', 'semi_premium', '준프리미엄', 2, 80000, 90, 115, 72000, 92000, 10000, 440000, 640000, 880000),
  (22533, '더 뉴 아반떼 (CN7) (2023년) 가솔린', '더 뉴 아반떼 (CN7) (2023년) 가솔린', 'semi_premium', '준프리미엄', 1, 70000, 90, 115, 63000, 81000, 9000, 385000, 560000, 770000),
  (22789, '코나 2.0 휘발유', '코나 2.0 휘발유', 'semi_premium', '준프리미엄', 1, 63500, 90, 115, 58000, 74000, 8000, 350000, 508000, 699000),
  (23069, '더 뉴 아반떼 (CN7) (2025년) 가솔린', '더 뉴 아반떼 (CN7) (2025년) 가솔린', 'semi_premium', '준프리미엄', 2, 70000, 90, 115, 63000, 81000, 9000, 385000, 560000, 770000),
  (23142, '더 뉴 K5 3세대 (2023년) 가솔린', '더 뉴 K5 3세대 (2023년) 가솔린', 'semi_premium', '준프리미엄', 2, 82000, 90, 115, 74000, 95000, 10000, 451000, 656000, 902000),
  (22030, '팰리세이드 3.8 휘발유', '팰리세이드 3.8 휘발유', 'premium', '프리미엄', 1, 150000, 90, 115, 135000, 173000, 22000, 975000, 1350000, 2100000),
  (22031, '카니발 9인승 경유', '카니발 9인승 경유', 'semi_premium', '준프리미엄', 1, 140000, 90, 115, 126000, 161000, 17000, 770000, 1120000, 1540000),
  (22032, 'G80 3.5 가솔린', 'G80 3.5 가솔린', 'premium', '프리미엄', 1, 160000, 90, 115, 144000, 184000, 23000, 1040000, 1440000, 2240000),
  (22033, 'GV70 2.5 가솔린', 'GV70 2.5 가솔린', 'premium', '프리미엄', 1, 170000, 90, 115, 153000, 196000, 24000, 1105000, 1530000, 2380000),
  (22034, 'GV80 3.5 가솔린', 'GV80 3.5 가솔린', 'premium', '프리미엄', 1, 180000, 90, 115, 162000, 207000, 26000, 1170000, 1620000, 2520000),
  (22035, '모델3 롱레인지', '모델3 롱레인지', 'premium', '프리미엄', 2, 120000, 90, 115, 108000, 138000, 17000, 780000, 1080000, 1680000),
  (22036, '모델Y 롱레인지', '모델Y 롱레인지', 'premium', '프리미엄', 1, 140000, 90, 115, 126000, 161000, 20000, 910000, 1260000, 1960000),
  (22105, '모델Y RWD', '모델Y RWD', 'premium', '프리미엄', 1, 145000, 90, 115, 131000, 167000, 21000, 943000, 1305000, 2030000),
  (22380, '싼타페 MX5 휘발유', '싼타페 MX5 휘발유', 'semi_premium', '준프리미엄', 2, 120000, 90, 115, 108000, 138000, 15000, 660000, 960000, 1320000),
  (23032, '더 뉴 카니발(KA4) 2025 가솔린 3.5', '더 뉴 카니발(KA4) 2025 가솔린 3.5', 'semi_premium', '준프리미엄', 2, 150000, 90, 115, 135000, 173000, 18000, 825000, 1200000, 1650000),
  (23043, '모델 Y 주니퍼 (2025년) 전기', '모델 Y 주니퍼 (2025년) 전기', 'premium', '프리미엄', 1, 220000, 90, 115, 198000, 253000, 31000, 1430000, 1980000, 3080000),
  (23049, 'E220 아방가르드', 'E220 아방가르드', 'premium', '프리미엄', 1, 180000, 90, 115, 162000, 207000, 26000, 1170000, 1620000, 2520000),
  (23143, '더 뉴 K8 (2025년) 가솔린베스트셀렉션', '더 뉴 K8 (2025년) 가솔린베스트셀렉션', 'semi_premium', '준프리미엄', 1, 105000, 90, 115, 95000, 121000, 13000, 578000, 840000, 1155000),
  (23159, '디 올 뉴 그랜저 (2025년) 가솔린', '디 올 뉴 그랜저 (2025년) 가솔린', 'semi_premium', '준프리미엄', 1, 120000, 90, 115, 108000, 138000, 15000, 660000, 960000, 1320000),
  (23398, '더 뉴 셀토스 2025년 가솔린', '더 뉴 셀토스 2025년 가솔린', 'semi_premium', '준프리미엄', 2, 80000, 90, 115, 72000, 92000, 10000, 440000, 640000, 880000),
  (24154, '더 뉴 카니발(KA4) (2023년) 디젤', '더 뉴 카니발(KA4) (2023년) 디젤', 'semi_premium', '준프리미엄', 1, 145000, 90, 115, 131000, 167000, 18000, 798000, 1160000, 1595000),
  (25141, '스타리아 투어러(2023년) 디젤', '스타리아 투어러(2023년) 디젤', 'semi_premium', '준프리미엄', 1, 130000, 90, 115, 117000, 150000, 16000, 715000, 1040000, 1430000);

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
