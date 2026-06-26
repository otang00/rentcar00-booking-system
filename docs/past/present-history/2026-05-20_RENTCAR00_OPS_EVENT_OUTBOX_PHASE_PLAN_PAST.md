# 2026-05-20 RENTCAR00 OPS Event Outbox Locked Plan

## 결론
홈페이지 API를 추가하지 않는다.
`reservation_ai_parser`의 기존 Cloudflare Tunnel 도메인과 기존 수신 endpoint를 사용한다.

최종 송신 목적지:
```text
https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
```

최종 실행 구조:
```text
홈페이지 결제 승인
→ booking_orders 예약 생성
→ 고객명/전화번호 전체/생년월일 전체 포함 event payload 생성
→ ops_app_reservation_event_outbox pending 저장
→ 고객 예약완료 응답
→ Mac mini launchd worker가 outbox 조회
→ parser.00rentcar.com 기존 endpoint로 POST
→ OPS parser가 rc00_ops_reservation_events inbox에 저장
```

예약 event data payload 기준:
```text
customerName: 고객명
customerPhone: 전화번호 전체
customerBirth: 생년월일 전체
customerPhoneLast4: 전화번호 끝 4자리
```

주의:
- OPS 업무 처리용 data payload에는 전체 정보를 포함한다.
- 잠금화면/푸시 미리보기는 개인정보 노출을 최소화하는 별도 설계를 권장한다.

## 확인 완료

### 홈페이지 API 개수
현재 `api/` serverless 파일 수: 9개.
API 최대 12개 제한을 고려해 새 API는 추가하지 않는다.

### OPS parser 서비스
서비스:
```text
ai.otang.reservation-ai-parser
```

로컬 바인딩:
```text
127.0.0.1:43110
```

외부 도메인 health check:
```text
GET https://parser.00rentcar.com/health → 200 OK
```

기존 수신 endpoint:
```text
POST /api/integrations/rentcar00/reservation-events
```

### OPS parser 수신 코드
확인 파일:
```text
/Users/otang_server/.openclaw/workspace-rentcar00_ops_developer/projects/rentcar00_OPS/reservation_ai_parser/src/server.js
```

기능:
- `reservation.created` event type 검증
- `X-Rentcar00-Event-Id` 검증
- timestamp 허용 오차 검증
- HMAC-SHA256 signature 검증
- 중복 eventId idempotency 처리
- Supabase `rc00_ops_reservation_events` 저장

### OPS inbox migration
OPS 프로젝트에 local migration 존재:
```text
rentcar00_OPS/supabase/migrations/20260520015500_add_reservation_event_inbox.sql
```

생성 테이블:
```text
rc00_ops_reservation_events
```

주의:
- 현재 `supabase migration list` 기준 local에는 있으나 remote에는 아직 미적용 상태다.
- DB 반영은 OPS 쪽 별도 승인/실행 범위다.

### 현재 설정 상태
값은 확인하지 않고 존재 여부만 확인했다.

OPS parser 자체 `.env`:
```text
AI_PARSER_HOST=<set>
AI_PARSER_PORT=<set>
OPS_APP_RESERVATION_EVENT_SECRET=<missing>
SUPABASE_URL=<missing>
SUPABASE_SERVICE_ROLE_KEY=<missing>
```

launchd 실행 명령은 OPS parser `.env`와 홈페이지 `.env`를 함께 source한다.
홈페이지 `.env`에는 Supabase 관련 값이 존재한다.

실제 외부 수신 endpoint 테스트:
```text
POST https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
→ 503 receiver_not_configured
→ missing env: OPS_APP_RESERVATION_EVENT_SECRET
```

해석:
- parser 도메인과 endpoint는 살아 있다.
- 실행 중인 parser는 Supabase env는 확보한 상태로 보인다.
- 현재 blocker는 `OPS_APP_RESERVATION_EVENT_SECRET` 미설정이다.
- 다만 OPS 전용 Supabase 프로젝트/키를 써야 한다면 OPS parser `.env`에 별도로 설정해야 한다.

## Locked Phase

### Phase 0. 홈페이지 outbox 기반 저장부
상태: 완료

완료 기준:
- 결제 승인/예약 생성 후 outbox pending 저장
- 고객 응답에서 OPS HTTP 송신 대기 제거
- 홈페이지 outbox migration 적용
- 단위 테스트 통과

관련 파일:
```text
api/payments/[action].js
server/notifications/opsAppReservationEventOutbox.js
server/notifications/sendOpsAppReservationEvent.js
supabase/migrations/20260520093000_create_ops_app_reservation_event_outbox.sql
```

### Phase 1. OPS parser 수신부 기준 잠금
상태: 확인 완료 / 설정 미완

완료 기준:
- 수신 URL 고정
- HMAC 계약 고정
- inbox table migration 확인
- 설정 blocker 정리

수신 URL:
```text
https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
```

현재 blocker:
- `OPS_APP_RESERVATION_EVENT_SECRET` 미설정
- OPS inbox migration remote 미적용
- OPS 전용 Supabase env를 쓸지, 홈페이지 Supabase env를 임시로 쓸지 기준 확인 필요

### Phase 2. Mac mini launchd outbox worker 설계
상태: 준비 단계

목적:
홈페이지 API를 추가하지 않고 Mac mini에서 outbox를 주기적으로 처리한다.

구조:
```text
launchd job
→ rentcar00-booking-system/scripts/process-ops-app-reservation-event-outbox.js
→ OPS_APP_RESERVATION_EVENT_URL=https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
→ HMAC 서명 POST
```

완료 기준:
- launchd plist 설계
- 실행 주기 고정
- 중복 실행 방지 기준 고정
- 로그 경로 고정
- 실패 재시도 기준 확인

주의:
- launchd/plist/env/secret은 protected target이다.
- 실제 생성/수정은 별도 승인 후 진행한다.

### Phase 3. OPS 설정 반영
상태: 대기

필요 작업:
- OPS parser에 `OPS_APP_RESERVATION_EVENT_SECRET` 설정
- 필요 시 OPS 전용 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정
- OPS inbox migration remote 적용
- parser 재시작

완료 기준:
- `node src/server.js --check` 또는 runtime endpoint에서 receiver configured 상태 확인
- unsigned request가 `receiver_not_configured`가 아니라 signature 검증 오류로 바뀌는지 확인

### Phase 4. 통합 검증
상태: 대기

검증 절차:
1. 테스트 예약/결제 1건 생성
2. 홈페이지 `ops_app_reservation_event_outbox` pending row 확인
3. launchd worker 또는 수동 processor 1회 실행
4. outbox status `sent` 전환 확인
5. OPS `rc00_ops_reservation_events` row 생성 확인
6. 동일 event 재전송 시 deduped 확인

### Phase 5. 운영 전환 / 문서 완료 / commit
상태: 대기

완료 기준:
- worker 자동 실행 확인
- 실패/재시도 로그 확인
- 배포/env/launchd 변경사항 문서화
- 관련 문서 completed 정리
- commit 승인 후 commit

## 사장님 입력 필요 항목 최소화

필수 입력/승인은 아래 3개만 남긴다.

1. `OPS_APP_RESERVATION_EVENT_SECRET` 생성/설정 승인
2. OPS inbox migration remote 적용 승인
3. launchd worker 생성/등록 승인

그 외 세부값은 기본값으로 고정한다.

기본값:
```text
OPS_APP_RESERVATION_EVENT_URL=https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events
worker interval=60초
batch limit=10
timeout=5초
```

## 현재 결론
현재 설계는 API 추가 없이 실제 운영 가능하다.
다만 아직 실제 자동 송신 완성 상태는 아니다.
남은 핵심은 OPS secret 설정, OPS inbox migration 반영, Mac mini launchd worker 등록이다.

---

## 2026-05-20 최종 구현 결과

### 반영 완료
- 홈페이지 `.env`에 OPS 송신 URL/secret/timeout 설정 완료. 값은 문서에 남기지 않는다.
- OPS parser `.env`에 OPS 수신 secret과 OPS Supabase service 설정 완료. 값은 문서에 남기지 않는다.
- OPS remote migration `20260520015500_add_reservation_event_inbox.sql` 적용 완료.
- parser launchd `ai.otang.reservation-ai-parser`는 parser 전용 `.env`만 source하도록 정리 완료.
- outbox worker launchd `ai.otang.rentcar00-ops-event-outbox-worker` 등록 완료.
- worker 실행 주기: 60초.
- worker 로그:
  - `rentcar00-booking-system/logs/ops-event-outbox-worker.stdout.log`
  - `rentcar00-booking-system/logs/ops-event-outbox-worker.stderr.log`

### 검증 완료
- `https://parser.00rentcar.com/health` 200 OK.
- parser runtime 설정 확인:
  - `hasOpsReservationEventSecret: true`
  - `hasSupabaseUrl: true`
  - `hasSupabaseServiceRoleKey: true`
- signed integration POST 성공:
  - `POST https://parser.00rentcar.com/api/integrations/rentcar00/reservation-events`
  - 응답: `{ "ok": true, "deduped": false }`
  - 테스트 event는 검증 후 삭제.
- outbox worker 수동 실행 성공:
  - pending 없음 기준 `picked: 0, sent: 0, failed: 0`.
- 홈페이지 코드 검증:
  - `node --check` 통과
  - notification/outbox/booking service 테스트 19개 통과

### 현재 운영 흐름
```text
결제 승인
→ booking_orders 생성
→ 홈페이지 outbox pending 저장
→ 고객 예약완료 응답
→ launchd worker가 60초마다 outbox 처리
→ parser.00rentcar.com 수신 endpoint로 signed POST
→ OPS rc00_ops_reservation_events inbox 저장
```

### 남은 확인
- 실제 결제/예약 1건에서 outbox row가 생성되고 worker가 `sent`로 전환하는 운영 통합 확인.
- OPS 앱 화면에서 `rc00_ops_reservation_events`를 어떻게 표시/처리할지 후속 phase 필요.
