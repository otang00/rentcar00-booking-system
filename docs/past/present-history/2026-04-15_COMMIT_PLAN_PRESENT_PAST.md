# COMMIT PLAN PRESENT

## 원칙
이번 변경은 한 커밋으로 뭉개지 말고 아래 3단으로 자른다.

## Commit 1. IMS worker baseline
### 범위
- `scripts/ims-sync/lib/ims-auth.js`
- `scripts/ims-sync/fetch-ims-reservations.js`
- `scripts/ims-sync/run-ims-reservation-sync.js`
- `package.json`
- `package-lock.json`

### 메시지
`feat: add IMS reservation sync worker baseline`

### 의미
- 브라우저 없는 IMS 로그인
- JWT 발급
- reservations fetch/page네이션
- 실행 entrypoint 확보

---

## Commit 2. Normalize and Supabase upsert
### 범위
- `scripts/ims-sync/lib/supabase-admin.js`
- `scripts/ims-sync/normalize-ims-reservation.js`
- `scripts/ims-sync/upsert-ims-reservations.js`

### 메시지
`feat: add IMS reservation normalization and supabase upsert`

### 의미
- raw row 생성
- normalize
- sync run / errors / reservations upsert 경로

---

## Commit 3. Schema and docs cleanup
### 범위
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260414213000_fix_reservations_upsert_unique.sql`
- `docs/README.md`
- `docs/present/CURRENT_STATE_PRESENT.md`
- `docs/present/DECISIONS_PRESENT.md`
- `docs/present/IMS_SYNC_PRESENT.md`
- `docs/present/COMMIT_PLAN_PRESENT.md`
- `docs/past/ims-sync/*`
- `docs/references/IMS_API_CALLS.md`

### 메시지
`docs(db): align IMS sync schema and reorganize present past docs`

### 의미
- schema 정합성 반영
- 현재 문서 / 과거 문서 분리
- 커밋 범위와 현재 기준 문서 고정

---

## 커밋 제외 후보
### 이번에 기본 제외
- `supabase/.temp/`
  - 로컬/CLI 임시 파일이라 커밋 비추천

### 확인 후 판단
- `supabase/migrations/20260414_create_cars.sql`
  - 의미 변경이 whitespace뿐이면 이번 커밋에서 제외 가능
- `docs/06_EXTERNAL_PREVIEW_DEPLOY_RUNBOOK.md`
  - 이번 IMS sync와 직접 무관하면 별도 커밋 또는 제외
- `package.json`, `package-lock.json` 안의 `pg`
  - 임시 보정용이면 제거 후 커밋
  - 유지할 거면 이유를 남기고 포함
