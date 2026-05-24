# 2026-05-20 INSTANT — 홈페이지 예약을 OPS 앱으로 알리는 작업 정리

## 목적
홈페이지에서 카드결제 후 예약이 확정되면 OPS 앱 쪽에서 해당 예약을 확인할 수 있도록 이벤트를 전달한다.

최종 목표:
```text
홈페이지 결제 완료
→ 예약 생성
→ 홈페이지 outbox 저장
→ Mac mini worker가 OPS parser로 송신
→ OPS Supabase inbox 저장
→ OPS 앱에서 수신 예약 확인/알림 구현
```

---

## 현재 완료된 범위

### 1. 홈페이지 송신 준비 완료
결제 승인 후 바로 OPS로 HTTP 송신하지 않고, 먼저 홈페이지 DB outbox에 저장하도록 구현했다.

이유:
- OPS 서버 지연/장애가 고객 결제완료 화면을 막지 않게 하기 위함.
- 실패 시 재시도 가능하게 하기 위함.

관련 흐름:
```text
KCP 결제 승인
→ 결제 금액 검증
→ booking_orders 예약 생성
→ 고객명/전화번호 전체/생년월일 전체 포함 event payload 생성
→ ops_app_reservation_event_outbox pending 저장
→ 고객 예약완료 응답
```

관련 파일:
```text
api/payments/[action].js
server/notifications/opsAppReservationEventOutbox.js
server/notifications/sendOpsAppReservationEvent.js
scripts/process-ops-app-reservation-event-outbox.js
supabase/migrations/20260520093000_create_ops_app_reservation_event_outbox.sql
```

DB 적용:
```text
홈페이지 Supabase remote migration 20260520093000 적용 완료
```

---

### 2. OPS parser 수신부 연결 완료
OPS 쪽 기존 parser 도메인을 사용한다.

수신 URL:
```text
https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
```

확인 결과:
```text
GET https://parser.00rentcar.com/health → 200 OK
```

parser 서비스:
```text
ai.otang.reservation-ai-parser
```

로컬 바인딩:
```text
127.0.0.1:43110
```

수신부 기능:
- `reservation.created` event type 검증
- eventId 검증
- timestamp 허용 오차 검증
- HMAC-SHA256 signature 검증
- 중복 eventId idempotency 처리
- OPS Supabase `rc00_ops_reservation_events`에 저장

관련 OPS 파일:
```text
reservation_ai_parser/src/server.js
reservation_ai_parser/src/parser-core.js
rentcar00_OPS/supabase/migrations/20260520015500_add_reservation_event_inbox.sql
```

DB 적용:
```text
OPS Supabase remote migration 20260520015500 적용 완료
```

---

### 3. 환경값/secret 설정 완료
값 자체는 문서에 남기지 않는다.

홈페이지 쪽 설정 완료:
```text
OPS_APP_RESERVATION_EVENT_URL=<set>
OPS_APP_RESERVATION_EVENT_SECRET=<set>
OPS_APP_RESERVATION_EVENT_TIMEOUT_MS=<set>
```

OPS parser 쪽 설정 완료:
```text
OPS_APP_RESERVATION_EVENT_SECRET=<set>
SUPABASE_URL=<set>
SUPABASE_SERVICE_ROLE_KEY=<set>
OPS_APP_RESERVATION_EVENT_TIMESTAMP_TOLERANCE_MS=<set>
```

---

### 4. Mac mini launchd worker 등록 완료
홈페이지 API를 추가하지 않기 위해 Vercel Cron/API 방식은 쓰지 않는다.

worker:
```text
ai.otang.rentcar00-ops-event-outbox-worker
```

실행 주기:
```text
60초마다 실행
```

역할:
```text
홈페이지 outbox pending 조회
→ parser.00rentcar.com으로 signed POST
→ 성공 시 sent
→ 실패 시 failed 후 재시도 대상 유지
```

로그:
```text
rentcar00-booking-system/logs/ops-event-outbox-worker.stdout.log
rentcar00-booking-system/logs/ops-event-outbox-worker.stderr.log
```

parser restart:
```text
ai.otang.reservation-ai-parser 재시작 완료
```

---

## 검증 완료

### 코드 검증
```text
node --check 통과
notification/outbox/booking service 테스트 19개 통과
```

### parser 설정 검증
```text
hasOpsReservationEventSecret: true
hasSupabaseUrl: true
hasSupabaseServiceRoleKey: true
```

### signed POST 통합 테스트
```text
POST https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
→ 200
→ { "ok": true, "deduped": false }
```

테스트 event는 검증 후 삭제했다.

### worker 실행 검증
pending 이벤트가 없는 상태에서 수동 실행 성공:
```json
{
  "picked": 0,
  "sent": 0,
  "failed": 0,
  "skipped": 0,
  "results": []
}
```

---

## 현재 실제 동작 범위
현재 완성된 것은 아래까지다.

```text
홈페이지 예약 이벤트
→ 고객명/전화번호 전체/생년월일 전체 포함 payload 생성
→ 홈페이지 outbox 저장
→ worker 송신
→ OPS parser 수신
→ OPS Supabase inbox 저장
```

payload 개인정보 기준:
```text
customerName: 고객명
customerPhone: 전화번호 전체
customerBirth: 생년월일 전체
customerPhoneLast4: 전화번호 끝 4자리
```

주의:
- OPS 업무 처리용 data payload에는 전체 정보를 포함한다.
- 잠금화면/푸시 미리보기 문구에는 개인정보 노출을 최소화하는 별도 설계를 권장한다.

즉, OPS 앱으로 직접 푸시 알림이 울리는 단계는 아직 아니다.

---

## 아직 앱에서 필요한 구현

### 1단계. OPS 앱 수신함 표시
가장 먼저 해야 할 단계.

구현 내용:
```text
rc00_ops_reservation_events 조회
→ 새 홈페이지 예약 목록 표시
→ 상세 payload 확인
→ 처리 완료/무시 상태 변경
```

앱 화면 후보:
```text
관리자/운영 메뉴 안에 “홈페이지 예약 수신함” 추가
```

필요 기능:
- 미처리 건 목록
- 예약번호/차량/고객/대여시간/금액 표시
- 상세 payload 확인
- 처리 완료 버튼
- 무시/보류 버튼
- 미처리 건 배지

---

### 2단계. 앱 실행 중 알림/배지
앱이 켜져 있을 때 새 이벤트를 감지한다.

구현 후보:
```text
Supabase realtime
또는 30~60초 polling
```

표시 방식:
- 상단 배너
- 메뉴 배지
- 새로고침 표시

---

### 3단계. 진짜 모바일 푸시
앱이 꺼져 있어도 알림을 받으려면 별도 구현이 필요하다.

필요 요소:
- FCM/APNs 설정
- Flutter push package 추가
- 권한 요청 UI
- 직원 기기 토큰 저장 테이블
- push 발송 worker/server
- 실패/재시도 로그
- iOS/Android 배포 설정

권장 순서상 3단계는 뒤로 미룬다.

---

## 앞으로 진행 권장 Phase

### Phase A. 실제 예약 1건 통합 확인
목적:
실제 결제/예약 발생 시 end-to-end가 도는지 확인한다.

확인 순서:
```text
booking_orders 생성
ops_app_reservation_event_outbox pending 생성
worker 처리 후 sent 전환
OPS rc00_ops_reservation_events row 생성
```

완료 기준:
- 실제 예약 이벤트가 OPS inbox에 저장됨.

---

### Phase B. OPS 앱 수신함 구현
목적:
앱에서 홈페이지 예약 수신 건을 볼 수 있게 한다.

완료 기준:
- 앱에서 `rc00_ops_reservation_events` 목록 조회 가능
- 미처리 건 표시 가능
- 상세 확인 가능
- 처리 완료 상태 변경 가능

---

### Phase C. 앱 내 알림/배지
목적:
앱 사용 중 새 홈페이지 예약을 놓치지 않게 한다.

완료 기준:
- 새 이벤트 감지
- 배지/배너 표시
- 수신함으로 이동 가능

---

### Phase D. 모바일 푸시
목적:
앱이 꺼져 있어도 알림이 오게 한다.

완료 기준:
- 직원 기기 토큰 저장
- push 발송 성공
- 실패 로그/재시도 기준 마련

---

## 주의사항
- secret 값은 문서/채팅/로그에 남기지 않는다.
- `.env`, launchd plist, Supabase service key는 protected target이다.
- 현재 홈페이지 API 추가는 하지 않는다.
- 현재 구조는 API 12개 제한을 피한다.
- 실제 앱 푸시는 아직 구현 범위 밖이다.

---

## 현재 결론
홈페이지 → OPS 서버 수신 저장까지의 기반은 구축됐다.
다음 핵심은 OPS 앱에서 `rc00_ops_reservation_events`를 읽어 “홈페이지 예약 수신함”을 만드는 것이다.
