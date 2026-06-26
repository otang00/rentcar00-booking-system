# 2026-05-16 RENTCAR00 KCP PAYMENT ATTEMPT COMPLETE

## 완료 범위
KCP 운영 결제 검증 과정에서 홈페이지 측 코드/DB 흐름과 KCP 상점 상태 blocker를 분리했다.

## 완료된 판단

```text
KCP 결제창까지 진입한다.
실패는 /api/payments/return 단계에서 KCP 실패 메시지로 복귀한다.
approve API 호출 전 실패다.
booking_orders 생성 전 실패다.
DB 오염은 없다.
```

## 확인된 오류

```text
상점 승인가능 상태값 확인후 결제 바랍니다.
KCP 전화 1544-8660
```

## 운영 로그 해석

```text
POST /api/payments/prepare → 호출됨
POST /api/payments/return → KCP 실패 복귀
approve API → 미도달
booking_orders 생성 → 없음
```

## DB 확인 결과
문제 발생 직후 23:20 이후 read-only 확인 결과:

```text
booking_orders: 0
booking_lookup_keys: 0
reservation_status_events: 0
phone_verifications consumed: 0
```

## 남은 blocker
KCP ALRFN 상점의 운영 카드 승인 가능 상태 확인이 필요하다.

## 다음 조치
KCP에 상점코드 ALRFN의 승인 가능 상태, 카드사 심사/오픈 상태, 운영 결제 가능 상태, res_cd 내부 원인을 문의한다.

## 주의
민감값은 이 문서에 남기지 않는다.
KCP env/인증서/상점키 재점검 또는 교체는 별도 승인 후 진행한다.
