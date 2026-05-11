begin;

-- 목적
-- - booking_orders 상태모델을 홈페이지 원장 기준으로 단순화한다.
-- - booking_status: confirmed | cancelled
-- - payment_status: paid | refund_pending | refunded
--
-- 주의
-- - payment_status='pending' 또는 'cancelled' 가 남아 있으면 자동 매핑하지 않고 중단한다.
-- - 이 두 값은 실제 운영 해석이 엇갈릴 수 있으므로 적용 전에 row 확인이 필요하다.

DO $$
DECLARE
  legacy_pending_payment_count integer;
  legacy_cancelled_payment_count integer;
BEGIN
  SELECT count(*)
    INTO legacy_pending_payment_count
  FROM public.booking_orders
  WHERE payment_status = 'pending';

  SELECT count(*)
    INTO legacy_cancelled_payment_count
  FROM public.booking_orders
  WHERE payment_status = 'cancelled';

  IF legacy_pending_payment_count > 0 THEN
    RAISE EXCEPTION 'migration_blocked: booking_orders.payment_status=''pending'' rows=%', legacy_pending_payment_count;
  END IF;

  IF legacy_cancelled_payment_count > 0 THEN
    RAISE EXCEPTION 'migration_blocked: booking_orders.payment_status=''cancelled'' rows=%', legacy_cancelled_payment_count;
  END IF;
END $$;

-- 구 booking status를 홈페이지 원장 기준으로 confirmed 로 흡수
-- completed 도 과거 예약 이력일 뿐 홈페이지 운영상태 분리 대상이 아니므로 confirmed 로 통일한다.
UPDATE public.booking_orders
SET booking_status = 'confirmed'
WHERE booking_status IN (
  'confirmation_pending',
  'confirmed_pending_sync',
  'in_use',
  'completed',
  'manual_review_required'
);

ALTER TABLE public.booking_orders
  DROP CONSTRAINT IF EXISTS booking_orders_booking_status_check;

ALTER TABLE public.booking_orders
  ADD CONSTRAINT booking_orders_booking_status_check CHECK (
    booking_status IN (
      'confirmed',
      'cancelled'
    )
  );

ALTER TABLE public.booking_orders
  DROP CONSTRAINT IF EXISTS booking_orders_payment_status_check;

ALTER TABLE public.booking_orders
  ADD CONSTRAINT booking_orders_payment_status_check CHECK (
    payment_status IN (
      'paid',
      'refund_pending',
      'refunded'
    )
  );

commit;
