# rentcar00-booking-system

`rentcar00-booking-system`은 렌터카 검색/상세/예약 진입 흐름을
우리 서버와 DB 기준으로 재구성하는 예약 서비스 프로젝트다.

## 현재 기준 문서
문서는 아래 순서로 본다.

1. `docs/README.md`
2. `docs/policies/RENTCAR00_POLICY.md`
3. 필요 시 `docs/complete/2026-05-14_RENTCAR00_PRICING_HUB_ADMIN_COMPLETE.md`
4. 실행 중이면 `docs/present/2026-05-16_RENTCAR00_CURRENT.md`
5. `docs/references/IMS_API_CALLS.md`

### 최우선 운영 규칙
- 외부 SDK, 지도, 주소검색, 인증 위젯을 추가/변경할 때는 기능 코드보다 먼저 `vercel.json` 의 CSP와 보안 헤더를 같이 검토한다.
- 외부 서비스는 1차 로더 도메인만 보고 끝내지 말고 실제 하위 로딩 도메인, API 호출 도메인, iframe/popup 동작 경로까지 증거 기반으로 확인한다.
- CSP 검토 시 `script-src`, `connect-src`, `frame-src`, 필요 시 `img-src`, `style-src`, `font-src` 를 각각 분리 점검한다.
- popup 이 뜬다고 끝난 것이 아니다. popup, iframe, redirect, postMessage 중 실제 런타임 방식이 무엇인지 먼저 확인하고 그 방식에 맞는 CSP를 연다.
- 현재 정책/예약/회원/보안/API 기준 문서는 항상 `docs/policies/RENTCAR00_POLICY.md` 를 기준으로 본다.

### 외부 서비스 연동 공통 원칙
- 새 외부 서비스(Toss, Stripe, Kakao, 지도, 인증, 주소검색 등)를 붙일 때는 **코드 구현 전에 연동 방식 표를 먼저 잠근다.**
  - 로더 도메인
  - 실제 API 호출 도메인
  - iframe 사용 여부
  - popup 사용 여부
  - redirect/callback 경로
  - postMessage 사용 여부
- 위 표를 기준으로 `vercel.json` CSP를 먼저 설계하고, 기능 코드는 그 다음에 붙인다.
- 허용은 서비스 단위가 아니라 **동작 단위**로 연다. 예: 스크립트 로딩은 `script-src`, API 호출은 `connect-src`, iframe/popup 내부 문서는 `frame-src`.
- "버튼 클릭 시 창이 뜬다" 는 완료 기준이 아니다. **실제 외부 문서/결제창/주소검색 UI/인증 UI가 로드되고 콜백까지 왕복되는지** 확인해야 한다.
- 운영 반영 전 최소 체크리스트:
  1. 실제 하위 도메인까지 포함한 CSP 허용 목록 확정
  2. preview + prod 도메인 각각 검증
  3. Safari 포함 실제 브라우저 검증
  4. popup/iframe/redirect/postMessage 성공 여부 확인
  5. 콘솔 CSP violation 0건 확인

## 문서 정책
- active current 목록과 문서 역할은 `docs/README.md` 를 기준으로 유지한다.
- 정책 문서는 `docs/policies/` 에 suffix 없이 둔다.
- 구현 완료 문서는 `docs/complete/` 에 통합한다.
- 완료된 예전 current / 아이디어 / 스냅샷은 `docs/past/` 로 내린다.
- rename 관련 문서는 current 에 두지 않고 `docs/past/present-history/` 에 보관한다.
- 단계별 설계/실행 문서는 `docs/archive/spec-history/` 로 이동했다.
- 과거 작업 지시/빌드 규칙 문서는 `docs/archive/working-notes/` 로 이동했다.
- 더 오래된 외형 프로토타입 문서는 `docs/archive/legacy-ui-prototype/` 로 유지한다.
- IMS 관련 참고 자료는 `docs/references/IMS_API_CALLS.md` 에 둔다.

## 현재 구현 전략
- 프론트는 외부 partner/IMS를 직접 호출하지 않는다.
- 프론트는 내부 API만 호출한다.
- 검색과 상세는 우리 서버의 검증/계산 기준으로 동작한다.
- 상세는 검색 결과에서 발급된 `detailToken` 검증 통과 시에만 열린다.
- 향후 결제/IMS 예약 생성 단계로 확장 가능하게 설계한다.
