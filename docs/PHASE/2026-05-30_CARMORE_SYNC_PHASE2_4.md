# Carmore Holiday Sync Phase 2-4 — 2026-05-30

## 목적
IMS 예약 상태를 기준으로 카모아 차량 휴무일을 자동 생성/삭제/변경할 준비를 한다.

## 완료 범위
- Phase 2: 카모아 holiday sync mapping/run 테이블 migration 파일 작성
- Phase 3: 카모아 로그인/휴무 조회/생성/삭제 client 구현
- Phase 4: IMS desired 예약 -> 카모아 휴무 dry-run reconcile 구현

## 적용하지 않은 것
- Supabase migration 실제 적용 안 함
- 카모아 live save-run 안 함
- launchd 운영 연결 안 함

## 주요 파일
- `supabase/migrations/20260530003000_create_carmore_holiday_sync_tables.sql`
- `scripts/carmore-sync/lib/carmore-client.js`
- `scripts/carmore-sync/lib/carmore-holiday-date.js`
- `scripts/carmore-sync/lib/carmore-vehicle-mapping.js`
- `scripts/carmore-sync/lib/carmore-sync-mapping-repo.js`
- `scripts/carmore-sync/lib/carmore-sync-run-repo.js`
- `scripts/carmore-sync/lib/reconcile-carmore-holidays.js`
- `scripts/carmore-sync/run-carmore-reconcile-sync.js`

## 날짜 변환 정책 초안
- IMS `start_at`, `end_at`은 시간 단위다.
- 카모아 휴무는 현재 확인상 날짜 단위다.
- KST 날짜로 변환한다.
- `end_at`이 KST 00:00:00이면 종료일은 전날로 본다.
- 종료일이 시작일보다 앞서면 시작일로 보정한다.

## dry-run 결과
- 명령: `node scripts/carmore-sync/run-carmore-reconcile-sync.js`
- 결과: desired 52, actual 0, additions 52, deletions 0, changes 0, unchanged 0, errors 0
- 현재 DB에 `carmore_sync_runs` 테이블이 아직 없어 dry-run run 저장은 local fallback으로 처리된다.

## 검증
- `npm run test:carmore-sync`: 9 pass
- `npm run test:zzimcar-sync`: 32 pass

## 다음 단계
1. Supabase migration 적용 승인
2. 카모아 save-run 1건 실검증
3. add/delete/change 복구 검증
4. launchd 운영 연결 설계/승인
