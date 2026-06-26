# ZZIMCAR SYNC STATUS POLICY - PHASE 3

## Purpose
찜카 예약불가 싱크에서 IMS 상태가 애매할 때는 예약 가능으로 열지 않고 보수적으로 막는다.

## Baseline
- Phase 1 commit: `12bd746` — 같은 찜카 disable time pid를 공유하는 active 매핑이 있으면 삭제하지 않는다.
- Phase 2 commit: `324086e` — DB active 매핑인데 찜카 실제 disable time이 없으면 재생성한다.
- 이번 Phase 3은 운영 정책을 테스트와 문서로 고정한다.

## Status Policy
- `using_car`는 `confirmed`로 정규화하며 차단 대상이다.
- 차단 대상 IMS status:
  - `pending`
  - `confirmed`
  - `paid`
- 차단 제외 IMS status:
  - `cancelled`
  - `completed`
  - `failed`
- IMS 목록에서 일시적으로 안 보이거나 `last_synced_at`이 오래된 것만으로는 차단을 해제하지 않는다.
- 애매한 경우에는 예약 가능으로 열기보다 찜카 차단을 유지한다.

## Operational Rule
- 삭제/해제는 IMS가 명확한 inactive status를 내려준 경우에만 진행한다.
- 찜카 실제 disable time이 사라진 경우에는 DB active 매핑을 기준으로 복구한다.
- 중복 IMS 예약이 같은 차량/겹친 기간을 가질 수 있으므로, 하나가 빠져도 남은 active 예약이 있으면 찜카 차단은 유지한다.

## Verification
- `scripts/zzimcar-sync/__tests__/fetch-desired-ims-reservations.test.js`
  - `using_car` → `confirmed` → active blocking status 확인
  - active/inactive status별 desired 판정 확인
  - 오래된 `last_synced_at`만으로 active future 예약을 해제하지 않음 확인
- Command: `npm run test:zzimcar-sync`
