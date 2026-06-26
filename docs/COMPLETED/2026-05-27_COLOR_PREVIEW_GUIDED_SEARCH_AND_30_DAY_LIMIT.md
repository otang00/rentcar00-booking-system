# 2026-05-27 Color Preview Guided Search and 30-Day Limit Complete

## 완료 범위

- `/color-preview` 예약 검색 플로우 UX 정리
  - 딜리버리 위치 선택 후 선택 완료 펄스 확인
  - 예약 일정 단계 펄스 확인
  - 날짜 모달 내 선택 가능한 날짜 펄스 확인
  - 월 이동 스와이프 지원 확인
  - 운전자 연령 모달은 `예약 가능 차량 검색` 버튼만 펄스 확인
- 달력 날짜 선택 순서 정리
  - 대여일 → 반납일 → 대여시간 → 반납시간
- 반납일 검색 한도 정리
  - 기존 오늘 기준 60일 → 오늘 기준 30일
  - 프론트 날짜 정규화와 서버 검색 검증 기준 모두 30일로 통일
- 메인 검색카드 안내 문구 정리
  - `반납일은 오늘 기준 30일 이내`

## 변경 파일

- `src/pages/ColorPreviewPage.jsx`
- `src/utils/reservationSchedule.js`
- `src/components/SearchBox.jsx`
- `server/search/searchState.js`

## 커밋

- `e889860 feat: refine guided pulse flow interactions`
- `0aa7c37 Fix calendar return date limits`
- `b534e26 Limit search return date to 30 days`

## 검증

- `npm run build` 통과
- Vercel production deploy 성공
- 운영 alias 확인: `https://rentcar00.com`
- 운영 JS에서 `반납일은 오늘 기준 30일 이내` 문자열 반영 확인

## 남은 리스크 / 확인 필요

- 실제 모바일 브라우저에서 캐시가 남아 있으면 강력 새로고침 또는 브라우저 캐시 만료 후 확인이 필요할 수 있다.
- `docs/present/2026-05-16_RENTCAR00_CURRENT.md`는 기존 미커밋 변경이 있어 이번 정리 범위에서 건드리지 않았다.

## 후속 후보

- `/color-preview`가 최종 메인으로 확정되면 `/` 라우트 전환 여부를 별도 phase로 잠근다.
