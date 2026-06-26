drop view if exists public.v_search_pricing_hub_policies;

create view public.v_search_pricing_hub_policies as
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
  cg.group_name,
  cg.id as car_group_id,
  pp.id as price_policy_id,
  ppg.id as price_policy_group_id,
  pp.policy_name,
  ap.id as active_period_id,
  ap.period_name as active_period_name,
  ceil((coalesce(cr.fee_24h, pp.base_daily_price))::numeric / 1000) * 1000 as base24h,
  ceil((coalesce(
    cr.fee_1h,
    case ppg.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 0.12
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 0.14
      else coalesce(cr.fee_24h, pp.base_daily_price) * 0.12
    end
  ))::numeric / 1000) * 1000 as hour_1_price,
  ceil((coalesce(wdr.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)))::numeric / 1000) * 1000 as weekday_24h_price,
  ceil((coalesce(wer.fee_24h, coalesce(cr.fee_24h, pp.base_daily_price)))::numeric / 1000) * 1000 as weekend_24h_price,
  ceil((coalesce(
    cr.week_1_price,
    case ppg.pricing_option_type
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 6.50
      else coalesce(cr.fee_24h, pp.base_daily_price) * 5.50
    end
  ))::numeric / 1000) * 1000 as week_1_price,
  ceil((coalesce(
    cr.week_2_price,
    case ppg.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 7.50
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 9.00
      else coalesce(cr.fee_24h, pp.base_daily_price) * 8.00
    end
  ))::numeric / 1000) * 1000 as week_2_price,
  ceil((coalesce(
    cr.month_1_price,
    case ppg.pricing_option_type
      when 'basic' then coalesce(cr.fee_24h, pp.base_daily_price) * 10.50
      when 'premium' then coalesce(cr.fee_24h, pp.base_daily_price) * 14.00
      else coalesce(cr.fee_24h, pp.base_daily_price) * 12.00
    end
  ))::numeric / 1000) * 1000 as month_1_price,
  ppg.pricing_option_type,
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
