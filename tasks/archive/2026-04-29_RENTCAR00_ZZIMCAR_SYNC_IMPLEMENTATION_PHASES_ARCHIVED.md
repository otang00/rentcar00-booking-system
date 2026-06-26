# RENTCAR00 Zzimcar Sync Implementation Phases

## Phase 1 — Mapping table
- [ ] migration 파일 확정
- [ ] 컬럼 확정
- [ ] unique/check/index 확정
- [ ] sync_status 값 확정

## Phase 2 — Zzimcar HTTP client
- [ ] login 구현
- [ ] vehicle search 구현
- [ ] disable_time list 구현
- [ ] disable_time create 구현
- [ ] disable_time delete 구현

## Phase 3 — Repository layer
- [ ] desired reservations query 구현
- [ ] active mapping read 구현
- [ ] active mapping upsert 구현
- [ ] deleted/failure 상태 update 구현

## Phase 4 — Reconcile engine
- [ ] add 구현
- [ ] delete 구현
- [ ] change 구현
- [ ] dry-run summary 구현
- [ ] save-run 상태 반영 구현

## Phase 5 — Attach preparation
- [ ] 찜카 실행기 단독 dry-run 확인
- [ ] attach input/output 계약 정리
- [ ] IMS 비수정 원칙 재확인

## Validation gates
- [ ] unit tests green
- [ ] dry-run summary 확인
- [ ] save-run 소규모 검증
- [ ] cancel/delete/change 복구 확인

## Top risks
- [ ] 차번 매칭 실패 방어 확인
- [ ] mapping 없는 delete 금지 확인
- [ ] partial failure 상태 복구 확인
- [ ] IMS 자산 비수정 유지 확인
