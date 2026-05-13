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
  select *
  from public.pricing_hub_rates
  where rate_scope = 'common'
),
weekday_rates as (
  select *
  from public.pricing_hub_rates
  where rate_scope = 'weekday'
),
weekend_rates as (
  select *
  from public.pricing_hub_rates
  where rate_scope = 'weekend'
)
select
  cg.ims_group_id,
  cg.group_name,
  cg.id as car_group_id,
  pp.id as price_policy_id,
  pp.policy_name,
  pp.effective_from,
  pp.effective_to,
  pp.metadata as policy_metadata,
  cg.metadata as group_metadata,
  ppg.metadata as mapping_metadata,
  ap.id as active_period_id,
  ap.period_name as active_period_name,
  ap.start_at as active_period_start_at,
  ap.end_at as active_period_end_at,
  coalesce(cr.fee_24h, pp.base_daily_price) as base24h,
  coalesce(cr.fee_1h, pp.hour_1_price) as hour_1_price,
  coalesce(wdr.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)) as weekday_24h_price,
  coalesce(wer.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)) as weekend_24h_price,
  coalesce(cr.week_1_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 5.50)::numeric)::integer) as week_1_price,
  coalesce(cr.week_2_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 8.00)::numeric)::integer) as week_2_price,
  coalesce(cr.month_1_price, round((coalesce(cr.fee_24h, pp.base_daily_price) * 12.00)::numeric)::integer) as month_1_price,
  (cr.id is not null) as has_hub_common_rate,
  (wdr.id is not null) as has_hub_weekday_rate,
  (wer.id is not null) as has_hub_weekend_rate,
  (cr.week_1_price is null or cr.week_2_price is null or cr.month_1_price is null) as uses_anchor_fallback,
  pp.base_daily_price as legacy_base_daily_price,
  pp.hour_1_price as legacy_hour_1_price,
  pp.weekday_rate_percent as legacy_weekday_rate_percent,
  pp.weekend_rate_percent as legacy_weekend_rate_percent,
  pp.weekday_7d_plus_price as legacy_weekday_7d_plus_price,
  pp.weekend_7d_plus_price as legacy_weekend_7d_plus_price
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
