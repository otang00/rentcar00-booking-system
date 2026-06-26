# IMS SYNC PRESENT

## 목적
이 문서는 `premove-clone`의 **현재 IMS 예약 동기화 기준점**만 빠르게 보게 하기 위한 present 문서다.

## 현재 상태
- IMS 로그인: **브라우저 없이 직접 로그인 가능**
- 인증 방식: `IMS_ID` + `IMS_PW` → `sha256(password)` → `POST /auth` → `JWT`
- 예약 조회: `GET /v2/company-car-schedules/reservations`
- worker entrypoint: `node scripts/ims-sync/run-ims-reservation-sync.js`
- package scripts:
  - `npm run ims:sync`
  - `npm run ims:sync:dry`
- 실검증 상태:
  - IMS fetch 성공
  - Supabase raw insert 성공
  - reservations upsert 성공
  - 최신 success run 확인 완료

## 현재 기준 파일
### 코드
- `scripts/ims-sync/lib/ims-auth.js`
- `scripts/ims-sync/lib/supabase-admin.js`
- `scripts/ims-sync/fetch-ims-reservations.js`
- `scripts/ims-sync/normalize-ims-reservation.js`
- `scripts/ims-sync/upsert-ims-reservations.js`
- `scripts/ims-sync/run-ims-reservation-sync.js`

### DB
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260414213000_fix_reservations_upsert_unique.sql`

### 참고
- `docs/present/DECISIONS_PRESENT.md`
- `docs/references/IMS_API_CALLS.md`
- `docs/past/ims-sync/*`

## 현재 운영 판단
- `reservations` 는 idempotent upsert 기준으로 동작한다.
- `ims_reservations_raw` 는 실행마다 누적 저장한다.
- 시간은 UTC 저장 기준으로 보이며 현재 샘플 검증상 이상은 없다.
- `overdue_return` status 매핑은 후속 보정 후보다.
- migration history 정리는 아직 남아 있다.

## 추천 커밋 범위
### Commit 1
- 범위: IMS login + fetch worker baseline
- 메시지: `feat: add IMS reservation sync worker baseline`

### Commit 2
- 범위: normalize + Supabase upsert path
- 메시지: `feat: add IMS reservation normalization and supabase upsert`

### Commit 3
- 범위: schema + docs present/past cleanup
- 메시지: `docs(db): align IMS sync schema and reorganize present past docs`

## 과거 문서 위치
IMS sync 검토/phase 잠금 문서는 모두 아래로 내린다.
- `docs/past/ims-sync/`
