# RENTCAR00 next goals

## active
- 프라이싱 허브 멀티채널 재정의
  - 상태: 현재 최우선 active 작업
  - 목표: **자사플랫폼 원장 가격표**를 기준으로 IMS / 찜카 / 메인홈페이지 가격을 채널별로 파생·관리·배포하는 허브로 재정의
  - 잠긴 원칙:
    1. 기준 가격표는 자사플랫폼 원장 가격표다.
    2. IMS / 찜카 / 메인홈페이지는 원장 가격표에서 파생되는 채널이다.
    3. 채널별 결과 가격은 서로 같을 필요가 없다.
    4. 운영 수정은 단일 값 직접 수정보다 주중/주말 %, 장기값, 구간 기준, 채널별 오프셋 조정 중심으로 간다.
    5. 원장 수정 / 채널 파생 / preview / publish 는 분리한다.
    6. 기존 홈페이지 전용 가격 수정 구조는 이번 기준에서 열외로 둔다.
  - 다음 액션:
    1. 원장 가격 테이블 기준 잠금
    2. 채널별 파생 구조 잠금
    3. IMS / 찜카 / 홈페이지 매핑 기준 잠금
    4. import / compare 단계 설계
    5. export / publish 단계 설계
    6. 운영 대시보드 정보구조 잠금
  - 현재 기준 문서:
    - `docs/present/2026-05-13_RENTCAR00_CURRENT.md`
    - `docs/present/2026-05-13_RENTCAR00_PRICING_HUB_CURRENT.md`

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
