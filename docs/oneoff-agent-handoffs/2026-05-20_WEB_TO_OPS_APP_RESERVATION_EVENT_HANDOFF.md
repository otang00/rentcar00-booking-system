# 2026-05-20 WEB → OPS APP 예약발생 송수신 1회성 전달문서

## 문서 상태
- 상태: one-off agent handoff
- 목적: 홈페이지에서 예약이 확정됐을 때 운영 앱으로 예약 발생 이벤트를 보내는 송신부/수신부 개발 범위를 분리한다.
- 보관 위치: `docs/oneoff-agent-handoffs/`
- 주의: 이 문서는 active current/policy 문서가 아니다. 에이전트 간 1회성 구현 전달용이다.

## 담당 분리

### rentcar00_reservation_developer 담당
홈페이지 프로젝트 `rentcar00-booking-system` 안에서 **송신부**를 만든다.

범위:
1. 예약 확정 직후 운영 앱 수신 API로 이벤트 전송
2. 실패/성공/스킵 결과를 `reservation_status_events`에 기록
3. 송신 실패가 예약/결제 성공을 롤백하지 않도록 처리
4. 수신부 준비 전에는 env 미설정 시 skip 처리
5. 연결 검증 준비

### rentcar00_ops_developer 담당
운영 앱/운영 서버 쪽에서 **수신부**를 만든다.

범위:
1. 홈페이지가 호출할 예약 이벤트 수신 endpoint 제공
2. 서명 검증 또는 공유 secret 검증
3. 중복 이벤트 방지
4. 수신 이벤트 저장/표시/푸시 처리
5. 수신 성공 시 2xx 응답
6. 테스트용 endpoint URL과 secret 전달

---

## 현재 홈페이지 예약 확정 지점

예약 확정 후 알림이 이미 붙어 있는 지점이 있다.

관련 파일:
```text
api/payments/[action].js
api/guest-bookings/[action].js
server/notifications/sendAdminBookingAlert.js
server/notifications/sendCustomerBookingSms.js
server/booking-core/guestBookingService.js
```

현재 흐름:
```text
KCP 결제 승인 성공
→ createGuestBooking()
→ booking_orders 생성
→ reservation_status_events 기록
→ 이메일/SMS/관리자 알림 발송
```

운영 앱 송신부는 이 흐름의 알림 단계에 추가한다.

---

## 홈페이지 송신부 제안 설계

### 구현 파일
```text
server/notifications/sendOpsAppReservationEvent.js
server/notifications/opsAppReservationEventOutbox.js
scripts/process-ops-app-reservation-event-outbox.js
supabase/migrations/20260520093000_create_ops_app_reservation_event_outbox.sql
```

### 호출 위치
1순위:
```text
api/payments/[action].js
- dispatchBookingCreatedNotifications() 내부에서 직접 HTTP 송신하지 않고 outbox에 pending 이벤트 저장
```

추가 검토:
```text
api/guest-bookings/[action].js
- 결제 없는 예약 생성 경로가 운영 중이면 동일하게 호출
```

### env 후보
값 자체는 문서/채팅에 노출하지 않는다.

```text
OPS_APP_RESERVATION_EVENT_URL
OPS_APP_RESERVATION_EVENT_SECRET
OPS_APP_RESERVATION_EVENT_TIMEOUT_MS
```

동작 기준:
- 결제 승인/금액 검증/예약 DB 생성 후 outbox 저장
- 고객 예약완료 응답은 OPS HTTP 송신을 기다리지 않는다.
- URL 미설정/SECRET 미설정: outbox 처리 실패로 남기고 재시도 대상
- SECRET 미설정은 운영 반영 전 blocker. 개발/검증 중에는 receiver와 합의 필요
- timeout 기본값: 3~5초 권장
- fetch 실패/비2xx: outbox 실패 기록 후 재시도 대상

---

## 이벤트 계약 초안

### HTTP
```text
POST {OPS_APP_RESERVATION_EVENT_URL}
Content-Type: application/json
X-Rentcar00-Event-Type: reservation.created
X-Rentcar00-Event-Id: {eventId}
X-Rentcar00-Timestamp: {unixMs}
X-Rentcar00-Signature: sha256={hmacHex}
```

서명 문자열 제안:
```text
{timestamp}.{rawBody}
```

HMAC:
```text
HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
```

수신부는 timestamp 허용 오차를 둔다.
권장: 5분.

### JSON body
```json
{
  "eventId": "uuid-or-deterministic-id",
  "eventType": "reservation.created",
  "occurredAt": "2026-05-20T00:00:00.000Z",
  "source": "rentcar00-booking-system",
  "booking": {
    "bookingOrderId": "uuid",
    "reservationCode": "R-...",
    "bookingStatus": "confirmed",
    "paymentStatus": "paid",
    "paymentProvider": "nhn_kcp",
    "paymentReferenceId": "...",
    "customerName": "홍길동",
    "customerPhone": "01012345678",
    "customerBirth": "19841115",
    "customerPhoneLast4": "1234",
    "carId": "uuid-or-internal-id",
    "sourceCarId": "IMS/외부 차량 ID 가능 시",
    "carName": "차량명",
    "carNumber": "차량번호 가능 시",
    "pickupAt": "ISO datetime",
    "returnAt": "ISO datetime",
    "pickupMethod": "pickup|delivery",
    "deliveryAddressSummary": "민감정보 최소화 주소 요약",
    "quotedTotalAmount": 100000
  },
  "links": {
    "adminBookingUrl": "https://rentcar00.com/admin/bookings/..."
  }
}
```

개인정보 기준:
- OPS 앱 업무 처리에 필요한 고객명, 전화번호 전체, 생년월일 전체를 data payload에 포함한다.
- 잠금화면/푸시 미리보기 문구에는 개인정보 노출을 최소화하고, 상세/수신함 data에서 전체 정보를 확인하는 구조를 권장한다.
- secret, full signature, token, auth header는 payload에 저장하지 않는다.

---

## 수신부 요구사항: rentcar00_ops_developer

### endpoint
운영 앱 서버에 아래 같은 endpoint를 만든다.

```text
POST /api/integrations/rentcar00/reservation-events
```

정확한 경로는 ops 프로젝트 구조에 맞춰 정해도 된다.
단, 결정한 production/preview URL을 홈페이지 담당에게 전달한다.

### 필수 검증
1. `X-Rentcar00-Event-Type = reservation.created`
2. `X-Rentcar00-Event-Id` 존재
3. timestamp 허용 오차 검증
4. HMAC signature 검증
5. body schema 검증
6. 중복 eventId idempotency 처리

### 응답 기준
성공:
```json
{ "ok": true, "deduped": false }
```

중복:
```json
{ "ok": true, "deduped": true }
```

검증 실패:
```json
{ "ok": false, "error": "invalid_signature" }
```

홈페이지 송신부는 2xx만 성공으로 본다.

### 저장/표시 기준
수신부는 최소 아래를 저장한다.

```text
event_id
event_type
booking_order_id
reservation_code
payload json
received_at
processed_at
status
error_message
```

앱 알림/푸시는 수신 저장 후 별도 처리 가능하다.
수신 저장 실패 시 2xx를 반환하지 않는다.

---

## 홈페이지 event 기록 기준

`reservation_status_events`에 아래 event type 후보를 기록한다.

```text
ops_app_reservation_event_queued
ops_app_reservation_event_queue_failed
```

실제 송신 성공/실패는 `ops_app_reservation_event_outbox`의 `status`, `attempts`, `response_status`, `last_error`, `sent_at`으로 추적한다.

payload 후보:
```json
{
  "requestedBy": "guest_web|member_web",
  "eventId": "...",
  "outboxId": "...",
  "deduped": false,
  "message": "queue failure reason if any"
}
```

주의:
- secret, full signature, token, auth header는 event payload에 저장하지 않는다.
- 실패해도 예약/결제 성공은 유지한다.

---

## 연결 검증 시나리오

### 수신부 단독 검증
ops 쪽에서 임시 curl 또는 테스트로 signature 검증과 저장을 확인한다.

종료 조건:
```text
정상 signature → 2xx
중복 eventId → 2xx + deduped true
잘못된 signature → 401/403
스키마 누락 → 400
```

### 송신부 단독 검증
홈페이지 쪽에서 mock/local endpoint 또는 ops preview endpoint로 송신한다.

종료 조건:
```text
예약 확정 시 outbox pending event 저장
예약완료 응답은 OPS HTTP 송신을 기다리지 않음
URL/secret 설정 + outbox processor 실행 + 2xx 응답 시 outbox sent 기록
비2xx/timeout 시 outbox failed 기록 후 재시도 대상 유지
예약 성공은 유지
```

### 통합 검증
수신부 URL/secret 수령 후 테스트 예약 1건으로 확인한다.

종료 조건:
```text
booking_orders 생성
reservation_status_events에 ops_app_reservation_event_queued 기록
ops_app_reservation_event_outbox pending 생성
outbox processor 실행 후 sent 전환
ops 앱 수신 저장 1건 확인
동일 event 재전송 시 중복 처리 확인
앱 알림/표시 확인
```

---

## rentcar00_ops_developer에게 필요한 회신

수신부 구현 후 아래를 회신한다.

```text
1. 수신 endpoint URL
2. secret 전달 방식
3. preview/prod 구분 여부
4. 저장 테이블/컬렉션 이름
5. 중복 처리 기준
6. 테스트 가능한 eventId 또는 수신 로그 확인 방법
7. 앱 알림까지 연결됐는지, 저장까지만 됐는지
```

---

## 현재 주의사항
- 홈페이지 프로젝트에는 이미 미커밋 변경이 있다. 송신부 구현 전 변경 범위를 다시 확인한다.
- `.env`, Vercel env, secret, runtime config는 protected target이다. 값 추가/수정은 별도 승인 후 진행한다.
- 외부 호출 endpoint가 새 도메인이면 서버 outbound라 CSP 영향은 작지만, 런타임 env와 보안 로그 노출을 주의한다.
- 운영 알림 실패는 예약 성공을 되돌리지 않는다.

---

## 2026-05-20 홈페이지 송신부 구현 메모

홈페이지 쪽 송신부는 아래 파일로 구현한다.

```text
server/notifications/sendOpsAppReservationEvent.js
server/notifications/opsAppReservationEventOutbox.js
scripts/process-ops-app-reservation-event-outbox.js
api/payments/[action].js
server/notifications/__tests__/sendOpsAppReservationEvent.test.js
server/notifications/__tests__/opsAppReservationEventOutbox.test.js
```

예약 확정 후 알림 흐름에서 OPS 앱 이벤트를 즉시 HTTP 송신하지 않고 outbox에 저장한다. 큐 저장 결과는 `reservation_status_events`에 아래 event type으로 남긴다.

```text
ops_app_reservation_event_queued
ops_app_reservation_event_queue_failed
```

실제 송신 성공/실패는 `ops_app_reservation_event_outbox` 상태로 추적한다. OPS 수신부가 endpoint URL과 secret 전달 방식을 회신하면 `OPS_APP_RESERVATION_EVENT_URL`, `OPS_APP_RESERVATION_EVENT_SECRET`을 별도 승인 후 설정하고 통합 검증한다.
