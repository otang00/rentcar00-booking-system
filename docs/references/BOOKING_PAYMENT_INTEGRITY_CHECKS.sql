-- RENTCAR00 booking/payment integrity read-only checks
-- 작성일: 2026-05-15
-- 목적: PR 1 범위의 예약/결제 무결성 이상 데이터 검사
-- 주의: 이 파일은 SELECT 전용이다. UPDATE/DELETE/ALTER/CREATE를 포함하지 않는다.

-- 1. 같은 차량/겹치는 기간 중복 예약
-- 기준: [pickup_at, return_at), 즉 a.pickup_at < b.return_at AND a.return_at > b.pickup_at
select
  a.id as booking_a_id,
  b.id as booking_b_id,
  a.public_reservation_code as booking_a_code,
  b.public_reservation_code as booking_b_code,
  a.car_id,
  a.pickup_at as a_pickup_at,
  a.return_at as a_return_at,
  b.pickup_at as b_pickup_at,
  b.return_at as b_return_at,
  a.booking_status as a_booking_status,
  b.booking_status as b_booking_status
from public.booking_orders a
join public.booking_orders b
  on a.car_id = b.car_id
 and a.id < b.id
 and a.pickup_at < b.return_at
 and a.return_at > b.pickup_at
where a.booking_status = 'confirmed'
  and b.booking_status = 'confirmed'
order by a.pickup_at, a.car_id;

-- 2. payment_provider + payment_reference_id 중복
select
  payment_provider,
  payment_reference_id,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as booking_order_ids,
  array_agg(public_reservation_code order by created_at) as public_reservation_codes,
  min(created_at) as first_created_at,
  max(created_at) as last_created_at
from public.booking_orders
group by payment_provider, payment_reference_id
having count(*) > 1
order by duplicate_count desc, last_created_at desc;

-- 3. lookup key 누락 예약
-- 현재 예약 생성 완료 기준상 customer_phone, customer_birth lookup key 2개가 있어야 한다.
select
  bo.id,
  bo.public_reservation_code,
  bo.created_at,
  bo.booking_status,
  count(blk.id) as lookup_key_count,
  array_agg(blk.lookup_type order by blk.lookup_type) filter (where blk.id is not null) as lookup_types
from public.booking_orders bo
left join public.booking_lookup_keys blk
  on blk.booking_order_id = bo.id
group by bo.id, bo.public_reservation_code, bo.created_at, bo.booking_status
having count(blk.id) < 2
order by bo.created_at desc;

-- 4. booking_created 이벤트 누락 예약
select
  bo.id,
  bo.public_reservation_code,
  bo.created_at,
  bo.booking_status,
  bo.payment_status
from public.booking_orders bo
left join public.reservation_status_events e
  on e.booking_order_id = bo.id
 and e.event_type = 'booking_created'
where e.id is null
order by bo.created_at desc;

-- 5. confirmed인데 payment_status가 paid가 아닌 예약
select
  id,
  public_reservation_code,
  booking_status,
  payment_status,
  payment_provider,
  payment_reference_id,
  pickup_at,
  return_at,
  created_at
from public.booking_orders
where booking_status = 'confirmed'
  and payment_status <> 'paid'
order by created_at desc;

-- 6. cancelled인데 payment_status가 paid인 예약
select
  id,
  public_reservation_code,
  booking_status,
  payment_status,
  payment_provider,
  payment_reference_id,
  cancelled_at,
  created_at
from public.booking_orders
where booking_status = 'cancelled'
  and payment_status = 'paid'
order by cancelled_at desc nulls last, created_at desc;

-- 7. 비활성/대여불가 차량에 붙은 confirmed 예약
select
  bo.id,
  bo.public_reservation_code,
  bo.car_id,
  c.source_car_id,
  c.car_number,
  c.active,
  c.ims_can_general_rental,
  bo.pickup_at,
  bo.return_at,
  bo.created_at
from public.booking_orders bo
join public.cars c
  on c.id = bo.car_id
where bo.booking_status = 'confirmed'
  and (
    c.active is not true
    or c.ims_can_general_rental is not true
  )
order by bo.pickup_at, bo.created_at desc;

-- 8. IMS 예약과 홈페이지 예약 겹침
-- 현재 예약 생성 경로의 IMS availability 검사는 status 필터가 없다.
-- 이 쿼리도 현재 구현과 동일하게 status 필터 없이 전체 겹침을 보여준다.
select
  bo.id as booking_order_id,
  bo.public_reservation_code,
  bo.car_id as booking_car_id,
  c.source_car_id,
  c.car_number,
  ir.id as ims_sync_reservation_row_id,
  ir.ims_reservation_id,
  ir.status,
  ir.status_raw,
  bo.pickup_at,
  bo.return_at,
  ir.start_at as ims_start_at,
  ir.end_at as ims_end_at,
  ir.last_synced_at
from public.booking_orders bo
join public.cars c
  on c.id = bo.car_id
join public.ims_sync_reservations ir
  on ir.car_id = c.source_car_id::text
 and bo.pickup_at < ir.end_at
 and bo.return_at > ir.start_at
where bo.booking_status = 'confirmed'
order by bo.pickup_at, c.car_number, ir.start_at;

-- 9. 예약 시작일이 종료일보다 늦거나 같은 데이터
-- DB check constraint booking_orders_return_after_pickup이 있으면 정상적으로는 0건이어야 한다.
select
  id,
  public_reservation_code,
  car_id,
  pickup_at,
  return_at,
  booking_status,
  payment_status,
  created_at
from public.booking_orders
where pickup_at >= return_at
order by created_at desc;

-- 10. 고객명/연락처 빈 문자열 데이터
-- not null은 빈 문자열을 막지 못하므로 별도 점검한다.
select
  id,
  public_reservation_code,
  customer_name,
  customer_phone,
  customer_phone_last4,
  booking_status,
  payment_status,
  created_at
from public.booking_orders
where btrim(coalesce(customer_name, '')) = ''
   or btrim(coalesce(customer_phone, '')) = ''
   or btrim(coalesce(customer_phone_last4, '')) = ''
order by created_at desc;

-- 11. payment_provider 또는 payment_reference_id 빈 문자열 데이터
-- schema상 not null이지만 빈 문자열은 별도 점검한다.
select
  id,
  public_reservation_code,
  payment_provider,
  payment_reference_id,
  booking_status,
  payment_status,
  created_at
from public.booking_orders
where btrim(coalesce(payment_provider, '')) = ''
   or btrim(coalesce(payment_reference_id, '')) = ''
order by created_at desc;

-- 12. IMS status/status_raw 분포 확인
-- blocking status 확정 전 실제 운영 값 확인용이다.
select
  status,
  status_raw,
  count(*) as row_count,
  min(start_at) as min_start_at,
  max(end_at) as max_end_at,
  max(last_synced_at) as latest_synced_at
from public.ims_sync_reservations
group by status, status_raw
order by row_count desc, status, status_raw;
