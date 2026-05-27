# 2026-05-27 Homepage Renewal Phase 1 Preview

## 완료 범위

- `/color-preview`에서 검증한 새 메인 히어로/검색카드를 `/` 기본 홈 화면에 연결했다.
- 기존 상세 모드(`/cars/:carId`)는 `CarDetailSection` 그대로 유지했다.
- 기존 검색 결과(`SearchResultsSection`)는 그대로 유지했다.
- `/color-preview` 라우트는 테스트/비교용으로 유지했다.
- `/`는 입력 전용으로 바꾸고, 검색 결과 전용 `/search` 페이지를 신설했다.
- 홈 검색 완료 시 `/search?...`로 이동하게 정리했다.
- `/search` 상단에 검색 조건 요약과 `검색조건 다시 설정` 버튼을 추가했다.
- `검색조건 다시 설정` 클릭 시 랜딩으로 이동하지 않고 위치 → 날짜/시간 → 연령 다이얼로그가 순차로 열리도록 변경했다.
- 검색 입력 모달을 공용 컴포넌트로 분리해 홈과 검색페이지에서 재사용 가능하게 했다.
- 검색 결과 카드에서 옵션 줄나열을 제거하고, 한 화면에 더 많은 차량이 보이도록 카드 밀도를 개선했다.
- 위치와 일정이 완료되면 펄스가 `예약 가능 차량 검색` CTA로 이동하도록 보정했다.
- 운영 production 배포는 하지 않고 preview 확인 대상으로 준비했다.

## 변경 파일

- `src/components/ColorPreviewHero.jsx`
  - `ColorPreviewHero`와 관련 모달/날짜 선택 로직을 재사용 컴포넌트로 분리
  - 검색 완료 후 검색 결과 영역으로 자동 스크롤 처리
- `src/pages/ColorPreviewPage.jsx`
  - 분리된 `ColorPreviewHero`를 import해서 기존 `/color-preview` 유지
- `src/pages/LandingPage.jsx`
  - 비상세 홈 모드에서 `ColorPreviewHero` 사용
  - 홈은 입력 전용으로 유지
  - 상세 모드에서는 기존 `CarDetailSection` 유지
- `src/pages/SearchPage.jsx`
  - 검색 결과 전용 페이지 신설
- `src/components/SearchResultsSection.jsx`
  - 검색 조건 요약 / 정렬 / 결과 리스트 구조 정리
  - 검색조건 수정 다이얼로그 연결
- `src/components/SearchConditionEditor.jsx`
  - 검색조건 수정용 공용 편집 흐름 추가
- `src/components/SearchFlowModals.jsx`
  - 날짜/시간, 연령 모달과 캘린더 헬퍼 분리
- `src/components/CarCard.jsx`
  - 결과 카드 가독성 및 밀도 개선
- `src/App.jsx`
  - `/search` 라우트 추가
- `src/styles.css`
  - 검색 페이지 / 검색 요약 / 결과 카드 스타일 추가

## 유지한 동작

- 검색 쿼리 구조 유지
- 검색 결과 섹션은 `/search` 전용으로 이동
- 상세 페이지 라우트 유지
- detailToken 흐름은 변경하지 않음

## 검증

- `npm run build` 통과

## 남은 리스크 / 확인 필요

- preview URL에서 실제 모바일/PC 화면 확인 필요
- 상세 페이지는 아직 새 스타일로 완전히 통일하지 않았다. 다음 phase 대상이다.
- 실제 모바일 브라우저에서 카드 밀도, CTA 펄스, 검색조건 수정 다이얼로그 감각 확인이 필요하다.
