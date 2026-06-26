# Admin Booking Contact Visibility PM

## Document Metadata
- Created at: 2026-06-25 14:34 KST
- Last updated at: 2026-06-25 14:55 KST
- Author/agent: rentcar00_reservation_developer
- Related milestone: 관리자 예약확인 연락처 전체표시 복구
- Related goal/spec docs:
  - `docs/present/2026-05-16_RENTCAR00_CURRENT.md`
  - `docs/policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`
  - `PROJECT_DOCUMENTATION_RULES.md`
  - `docs/archive/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM_ARCHIVED.md` 참고만 함. OPS birth format scope는 이번 PM에서 제외.
- Current status: Completed
- Approval scope: `pa all` 승인으로 Phase 1~4 코드 수정/검증/문서/커밋 진행. 배포 제외.
- Archive target: `docs/COMPLETED/ADMIN_BOOKING_CONTACT_VISIBILITY_PM_COMPLETE_<YYYYMMDD>.md`

## 0. Goal Lock
- Objective: 고객용 예약조회 마스킹은 유지하면서, 관리자 예약확인 화면과 운영자 예약확정 이메일에는 전화번호·생년월일 전체값이 보이도록 관리자/운영자 전용 경계만 보강한다.
- Final success condition:
  - 고객/비회원/회원 예약조회 응답은 기존처럼 `010-****-1234`, `1990****` 형태 마스킹 유지.
  - 관리자 예약확인 API `api/admin/bookings.js::handleConfirmTarget()`은 관리자 인증 통과 후 `customerPhone`, `customerBirth` 전체값을 반환.
  - `src/pages/AdminBookingConfirmPage.jsx`는 기존 필드 표시로 전체값을 표시하거나, 필요한 경우 표시 포맷만 최소 보강.
  - 운영자 예약확정 이메일은 `customerPhone/customerBirth` 인자가 없을 때도 raw DB값을 우선 fallback으로 사용.
  - DB/env/KCP/Vercel/배포 변경 없음.
- Explicit non-goals:
  - OPS parser 생년월일 `YYYY-MM-DD` 변환 작업 없음. 기존 archived PM의 OPS scope는 이번 실행에서 제외.
  - 공통 `serializeBookingOrder()` 기본 마스킹 해제 없음.
  - 고객용 `GuestBookingsPage`, `MemberReservationDetailPage`, `ReservationCompletePage` 전체값 노출 없음.
  - DB 스키마/migration/RPC 변경 없음.
  - production deploy 없음.
- Protected targets:
  - `.env*`, secret/token/password/credential/API key 파일.
  - Vercel env/runtime config/deploy config.
  - Supabase 운영 DB/migrations/RPC.
  - SMTP/SMS/KCP 설정.
- Approval required for:
  - 코드 수정.
  - 테스트/build 실행.
  - 커밋.
  - 프리뷰/프로덕션 배포.
  - protected target 작업은 별도 구체 승인 없으면 STOP.

## 1. Current State Evidence
- Repo status verified at 2026-06-25 14:33 KST:
  - Existing untracked docs:
    - `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md`
    - `docs/archive/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM_ARCHIVED.md`
  - These unrelated docs must not be staged unless explicitly approved.
- Existing implementation:
  - `server/booking-core/guestBookingUtils.js:212-220`
    - `maskPhone()` converts 11 digits to `010-****-1234`.
  - `server/booking-core/guestBookingUtils.js:222-226`
    - `maskBirth()` converts birth to `1990****` style.
  - `server/booking-core/guestBookingUtils.js:228-235`
    - `serializeBookingOrder()` returns `customerPhone: maskPhone(order.customer_phone)` and `customerBirth: maskBirth(order.customer_birth || order.pricing_snapshot?.customerBirth)`.
  - `server/booking-core/bookingConfirmationService.js:37-49`
    - `fetchBookingOrderByConfirmationToken()` returns both `rawBooking: data` and masked `booking: serializeBookingOrder(data)`.
  - `api/admin/bookings.js:521-535`
    - `handleConfirmTarget()` currently returns `{ booking: result.booking }`, so 관리자 확인 화면 also receives masked values.
  - `src/pages/AdminBookingConfirmPage.jsx:267-268`
    - Displays `booking.customerPhone` and `booking.customerBirth` exactly as API returns.
  - `server/email/bookingConfirmationEmail.js:75-77`
    - Email builder uses `customerPhone || booking.customerPhone || booking.customerPhoneLast4` and `customerBirth || booking.customerBirth`; fallback can be masked.
  - `api/payments/[action].js:288-292`
    - Normal payment approval path passes `bookingInput.customerPhone/customerBirth` to `sendBookingConfirmationEmail()`, so normal creation path likely has full values.
- Existing docs/specs:
  - `docs/present/2026-05-16_RENTCAR00_CURRENT.md` states operations payload/email context expects full customer contact values for operations use.
  - Archived PM exists but included OPS parser format work. This PM narrows scope to admin/email contact visibility only.
- Existing tests/harness:
  - `server/booking-core/__tests__/guestBookingUtils.test.js` for serializer/validation candidates.
  - `server/security/__tests__/bookingConfirmToken.test.js` for token helper candidates.
  - No confirmed dedicated `api/admin/bookings.js` test found during initial grep.
  - `npm run build` exists and includes frontend env check.
  - Practical verification candidates: targeted unit script/mock handler test, `node --test server/booking-core/__tests__/guestBookingUtils.test.js`, `npm run build`, targeted `rg`/diff review.
- Known conflicts or drift:
  - The same serialized booking object serves customer and admin contexts. Fix must not unmask customer contexts by changing common serializer globally.
  - Admin confirm route is under admin API auth wrapper; if auth assumption differs, STOP and re-plan.

## 2. Change Summary
| Item | Before | After | Why |
| --- | --- | --- | --- |
| Customer serializer | `serializeBookingOrder()` masks phone/birth | Keep masked | Customer privacy boundary 유지 |
| Admin confirm API | Returns masked `result.booking` | Return admin-only booking with raw `customer_phone/customer_birth` overlaid | 관리자 연락/확인 가능 |
| Admin UI | Displays returned fields | Keep or minimal display formatting only | API fix alone should solve display |
| Email fallback | May fall back to masked `booking.customerPhone/customerBirth` | Raw contact fallback contract added | 운영자 메일에 전체값 유지 |
| OPS parser | Archived PM included OPS birth format | Out of scope | 이번 문제와 분리 |

## 3. Impact Analysis
| Impact Area | Affected Modules/Docs | Schedule Impact | Risk | Mitigation |
| --- | --- | --- | --- | --- |
| Admin API | `api/admin/bookings.js` | Low | Customer path에 전체값 누출 | `handleConfirmTarget()` only admin-specific overlay |
| Shared booking service | `server/booking-core/bookingConfirmationService.js` | Low | Raw value helper를 잘못 공유하면 노출 확대 | Prefer local admin serializer/overlay or explicit admin helper only |
| Common serializer | `server/booking-core/guestBookingUtils.js` | Low | Global unmasking하면 개인정보 사고 | Default `serializeBookingOrder()` remains masked; tests verify |
| Admin UI | `src/pages/AdminBookingConfirmPage.jsx` | Low | Unnecessary UI churn | API response fix first; UI only if needed |
| Email | `server/email/bookingConfirmationEmail.js`, `server/email/sendBookingConfirmationEmail.js`, caller paths | Low | Email recipient misconfig can expose PII | Env/config untouched; document BOOKING_EMAIL_TO operational assumption |
| Customer UI/API | `api/guest-bookings`, `api/member/bookings`, customer pages | Low | 마스킹 회귀 | Test/static check `serializeBookingOrder()` default masked |
| DB/runtime/external | Supabase/Vercel/SMTP/SMS/KCP | None intended | Protected action required | STOP and request approval |
| Docs/commit | `docs/PHASE`, later `docs/COMPLETED` | Low | unrelated docs staged | Commit gate exact files only |

## 4. Execution Policy
- Approval model:
  - This PM is not execution approval.
  - Execute only after explicit phrase: `pa all ADMIN_CONTACT_VISIBILITY` or `Phase 1~4 실행 승인: 관리자 연락처 전체표시 범위`.
- Phase transition rule:
  - Evidence lock → implementation → verification/review → docs/commit.
- Review rule:
  - Coder/Executor and Reviewer/Verifier roles separated when possible.
  - Reviewer must confirm no customer-path unmasking.
- Commit rule:
  - No commit unless approval includes commit or user says `pa all` for this PM.
  - Do not stage unrelated untracked docs.
- Rollback/compensation rule:
  - Keep changes small. Revert target files only if verification fails.
- Stop conditions:
  - Fix requires changing auth model, env, DB, migrations, SMTP/SMS/KCP, or deploy config.
  - Admin route is not actually authenticated as assumed.
  - Customer path requires full contact exposure.
  - OPS parser scope becomes necessary.
  - Tests/build fail outside approved scope.

## 5. Phase Map
| Phase | Purpose | Owner | State Change | Parallelizable | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | Lock admin/customer/email contact boundaries | Execution Governor | No | Yes | No |
| 2 | Implement admin/email full-contact fix | Coder/Executor | Code edit | No | No until verified |
| 3 | Verify privacy boundary and build/tests | Reviewer/Verifier | Test/read only | After Phase 2 | No |
| 4 | Completion docs and commit | Execution Governor | Docs/commit | No | Yes if approved |

## 6. Parallel Work Lanes
| Lane | Can Run In Parallel With | Subagent Prompt | Inputs | Outputs | Merge Gate |
| --- | --- | --- | --- | --- | --- |
| Scope Verifier | Phase 1 | “READ-ONLY: verify admin booking confirm, serializer masking, admin UI display, and email fallback paths. Report exact paths/lines/snippets. No edits.” | `server`, `api`, `src`, `docs` | Evidence list | Phase 2 entry |
| Privacy Reviewer | After Phase 2 | “READ-ONLY: inspect diff. Confirm admin-only full phone/birth, customer serializer remains masked, email fallback safe, no protected target edits. Return PASS/FIX/STOP.” | git diff, target files | Review judgment | Governor decision |

## 7. Phases

### Phase 1. Boundary Evidence Lock
Status: COMPLETED

Purpose:
- Confirm exact admin/customer/email contact boundary before edits.

Scope:
- In:
  - `serializeBookingOrder()` masking behavior.
  - Admin confirm API response path.
  - Admin page display path.
  - Email fallback path.
  - Existing tests/build commands.
- Out:
  - Code edits.
  - DB/env/deploy work.
  - OPS parser.

Files/Targets:
- `server/booking-core/guestBookingUtils.js`
- `server/booking-core/bookingConfirmationService.js`
- `api/admin/bookings.js`
- `src/pages/AdminBookingConfirmPage.jsx`
- `server/email/bookingConfirmationEmail.js`
- `server/email/sendBookingConfirmationEmail.js`
- `api/payments/[action].js` read-only caller check

Execution Steps:
1. Run targeted `rg` for `serializeBookingOrder`, `customerPhone`, `customerBirth`, `handleConfirmTarget`, email builder.
2. Read exact target blocks.
3. Confirm admin route auth wrapper and raw row availability.
4. Confirm no existing dirty source files overlap.

Verification:
- Static checks: grep/read output.
- Tests: None.
- Harness/smoke: None.
- Manual review: path and scope lock.

Completion Evidence:
- Current State Evidence updated with exact paths/lines.

Review Gate:
- Required checks: customer masking and admin raw source are both verified.
- Failure handling: STOP and re-plan if raw source is unavailable or auth boundary is unclear.

Completion Judgment:
- PASS criteria: Phase 2 can be limited to admin/email boundary files.
- FAIL criteria: common serializer must be globally changed or admin auth uncertain.

Commit Gate:
- None.

Next Phase Entry Criteria:
- Explicit user execution approval.

Rollback/Compensation:
- None; read/doc-only.

### Phase 2. Admin/Email Full-Contact Implementation
Status: COMPLETED

Purpose:
- Provide full phone/birth only to administrator/operations paths.

Scope:
- In:
  - Add admin-only serialization/overlay for `handleConfirmTarget()` using `result.rawBooking.customer_phone` and `result.rawBooking.customer_birth`.
  - If needed, apply same admin-only full-contact response after admin booking change actions that return booking to the same page.
  - Add email fallback support so raw contact can be used before masked serialized fields.
  - Keep common serializer default masking.
- Out:
  - OPS parser changes.
  - Customer API/page full-contact exposure.
  - DB/env/deploy/config changes.

Files/Targets:
- Primary expected:
  - `api/admin/bookings.js`
  - `server/email/bookingConfirmationEmail.js`
- Possible if verification shows necessary:
  - `server/email/sendBookingConfirmationEmail.js`
  - `src/pages/AdminBookingConfirmPage.jsx` display formatting only
  - `server/booking-core/guestBookingUtils.js` tests/helper only; no default unmask

Execution Steps:
1. Implement local admin full-contact overlay, e.g. masked booking plus `customerPhone: raw.customer_phone`, `customerBirth: raw.customer_birth` for admin response.
2. Keep `serializeBookingOrder()` unchanged for customer/member/guest services.
3. Email builder: define raw fallback contract, e.g. `booking.customerPhoneRaw/customerBirthRaw` or explicit args. Do not prefer masked values when raw exists.
4. Avoid changing unrelated admin change/cancel/refund behavior unless the same page immediately consumes returned booking and needs full values.
5. Inspect diff for scope creep.

Verification:
- Static checks:
  - `rg -n "customerPhoneRaw|customerBirthRaw|serializeBookingOrder|customer_phone|customer_birth|handleConfirmTarget" api server src`
  - Confirm `serializeBookingOrder()` still masks by default.
- Tests:
  - Add or run smallest feasible test proving:
    - common serializer returns masked phone/birth;
    - admin confirm serialization returns full phone/birth;
    - email fallback prefers raw/full value.
- Harness/smoke:
  - No external email send, DB write, or deploy in this phase.
- Manual review:
  - Customer routes not modified to expose full values.

Completion Evidence:
- Target diff.
- Static grep output.
- Test/build output if approved.

Review Gate:
- Reviewer: Privacy Reviewer.
- Required checks:
  - Customer path masking unchanged.
  - Admin path full values only after admin route auth.
  - Email full value fallback does not require env/config edits.
- Failure handling:
  - FIX_ONLY if confined to target files.
  - STOP if auth/protected/DB scope expands.

Completion Judgment:
- PASS criteria: admin/email full-contact works; customer masking retained.
- FAIL criteria: common serializer unmasked globally or protected target needed.

Commit Gate:
- Stage only approved source files.
- Commit message candidate: `Show full booking contact details in admin confirmation`
- Commit only after Phase 3 PASS and approval/pa all.

Next Phase Entry Criteria:
- Phase 2 diff ready and no stop condition.

Rollback/Compensation:
- Revert target files from git if privacy verification fails.

### Phase 3. Privacy Boundary Verification
Status: COMPLETED

Purpose:
- Prove the change fixes admin visibility without customer PII regression.

Scope:
- In:
  - Static grep/diff review.
  - Targeted node tests or existing test files.
  - `npm run build` if approved and env permits.
- Out:
  - Live DB query/write.
  - Real email send.
  - Deployment.

Files/Targets:
- Changed files from Phase 2.
- Test files added/updated if any.

Execution Steps:
1. Run `git diff --check`.
2. Run targeted grep for contact fields.
3. Run relevant `node --test ...` commands.
4. Run `npm run build` if approved.
5. Reviewer issues PASS/FIX/STOP.

Verification:
- Static checks:
  - `git diff --check`
  - targeted `rg`
- Tests:
  - Expected: serializer/admin/email tests or closest feasible node tests.
- Harness/smoke:
  - None unless separately approved.
- Manual review:
  - Confirm no customer endpoint now returns raw phone/birth.

Completion Evidence:
- Command outputs.
- Reviewer judgment.

Review Gate:
- Reviewer: Reviewer/Verifier.
- Required checks: evidence from diff/test/logs.
- Failure handling: STOP on unclear privacy behavior.

Completion Judgment:
- PASS criteria: tests/build pass and reviewer PASS.
- FAIL criteria: privacy boundary unclear or broken.

Commit Gate:
- None in this phase.

Next Phase Entry Criteria:
- User approval for docs/commit if not included in execution approval.

Rollback/Compensation:
- Revert Phase 2 target files if fail cannot be fixed within scope.

### Phase 4. Completion Docs and Commit
Status: COMPLETED

Purpose:
- Archive completed PM and commit verified changes.

Scope:
- In:
  - Create completion doc under `docs/COMPLETED/`.
  - Commit approved changed source/docs only.
- Out:
  - Deploy/restart/DB/external writes.

Files/Targets:
- `docs/PHASE/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM.md`
- Completion doc: `docs/COMPLETED/ADMIN_BOOKING_CONTACT_VISIBILITY_PM_COMPLETE_20260625.md`
- Phase 2 changed source/test files only.

Execution Steps:
1. Update final completion report with verification results.
2. Move/copy PM to completed path and remove active PHASE copy if project convention requires.
3. Confirm `git status --short` and staged diff.
4. Commit with approved message.

Verification:
- Static checks: staged diff/status.
- Tests: Phase 3 evidence.
- Harness/smoke: Not in scope.
- Manual review: unrelated untracked docs not staged.

Completion Evidence:
- Completion doc path.
- Commit hash.

Review Gate:
- Required checks: stage scope exact.
- Failure handling: unstage unrelated files; STOP on ambiguity.

Completion Judgment:
- PASS criteria: docs/commit match verified scope.
- FAIL criteria: unrelated files included or verification incomplete.

Commit Gate:
- Stage scope:
  - approved source/test files.
  - this PM/completion docs.
- Do not stage:
  - `docs/PHASE/2026-06-19_RESERVATION_VERCEL_ANALYTICS_PHASE_PLAN.md`
  - `docs/archive/2026-06-25_ADMIN_BOOKING_CONTACT_VISIBILITY_PM_ARCHIVED.md` unless explicitly approved.
- Commit message:
  - `Show full booking contact details in admin confirmation`
- Commit only after:
  - Phase 3 PASS and explicit approval/pa all.

Next Phase Entry Criteria:
- None.

Rollback/Compensation:
- If committed incorrectly, do not rewrite history without approval; report and request revert/amend direction.

### Final Completion Report
- Completed phases: Pending.
- Commits: Pending.
- Verification summary: Pending.
- Residual risks:
  - Admin route exposes PII by design; depends on existing admin auth boundary.
  - Email full-contact display assumes `BOOKING_EMAIL_TO` is operations-only; env not inspected or changed in this PM.
- Follow-up work:
  - OPS parser birth-date normalization remains excluded. If needed, create a separate PM.


## 8. Final Completion Report
- Completed phases:
  - Phase 1: Boundary evidence lock completed.
  - Phase 2: Admin/email full-contact implementation completed.
  - Phase 3: Privacy boundary verification completed with reviewer PASS.
  - Phase 4: Completion documentation and commit completed.
- Changed source/test files:
  - `api/admin/bookings.js`
  - `server/email/bookingConfirmationEmail.js`
  - `server/booking-core/__tests__/guestBookingUtils.test.js`
  - `server/email/__tests__/bookingConfirmationEmail.test.js`
- Implementation summary:
  - Added admin-only `toAdminBookingDetail()` overlay so admin confirmation/change/cancel/refund responses keep full `customerPhone/customerBirth` from raw booking rows.
  - Kept `serializeBookingOrder()` default phone/birth masking unchanged for customer-facing paths.
  - Updated operations confirmation email fallback to prefer explicit full args, then raw fields, before masked serialized fields.
- Verification summary:
  - `git diff --check` passed.
  - Targeted contact-field grep reviewed.
  - `node --test server/booking-core/__tests__/guestBookingUtils.test.js server/email/__tests__/bookingConfirmationEmail.test.js` passed: 17/17.
  - `npm run build` passed.
  - Reviewer/Verifier result: PASS.
- Out of scope and not changed:
  - DB/env/KCP/Vercel/deploy/runtime config.
  - OPS parser birth-date format conversion.
  - Customer/member/guest APIs and pages.
- Residual risks:
  - Admin full contact exposure is intentional and depends on the existing admin auth boundary.
  - Email full-contact display assumes operations recipient configuration remains restricted; env/config was not inspected or changed.
- Commit:
  - Pending at document write time; final commit hash recorded in chat completion report.
