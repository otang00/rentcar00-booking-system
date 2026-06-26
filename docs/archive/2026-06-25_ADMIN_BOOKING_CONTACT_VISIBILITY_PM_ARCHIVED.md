# ARCHIVED - Admin Booking Contact Visibility PM

## Archive Reason
- Archived at: 2026-06-25 13:39 KST
- User decision: OPS 생년월일 형식 문제는 홈페이지가 아니라 OPS 내부에서 처리한다.
- Result: 이 PM 문서는 실행하지 않는다.
- Note: 코드 수정, DB 변경, 배포, 커밋 없음.

---

# Admin Booking Contact Visibility PM

## Document Metadata
- Created at: 2026-06-25 13:20 KST
- Last updated at: 2026-06-25 13:28 KST
- Author/agent: rentcar00_reservation_developer
- Related milestone: 예약 확정 운영 연락처 표시 복구
- Related goal/spec docs:
  - `README.md`
  - `docs/README.md`
  - `docs/policies/RENTCAR00_POLICY.md`
  - `docs/present/2026-05-16_RENTCAR00_CURRENT.md`
  - `PROJECT_DOCUMENTATION_RULES.md`
- Current status: In Review
- Approval scope: 문서 작성만 완료. 코드 수정/테스트/커밋은 별도 승인 필요.
- Archive target: `docs/COMPLETED/ADMIN_BOOKING_CONTACT_VISIBILITY_PM_COMPLETE_<YYYYMMDD>.md`

## 0. Goal Lock
- Objective: 예약확정 운영자 이메일과 관리자 예약확인 화면에서 고객 연락처 확인이 가능하도록, 관리자/운영자 전용 경로에는 전화번호·생년월일 전체값을 제공하고 고객용 조회 경로의 마스킹은 유지한다. 추가로 OPS 앱 자동 예약생성 경계에서 생년월일 저장 형식을 `YYYY-MM-DD`로 맞춘다. 홈페이지 event payload는 기존 `YYYYMMDD` 계약을 유지하고, OPS parser ingestion에서 OPS 원장 형식으로 변환한다.
- Final success condition:
  - 고객/비회원/회원 예약조회 응답은 기존처럼 마스킹 유지.
  - 운영자 전용 예약확정 이메일은 전화번호·생년월일 전체 표시.
  - 관리자 예약확인 화면은 관리자 인증 후 전화번호·생년월일 전체 표시.
  - 홈페이지 OPS event payload의 `booking.customerBirth`는 기존처럼 `19841115` 같은 `YYYYMMDD`를 유지.
  - OPS parser가 자동 예약생성 시 `customerBirth/customerBirthDate/birthDate`를 `1984-11-15` 같은 `YYYY-MM-DD`로 정규화해 저장.
  - 관련 테스트와 최소 빌드 검증 통과.
- Explicit non-goals:
  - DB 스키마 변경 없음.
  - `.env*`, Vercel env, SMTP/SMS/KCP 설정 변경 없음.
  - 고객용 예약조회 화면의 개인정보 노출 확대 없음.
  - 배포/restart/운영 DB 직접 수정 없음.
- Protected targets:
  - `.env*`, Vercel env, SMTP/SMS/KCP/secret 설정, Supabase 운영 DB, 배포 설정.
- Approval required for:
  - 코드 수정.
  - 테스트 실행 중 외부 API 호출이 필요한 경우.
  - 커밋.
  - 배포/운영 반영.

## 1. Current State Evidence
- Repo status:
  - `git status --short` 확인 결과 기존 untracked 문서 1건 존재: `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md`.
  - 이번 PM 문서 외 기존 dirty work는 건드리지 않는다.
- Existing implementation:
  - `server/booking-core/guestBookingUtils.js`
    - `serializeBookingOrder()`가 `customerPhone: maskPhone(order.customer_phone)` 및 `customerBirth: maskBirth(...)`로 공통 마스킹한다.
    - 11자리 전화번호는 `010-****-1234` 형태가 된다.
  - `api/admin/bookings.js`
    - `handleConfirmTarget()`이 `fetchBookingOrderByConfirmationToken()` 결과의 `result.booking`을 그대로 반환한다.
  - `server/booking-core/bookingConfirmationService.js`
    - `fetchBookingOrderByConfirmationToken()`은 raw DB row와 `serializeBookingOrder(data)` 결과를 같이 반환한다.
  - `src/pages/AdminBookingConfirmPage.jsx`
    - API에서 받은 `booking.customerPhone`, `booking.customerBirth`를 그대로 표시한다.
  - `server/email/bookingConfirmationEmail.js`
    - `customerPhone` 인자가 있으면 전체번호를 표시하지만, fallback으로 `booking.customerPhone`을 사용하면 마스킹값을 탈 수 있다.
  - `server/notifications/sendOpsAppReservationEvent.js`
    - `buildOpsReservationEventPayload()`가 `bookingInput.customerBirth`를 `String(...).trim()` 그대로 `booking.customerBirth`에 넣는다. 현재 입력값은 `19841115` 형식이며, 홈페이지 outgoing 계약으로 유지한다.
  - OPS parser 수신부
    - `reservation_ai_parser/src/server.js`의 homepage payload mapping에서 `customerBirth`를 변환 없이 `customerBirthDate` 후보로 사용하면 OPS 원장에 `19841115`가 저장될 수 있다.
  - OPS 기준
    - OPS 원장/IMS payload 쪽 `customerBirthDate`는 `1984-11-15` 같은 실제 날짜 형식이어야 한다.
  - `api/payments/[action].js`
    - 정상 신규 예약 알림 발송 시 `bookingInput.customerPhone/customerBirth`를 이메일 빌더와 OPS outbox에 전달한다.
- Existing docs/specs:
  - `docs/present/2026-05-16_RENTCAR00_CURRENT.md` 2026-05-18 추가 작업에 “운영자 이메일은 BOOKING_EMAIL_TO 전용으로 보고 고객 전화번호/생년월일 전체를 표시한다”가 명시되어 있다.
  - 과거 security 문서에는 기본 마스킹 기준이 있으나, 현재 active current가 운영자 이메일 전체 표시 기준을 더 최신 기준으로 잠근다.
- Existing tests/harness:
  - `server/booking-core/__tests__/guestBookingUtils.test.js`
  - `server/booking-core/__tests__/guestBookingService.test.js`
  - `server/security/__tests__/bookingConfirmToken.test.js`
  - `server/notifications/__tests__/sendOpsAppReservationEvent.test.js`
  - `npm run build` 존재. 단, frontend env check가 포함되어 env 없으면 실패 가능.
- Known conflicts or drift:
  - 정책상 고객용 기본 마스킹과 운영자 전용 전체 표시가 공존해야 한다.
  - 현재 공통 serializer 하나가 두 경로를 같이 담당해 관리자 화면에도 마스킹이 전파된다.

## 2. Change Summary
| Item | Before | After | Why |
| --- | --- | --- | --- |
| 고객용 예약 serializer | 전화번호/생년월일 마스킹 | 유지 | 고객 화면 개인정보 최소 노출 유지 |
| 관리자 예약확인 API | 공통 마스킹 booking 반환 | 관리자 인증 통과 후 전체 연락처 포함 booking 반환 | 운영자가 고객에게 연락 가능해야 함 |
| 운영자 이메일 fallback | `booking.customerPhone`이 마스킹값이면 마스킹 표시 가능 | 원문 인자 우선 + 관리자/운영 경로에서 raw DB값 fallback | 예약확정 이메일 운영 목적 달성 |
| OPS 자동생성 생년월일 | 홈페이지 event `19841115`이 OPS 저장까지 그대로 갈 수 있음 | OPS parser ingestion에서 `1984-11-15`로 변환 저장 | OPS 자동 예약생성/IMS 생년월일 형식 오류 방지 |
| 테스트 | 관리자 전체표시/OPS birth format 회귀 테스트 없음 | 고객 마스킹 유지 + 관리자 전체표시 + OPS parser `YYYY-MM-DD` 저장 테스트 추가 | 재발 방지 |

## 3. Impact Analysis
| Impact Area | Affected Modules/Docs | Schedule Impact | Risk | Mitigation |
| --- | --- | --- | --- | --- |
| Backend API | `api/admin/bookings.js`, `server/booking-core/bookingConfirmationService.js` 또는 신규 admin serializer | 낮음 | 고객용 경로에 전체번호가 새면 개인정보 리스크 | admin confirm handler에서만 별도 변환, 공통 serializer 유지 |
| Email | `server/email/bookingConfirmationEmail.js`, `server/email/sendBookingConfirmationEmail.js` | 낮음 | 이메일 수신 대상 오설정 시 개인정보 노출 | 기존 `BOOKING_EMAIL_TO` 운영자 전용 전제 유지, env 변경 금지 |
| Frontend Admin | `src/pages/AdminBookingConfirmPage.jsx` | 낮음 | 프론트 변경 없이 API만으로 해결 가능할 수 있음 | 우선 API 응답 보강, UI는 필요 시 표시 포맷만 확인 |
| Customer UI | `GuestBookingsPage`, `MemberReservationDetailPage`, `ReservationCompletePage` | 낮음 | 고객 화면 전체 노출 회귀 | 공통 serializer 마스킹 유지 테스트 |
| DB/Runtime/External | Supabase/Vercel/SMTP/SMS/KCP | 없음 | protected action 유발 가능 | DB/env/deploy 변경 금지, 필요 시 중단 보고 |
| OPS Parser | `rentcar00_OPS/reservation_ai_parser/src/server.js`, OPS parser tests | 중간 | 홈페이지 outgoing 계약과 OPS 원장 저장 형식 혼동 | 홈페이지 payload는 `YYYYMMDD` 유지, OPS ingestion 경계에서만 `YYYY-MM-DD` 변환 |
| Docs | 이 PM 문서, 완료 시 `docs/COMPLETED` | 낮음 | 문서와 코드 불일치 | 구현 후 완료 문서로 정리 |

## 4. Execution Policy
- Approval model:
  - 이 문서는 실행 준비 문서이며 코드 수정 승인이 아니다.
  - “Phase 1 실행 승인” 또는 “전체 phase 실행 승인” 같은 명시 문구가 필요하다.
- Phase transition rule:
  - 각 phase는 구현 → 검증 → 리뷰 보고 → 커밋 승인/커밋 순서로만 진행한다.
- Review rule:
  - 구현자와 검수 판단을 분리한다. subagent reviewer 또는 single-agent fallback 검수 패스를 별도 기록한다.
- Commit rule:
  - 커밋은 사용자 승인 범위에 포함될 때만 수행한다.
  - 기존 untracked `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md`는 stage 금지.
- Rollback/compensation rule:
  - 코드 변경은 git diff 기반 revert 가능하게 작게 유지한다.
  - DB/env/deploy 변경은 하지 않는다.
- Stop conditions:
  - 관리자 API 외 고객 API에도 전체값 노출 필요가 생길 때.
  - raw DB에 원문 전화번호가 없는 실제 데이터 문제가 확인될 때.
  - `.env`, Vercel env, SMTP 설정 수정이 필요할 때.
  - 테스트/빌드가 env 누락으로 실행 불가하고 대체 검증도 부족할 때.

## 5. Phase Map
| Phase | Purpose | Owner | State Change | Parallelizable | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | 정책 소유권/경로 잠금 | Execution Governor | 문서/판단만 | Yes | No |
| 2 | 관리자 전용 full-contact serializer/API 보강 | Coder/Executor | Code | No | Yes, if approved |
| 3 | 운영자 이메일 fallback 보강 | Coder/Executor | Code | Partially with Phase 2 after contract lock | Same commit or separate |
| 4 | OPS parser 생년월일 `YYYY-MM-DD` 저장 변환 | Coder/Executor | Code in OPS project | 별도 프로젝트라 분리 권장 | Separate |
| 5 | 테스트/빌드 검증 및 회귀 확인 | Reviewer/Verifier | Test execution only | Yes after code | No |
| 6 | 완료 문서/커밋 | Execution Governor | Docs + commit | No | Yes, if approved |

## 6. Parallel Work Lanes
| Lane | Can Run In Parallel With | Subagent Prompt | Inputs | Outputs | Merge Gate |
| --- | --- | --- | --- | --- | --- |
| Reviewer | Phase 2/3 implementation after diff exists | “관리자 예약확인 full-contact 변경 diff를 읽고 고객용 마스킹 유지, 관리자 인증 전제, 이메일 fallback을 검수하라. 수정 금지.” | diff, target files, tests | PASS/FIX/STOP with evidence | Governor decision |
| Test Scout | Phase 2/3/4 implementation planning | “현재 test runner와 관련 테스트 위치를 확인하고 최소 회귀 테스트 명령을 제안하라. 수정 금지.” | package.json, tests | test command list | Before verification |
| OPS Contract Scout | Phase 4 planning | “OPS 예약 이벤트 payload의 customerBirth 요구 형식과 현재 전송 형식, OPS parser 저장 형식을 확인하고 변환 위치/테스트 후보를 보고하라. 수정 금지.” | homepage `server/notifications/*`, OPS parser/docs/tests | contract evidence + risk | Before Phase 4 implementation |

## 7. Phases

### Phase 1. Policy Ownership Lock
Status: PLANNED

Purpose:
- 고객용 개인정보 마스킹 정책과 운영자/관리자 연락 가능 정책의 소유권을 분리해 잠근다.

Scope:
- In:
  - active current 문서와 실제 코드 기준 확인.
  - 운영자 이메일/관리자 확인 화면은 운영 처리 권한 surface로 분류.
  - 고객 조회 surface는 기본 마스킹 유지로 분류.
- Out:
  - 코드 수정.
  - 정책 문서 본문 수정.

Files/Targets:
- `docs/present/2026-05-16_RENTCAR00_CURRENT.md`
- `docs/policies/RENTCAR00_POLICY.md`
- `server/booking-core/guestBookingUtils.js`
- `api/admin/bookings.js`
- `server/email/bookingConfirmationEmail.js`

Execution Steps:
1. active current의 운영자 이메일 전체 표시 기준을 최종 기준으로 삼는다.
2. 과거 security 마스킹 문서는 고객용/기본 surface 기준으로만 해석한다.
3. 관리자 예약확인 화면은 관리자 인증 통과 후 운영 처리 surface로 분류한다.

Verification:
- Static checks: 문서 근거와 코드 호출 경로 대조.
- Tests: 없음.
- Harness/smoke: 없음.
- Manual review: 이 PM 문서 검토.

Completion Evidence:
- Code/doc evidence: `docs/present/2026-05-16_RENTCAR00_CURRENT.md` lines around 171~182.
- Test evidence: Not in scope.
- Runtime/DB/external evidence: Not in scope.

Review Gate:
- Reviewer: Execution Governor.
- Required checks: 정책 충돌 없음 확인.
- Failure handling: 정책 충돌 시 코드 수정 전 사용자 재확인.

Completion Judgment:
- PASS criteria: 운영자/관리자 full-contact surface와 고객 masked surface가 분리됨.
- FAIL criteria: 관리자 화면이 고객 surface인지 운영 surface인지 불명확함.

Commit Gate:
- Stage scope: PM 문서만, 문서 커밋 승인 시.
- Commit message: `docs: plan admin booking contact visibility fix`
- Commit only after: 사용자 커밋 승인.

Next Phase Entry Criteria:
- 사용자 실행 승인.

Rollback/Compensation:
- 문서 변경 revert.

### Phase 2. Admin Confirm API Full Contact
Status: PLANNED

Purpose:
- 관리자 예약확인 API가 관리자 인증 후 전체 전화번호/생년월일을 반환하게 한다.

Scope:
- In:
  - `api/admin/bookings.js` confirm-target 응답 또는 전용 serializer 추가.
  - raw DB `customer_phone`, `customer_birth`에서 관리자 전용 표시값 생성.
  - 고객용 `serializeBookingOrder()` 기본 마스킹 유지.
- Out:
  - 고객용 guest/member booking 조회 응답 변경.
  - DB 스키마 변경.

Files/Targets:
- `api/admin/bookings.js`
- `server/booking-core/bookingConfirmationService.js` 또는 `server/booking-core/guestBookingUtils.js`의 전용 export 추가 가능
- Tests under `server/booking-core/__tests__` or API-level test if feasible

Execution Steps:
1. 공통 `serializeBookingOrder()`는 마스킹 유지한다.
2. 관리자 confirm-target 전용 변환을 만든다.
3. `result.rawBooking.customer_phone/customer_birth`를 관리자 응답에만 full value로 덮어쓴다.
4. 프론트 `AdminBookingConfirmPage.jsx`가 기존 필드를 그대로 표시해도 full value가 보이는지 확인한다.

Verification:
- Static checks: grep으로 고객 조회 경로가 full serializer를 쓰지 않는지 확인.
- Tests: 관련 serializer/API 단위 테스트 추가 또는 기존 테스트 보강.
- Harness/smoke: 가능하면 로컬 build.
- Manual review: diff 확인.

Completion Evidence:
- Code/doc evidence: diff.
- Test evidence: node test result.
- Runtime/DB/external evidence: DB write 없음.

Review Gate:
- Reviewer: 별도 reviewer/subagent 권장.
- Required checks:
  - 고객용 마스킹 유지.
  - 관리자 인증 체크 이후에만 full value 반환.
  - 생년월일도 운영자 기준 전체값 표시.
- Failure handling: full value가 고객 경로로 흐르면 STOP.

Completion Judgment:
- PASS criteria: admin confirm response only has full contact; customer response remains masked.
- FAIL criteria: 공통 serializer 자체를 full로 바꿔 고객 화면에 노출 위험 발생.

Commit Gate:
- Stage scope: 관련 backend/test 파일만.
- Commit message: `fix: show full contact on admin booking confirmation`
- Commit only after: 테스트 + 사용자 커밋 승인.

Next Phase Entry Criteria:
- Phase 2 verified or combined with Phase 3 under same approval.

Rollback/Compensation:
- admin serializer/API diff revert.

### Phase 3. Operator Email Full Contact Fallback
Status: PLANNED

Purpose:
- 운영자 예약확정 이메일이 원문 인자를 받지 못하는 예외 경로에서도 마스킹값으로 떨어지지 않게 보강한다.

Scope:
- In:
  - `server/email/bookingConfirmationEmail.js` fallback 정책 보강.
  - 가능하면 `sendBookingConfirmationEmail()` 호출부에서 raw contact 전달 확인.
- Out:
  - 이메일 수신자/env 변경.
  - 외부 SMTP 테스트 발송.

Files/Targets:
- `server/email/bookingConfirmationEmail.js`
- `server/email/sendBookingConfirmationEmail.js`
- `api/payments/[action].js` only if needed

Execution Steps:
1. `customerPhone/customerBirth` 인자 우선은 유지한다.
2. fallback으로 마스킹된 `booking.customerPhone`보다 raw source를 우선할 수 있는 계약을 명확히 한다.
3. 이메일 빌더 단위 테스트를 추가해 full phone/birth 표시를 검증한다.

Verification:
- Static checks: fallback 순서 확인.
- Tests: email builder unit test.
- Harness/smoke: 외부 발송 없이 pure function 테스트.
- Manual review: 개인정보 수신 대상 전제 확인.

Completion Evidence:
- Code/doc evidence: diff.
- Test evidence: node test result.
- Runtime/DB/external evidence: 외부 SMTP 발송 없음.

Review Gate:
- Reviewer: 별도 reviewer/subagent 권장.
- Required checks: 고객 이메일이 아니라 운영자 `BOOKING_EMAIL_TO` 전용임을 유지.
- Failure handling: 수신 대상 확대 필요 시 STOP.

Completion Judgment:
- PASS criteria: 운영자 이메일 full contact 표시 테스트 통과.
- FAIL criteria: env/SMTP 변경 필요 또는 고객 대상 이메일로 오해 가능.

Commit Gate:
- Stage scope: email/test 파일만.
- Commit message: `fix: preserve full contact in booking confirmation email`
- Commit only after: 테스트 + 사용자 커밋 승인.

Next Phase Entry Criteria:
- Phase 2, 3, and 4 implementation complete.

Rollback/Compensation:
- email builder diff revert.

### Phase 4. OPS Parser Birth Date Format
Status: PLANNED

Purpose:
- 홈페이지 예약 이벤트를 받아 OPS 앱 예약을 자동생성할 때 생년월일을 OPS 원장/IMS 요구 형식인 `YYYY-MM-DD`로 저장한다.

Scope:
- In:
  - OPS parser의 homepage payload ingestion에서 `customerBirth`, `customerBirthDate`, `birthDate`, `booking.customerBirth` 후보값을 `YYYY-MM-DD`로 정규화.
  - `19841115` → `1984-11-15` 변환.
  - 이미 `1984-11-15`인 값은 유지.
  - invalid date는 임의 보정하지 않고 null/warning/보류 중 기존 parser 정책에 맞춰 처리.
  - OPS parser 단위 테스트 추가/갱신.
- Out:
  - 홈페이지 event payload 형식 변경.
  - 홈페이지 DB 저장/입력/나이계산 형식 변경.
  - 기존 OPS DB row 보정 실행.

Files/Targets:
- OPS project: `reservation_ai_parser/src/server.js`
- OPS parser tests if present
- Homepage reference only: `server/notifications/sendOpsAppReservationEvent.js`
- Homepage tests should continue expecting `19841115` outgoing payload unless the cross-system contract is separately changed.

Execution Steps:
1. OPS parser의 `mapHomepageReservationPayload()` 또는 동등 mapping 위치를 확인한다.
2. JS formatter를 추가한다: `YYYYMMDD` 또는 `YYYY-MM-DD` valid date → `YYYY-MM-DD`.
3. 원장 저장 필드 `customerBirthDate/customer_birth_date`에 formatter 결과를 사용한다.
4. raw inbox/event payload는 추적성을 위해 원문 유지한다.
5. OPS parser tests에 아래 케이스를 추가한다.
   - `customerBirth: "19841115"` → `customer_birth_date: "1984-11-15"`
   - `customerBirth: "1984-11-15"` → 유지
   - 불가능 날짜는 자동 보정하지 않음
6. 홈페이지 notification tests는 outgoing payload가 계속 `19841115`임을 유지 확인한다.

Verification:
- Static checks: 변환이 OPS ingestion 저장 경계에만 적용되는지 확인.
- Tests:
  - OPS parser 단위 테스트 명령 확인 후 실행.
  - Homepage notifications test는 회귀 확인용으로 유지 실행 가능:
    - OPS parser test command after harness confirmation
  - Homepage outgoing regression if needed: `node --test server/notifications/__tests__/sendOpsAppReservationEvent.test.js server/notifications/__tests__/opsAppReservationEventOutbox.test.js`
- Harness/smoke:
  - 외부 실제 전송 없이 mock homepage event → OPS mapped reservation `customer_birth_date = 1984-11-15` 확인.
- Manual review: 홈페이지 계약 `YYYYMMDD`, OPS 저장 계약 `YYYY-MM-DD` 분리 확인.

Completion Evidence:
- Code/doc evidence: OPS parser diff.
- Test evidence: OPS parser tests + homepage outgoing regression if run.
- Runtime/DB/external evidence: 운영 DB 보정/외부 전송 없음.

Review Gate:
- Reviewer: 별도 reviewer/subagent 권장.
- Required checks:
  - 홈페이지 `customerBirth` outgoing payload는 `YYYYMMDD` 유지.
  - OPS 원장 저장값만 `YYYY-MM-DD`.
  - raw event 추적성 유지.
- Failure handling: OPS project path/test harness 확인이 안 되면 STOP 후 재확인.

Completion Judgment:
- PASS criteria: OPS parser test에서 `19841115` 입력이 `1984-11-15` 저장값으로 변환됨.
- FAIL criteria: 홈페이지 outgoing payload를 임의 변경하거나 OPS 저장값이 여전히 `19841115`.

Commit Gate:
- Stage scope: OPS parser/test files only, unless combined approval explicitly includes homepage admin/email files.
- Commit message: `fix: normalize homepage reservation birth date in ops parser`
- Commit only after: 테스트 + 사용자 커밋 승인.

Next Phase Entry Criteria:
- Phase 2/3/4 implementation complete.

Rollback/Compensation:
- OPS parser formatter/mapping diff revert.

### Phase 5. Verification and Regression Review
Status: PLANNED

Purpose:
- 고객용 마스킹 유지와 관리자/운영자 전체 표시를 함께 검증한다.

Scope:
- In:
  - 관련 node tests.
  - `npm run build` 가능 시 실행.
  - grep/static review.
- Out:
  - 운영 DB 확인.
  - 실제 이메일 발송.
  - 배포.

Files/Targets:
- `package.json`
- `server/**/__tests__`
- `src/pages/AdminBookingConfirmPage.jsx`
- `src/pages/GuestBookingsPage.jsx`
- `src/pages/MemberReservationDetailPage.jsx`

Execution Steps:
1. 관련 단위 테스트 실행.
2. OPS parser 저장값에서 `customer_birth_date/customerBirthDate`가 `YYYY-MM-DD`인지 test/static review.
3. 고객용 화면 경로가 공통 마스킹 serializer를 유지하는지 static review.
4. 관리자 confirm-target만 full value를 반환하는지 diff review.
5. `npm run build` 실행 가능하면 수행. env blocker면 사유 기록.

Verification:
- Static checks: grep/diff.
- Tests:
  - `node --test server/booking-core/__tests__/*.test.js`
  - 추가 email/admin serializer test 명령.
  - OPS parser test command after harness confirmation
  - Homepage outgoing regression if needed: `node --test server/notifications/__tests__/sendOpsAppReservationEvent.test.js server/notifications/__tests__/opsAppReservationEventOutbox.test.js`
- Harness/smoke:
  - `npm run build` if env is available.
- Manual review: PASS/FIX/STOP 판정.

Completion Evidence:
- Code/doc evidence: final diff summary.
- Test evidence: command output.
- Runtime/DB/external evidence: Not in scope.

Review Gate:
- Reviewer: Reviewer/Verifier role.
- Required checks: 실제 test/log 근거.
- Failure handling: FAIL이면 Phase 2/3 fix-only로 되돌림.

Completion Judgment:
- PASS criteria: all required checks pass or documented acceptable blocker.
- FAIL criteria: customer full exposure, admin still masked, email still masked, or OPS stored birth still `YYYYMMDD`.

Commit Gate:
- Stage scope: no new files beyond approved code/tests/docs.
- Commit message: combined if approved.
- Commit only after: user approval.

Next Phase Entry Criteria:
- PASS or user decision on blocker.

Rollback/Compensation:
- revert implementation diff.

### Phase 6. Completion Docs and Commit
Status: PLANNED

Purpose:
- 구현 결과를 완료 문서로 정리하고 승인된 범위만 커밋한다.

Scope:
- In:
  - PM 문서 상태 갱신.
  - 완료 시 `docs/COMPLETED`로 완료 문서 작성/이동.
  - 승인 시 commit.
- Out:
  - push/deploy.

Files/Targets:
- `docs/PHASE/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM.md`
- `docs/COMPLETED/ADMIN_BOOKING_CONTACT_VISIBILITY_PM_COMPLETE_<YYYYMMDD>.md`

Execution Steps:
1. 검증 결과와 남은 리스크 기록.
2. 완료 문서 생성/이동.
3. `git status --short`로 stage 범위 확인.
4. 승인된 파일만 stage/commit.

Verification:
- Static checks: doc path/status 확인.
- Tests: Phase 5 결과 인용.
- Harness/smoke: Not in scope.
- Manual review: commit staged files 확인.

Completion Evidence:
- Code/doc evidence: completed doc path.
- Test evidence: Phase 5 output.
- Runtime/DB/external evidence: deploy not performed.

Review Gate:
- Reviewer: Execution Governor.
- Required checks: unrelated dirty file 미포함.
- Failure handling: stage 정리 후 재확인.

Completion Judgment:
- PASS criteria: docs updated, commit done if approved.
- FAIL criteria: unrelated dirty file 포함 또는 검증 근거 누락.

Commit Gate:
- Stage scope:
  - approved code/test/docs only, including OPS parser birth format files when approved.
  - Exclude existing untracked `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md` unless separately approved.
- Commit message: `fix: restore admin booking contact visibility`
- Commit only after: explicit user commit approval or phase approval including commit.

Next Phase Entry Criteria:
- None.

Rollback/Compensation:
- git revert commit if committed; otherwise restore diff.

### Final Completion Report
- Completed phases: To be filled after execution.
- Commits: To be filled after commit approval.
- Verification summary: To be filled after tests/build.
- Residual risks: To be filled after review.
- Follow-up work: Possible policy doc cleanup if owner wants admin full-contact rule and OPS parser `YYYY-MM-DD` storage contract promoted from active current to policy.
