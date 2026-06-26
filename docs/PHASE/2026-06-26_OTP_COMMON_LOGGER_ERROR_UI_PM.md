# OTP Common Logger and Error UI PM

## Document Metadata
- Created at: 2026-06-26 14:15 KST
- Last updated at: 2026-06-26 14:55 KST
- Author/agent: rentcar00_reservation_developer
- Related milestone: 비회원 예약조회 OTP 오류 안내 및 최소 운영 로그 정비
- Related goal/spec docs:
  - `/Users/otang_server/.openclaw/workspace-rentcar00_reservation_developer/PROJECT_RENTCAR00_BOOKING_SYSTEM.md`
  - `/Users/otang_server/.openclaw/workspace-rentcar00_reservation_developer/PROJECT_DOCUMENTATION_RULES.md`
  - `README.md`
  - `docs/README.md`
  - `docs/policies/RENTCAR00_POLICY.md`
- Current status: Approved / Phase 1-4 executed, awaiting commit
- Approval scope: User approved `pa all` for Phase 1-4 execution and phase commit. DB/migration, external SMS send test, deploy, and push remain excluded.
- Archive target: `docs/COMPLETED/OTP_COMMON_LOGGER_ERROR_UI_PM_COMPLETE_<YYYYMMDD>.md`

## 0. Goal Lock
- Objective:
  - 비회원 예약조회 OTP에서 사용자가 왜 인증번호를 받지 못하는지 화면에 명확히 안내한다.
  - 서버에는 재사용 가능한 최소 공통 로거를 만들고, OTP 발송 경로의 주요 결과를 구조화 로그로 남긴다.
  - 지금 시급한 범위만 처리하며, 전체 커맨드 게이트/DB 로그 축적은 이번 범위에서 제외한다.
- Final success condition:
  - 가입자 번호로 비회원 예약조회 OTP 요청 시 사용자가 로그인으로 이동해야 함을 명확히 본다.
  - OTP 요청 결과가 공통 로거를 통해 JSON 구조화 로그로 남는다.
  - 전화번호 원문, OTP 코드, secret/env 값은 로그에 남지 않는다.
  - 기존 SMS 발송/검증/예약조회 계약은 유지된다.
  - `npm run build` 통과.
- Explicit non-goals:
  - 모든 API를 command gate로 재구성하지 않는다.
  - DB 로그 테이블, Supabase migration, 장기 로그 저장소를 만들지 않는다.
  - Solapi 실제 SMS 발송 테스트를 자동 실행하지 않는다.
  - `.env*`, Vercel env, secret 값을 수정하지 않는다.
  - 회원/비회원 인증 정책 자체를 변경하지 않는다.
- Protected targets:
  - `.env*`, Vercel env, Solapi/Supabase secret, `supabase/migrations/*`, 운영 DB, 배포 설정, 외부 SMS 실제 발송.
- Approval required for:
  - 코드 수정.
  - 테스트 중 외부 SMS 발송이 필요한 경우.
  - 커밋.
  - 배포/운영 반영.
  - DB 로그 축적 또는 migration.

## 1. Current State Evidence
- Repo status:
  - Branch: `dev`
  - Upstream: `origin/dev`
  - Working tree: clean at inspection time.
- Existing implementation:
  - `src/pages/GuestBookingsPage.jsx`
    - 비회원 예약조회에서 `/api/auth/otp/send`를 호출한다.
    - 서버 오류 메시지는 `setError()`로 표시하지만, 가입자 차단/쿨다운/Solapi 실패별 UI 강조와 이동 액션은 약하다.
  - `api/auth/otp/[action].js`
    - `handleOtpSend()`에서 `purpose: guest_lookup`을 지원한다.
    - 가입된 번호는 `409 phone_already_registered`와 `회원 예약은 로그인 후 예약내역에서 확인해 주세요.` 메시지로 차단한다.
    - 이 차단은 정상 정책 처리라 `phone_verifications` row를 만들지 않고 SMS도 보내지 않는다.
    - `otp_provider_unavailable`, `otp_cooldown`, `otp_send_failed`, `otp_save_failed` 등 분기별 응답이 이미 있다.
  - `server/auth/memberPhoneLookup.js`
    - `getMemberPhoneBlockMessage('guest_lookup')`가 회원 예약은 로그인 후 확인하라는 메시지를 반환한다.
  - `server/auth/phoneOtp.js`
    - `isSolapiConfigured()`는 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`, `PHONE_OTP_SECRET`를 요구한다.
    - `normalizePhoneNumber()`는 `+82` 계열을 국내 0-prefix로 정규화한다.
  - `server/sms/sendSolapiMessage.js`
    - Solapi SDK를 직접 호출한다.
  - 현재 공통 서버 로거는 없다.
  - 현재 `console.error/warn/log`가 API/서버/스크립트에 파일별로 흩어져 있다.
- Existing docs/specs:
  - 프로젝트 문서 규칙상 phase 문서는 `docs/PHASE/`에 둔다.
  - 운영/보안 민감 영역은 `.env*`, Vercel env, Supabase, Solapi 등이며 수정 판단과 실행을 분리해야 한다.
- Existing tests/harness:
  - `npm run build` 존재.
  - OTP 전용 test script는 `package.json`에 별도 등록되어 있지 않다.
  - 최소 검증은 build + targeted static review + 가능 시 `node --check`이다.
- Known conflicts or drift:
  - Vercel 함수 로그는 런타임 관찰용이며 장기 운영 이력 축적으로는 부족하다.
  - 그러나 DB 로그 축적은 migration/운영 DB 변경이므로 이번 시급 범위에서 제외한다.
  - 전체 command gate는 기존 API 전체를 건드리는 큰 구조 변경이므로 이번 범위에서 제외한다.

## 2. Change Summary
| Item | Before | After | Why |
| --- | --- | --- | --- |
| 서버 로깅 | 파일별 `console.*` 산발 사용 | `server/logging/appLogger.js` 최소 공통 로거 추가 | 이후 예약/결제/관리자 이벤트도 같은 형식으로 확장 가능 |
| OTP 가입자 차단 | 409 응답만 반환, 운영 로그 없음 | `otp_send_blocked` 구조화 로그 남김 | “문자가 왜 안 갔는지” 운영자가 추적 가능 |
| OTP 쿨다운/설정/발송 실패 | 응답은 있으나 로그 표준 없음 | `otp_cooldown`, `otp_provider_unavailable`, `otp_send_failed` 등 이벤트화 | 실패 원인 구분 가능 |
| OTP 성공 | DB row 생성 후 응답 | `otp_send_success` 로그 추가 | 발송 요청 성공 여부 추적 |
| 프론트 오류 안내 | 메시지 텍스트만 표시 | 에러 타입별 안내 박스 + 가입자면 로그인 버튼 표시 | 사용자 혼란 감소 |
| 장기 로그 축적 | 없음 | 이번 phase에서는 미구현 | DB/migration 별도 승인 필요 |

## 3. Impact Analysis
| Impact Area | Affected Modules/Docs | Schedule Impact | Risk | Mitigation |
| --- | --- | --- | --- | --- |
| Backend logging | `server/logging/appLogger.js`, `api/auth/otp/[action].js` | 낮음 | 로그에 PII/OTP/secret 노출 | phoneLast4만 기록, OTP code 미기록, allowlist 필드만 출력 |
| Frontend UX | `src/pages/GuestBookingsPage.jsx` | 낮음 | 오류 표시가 기존 흐름을 방해 | OTP send 응답 error code 기준으로 UI만 보강 |
| Auth/OTP behavior | `api/auth/otp/[action].js` | 낮음 | 발송/검증 계약 변경 위험 | 정책 분기와 응답 코드는 유지, 로그만 추가 |
| Tests/build | `package.json`, `npm run build` | 낮음 | 전용 OTP test 부재 | build + node syntax check + static branch review |
| Runtime/Vercel | Vercel Function Logs | 낮음 | 로그 과다/민감정보 노출 | 이벤트 수준 제한, info/warn/error 분리 |
| DB/Supabase | Not in scope | 없음 | 장기 축적 불가 | 2차 phase에서 `app_event_logs` 검토 |
| External SMS/Solapi | Not directly changed | 없음 | 실제 SMS 발송 테스트 필요 시 외부 발송 | 별도 승인 없이는 실제 발송 테스트 금지 |
| Docs | 이 PM 문서, 완료 시 `docs/COMPLETED` | 낮음 | 문서와 구현 불일치 | 완료 시 검증 결과와 커밋 해시 기록 |

## 4. Execution Policy
- Approval model:
  - 현재 문서는 실행 준비 문서다.
  - `승인: OTP 공통 로거와 오류 안내 UI Phase 1~3 실행` 같은 명시 승인이 있어야 코드 수정 가능.
  - DB/migration/외부 SMS 발송/배포는 이 승인에 포함되지 않는다.
- Phase transition rule:
  - Phase 1 공통 로거 → Phase 2 OTP 서버 적용 → Phase 3 프론트 안내 → Phase 4 검증/문서/커밋 순서.
- Review rule:
  - 구현자와 검수 판단을 분리한다.
  - 서브에이전트 또는 single-agent fallback 검수 패스를 별도 기록한다.
- Commit rule:
  - 검증과 리뷰 후 승인된 파일만 stage/commit한다.
  - unrelated dirty work는 포함하지 않는다.
- Rollback/compensation rule:
  - 모든 변경은 git diff로 작은 revert 가능해야 한다.
  - DB/env/external 상태를 바꾸지 않으므로 rollback은 코드 revert로 제한된다.
- Stop conditions:
  - 로그 저장을 위해 DB/migration이 필요해질 때.
  - secret/env 값 확인 또는 수정이 필요해질 때.
  - OTP 정책 변경이 필요해질 때.
  - 기존 API 응답 계약 변경이 필요해질 때.
  - 전화번호 원문/OTP 코드/secret이 로그에 들어갈 위험이 발견될 때.
  - 실제 SMS 발송 테스트가 필요해질 때.

## 5. Phase Map
| Phase | Purpose | Owner | State Change | Parallelizable | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | 최소 공통 서버 로거 추가 | Coder/Executor | Code | No | No, Phase 4에서 묶음 |
| 2 | OTP send 경로에 구조화 로그 적용 | Coder/Executor | Code | No | No, Phase 4에서 묶음 |
| 3 | 비회원 예약조회 오류 안내 UI 강화 | Coder/Executor | Code | After Phase 2 contract lock | No, Phase 4에서 묶음 |
| 4 | 검증, 리뷰, 문서 정리, 커밋 | Reviewer/Governor | Test + Docs + Commit | No | Yes |
| 5 | 후속 장기 로그 축적 검토 문서화 | Execution Governor | Docs only | Yes after Phase 4 | Optional, separate approval |

## 6. Parallel Work Lanes
| Lane | Can Run In Parallel With | Subagent Prompt | Inputs | Outputs | Merge Gate |
| --- | --- | --- | --- | --- | --- |
| Reviewer | Phase 1~3 diff 생성 후 | “OTP 공통 로거/오류 UI 변경 diff를 읽고 개인정보 원문/OTP code/secret 로그 노출 여부, 기존 OTP 응답 계약 유지 여부, 가입자 차단 UI 동작을 검수하라. 수정 금지.” | diff, `api/auth/otp/[action].js`, `server/logging/appLogger.js`, `src/pages/GuestBookingsPage.jsx` | PASS/FIX/STOP with evidence | Governor decision |
| Test Scout | Phase 1 전 또는 구현 중 | “현재 test/build harness를 확인하고 OTP 로거/UI 변경에 맞는 최소 검증 명령을 제안하라. 수정 금지.” | `package.json`, target files | command list + blocker | Before Phase 4 |
| Logging Policy Scout | Phase 1 전 | “현재 산발적 console 사용 패턴을 읽고 이번 phase에서 건드릴 범위와 후속 적용 후보를 구분하라. 수정 금지.” | `server`, `api`, `scripts` grep results | 후속 적용 후보 목록 | Do not expand current phase |

## 7. Phases

### Phase 1. Minimal Common Server Logger
Status: PLANNED

Purpose:
- 전체 command gate 없이 재사용 가능한 최소 공통 서버 로거를 만든다.

Scope:
- In:
  - `server/logging/appLogger.js` 추가.
  - JSON 한 줄 로그 출력.
  - `info`, `warn`, `error` helper 제공.
  - 민감정보 방지용 safe context builder 또는 필드 allowlist 제공.
- Out:
  - DB 저장.
  - 파일 저장.
  - 외부 로그 서비스 연동.
  - 기존 모든 console 사용 일괄 치환.

Files/Targets:
- `server/logging/appLogger.js`

Execution Steps:
1. `server/logging/` 디렉토리와 `appLogger.js`를 추가한다.
2. 로그 포맷을 고정한다: `timestamp`, `level`, `event`, `message`, `route`, `status`, `reason`, `requestId`, `phoneLast4`, `metadata`.
3. `phone`, `otp`, `secret`, `token`, `authorization`, `cookie` 같은 raw key는 출력하지 않도록 방어한다.
4. console backend는 유지하되, 출력은 JSON.stringify로 통일한다.

Verification:
- Static checks: 민감 key 필터 또는 allowlist 확인.
- Tests: `node --check server/logging/appLogger.js`
- Harness/smoke: 없음.
- Manual review: 로그 샘플에 PII가 없는지 확인.

Completion Evidence:
- Code/doc evidence: new logger diff.
- Test evidence: `node --check` output.
- Runtime/DB/external evidence: DB/external 없음.

Review Gate:
- Reviewer: Reviewer/Verifier.
- Required checks:
  - OTP code/phone 원문/secret 출력 불가.
  - existing console behavior와 충돌 없음.
- Failure handling:
  - 민감정보 노출 가능성이 있으면 STOP.

Completion Judgment:
- PASS criteria: 최소 로거가 독립적으로 동작하고 민감정보 방어가 있다.
- FAIL criteria: raw context를 그대로 출력하거나 secret/phone 원문이 들어갈 수 있다.

Commit Gate:
- Stage scope: Phase 4에서 OTP/UI 변경과 함께 stage.
- Commit message: `fix: add otp logging and error guidance`
- Commit only after: Phase 4 검증/리뷰 완료 및 사용자 커밋 승인 범위 확인.

Next Phase Entry Criteria:
- 로거 API가 확정됨.

Rollback/Compensation:
- `server/logging/appLogger.js` 삭제 revert.

### Phase 2. OTP Send Structured Logging
Status: PLANNED

Purpose:
- `/api/auth/otp/send` 주요 결과를 공통 로거로 구조화 기록한다.

Scope:
- In:
  - `api/auth/otp/[action].js`의 `handleOtpSend()`에만 적용.
  - 주요 이벤트:
    - `otp_send_invalid_purpose`
    - `otp_send_invalid_phone`
    - `otp_send_invalid_booking_context`
    - `otp_send_blocked_member_phone`
    - `otp_provider_unavailable`
    - `otp_lookup_failed`
    - `otp_cooldown`
    - `otp_send_failed`
    - `otp_save_failed`
    - `otp_send_success`
  - phone은 last4만 기록.
  - purpose, status, reason, route만 기록.
- Out:
  - `handleOtpVerify()` 전체 로깅 확장. 단, 꼭 필요한 에러만 소폭 추가 가능하나 범위 확장 시 보고.
  - phone_verifications schema 변경.
  - 실제 SMS 테스트.

Files/Targets:
- `api/auth/otp/[action].js`
- `server/auth/phoneOtp.js` only if `getPhoneLast4` reuse needs import already present.

Execution Steps:
1. `appLogger`를 import한다.
2. 응답 분기 직전에 event 로그를 추가한다.
3. success는 Solapi send + DB insert 성공 후에만 기록한다.
4. catch는 error message를 sanitized reason으로 제한한다.

Verification:
- Static checks:
  - `phone` 원문 로그 없음.
  - OTP `code` 로그 없음.
  - env/secret 로그 없음.
  - 기존 response status/message 유지.
- Tests:
  - `node --check api/auth/otp/[action].js`
- Harness/smoke:
  - 실제 SMS 없는 검증만 수행.
  - invalid phone API check는 가능: `curl -X POST ... {"phone":"123","purpose":"guest_lookup"}`는 SMS 발송 전 400이므로 외부 발송 없음.
- Manual review:
  - 가입자 차단 응답은 여전히 409.

Completion Evidence:
- Code/doc evidence: OTP API diff.
- Test evidence: syntax/static/curl safe output if run.
- Runtime/DB/external evidence: 실제 SMS 발송 없음.

Review Gate:
- Reviewer: Reviewer/Verifier.
- Required checks:
  - 기존 OTP 정책 유지.
  - 정상 차단/쿨다운/실패가 구분되는 로그 이벤트 존재.
  - PII/OTP 미노출.
- Failure handling:
  - 응답 계약 변경 또는 민감정보 노출 위험 시 STOP.

Completion Judgment:
- PASS criteria: OTP send 경로에 구조화 로그가 추가되고 동작 계약이 유지된다.
- FAIL criteria: SMS 발송 조건이 바뀌거나 개인정보가 로그에 남는다.

Commit Gate:
- Stage scope: Phase 4에서 함께 stage.
- Commit message: `fix: add otp logging and error guidance`
- Commit only after: Phase 4 검증/리뷰 완료.

Next Phase Entry Criteria:
- 서버 응답 error code가 프론트에서 활용 가능함을 확인.

Rollback/Compensation:
- `api/auth/otp/[action].js` diff revert.

### Phase 3. Guest Booking OTP Error UI Guidance
Status: PLANNED

Purpose:
- 비회원 예약조회 화면에서 인증번호 발송 실패 사유를 사용자에게 명확히 보여준다.

Scope:
- In:
  - `src/pages/GuestBookingsPage.jsx`에서 `/api/auth/otp/send` 응답의 `error` code를 보존한다.
  - `phone_already_registered`면 로그인 안내와 로그인 버튼을 노출한다.
  - `otp_cooldown`이면 재요청 대기 시간을 명확히 표시한다.
  - `otp_provider_unavailable`/`otp_send_failed`면 고객센터/잠시 후 재시도 안내를 명확히 표시한다.
  - 현재 auth/account 스타일 안에서 최소 UI만 보강한다.
- Out:
  - 페이지 전체 UI 리팩토링.
  - 예약목록/예약상세 UI 통합 작업.
  - 회원 로그인 정책 변경.

Files/Targets:
- `src/pages/GuestBookingsPage.jsx`
- CSS가 필요할 경우 `src/styles/account.css` 또는 기존 auth style 재사용. 새 CSS 추가는 최소화.

Execution Steps:
1. OTP send catch에서 `result.error`를 별도 state로 저장할 수 있게 한다.
2. 가입자 차단 상태일 때 안내 박스와 `/login?redirectTo=/reservations` 링크를 표시한다.
3. 일반 오류는 기존 메시지를 유지하되 시각적으로 더 명확히 한다.
4. inline style 증가는 피하고 기존 `small-note`, `field-note`, `btn` 계열을 우선 사용한다.

Verification:
- Static checks:
  - 기존 OTP 요청/검증/cancel flow 영향 없음.
  - 가입자 차단 UI가 로그인으로 유도.
- Tests:
  - `npm run build`
- Harness/smoke:
  - 실제 SMS 없는 invalid phone case 확인 가능.
  - 가입자 번호 테스트는 실 데이터/전화번호가 필요하므로 사용자 승인 없이는 실제 SMS/개인번호 테스트 금지.
- Manual review:
  - mobile layout에서 버튼/안내가 깨지지 않는지 코드 기준 확인.

Completion Evidence:
- Code/doc evidence: JSX/CSS diff.
- Test evidence: build output.
- Runtime/DB/external evidence: 외부 SMS 발송 없음.

Review Gate:
- Reviewer: Reviewer/Verifier.
- Required checks:
  - 회원 번호 차단이 “오류”가 아니라 로그인 안내로 보임.
  - 기존 비회원 정상번호 OTP 흐름은 유지.
  - CSS scope가 과도하게 넓지 않음.
- Failure handling:
  - 페이지 전체 리팩토링 필요가 드러나면 STOP 후 별도 UI PM으로 분리.

Completion Judgment:
- PASS criteria: 가입자 차단/쿨다운/발송실패 안내가 명확하고 build 통과.
- FAIL criteria: 정상 OTP 요청 버튼이 깨지거나 로그인/예약조회 경로가 혼동됨.

Commit Gate:
- Stage scope: Phase 4에서 함께 stage.
- Commit message: `fix: add otp logging and error guidance`
- Commit only after: Phase 4 검증/리뷰 완료.

Next Phase Entry Criteria:
- Phase 1~3 diff ready.

Rollback/Compensation:
- `src/pages/GuestBookingsPage.jsx` and optional CSS diff revert.

### Phase 4. Verification, Review, Docs, Commit
Status: PLANNED

Purpose:
- 전체 변경이 시급 범위 안에 있고 안전하게 동작하는지 검증한 뒤 커밋한다.

Scope:
- In:
  - syntax check.
  - `npm run build`.
  - git diff review.
  - PM 문서 상태/결과 업데이트.
  - 승인 범위에 포함될 경우 commit.
- Out:
  - deploy.
  - push.
  - 실제 SMS 발송.
  - DB/migration.

Files/Targets:
- `server/logging/appLogger.js`
- `api/auth/otp/[action].js`
- `src/pages/GuestBookingsPage.jsx`
- Optional: `src/styles/account.css`
- This PM doc.

Execution Steps:
1. `git diff --stat`와 target file diff를 확인한다.
2. `node --check server/logging/appLogger.js` 실행.
3. `node --check api/auth/otp/[action].js` 실행.
4. `npm run build` 실행.
5. 실제 SMS 없는 안전 API check가 필요하면 invalid phone만 사용한다.
6. reviewer 검수 또는 fallback 검수 패스를 기록한다.
7. PM 문서에 검증 결과를 업데이트한다.
8. 승인된 파일만 stage/commit한다.

Verification:
- Static checks:
  - 민감정보 로그 금지.
  - 기존 응답 status/message 유지.
  - UI 안내 scope 제한.
- Tests:
  - `node --check server/logging/appLogger.js`
  - `node --check api/auth/otp/[action].js`
  - `npm run build`
- Harness/smoke:
  - Optional safe curl invalid phone. No SMS.
- Manual review:
  - PASS/FIX/STOP 판정.

Completion Evidence:
- Code/doc evidence: final diff summary and PM doc update.
- Test evidence: command outputs.
- Runtime/DB/external evidence: SMS/DB/deploy not performed.

Review Gate:
- Reviewer: Reviewer/Verifier or single-agent fallback reviewer pass.
- Required checks:
  - No secret/PII/OTP in logs.
  - No DB/migration/env/deploy changes.
  - Build pass.
  - UI message matches policy.
- Failure handling:
  - Any failed verification => FIX_ONLY or STOP.

Completion Judgment:
- PASS criteria: all checks pass and no scope creep.
- FAIL criteria: build fails, sensitive data logs, or OTP behavior changes unexpectedly.

Commit Gate:
- Stage scope:
  - `server/logging/appLogger.js`
  - `api/auth/otp/[action].js`
  - `src/pages/GuestBookingsPage.jsx`
  - optional scoped CSS file if changed
  - this PM doc if updated with verification notes
- Must not stage:
  - `.env*`
  - `vercel.json`
  - `supabase/migrations/*`
  - unrelated reservation UI refactor files
  - generated `dist/` unless repository policy explicitly tracks it for this project
- Commit message: `fix: add otp logging and error guidance`
- Commit only after:
  - Phase 4 PASS and user approval covers commit, or `pa all` against this PM explicitly includes commit.

Next Phase Entry Criteria:
- None.

Rollback/Compensation:
- git revert commit if committed; otherwise restore target diffs.

### Phase 5. Follow-up Long-term Log Storage Decision
Status: PLANNED

Purpose:
- Vercel 로그만으로 부족할 경우 DB 기반 운영 로그 축적을 별도 작업으로 설계한다.

Scope:
- In:
  - 별도 PM 작성 여부 판단.
  - `app_event_logs` 같은 테이블 후보 검토.
  - 보존 기간/PII 정책/조회 UI 필요성 검토.
- Out:
  - 이번 PM에서 migration 작성/적용 안 함.
  - 운영 DB 쓰기 안 함.

Files/Targets:
- Future docs only unless separately approved.

Execution Steps:
1. Phase 4 완료 후 운영상 장기 로그가 필요한지 판단한다.
2. 필요하면 DB/migration 포함 PM을 새로 작성한다.

Verification:
- Static checks: Not in current execution.
- Tests: Not in current execution.
- Harness/smoke: Not in current execution.
- Manual review: user decision.

Completion Evidence:
- Code/doc evidence: follow-up decision note only.
- Test evidence: None.
- Runtime/DB/external evidence: None.

Review Gate:
- Reviewer: Execution Governor.
- Required checks: DB 작업 별도 승인 필요 여부 명확화.
- Failure handling: migration 필요 시 STOP and new PM.

Completion Judgment:
- PASS criteria: follow-up 필요 여부가 분리됨.
- FAIL criteria: 이번 PM에 DB 축적이 섞임.

Commit Gate:
- Stage scope: none by default.
- Commit message: separate only if follow-up doc created.
- Commit only after: separate approval.

Next Phase Entry Criteria:
- Separate user decision.

Rollback/Compensation:
- docs-only revert if created.

### Final Completion Report
- Completed phases: Phase 1 minimal common server logger, Phase 2 OTP send structured logging, Phase 3 guest booking OTP error UI guidance, Phase 4 verification/review/docs.
- Commits: To be filled after commit.
- Verification summary:
  - `node --check server/logging/appLogger.js` passed.
  - `node --check api/auth/otp/[action].js` passed.
  - Logger sanitizer sample check passed: raw phone, OTP, secret, token, api key were filtered; `phoneLast4` remained.
  - `npm run build` passed. Existing Vite CJS API deprecation warning appeared; build succeeded.
  - No DB/migration/env/deploy/push/real SMS test performed.
- Residual risks:
  - Vercel 로그는 장기 보관/조회성에 한계가 있다.
  - 실제 SMS 수신성은 Solapi 콘솔/통신사/로밍 상태까지 봐야 확정 가능하다.
- Follow-up work:
  - DB 기반 `app_event_logs` 운영 로그 축적 PM.
  - 예약 생성/취소, 결제, 관리자 변경, 외부 API 실패에 공통 로거 점진 적용.
  - 예약목록/예약상세 UI 통일 작업은 별도 UI PM으로 분리.
