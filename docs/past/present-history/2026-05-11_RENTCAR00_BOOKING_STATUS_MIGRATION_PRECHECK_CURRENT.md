# RENTCAR00 BOOKING STATUS MIGRATION PRECHECK CURRENT

## 목적
- `20260511215500_simplify_booking_order_statuses.sql` 적용 전 실데이터 위험 상태를 확인한다.

## 1. booking_status 분포 확인
```sql
select booking_status, count(*) as cnt
from public.booking_orders
group by booking_status
order by booking_status;
```

## 2. payment_status 분포 확인
```sql
select payment_status, count(*) as cnt
from public.booking_orders
group by payment_status
order by payment_status;
```

## 3. migration blocker 확인
```sql
select id, public_reservation_code, booking_status, payment_status, pickup_at, return_at, created_at
from public.booking_orders
where payment_status in ('pending', 'cancelled')
order by created_at desc;
```

## 4. 구 booking_status 잔존 row 확인
```sql
select id, public_reservation_code, booking_status, payment_status, pickup_at, return_at, created_at
from public.booking_orders
where booking_status in (
  'confirmation_pending',
  'confirmed_pending_sync',
  'in_use',
  'completed',
  'manual_review_required'
)
order by created_at desc;
```

## 5. 위험 조합 확인
### 5-1. completed + paid
```sql
select id, public_reservation_code, booking_status, payment_status, pickup_at, return_at, created_at
from public.booking_orders
where booking_status = 'completed'
  and payment_status = 'paid'
order by created_at desc;
```

### 5-2. cancelled + paid
```sql
select id, public_reservation_code, booking_status, payment_status, pickup_at, return_at, created_at
from public.booking_orders
where booking_status = 'cancelled'
  and payment_status = 'paid'
order by created_at desc;
```

### 5-3. manual_review_required + any
```sql
select id, public_reservation_code, booking_status, payment_status, manual_review_required, pickup_at, return_at, created_at
from public.booking_orders
where booking_status = 'manual_review_required'
   or manual_review_required = true
order by created_at desc;
```

## 6. 현재 migration 적용 기준
- `payment_status='pending'` row 존재 시 적용 중단
- `payment_status='cancelled'` row 존재 시 적용 중단
- 아래 booking_status 는 자동으로 `confirmed` 로 흡수
  - `confirmation_pending`
  - `confirmed_pending_sync`
  - `in_use`
  - `completed`
  - `manual_review_required`

## 7. 적용 전 판단 규칙
- blocker row 0건이면 migration 그대로 진행 가능
- blocker row가 1건 이상이면 자동 적용 금지
- 특히 아래는 사장님 확인 후 매핑
  - `payment_status='pending'`
  - `payment_status='cancelled'`
  - `booking_status='completed'`
