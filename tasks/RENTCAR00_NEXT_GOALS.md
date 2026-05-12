# RENTCAR00 next goals

## active
- 가격표 7일 / 15일 / 30일(월차) 기준 재정의
  - 상태: 현재 최우선 active 작업
  - 목표: `7일 / 15일 / 30일` 기준을 잠그고, 필요한 컬럼 추가와 계산식 검증 범위를 정리
  - 잠긴 원칙:
    1. 7일은 현재 `week_1_price` 기준을 우선 검토
    2. 15일은 더 이상 14일 흔적과 섞지 않고 별도 의미로 잠금
    3. 30일은 총액과 잔여일 계산 기준을 분리 검토
    4. source-of-truth 를 잠그기 전 UI만 먼저 바꾸지 않음
  - 다음 액션:
    1. `pricing_hub_rates` 기존 컬럼 의미 점검
    2. 15일/30일 계산용 누락 컬럼 확정
    3. IMS monthly source 식과 local pricing hub 식 비교
    4. 관리자 UI 저장 구조 변경 범위 잠금
  - 현재 기준 문서:
    - `docs/present/2026-05-12_RENTCAR00_PRICING_7D_15D_30D_CURRENT.md`
    - `docs/present/2026-05-01_RENTCAR00_PRICING_POLICY_V1_CURRENT.md`
    - `docs/present/2026-05-01_RENTCAR00_PRICING_HUB_MONTHLY_SOURCE_CURRENT.md`

- 토스페이먼츠 결제시스템 도입
  - 상태: 후속 검토 후보
  - 다음 액션: KCP 승인흐름 안정화 후 UX/계약/정산 재검토

- 카카오 쉬운연결
  - 상태: 다음 단기 작업 후보
  - 다음 액션: 기존 회원 귀속 정책과 병합 기준 먼저 정리

## note
- KCP 결제 분기 current 문서는 `docs/past/present-history/2026-05-12_RENTCAR00_KCP_PC_MOBILE_SPLIT_CURRENT_PAST.md` 로 이동했다.
- KCP phase1 기준 문서는 `docs/past/present-history/2026-05-11_RENTCAR00_KCP_PHASE1_CURRENT_PAST.md` 로 이동했다.
- 제품 운영 상태 기준은 active present 문서를 우선한다.
