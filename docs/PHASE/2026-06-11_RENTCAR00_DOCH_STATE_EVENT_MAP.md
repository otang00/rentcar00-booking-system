# 2026-06-11 RENTCAR00 DOCH State/Event Map

## 문서 상태
- 상태: active phase / doch baseline
- 목적: `rentcar00-booking-system`의 예약, 결제, 가격, 외부 플랫폼 동기화가 상태와 이벤트 기준으로 꼬이지 않도록 현재 구조를 잠근다.
- 범위: 상태 owner, event/decision/command, runtime loop, UI/API guardrail.
- 비범위: 코드 수정, DB 변경, env/launchd 변경, 외부 플랫폼 저장.

## 확인한 기준 파일
- `GOAL.md`
- `PROJECT_STATE.md`
- `docs/policies/RENTCAR00_POLICY.md`
- `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
- `docs/policies/RENTCAR00_PRICING_HUB.md`
- `api/payments/[action].js`
- `server/booking-core/guestBookingService.js`
- `api/admin/bookings.js`
- `api/admin/pricing-hub.js`
- `server/notifications/opsAppReservationEventOutbox.js`
- `docs/COMPLETED/2026-06-09_CARNIVAL_PRICE_AND_CARMORE_APPLY.md`
- `docs/PHASE/2026-05-30_CARMORE_SYNC_PHASE2_4.md`

---

# PM Harness Check

## 작업 요약
현재 시스템은 고객 예약/결제, 관리자 변경, 가격 허브, 외부 플랫폼 동기화가 한 프로젝트 안에 있다. 다음 구현 전에 상태 owner와 event 흐름을 먼저 고정해야 한다.

## 영향 범위
- 상태: `booking_orders`, `payment_status`, `phone_verifications`, `pricing_hub_rates`, `price_policies`, `carmore_sync_runs`, `ops_app_reservation_event_outbox`, `reservation_status_events`
- 이벤트 흐름: 검색/상세 토큰, 결제 승인, 예약 생성, 알림 enqueue, 관리자 예약 변경, 가격 저장, 외부 플랫폼 sync
- 런타임: KCP return API, outbox worker, 카모아/찜카 reconcile runner, launchd 운영 가능성
- UI/API 경계: 고객 UI는 command 요청만, 관리자 UI는 제한된 운영 command만, 실제 상태 변경은 서버/API/DB RPC가 owner
- live/replay/test 의미: 외부 플랫폼 save-run과 dry-run을 반드시 분리해야 함

## 핵심 질문
- 새 상태를 만드는가: 이번 문서화 자체는 만들지 않음. 향후 payment ledger, sync log 확장은 새 상태 가능.
- 기존 상태를 바꾸는가: 문서화만으로는 바꾸지 않음.
- 상태 owner: 아래 State Map 기준.
- 판단과 실행 혼재 여부: 가격 저장, 관리자 예약 변경, 외부 sync에서 혼재 위험 있음.
- event / decision / command: 아래 Event Flow Map 기준으로 분리.
- runtime loop 영향: outbox worker와 카모아/찜카 sync는 runtime loop 영향 있음.
- UI/API 직접 상태 변경 여부: UI는 직접 DB 변경 금지. API가 command를 받아 서버에서 검증 후 변경.
- live/replay/test 의미 변화: dry-run과 save-run 분리 필요.

## 결론
- **보완 후 진행**
- 다음 구현 전에 이 문서의 guardrail을 기준으로 phase를 좁혀야 한다.

## 보완 필요 사항
- KCP 운영 결제 blocker는 코드보다 상점 승인 가능 상태 확인이 먼저다.
- 외부 플랫폼 가격/휴무 반영은 preview/result/rollback 근거를 함께 기록해야 한다.
- 문서 구조는 신규 문서부터 `GOAL / PHASE / COMPLETED / ARCHIVE` 기준으로 유지한다.

---

# Current State Map

## 상태: `booking_orders`
- 의미: 홈페이지 예약/결제/취소/환불 관리용 로컬 원장.
- 저장 위치: Supabase `booking_orders`.
- owner: 예약 생성 RPC `create_booking_order_after_payment_v1`, 결제 승인 흐름, 관리자 예약 변경 API.
- reader: 고객 예약조회, 회원 예약조회, 관리자 예약관리, 검색 availability.
- writer: `server/booking-core/guestBookingService.js::createGuestBooking()`, `api/admin/bookings.js::handleChange()`, 취소/환불 함수.
- 생성 조건: KCP 승인 성공 후 금액 검증 통과 및 예약 생성 RPC 성공.
- 변경 조건: 관리자 예약 변경, 취소/환불 처리.
- 종료 조건: `booking_status=cancelled` 또는 환불 완료 상태.
- 관련 이벤트: `kcp_payment_approved`, `booking_created`, `admin_booking_changed`.
- 혼재 지점: 예약 상태와 결제 상태가 한 row에 함께 있으므로 booking/payment owner를 섞지 않아야 함.

## 상태: `booking_status`
- 의미: 홈페이지 예약 차단 여부의 핵심 상태.
- 저장 위치: `booking_orders.booking_status`.
- owner: 예약 생성/취소/관리자 변경 API.
- reader: 검색 availability, 관리자 목록, 예약조회.
- writer: 예약 생성 RPC, 취소 처리.
- 생성 조건: 결제 성공 예약 생성 시 `confirmed`.
- 변경 조건: 취소 시 `cancelled`.
- 종료 조건: `cancelled`.
- 관련 이벤트: booking created/cancelled/admin changed.
- 혼재 지점: IMS 운영상태와 다르다. 홈페이지 blocking status는 `confirmed`만 기준.

## 상태: `payment_status` / KCP payment reference
- 의미: 홈페이지 결제 완료/환불 진행/환불 완료 및 PG 거래 멱등성 기준.
- 저장 위치: `booking_orders.payment_status`, `payment_provider`, `payment_reference_id`.
- owner: `api/payments/[action].js::handlePaymentApproval()`, 예약 생성 RPC.
- reader: 예약조회, 관리자, 결제 중복 처리.
- writer: 결제 승인 흐름, 환불 완료 처리.
- 생성 조건: KCP approve 성공 후 `payment_status=paid`.
- 변경 조건: 취소/환불 처리.
- 종료 조건: `refunded`.
- 관련 이벤트: `kcp_payment_approved`.
- 혼재 지점: 현재 payment ledger가 별도 없으므로 “승인 성공 후 예약 생성 실패”는 별도 guardrail 필요.

## 상태: `phone_verifications`
- 의미: 예약/회원가입 연락처 검증 상태.
- 저장 위치: Supabase `phone_verifications`.
- owner: OTP API/서버 인증 로직.
- reader: 결제 prepare, 회원가입, 예약 검증.
- writer: OTP 발송/검증/consume 흐름.
- 생성 조건: OTP 발송.
- 변경 조건: OTP verify, 결제 승인 후 consume.
- 종료 조건: consumed 또는 만료.
- 관련 이벤트: reservation phone verification.
- 혼재 지점: 회원 프로필 잠금 제출은 OTP 없이 진행될 수 있으므로 auth profile 기준과 guest OTP 기준을 섞지 않는다.

## 상태: `detailToken`
- 의미: 검색 결과에서 발급된 상세 진입 권한.
- 저장 위치: DB 저장 없음. 서버 서명 토큰.
- owner: `api/search-cars.js`, `server/security/detailToken.js`.
- reader: `api/car-detail.js`, 결제 prepare.
- writer: 검색 API 응답 생성.
- 생성 조건: 유효한 검색 결과 반환.
- 변경 조건: 없음. 만료/검증 실패로 무효 처리.
- 종료 조건: 토큰 만료 또는 검색 조건 불일치.
- 관련 이벤트: search result issued, detail opened.
- 혼재 지점: 차량 ID만으로 상세/예약을 열면 guardrail 위반.

## 상태: `price_policies`
- 의미: 가격 정책과 등급 truth.
- 저장 위치: Supabase `price_policies`.
- owner: 관리자 가격 허브 정책 저장 API.
- reader: 검색 가격 view, 관리자 가격 허브.
- writer: `api/admin/pricing-hub.js::handleSaveEditor()`.
- 생성 조건: 가격 정책 구성/마이그레이션.
- 변경 조건: 관리자 정책 수정.
- 종료 조건: 비활성/대체 정책으로 전환.
- 관련 이벤트: pricing policy edited.
- 혼재 지점: 차량그룹이 아니라 정책이 `pricing_option_type` truth를 가져야 한다.

## 상태: `pricing_hub_rates`
- 의미: 정책별 1h/6h/12h/24h/7일/14일/30일 저장값.
- 저장 위치: Supabase `pricing_hub_rates`.
- owner: 관리자 가격 허브 editor.
- reader: 검색 가격 계산, 관리자 preview.
- writer: `api/admin/pricing-hub.js::handleSaveEditor()`, `handleSaveRate()`.
- 생성 조건: active period 생성 및 rate upsert.
- 변경 조건: 관리자 가격 저장.
- 종료 조건: period 비활성화 또는 새 period 전환.
- 관련 이벤트: price rate saved.
- 혼재 지점: 홈페이지 DB 가격과 카모아/찜카 반영값은 별도 채널 상태다.

## 상태: `price_policy_groups`
- 의미: 차량그룹 ↔ 가격정책 연결.
- 저장 위치: Supabase `price_policy_groups`.
- owner: 관리자 가격 허브 group setting.
- reader: 검색 가격 view, 관리자 가격 허브.
- writer: `api/admin/pricing-hub.js::handleSaveGroupSetting()`.
- 생성 조건: 그룹에 정책 연결.
- 변경 조건: active policy 교체.
- 종료 조건: active=false.
- 관련 이벤트: group policy mapping changed.
- 혼재 지점: 등급 truth 저장 위치가 아니며 연결 상태만 담당해야 한다.

## 상태: `reservation_status_events`
- 의미: 예약 관련 감사/이력 이벤트.
- 저장 위치: Supabase `reservation_status_events`.
- owner: 예약 생성/결제/관리자 변경/알림 처리 API.
- reader: 관리자/운영 감사.
- writer: `recordReservationStatusEvent()`, 관리자 변경 API.
- 생성 조건: 예약 생성, 결제 승인, 변경, 알림 queue 등.
- 변경 조건: 원칙적으로 append-only.
- 종료 조건: 없음.
- 관련 이벤트: 모든 예약 관련 이벤트.
- 혼재 지점: 상태 자체를 대체하는 source of truth로 쓰면 안 된다. 감사 로그다.

## 상태: `ops_app_reservation_event_outbox`
- 의미: 홈페이지 예약 확정 후 OPS 앱으로 보낼 이벤트 outbox.
- 저장 위치: Supabase `ops_app_reservation_event_outbox`.
- owner: `server/notifications/opsAppReservationEventOutbox.js`.
- reader: outbox worker.
- writer: 예약 생성 후 enqueue, worker status update.
- 생성 조건: 예약 확정 후 `reservation.created:{bookingOrderId}` event enqueue.
- 변경 조건: pending → processing → sent/failed.
- 종료 조건: sent 또는 운영상 포기 처리.
- 관련 이벤트: `reservation.created`.
- 혼재 지점: outbox 실패는 예약/결제 성공 rollback 조건이 아니다.

## 상태: `carmore_sync_runs` / `carmore_holiday_sync_mappings`
- 의미: IMS 예약을 카모아 휴무일로 반영한 실행 이력과 매핑.
- 저장 위치: Supabase sync tables.
- owner: `scripts/carmore-sync/run-carmore-reconcile-sync.js` 계열 runner.
- reader: 관리자 동기화 상태창, 운영 검토.
- writer: 카모아 reconcile runner.
- 생성 조건: dry-run 또는 save-run 실행.
- 변경 조건: 휴무 추가/삭제/변경/unchanged 기록.
- 종료 조건: run finished, mapping active/deleted/error.
- 관련 이벤트: carmore reconcile run.
- 혼재 지점: dry-run과 save-run을 같은 의미로 보면 안 됨. 외부 플랫폼 실제 저장 여부가 다르다.

## 상태: `zzimcar_sync_runs` / 관련 mapping
- 의미: IMS 예약을 찜카 차단/휴무 상태로 반영한 실행 이력과 매핑.
- 저장 위치: Supabase sync tables.
- owner: `scripts/zzimcar-sync/*` runner.
- reader: 관리자 동기화 상태창, 운영 검토.
- writer: 찜카 reconcile runner.
- 생성 조건: dry-run 또는 save-run 실행.
- 변경 조건: 차단 추가/삭제/변경/unchanged 기록.
- 종료 조건: run finished, mapping active/deleted/error.
- 관련 이벤트: zzimcar reconcile run.
- 혼재 지점: 카모아와 같은 프로세스로 묶지 않는 원칙 유지.

---

# Current Event Flow Map

## Event/Decision/Command: 검색 요청
- 유형: Command
- 생성 위치: 고객 UI `/search`.
- 처리 위치: `api/search-cars.js` → `dbSearchService.run()`.
- 결과 상태: DB 상태 변경 없음. 검색 projection과 `detailToken` 생성.
- 다음 흐름: 상세 진입.
- 실패 기준: search query invalid, Supabase client unavailable, DB search failed.
- 재처리 기준: 같은 조건으로 재검색 가능.

## Event/Decision/Command: detailToken 발급
- 유형: Event
- 생성 위치: `api/search-cars.js`.
- 처리 위치: `server/security/detailToken.js`.
- 결과 상태: 클라이언트가 상세 진입 가능한 임시 권한 보유.
- 다음 흐름: 상세 API/결제 prepare에서 토큰 검증.
- 실패 기준: 토큰 누락/만료/검색 조건 불일치.
- 재처리 기준: 재검색으로 새 토큰 발급.

## Event/Decision/Command: 결제 준비
- 유형: Command + Decision
- 생성 위치: 고객 예약 폼.
- 처리 위치: `api/payments/[action].js::handlePrepare()`.
- 결과 상태: DB 예약 row 없음. KCP 세션/결제 payload 반환.
- 다음 흐름: KCP 결제창.
- 실패 기준: invalid input, detailToken invalid, OTP 미검증, availability 실패, 서버 가격 계산 실패.
- 재처리 기준: 입력/검색/OTP 재검증 후 재시도.

## Event/Decision/Command: KCP 승인 완료
- 유형: Event
- 생성 위치: KCP return/approve.
- 처리 위치: `api/payments/[action].js::handlePaymentApproval()`.
- 결과 상태: 승인 금액 검증 후 예약 생성 command 실행.
- 다음 흐름: `createGuestBooking()` RPC.
- 실패 기준: session invalid, approve 실패, 금액 불일치.
- 재처리 기준: `payment_provider + payment_reference_id` 기준 기존 예약 조회/dedupe.

## Event/Decision/Command: 예약 생성
- 유형: Command
- 생성 위치: 결제 승인 흐름.
- 처리 위치: `server/booking-core/guestBookingService.js::createGuestBooking()` → RPC `create_booking_order_after_payment_v1`.
- 결과 상태: `booking_orders`, lookup key, status event 생성.
- 다음 흐름: OTP consume, payment approved event 기록, 알림/outbox enqueue.
- 실패 기준: RPC 실패, conflict, payment reference unique violation.
- 재처리 기준: payment reference unique violation 시 기존 예약 조회 반환.

## Event/Decision/Command: 예약 생성 후 알림
- 유형: Event → Command
- 생성 위치: 예약 생성 성공 후.
- 처리 위치: email/SMS/admin alert/OPS outbox enqueue.
- 결과 상태: 알림 결과 이벤트 또는 outbox pending 생성.
- 다음 흐름: OPS worker가 pending 처리.
- 실패 기준: 알림 실패, outbox enqueue 실패.
- 재처리 기준: outbox는 failed → retry 가능. SMS/email 중복은 별도 idempotency 확인 필요.

## Event/Decision/Command: OPS outbox 처리
- 유형: Runtime Command
- 생성 위치: outbox worker.
- 처리 위치: `processOpsAppReservationEventOutbox()`.
- 결과 상태: pending/failed → processing → sent/failed.
- 다음 흐름: 실패 시 backoff 후 재시도.
- 실패 기준: URL/secret missing, non-2xx, network error.
- 재처리 기준: `next_attempt_at` 도래 시 재시도.

## Event/Decision/Command: 관리자 예약 변경
- 유형: Command
- 생성 위치: 관리자 UI.
- 처리 위치: `api/admin/bookings.js::handleChange()`.
- 결과 상태: `booking_orders.car_id/pickup_at/return_at/pricing_snapshot` 변경, `admin_booking_changed` 이벤트 추가.
- 다음 흐름: 관리자 확인/운영 안내.
- 실패 기준: token invalid, non-confirmed, already started, conflict.
- 재처리 기준: 입력 수정 후 재시도. 실패 전 기존 예약은 유지.

## Event/Decision/Command: 가격 허브 editor 저장
- 유형: Command + Decision
- 생성 위치: 관리자 가격 허브 UI.
- 처리 위치: `api/admin/pricing-hub.js::handleSaveEditor()`.
- 결과 상태: `price_policies.pricing_option_type`, `pricing_hub_periods`, `pricing_hub_rates` 변경.
- 다음 흐름: 검색 가격 view/계산에 반영.
- 실패 기준: period 생성 실패, policy update 실패, rate upsert 실패.
- 재처리 기준: 같은 정책에 다시 저장 가능. 외부 플랫폼 반영은 별도 흐름.

## Event/Decision/Command: 가격 허브 group setting 저장
- 유형: Command
- 생성 위치: 관리자 가격 허브 UI.
- 처리 위치: `api/admin/pricing-hub.js::handleSaveGroupSetting()`.
- 결과 상태: 특정 car group의 active price policy mapping 변경.
- 다음 흐름: 검색 가격 view/계산에 반영.
- 실패 기준: duplicate/mapping update/insert 실패.
- 재처리 기준: mapping 재저장 가능.

## Event/Decision/Command: 카모아 휴무 reconcile
- 유형: Runtime Command
- 생성 위치: 카모아 sync runner 또는 launchd.
- 처리 위치: `scripts/carmore-sync/*`.
- 결과 상태: dry-run은 계획/이력, save-run은 카모아 외부 휴무와 mapping 변경.
- 다음 흐름: 관리자 동기화 상태창, 다음 reconcile.
- 실패 기준: login/API/save/delete 실패, mapping conflict.
- 재처리 기준: run history와 mapping 기준으로 재실행.

## Event/Decision/Command: 카모아 가격 반영
- 유형: External Command
- 생성 위치: 운영 승인 후 가격 normalizer/apply 흐름.
- 처리 위치: 외부 카모아 endpoint.
- 결과 상태: 카모아 가격표 변경, apply result 산출물 기록.
- 다음 흐름: 재조회 mismatch 확인.
- 실패 기준: 저장 실패, mismatch 발생.
- 재처리 기준: payload/backupRows 기준 재적용 또는 복구.

---

# Current Guardrail Log

## Guardrail: 결제 전 예약 row 생성 금지
- 기준: `booking_orders`는 결제 성공 직후에만 생성한다.
- owner: 결제 승인 API + 예약 생성 RPC.
- 허용되는 event/decision/command: KCP approve 성공 후 create booking command.
- 금지되는 직접 변경: 결제 전 임시 예약 row 생성.

## Guardrail: 홈페이지 blocking status는 `confirmed`
- 기준: `cancelled`는 non-blocking.
- owner: booking availability service / 예약 정책.
- 허용되는 event/decision/command: confirmed 예약만 차단.
- 금지되는 직접 변경: IMS 상태나 운영 편의를 이유로 홈페이지 booking_status enum 확장.

## Guardrail: 상세/예약은 `detailToken` 전제
- 기준: 검색 결과에서 발급된 token 검증 통과 시 상세/예약 진행.
- owner: search API, detail token security module, payment prepare.
- 허용되는 event/decision/command: 재검색 후 새 토큰 발급.
- 금지되는 직접 변경: 차량 ID만으로 상세/예약 허용.

## Guardrail: 프론트는 외부 IMS/파트너 직접 호출 금지
- 기준: 프론트는 내부 API만 호출한다.
- owner: API/server layer.
- 허용되는 event/decision/command: 내부 API command 요청.
- 금지되는 직접 변경: 프론트에서 IMS/카모아/찜카/KCP 내부 API 직접 호출.

## Guardrail: KCP/env/launchd/external save는 별도 승인
- 기준: protected target은 문서화/진단과 실행을 분리한다.
- owner: 운영자 승인 + 서버 설정.
- 허용되는 event/decision/command: 읽기/진단/계획.
- 금지되는 직접 변경: 승인 없는 `.env`, Vercel env, launchd, 외부 플랫폼 저장.

## Guardrail: 가격 truth와 채널 출력 분리
- 기준: `pricing_hub_rates`/`price_policies`는 홈페이지 가격 truth, 카모아/찜카 가격은 채널별 출력 결과.
- owner: pricing hub API, 외부 가격 apply flow.
- 허용되는 event/decision/command: preview → save → verify → result 기록.
- 금지되는 직접 변경: 홈페이지 가격 변경을 외부 플랫폼 반영 완료로 간주.

## Guardrail: outbox 실패는 예약 rollback 조건 아님
- 기준: 예약/결제 성공과 OPS 앱 이벤트 송신은 분리한다.
- owner: outbox module.
- 허용되는 event/decision/command: failed 기록 후 backoff retry.
- 금지되는 직접 변경: OPS 전송 실패 때문에 `booking_orders`를 취소/rollback.

## Guardrail: dry-run과 save-run 분리
- 기준: 카모아/찜카 sync는 dry-run과 save-run의 의미가 다르다.
- owner: sync runner + 운영 승인.
- 허용되는 event/decision/command: dry-run으로 계획 확인 후 save-run 승인.
- 금지되는 직접 변경: dry-run 성공을 외부 반영 완료로 보고.

## Violation/Risk: 결제 승인 후 예약 생성 실패 ledger 부족
- 위치: `api/payments/[action].js`, `server/booking-core/guestBookingService.js`.
- 현재 문제: KCP approve 성공 후 booking RPC 실패 시 별도 payment ledger가 없으면 복구 추적이 약하다.
- 어긋난 기준: payment event와 booking state owner 분리 부족.
- 위험: 결제는 됐는데 예약이 없는 상태 추적 어려움.
- 정리 방향: payment ledger 또는 approved-before-booking event 상태를 별도 phase로 설계.
- 상태: 리스크.
- 다음 후보: payment ledger 최소 설계 PM.

## Violation/Risk: 관리자 예약 변경의 가격 정책
- 위치: `api/admin/bookings.js::handleChange()`.
- 현재 문제: 현재 구현은 변경 시 금액을 재계산하지 않고 `kept_original_booking_amount`로 남긴다.
- 어긋난 기준: 예약 변경 event와 정산 decision을 분리해야 함.
- 위험: 운영자가 차액 안내/정산을 놓칠 수 있음.
- 정리 방향: 차액 decision event를 별도 상태로 추가할지 검토.
- 상태: 의도된 1차 구현이지만 운영 guardrail 필요.
- 다음 후보: 관리자 변경 차액 처리 phase.

## Violation/Risk: 가격 허브와 외부 플랫폼 반영 분리 미흡 가능성
- 위치: 가격 허브 API, 카모아 가격 apply 산출물.
- 현재 문제: 홈페이지 가격 저장과 외부 플랫폼 저장은 별도인데 운영 대화에서 함께 다뤄질 수 있음.
- 어긋난 기준: source of truth / channel output 분리.
- 위험: 한쪽만 반영되고 완료로 오해.
- 정리 방향: 가격 변경 완료 문서에는 홈페이지 DB, 카모아/찜카 각각 result/mismatch/rollback 근거를 필수로 기록.
- 상태: guardrail로 관리.
- 다음 후보: 가격 변경 완료 템플릿 정리.

---

# 파생 문서 판단

## 생성하지 않음
- `CURRENT_RUNTIME_LOOP_MAP.md`: 현재는 본 문서 안에서 카모아/찜카/outbox runtime을 다룬다.
- `CURRENT_UI_API_BOUNDARY_MAP.md`: 관리자 UI/API 경계가 더 커지면 분리한다.
- `CURRENT_SOURCE_MAP.md`: dry-run/save-run 혼재가 더 커지면 분리한다.
- `CURRENT_REFACTOR_CANDIDATES.md`: violation이 5개 이상으로 늘면 분리한다.

---

# 다음 후보 하나

## Payment Ledger 최소 설계 PM
KCP approve 성공 후 예약 생성 실패를 복구 가능하게 남기는 최소 payment ledger/state를 별도 phase로 설계한다.

범위:
- payment approved event 저장 위치
- booking 생성 전/후 멱등성
- 실패 시 운영자가 볼 수 있는 복구 상태
- 기존 `booking_orders.payment_*`와의 관계

코드/DB 변경은 별도 승인 전 미실행.
