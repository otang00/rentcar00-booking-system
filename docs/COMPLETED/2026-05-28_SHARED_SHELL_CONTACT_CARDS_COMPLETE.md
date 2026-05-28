# 2026-05-28 Shared Shell / Contact Cards Complete

## 완료 범위
- 로그인 기준 공통 Header/Footer/이용안내카드를 전체 페이지 공통 구조로 정리했다.
- Header/Footer/ContactInfoStrip에서 page-specific 보조 클래스를 제거했다.
- header/footer/operation-card CSS는 `site-*`, `operation-card-*` 기준만 남겼다.
- auth/account/reservation 쪽의 `app-header`, `landing-contact-*` 공통 요소 override를 제거했다.

## 변경 파일
- `src/components/Layout.jsx`
- `src/components/ContactInfoStrip.jsx`
- `src/styles/header.css`
- `src/styles/layout-v2.css`
- `src/styles/components/operation-card.css`
- `src/styles/account.css`
- `src/styles/reservation.css`

## 핵심 변경
- Header: `site-header` 계열만 사용
- Footer: `site-footer` 계열만 사용
- 이용안내카드: `operation-card` 계열만 사용
- 제거한 의존:
  - `app-header*`
  - `footer-cafe24*`
  - `landing-contact-*`

## 검증
- `npm run build` 통과
- 핵심 컴포넌트/공통 CSS에서 제거 대상 클래스 미사용 확인

## 남은 리스크
- `legacy.css`에는 과거 선택자 문자열이 남아 있으나, 이번 공통 컴포넌트에서는 해당 클래스를 더 이상 사용하지 않는다.
- 랜딩/목록/상세 내부 콘텐츠(`color-preview-*`, `detail-*`) 정리는 다음 phase 범위다.
