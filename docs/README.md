# docs

문서는 아래 4개 축으로만 관리한다.

## 1. main skeleton
프로젝트의 메인 뼈대 문서다.
구조, 정책, 해석 순서를 잠그는 문서만 둔다.

대상:
- `../README.md`
- `policies/RENTCAR00_POLICY.md`
- `policies/RENTCAR00_PRICING_HUB.md`
- `policies/RENTCAR00_BOOKING_PAYMENT_INTEGRITY_V1.md`

원칙:
- 장기 기준은 여기만 남긴다.
- 실행 로그, 임시 phase, 완료 보고는 넣지 않는다.
- 새 세션이 먼저 읽어야 하는 기준만 유지한다.

## 2. complete
기능 구현이 끝난 상태를 남기는 문서다.
실행 중 문서 여러 개를 남기지 말고 완료되면 complete 1개 문서로 통합한다.

현재 complete:
- `complete/2026-05-14_RENTCAR00_AUTH_AND_GUEST_FLOW_COMPLETE.md`
- `complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md`
- `complete/2026-05-14_RENTCAR00_ROUTE_SPLITTING_COMPLETE.md`
- `complete/2026-05-16_RENTCAR00_KCP_PAYMENT_ATTEMPT_COMPLETE.md`

원칙:
- 구현 완료 범위
- 저장 truth
- 실제 반영 결과
- 남은 리스크 / 후속 후보
정도만 남긴다.
- 실행 준비 문서와 완료 문서를 따로 여러 개 늘리지 않는다.

## 3. current
현재 실행 중인 문서는 1개만 유지한다.
작업이 끝나면 complete 또는 past 로 이동한다.

현재 active current:
- `present/2026-05-16_RENTCAR00_CURRENT.md`

원칙:
- active current 는 한 번에 1개만 둔다.
- 새 current 를 만들기 전에 기존 current 에 합칠 수 있는지 먼저 본다.
- complete 로 올릴 수 있으면 current 에 오래 남기지 않는다.

## 4. past
아이디어, 스냅샷, 지나간 current, 과거 실행 기록은 전부 past / archive 로 내린다.

대상:
- `past/`
- `archive/`
- `references/`

원칙:
- 현재 기준에서 직접 안 쓰는 문서는 active 영역에 두지 않는다.
- 아이디어/스냅샷/중간메모는 current 나 policy 로 올리지 않는다.
- 과거 문서를 되살릴 때는 복사해서 새 current 를 만들지 말고 현재 문서에 필요한 판단만 옮긴다.

## 운영 규칙
- 문서는 먼저 기존 4축 안에 합칠 수 있는지 본다.
- 비슷한 역할 문서가 있으면 새로 만들지 말고 통합한다.
- `present` 문서가 2개 이상 생기면 정리 실패로 본다.
- pricing hub 같이 겹치기 쉬운 주제도
  - 정책은 `policies/`
  - 완료 상태는 `complete/`
  - 현재 실행은 `present/`
  - 옛 판단은 `past/`
  로만 나눈다.
