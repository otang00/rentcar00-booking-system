# 2026-05-27 Homepage Renewal Phase 1 Preview

## 완료 범위

- `/color-preview`에서 검증한 새 메인 히어로/검색카드를 `/` 기본 홈 화면에 연결했다.
- 기존 상세 모드(`/cars/:carId`)는 `CarDetailSection` 그대로 유지했다.
- 기존 검색 결과(`SearchResultsSection`)는 그대로 유지했다.
- `/color-preview` 라우트는 테스트/비교용으로 유지했다.
- 검색 완료 후 `#search-results` 영역으로 자동 스크롤되게 보정했다.
- 운영 production 배포는 하지 않고 preview 확인 대상으로 준비했다.

## 변경 파일

- `src/components/ColorPreviewHero.jsx`
  - `ColorPreviewHero`와 관련 모달/날짜 선택 로직을 재사용 컴포넌트로 분리
  - 검색 완료 후 검색 결과 영역으로 자동 스크롤 처리
- `src/pages/ColorPreviewPage.jsx`
  - 분리된 `ColorPreviewHero`를 import해서 기존 `/color-preview` 유지
- `src/pages/LandingPage.jsx`
  - 비상세 홈 모드에서 `ColorPreviewHero` 사용
  - 상세 모드에서는 기존 `CarDetailSection` 유지

## 유지한 동작

- 검색 쿼리 구조 유지
- 검색 결과 섹션 유지
- 상세 페이지 라우트 유지
- detailToken 흐름은 변경하지 않음

## 검증

- `npm run build` 통과

## 남은 리스크 / 확인 필요

- preview URL에서 실제 모바일/PC 화면 확인 필요
- 검색 결과 카드와 상세 페이지는 아직 새 스타일로 완전히 통일하지 않았다. 다음 phase 대상이다.
