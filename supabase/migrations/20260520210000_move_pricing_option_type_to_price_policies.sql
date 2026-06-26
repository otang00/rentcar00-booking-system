drop view if exists public.v_search_pricing_hub_policies;
drop view if exists public.v_pricing_hub_policy_editor;

alter table public.price_policies
  add column if not exists pricing_option_type text not null default 'semi_premium';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_policies_pricing_option_type_ck'
  ) then
    alter table public.price_policies
      add constraint price_policies_pricing_option_type_ck
      check (pricing_option_type in ('basic', 'semi_premium', 'premium'));
  end if;
end
$$;

create temporary table _policy_type_choice on commit drop as
with active_types as (
  select distinct
    ppg.price_policy_id,
    ppg.pricing_option_type,
    case ppg.pricing_option_type
      when 'premium' then 3
      when 'semi_premium' then 2
      else 1
    end as priority
  from public.price_policy_groups ppg
  where ppg.active = true
), type_counts as (
  select price_policy_id, count(*) as type_count
  from active_types
  group by price_policy_id
), ranked as (
  select
    active_types.price_policy_id,
    active_types.pricing_option_type,
    type_counts.type_count,
    row_number() over (partition by active_types.price_policy_id order by active_types.priority desc, active_types.pricing_option_type) as rn
  from active_types
  join type_counts on type_counts.price_policy_id = active_types.price_policy_id
)
select
  price_policy_id,
  pricing_option_type as keep_pricing_option_type,
  type_count
from ranked
where rn = 1;

update public.price_policies pp
set pricing_option_type = coalesce(ptc.keep_pricing_option_type, pp.pricing_option_type, 'semi_premium')
from _policy_type_choice ptc
where pp.id = ptc.price_policy_id;

create temporary table _policy_clone_map on commit drop as
select
  ppg.price_policy_id as old_price_policy_id,
  ppg.pricing_option_type,
  gen_random_uuid() as new_price_policy_id
from public.price_policy_groups ppg
join _policy_type_choice ptc on ptc.price_policy_id = ppg.price_policy_id
where ppg.active = true
  and ptc.type_count > 1
  and ppg.pricing_option_type <> ptc.keep_pricing_option_type
group by ppg.price_policy_id, ppg.pricing_option_type;

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
  effective_from,
  effective_to,
  active,
  source_file,
  metadata,
  pricing_option_type
)
select
  pcm.new_price_policy_id,
  concat(pp.policy_name, ' · ', case pcm.pricing_option_type when 'basic' then '기본' when 'premium' then '프리미엄' else '세미프리미엄' end),
  pp.base_daily_price,
  pp.weekday_1_2d_price,
  pp.weekday_3_4d_price,
  pp.weekday_5_6d_price,
  pp.weekday_7d_plus_price,
  pp.weekend_1_2d_price,
  pp.weekend_3_4d_price,
  pp.weekend_5_6d_price,
  pp.weekend_7d_plus_price,
  pp.hour_1_price,
  pp.hour_6_price,
  pp.hour_12_price,
  pp.effective_from,
  pp.effective_to,
  pp.active,
  pp.source_file,
  coalesce(pp.metadata, '{}'::jsonb) || jsonb_build_object(
    'source', 'pricing-option-type-policy-split',
    'clonedFromPricePolicyId', pp.id,
    'pricingOptionType', pcm.pricing_option_type
  ),
  pcm.pricing_option_type
from _policy_clone_map pcm
join public.price_policies pp on pp.id = pcm.old_price_policy_id;

create temporary table _period_clone_map on commit drop as
select
  php.id as old_period_id,
  gen_random_uuid() as new_period_id,
  pcm.old_price_policy_id,
  pcm.new_price_policy_id,
  pcm.pricing_option_type
from public.pricing_hub_periods php
join _policy_clone_map pcm on pcm.old_price_policy_id = php.price_policy_id;

insert into public.pricing_hub_periods (
  id,
  price_policy_id,
  period_name,
  start_at,
  end_at,
  apply_mon,
  apply_tue,
  apply_wed,
  apply_thu,
  apply_fri,
  apply_sat,
  apply_sun,
  active,
  metadata
)
select
  pcm.new_period_id,
  pcm.new_price_policy_id,
  php.period_name,
  php.start_at,
  php.end_at,
  php.apply_mon,
  php.apply_tue,
  php.apply_wed,
  php.apply_thu,
  php.apply_fri,
  php.apply_sat,
  php.apply_sun,
  php.active,
  coalesce(php.metadata, '{}'::jsonb) || jsonb_build_object(
    'source', 'pricing-option-type-policy-split',
    'clonedFromPeriodId', php.id
  )
from _period_clone_map pcm
join public.pricing_hub_periods php on php.id = pcm.old_period_id;

insert into public.pricing_hub_rates (
  pricing_hub_period_id,
  rate_scope,
  fee_6h,
  fee_12h,
  fee_24h,
  fee_1h,
  discount_percent,
  discount_amount,
  week_1_price,
  week_2_price,
  month_1_price,
  long_24h_price,
  long_1h_price,
  weekend_days,
  metadata
)
select
  pcm.new_period_id,
  phr.rate_scope,
  phr.fee_6h,
  phr.fee_12h,
  phr.fee_24h,
  phr.fee_1h,
  phr.discount_percent,
  phr.discount_amount,
  phr.week_1_price,
  phr.week_2_price,
  phr.month_1_price,
  phr.long_24h_price,
  phr.long_1h_price,
  phr.weekend_days,
  coalesce(phr.metadata, '{}'::jsonb) || jsonb_build_object(
    'source', 'pricing-option-type-policy-split',
    'clonedFromRateId', phr.id
  )
from public.pricing_hub_rates phr
join _period_clone_map pcm on pcm.old_period_id = phr.pricing_hub_period_id;

update public.price_policy_groups ppg
set price_policy_id = pcm.new_price_policy_id
from _policy_clone_map pcm
where ppg.price_policy_id = pcm.old_price_policy_id
  and ppg.pricing_option_type = pcm.pricing_option_type;

update public.pricing_hub_rates phr
set month_1_price = floor((coalesce(phr.fee_24h, 0) * case pp.pricing_option_type
  when 'basic' then 9.00
  when 'premium' then 14.00
  else 11.00
end)::numeric / 10000) * 10000
from public.pricing_hub_periods php
join public.price_policies pp on pp.id = php.price_policy_id
where phr.pricing_hub_period_id = php.id
  and phr.fee_24h is not null
  and phr.month_1_price is not null;

create or replace view public.v_pricing_hub_policy_editor as
select
  cg.id as car_group_id,
  cg.ims_group_id,
  cg.group_name,
  pp.id as price_policy_id,
  pp.policy_name,
  ppg.id as price_policy_group_id,
  pp.pricing_option_type,
  ppg.pricing_option_type as legacy_group_pricing_option_type,
  pp.base_daily_price,
  pp.weekday_1_2d_price,
  pp.weekday_3_4d_price,
  pp.weekday_5_6d_price,
  pp.weekday_7d_plus_price,
  pp.weekend_1_2d_price,
  pp.weekend_3_4d_price,
  pp.weekend_5_6d_price,
  pp.weekend_7d_plus_price,
  pp.hour_1_price,
  pp.hour_6_price,
  pp.hour_12_price,
  pp.effective_from,
  pp.effective_to,
  pp.active as policy_active
from public.price_policy_groups ppg
join public.car_groups cg on cg.id = ppg.car_group_id
join public.price_policies pp on pp.id = ppg.price_policy_id;

create or replace view public.v_search_pricing_hub_policies as
with ranked_periods as (
  select
    php.*,
    row_number() over (
      partition by php.price_policy_id
      order by
        case
          when (php.start_at is null or php.start_at <= now())
           and (php.end_at is null or php.end_at >= now())
          then 0 else 1
        end,
        php.created_at desc
    ) as rn
  from public.pricing_hub_periods php
  where php.active = true
),
active_periods as (
  select *
  from ranked_periods
  where rn = 1
),
common_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'common'
),
weekday_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'weekday'
),
weekend_rates as (
  select * from public.pricing_hub_rates where rate_scope = 'weekend'
)
select
  cg.ims_group_id,
  pp.id as price_policy_id,
  pp.policy_name,
  ceil((coalesce(cr.fee_24h, pp.base_daily_price))::numeric / 1000) * 1000 as base24h,
  ceil((coalesce(
    cr.fee_1h,
    case pp.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 0.12
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 0.14
      else coalesce(cr.fee_24h, pp.base_daily_price) * 0.12
    end
  ))::numeric / 1000) * 1000 as hour_1_price,
  ceil((coalesce(wdr.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)))::numeric / 1000) * 1000 as weekday_24h_price,
  ceil((coalesce(wer.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)))::numeric / 1000) * 1000 as weekend_24h_price,
  ceil((coalesce(
    cr.week_1_price,
    case pp.pricing_option_type
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 6.50
      else coalesce(cr.fee_24h, pp.base_daily_price) * 5.50
    end
  ))::numeric / 1000) * 1000 as week_1_price,
  ceil((coalesce(
    cr.week_2_price,
    case pp.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 7.50
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 9.00
      else coalesce(cr.fee_24h, pp.base_daily_price) * 8.00
    end
  ))::numeric / 1000) * 1000 as week_2_price,
  ceil((coalesce(
    cr.month_1_price,
    case pp.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 9.00
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 14.00
      else coalesce(cr.fee_24h, pp.base_daily_price) * 11.00
    end
  ))::numeric / 1000) * 1000 as month_1_price
from public.price_policy_groups ppg
join public.car_groups cg on cg.id = ppg.car_group_id
join public.price_policies pp on pp.id = ppg.price_policy_id
left join active_periods ap on ap.price_policy_id = pp.id
left join common_rates cr on cr.pricing_hub_period_id = ap.id
left join weekday_rates wdr on wdr.pricing_hub_period_id = ap.id
left join weekend_rates wer on wer.pricing_hub_period_id = ap.id
where pp.active = true
  and ppg.active = true
  and cg.active = true;
