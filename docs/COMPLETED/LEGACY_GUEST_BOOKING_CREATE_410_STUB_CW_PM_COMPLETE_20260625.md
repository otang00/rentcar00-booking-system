# Legacy Guest Booking Create 410-Stub Clean Wipe PM

## Document Metadata
- Created at: 2026-06-25 13:45 KST
- Last updated at: 2026-06-25 14:13 KST
- Author/agent: rentcar00_reservation_developer
- Related milestone: 결제 우회 예약확정 경로 제거
- Related goal/spec docs:
  - `docs/PHASE/2026-06-11_RENTCAR00_DOCH_STATE_EVENT_MAP.md`
  - `docs/present/2026-05-16_RENTCAR00_CURRENT.md`
  - `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
  - `PROJECT_DOCUMENTATION_RULES.md`
- Current status: Completed
- Approval scope: `pa all` 승인에 따라 Phase 1~4 실행, 검증, 리뷰, 문서 완료 정리, 커밋까지 수행.
- Archive target: `docs/COMPLETED/LEGACY_GUEST_BOOKING_CREATE_410_STUB_CW_PM_COMPLETE_<YYYYMMDD>.md`

## 0. Goal Lock
- Objective: legacy `/api/guest-bookings/create` 직접 예약 생성 경로의 죽은 코드를 제거하되, 운영 안전을 위해 route 자체는 410 stub으로 유지한다.
- Final success condition:
  - 고객 예약 생성 메인 루프는 `/api/payments/prepare` → KCP approve/return → `api/payments/[action].js::handlePaymentApproval()` → `server/booking-core/guestBookingService.js::createGuestBooking()`로 유지된다.
  - `api/guest-bookings/[action].js::handleCreate()`는 `POST` 외 405, `POST`는 410 `legacy_booking_create_disabled`만 반환한다.
  - `handleCreate()` 내부 410 이후 unreachable legacy 생성 코드는 삭제된다.
  - `src/services/guestBookingApi.js::createGuestBooking()` unused helper는 삭제된다.
  - 조회/완료조회/취소 helper와 API route는 유지된다.
- Explicit non-goals:
  - `action === 'create'` route 분기 삭제 없음. 구형 호출은 404가 아니라 410을 유지한다.
  - `server/booking-core/guestBookingService.js::createGuestBooking()` 삭제 없음.
  - `api/payments/[action].js` 결제 승인/생성 로직 변경 없음.
  - DB row/migration/RPC/env/Vercel/KCP 설정/deploy/restart 변경 없음.
- Protected targets:
  - `.env*`, secret/token/password/credential/API key 파일.
  - `vercel.json`, runtime config, launchd/cron/systemd.
  - Supabase 운영 DB/migrations/RPC, KCP 설정, 외부 서비스 실제 반영 대상.
- Approval required for:
  - Phase 2 코드 삭제/수정.
  - 테스트/build 실행.
  - 문서 완료 이동/커밋.
  - protected target 관련 작업은 별도 구체 승인 없으면 STOP.

## 1. Current State Evidence
- Repo status verified at 2026-06-25 14:05 KST:
  - Untracked docs already present:
    - `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md`
    - `docs/PHASE/2026-06-25_LEGACY_GUEST_BOOKING_CREATE_CW_PM.md`
    - `docs/archive/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM_ARCHIVED.md`
  - Execution/commit must not stage unrelated untracked files.
- Existing frontend implementation:
  - `src/components/CarDetailSection.jsx:21` imports only `prepareGuestBookingPayment` from `../services/guestBookingApi`.
  - `src/components/CarDetailSection.jsx:760` calls `prepareGuestBookingPayment(...)` for reservation confirmation.
  - `src/services/guestBookingApi.js:4-18` defines `createGuestBooking(payload, options)` that calls `/api/guest-bookings/create`.
  - `src/services/guestBookingApi.js:22-34` defines `prepareGuestBookingPayment(...)` that calls `/api/payments/prepare`.
- Existing API implementation:
  - `api/guest-bookings/[action].js:4` imports `createGuestBooking` from core service for legacy create path plus other live lookup/cancel helpers.
  - `api/guest-bookings/[action].js:163-173` `handleCreate()` already returns 405 for non-POST and 410 `legacy_booking_create_disabled` for POST.
  - `api/guest-bookings/[action].js:175+` still contains unreachable legacy direct booking creation code after the 410 return.
  - `api/guest-bookings/[action].js:610-612` still routes `action === 'create'` to `handleCreate(req, res)`.
- Payment main loop evidence:
  - `api/payments/[action].js:607` calls core `createGuestBooking(...)` after payment approval validation.
  - `server/booking-core/guestBookingService.js:307` defines core `createGuestBooking(...)`.
  - `server/booking-core/__tests__/guestBookingService.test.js` has existing tests for core `createGuestBooking` RPC behavior.
- Existing docs/specs:
  - `docs/PHASE/2026-06-11_RENTCAR00_DOCH_STATE_EVENT_MAP.md` documents booking creation through `createGuestBooking()` RPC after KCP payment flow.
  - `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md` treats `api/payments/[action].js::handlePaymentApproval()` and `guestBookingService.js::createGuestBooking()` as payment integrity path.
  - `memory/2026-05-16-2350.md` notes current `createGuestBooking()` uses RPC `create_booking_order_after_payment_v1`.
- Existing tests/harness:
  - Package scripts: `npm run build` exists; no global `npm test` script.
  - Relevant direct test file exists: `server/booking-core/__tests__/guestBookingService.test.js`.
  - Practical verification candidates: `npm run build`, `node --test server/booking-core/__tests__/guestBookingService.test.js`, targeted grep/static checks.
- Known conflicts or drift:
  - Older/current docs may mention route removal as an option. This PM locks the conservative decision: route deletion is out of scope; 410 stub is retained.

## 2. Change Summary
| Item | Before | After | Why |
| --- | --- | --- | --- |
| `/api/guest-bookings/create` route | `action === 'create'` calls `handleCreate()` | Same route remains | Hidden/old clients get explicit 410 instead of 404 |
| `handleCreate()` body | 405/410 return followed by unreachable legacy booking creation code | 405/410-only stub | Delete dead code without live behavior change |
| Frontend `createGuestBooking()` helper | Unused helper calls `/api/guest-bookings/create` | Helper removed | Remove dead client path |
| `prepareGuestBookingPayment()` | Calls `/api/payments/prepare` | Unchanged | Current reservation entrypoint |
| Core `createGuestBooking()` | Used by payment approval main loop | Unchanged | Required for KCP-approved booking creation |
| Docs | Earlier PM allowed route removal option | Route removal explicitly out of scope | Lock safer execution boundary |

## 3. Impact Analysis
| Impact Area | Affected Modules/Docs | Schedule Impact | Risk | Mitigation |
| --- | --- | --- | --- | --- |
| Guest create route | `api/guest-bookings/[action].js` | Low | Accidentally changing 410 to 404/200 | Keep route branch and 410 stub; verify with grep/review |
| Payment main loop | `api/payments/[action].js`, `server/booking-core/guestBookingService.js` | Low | Wrongly deleting core service/import used by payments | Core service and payments file out of edit scope |
| Frontend API helper | `src/services/guestBookingApi.js` | Low | Removing a referenced export | Run `rg "createGuestBooking" src api server`; build if approved |
| Lookup/cancel flows | `src/services/guestBookingApi.js`, `api/guest-bookings/[action].js` | Low | Nearby helper/API accidental damage | Edit only create helper and create handler body; review diff |
| Tests/build | package scripts, node test file | Low | Verification may need env for build | If env check blocks build, report exact blocker; do not edit env |
| DB/runtime/external | Supabase/KCP/Vercel | None intended | Protected target accidentally needed | STOP and request separate approval |
| Docs/commit | `docs/PHASE`, later `docs/COMPLETED` | Low | Staging unrelated untracked docs | Commit gate lists exact files only |

## 4. Execution Policy
- Approval model:
  - This PM document is not code execution approval.
  - Execute only after explicit phrase: `Phase 2 실행 승인: 410 stub 유지 범위로 진행`.
  - Tests/build and commit also require explicit approval unless included in the same phrase.
- Phase transition rule:
  - Phase 1 evidence lock → Phase 2 code cleanup → Phase 3 verification/review → Phase 4 docs/commit.
  - Each phase stops on unexpected structure or scope conflict.
- Review rule:
  - Coder/Executor must not self-declare final PASS.
  - Reviewer/Verifier checks diff/static/test evidence before Governor final decision.
- Commit rule:
  - No commit without explicit commit approval.
  - Do not stage unrelated untracked docs.
- Rollback/compensation rule:
  - Keep diff small. Rollback by reverting only `src/services/guestBookingApi.js` and `api/guest-bookings/[action].js` changes.
- Stop conditions:
  - Any live reference to frontend `createGuestBooking()` appears outside the helper definition.
  - `api/payments/[action].js` or core `guestBookingService.js` would need modification.
  - Protected target, DB, migration, env, deploy, restart, or external write becomes necessary.
  - Build/test failure points outside approved cleanup scope.

## 5. Phase Map
| Phase | Purpose | Owner | State Change | Parallelizable | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | Lock evidence and exact file scope | Execution Governor | No | Yes | No |
| 2 | Remove dead helper and unreachable legacy body while keeping 410 route | Coder/Executor | Code edit/delete | No | No until approved |
| 3 | Verify static refs, build/test where approved, and review diff | Reviewer/Verifier | Test/read only | After Phase 2 | No |
| 4 | Completion docs and commit | Execution Governor | Docs/commit | No | Yes only if approved |

## 6. Parallel Work Lanes
| Lane | Can Run In Parallel With | Subagent Prompt | Inputs | Outputs | Merge Gate |
| --- | --- | --- | --- | --- | --- |
| Scope Verifier | Phase 1 | “READ-ONLY: verify exact references for `/api/guest-bookings/create`, `createGuestBooking`, `handleCreate`, `/api/payments/prepare`. Report paths/lines/snippets only. No edits.” | `src`, `api`, `server`, `docs` | Evidence list and risk notes | Governor confirms Phase 2 scope |
| Diff Reviewer | After Phase 2 | “READ-ONLY: inspect cleanup diff. Confirm 410 route remains, unreachable legacy body removed, payment core create path untouched, lookup/cancel unaffected. Return PASS/FIX/STOP.” | git diff, target files | Review judgment | Governor decision before completion |

## 7. Phases

### Phase 1. Evidence and Boundary Lock
Status: PLANNED

Purpose:
- Confirm the exact current state before any edit.

Scope:
- In:
  - Search `/api/guest-bookings/create`, `createGuestBooking`, `handleCreate`, `/api/payments/prepare`.
  - Confirm route deletion is out of scope and 410 stub remains.
  - Confirm unrelated dirty/untracked files.
- Out:
  - Code edits, deletes, tests that change state, commits.

Files/Targets:
- `src/services/guestBookingApi.js`
- `src/components/CarDetailSection.jsx`
- `api/guest-bookings/[action].js`
- `api/payments/[action].js`
- `server/booking-core/guestBookingService.js`
- `server/booking-core/__tests__/guestBookingService.test.js`

Execution Steps:
1. Run `git status --short`.
2. Run targeted `rg` for relevant route/function names.
3. Read exact target code blocks.
4. Update PM doc if current code contradicts it.

Verification:
- Static checks: grep/read output recorded in this document.
- Tests: None.
- Harness/smoke: None.
- Manual review: confirm Phase 2 only touches two code files.

Completion Evidence:
- Current State Evidence section populated with exact paths/lines.

Review Gate:
- Reviewer: Execution Governor.
- Required checks: no path uncertainty, no code edit yet.
- Failure handling: report conflict and do not proceed.

Completion Judgment:
- PASS criteria: file scope locked to `src/services/guestBookingApi.js` and `api/guest-bookings/[action].js`.
- FAIL criteria: hidden live create usage found.

Commit Gate:
- None.

Next Phase Entry Criteria:
- Explicit user approval for Phase 2.

Rollback/Compensation:
- None; read/doc-only phase.

### Phase 2. 410-Stub Clean Wipe Implementation
Status: PLANNED

Purpose:
- Delete dead direct-create code without changing live reservation behavior.

Scope:
- In:
  - Delete `src/services/guestBookingApi.js::createGuestBooking()` export only.
  - Keep `prepareGuestBookingPayment`, `lookupGuestBooking`, `fetchCompletedGuestBooking`, `cancelGuestBooking`.
  - In `api/guest-bookings/[action].js`, keep `handleCreate()` 405/410 stub.
  - Delete all unreachable code below the 410 return inside `handleCreate()`.
  - Remove imports that become unused only because legacy create body was deleted.
- Out:
  - Do not delete `action === 'create'` route branch.
  - Do not edit `api/payments/[action].js`.
  - Do not edit/delete `server/booking-core/guestBookingService.js::createGuestBooking()`.
  - Do not alter DB/RPC/env/KCP/Vercel/deploy settings.

Files/Targets:
- `src/services/guestBookingApi.js`
- `api/guest-bookings/[action].js`

Execution Steps:
1. Remove `createGuestBooking(payload, options = {})` block from `src/services/guestBookingApi.js`.
2. Remove legacy direct booking logic after 410 return from `handleCreate()`.
3. Remove now-unused imports/functions only if they are used exclusively by deleted legacy body.
4. Preserve `if (action === 'create') return handleCreate(req, res)`.
5. Inspect diff for accidental changes.

Verification:
- Static checks:
  - `rg -n "/api/guest-bookings/create|createGuestBooking\(|function handleCreate|legacy_booking_create_disabled|action === 'create'" src api server`
  - Expected after cleanup:
    - no frontend `/api/guest-bookings/create` helper;
    - `handleCreate` and `legacy_booking_create_disabled` still present;
    - `action === 'create'` still present;
    - core `createGuestBooking(` still present in payment/core/test contexts.
- Tests:
  - If approved, `node --test server/booking-core/__tests__/guestBookingService.test.js`.
  - If approved and env allows, `npm run build`.
- Harness/smoke:
  - No runtime/deploy smoke in this phase.
- Manual review:
  - Confirm lookup/cancel/completion routes unchanged.

Completion Evidence:
- `git diff -- src/services/guestBookingApi.js api/guest-bookings/[action].js`.
- Static grep output.
- Test/build output if approved.

Review Gate:
- Reviewer: Diff Reviewer or single-agent fallback reviewer pass.
- Required checks:
  - 410 route remains.
  - Unreachable legacy booking creation body removed.
  - Payment main loop untouched.
  - Core service untouched.
  - Lookup/cancel/completion paths untouched.
- Failure handling:
  - If scope drift occurs, stop and revert/fix-only within approved files.

Completion Judgment:
- PASS criteria: only approved dead code removed; live behavior remains 410 for legacy route and payment path remains intact.
- FAIL criteria: route removed, payment/core modified, lookup/cancel damaged, or hidden frontend reference exists.

Commit Gate:
- Stage scope if commit approved:
  - `src/services/guestBookingApi.js`
  - `api/guest-bookings/[action].js`
- Do not stage:
  - unrelated untracked docs
  - env/config/migration/deploy files
- Commit message:
  - `Remove legacy guest booking direct-create dead code`
- Commit only after:
  - Phase 3 verification and user commit approval.

Next Phase Entry Criteria:
- Phase 2 diff ready and no stop condition.

Rollback/Compensation:
- Revert the two target files from git if verification fails beyond fix-only scope.

### Phase 3. Verification and Review
Status: PLANNED

Purpose:
- Verify cleanup did not alter the live payment reservation path or guest lookup/cancel flows.

Scope:
- In:
  - Static grep.
  - Diff review.
  - Existing core booking test if approved.
  - Build if approved and env permits.
- Out:
  - New feature work.
  - Protected target edits.
  - DB/runtime/deploy verification.

Files/Targets:
- `src/services/guestBookingApi.js`
- `api/guest-bookings/[action].js`
- `api/payments/[action].js` read-only confirmation
- `server/booking-core/guestBookingService.js` read-only confirmation
- `server/booking-core/__tests__/guestBookingService.test.js` test-only if approved

Execution Steps:
1. Run static grep and confirm expected reference pattern.
2. Read diff for target files only.
3. Run approved test/build commands.
4. Record any blocker exactly; do not edit env/config to make build pass.

Verification:
- Static checks:
  - `git diff --check`
  - targeted `rg` command above.
- Tests:
  - `node --test server/booking-core/__tests__/guestBookingService.test.js` if approved.
  - `npm run build` if approved.
- Harness/smoke:
  - None unless separately approved.
- Manual review:
  - PASS/FIX/STOP judgment.

Completion Evidence:
- Static output.
- Test/build output or explicit blocker.
- Reviewer judgment.

Review Gate:
- Reviewer: Reviewer/Verifier.
- Required checks:
  - Evidence is from actual diff/logs, not assumptions.
- Failure handling:
  - FIX_ONLY if confined to approved files.
  - STOP if env/protected/runtime or wider scope is needed.

Completion Judgment:
- PASS criteria: static/diff checks pass and approved tests/build either pass or have documented non-scope blocker.
- FAIL criteria: payment path affected, route no longer 410, or helper reference remains unexpectedly.

Commit Gate:
- None in this phase.

Next Phase Entry Criteria:
- User approval for docs/commit or explicit no-commit final report.

Rollback/Compensation:
- Revert Phase 2 target files if review fails and fix-only is not sufficient.

### Phase 4. Completion Docs and Commit
Status: PLANNED

Purpose:
- Align docs with implemented cleanup and create a clean commit if approved.

Scope:
- In:
  - Update this PM status or create completion report under `docs/COMPLETED/` if code work is verified.
  - Commit only approved files.
- Out:
  - Deploy/restart/DB/external writes.
  - Staging unrelated untracked docs.

Files/Targets:
- `docs/PHASE/2026-06-25_LEGACY_GUEST_BOOKING_CREATE_CW_PM.md`
- Potential completion doc: `docs/COMPLETED/LEGACY_GUEST_BOOKING_CREATE_410_STUB_CW_PM_COMPLETE_20260625.md`
- Code files from Phase 2 only if commit approved.

Execution Steps:
1. Summarize verified changes and residual risks.
2. If completion archive approved, move/copy completion doc according to project documentation rules.
3. Run `git status --short` and confirm stage scope.
4. Commit with approved message if user approved commit.

Verification:
- Static checks: `git status --short`, staged diff inspection.
- Tests: rely on Phase 3 outputs.
- Harness/smoke: Not in scope.
- Manual review: confirm unrelated files not staged.

Completion Evidence:
- Completion doc path if created.
- Commit hash if committed.
- Verification summary.

Review Gate:
- Reviewer: Execution Governor.
- Required checks: stage only approved files.
- Failure handling: unstage unrelated files; STOP on ambiguity.

Completion Judgment:
- PASS criteria: docs/commit reflect verified cleanup only.
- FAIL criteria: unrelated files included or verification incomplete.

Commit Gate:
- Stage scope:
  - Phase 2 target code files.
  - PM/completion docs only if approved.
- Commit message:
  - `Remove legacy guest booking direct-create dead code`
- Commit only after:
  - Phase 3 PASS and explicit commit approval.

Next Phase Entry Criteria:
- None.

Rollback/Compensation:
- If committed incorrectly, do not rewrite history without approval; report and request revert/cherry-pick direction.

### Final Completion Report
- Completed phases:
  - Phase 1 evidence and boundary lock completed.
  - Phase 2 410-stub clean wipe implementation completed.
  - Phase 3 verification and reviewer PASS completed.
  - Phase 4 completion document archival and commit gate completed.
- Commits: Pending at document update time; record final hash in user-facing report after commit.
- Verification summary:
  - `git diff --check`: passed.
  - targeted `rg`: no frontend `/api/guest-bookings/create` helper remains; `handleCreate`, `legacy_booking_create_disabled`, and `action === 'create'` remain; payment/core/test `createGuestBooking()` references remain.
  - `node --test server/booking-core/__tests__/guestBookingService.test.js`: passed 11/11.
  - `npm run build`: passed.
  - Reviewer/Verifier: PASS.
- Residual risks:
  - Unknown external clients may still call `/api/guest-bookings/create`; 410 stub intentionally preserves explicit shutdown response.
  - Static grep cannot prove absence of non-repo clients.
- Follow-up work:
  - If 410 hits are observed in logs later, decide whether to keep telemetry or eventually remove route in a separate PM.
