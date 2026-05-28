# 2026-05-28 Auth Style System Lock Complete

## 완료 범위
- 로그인/회원가입 기준 색상, 폰트, 간격 토큰 잠금
- auth 카드/입력/버튼/체크박스 공통 스타일 잠금
- 회원가입 카드 라벨 통일
- `회원정보` 카드 라벨 추가
- 약관 체크 색상 `--color-primary` 기준 고정

## 변경 파일
- `src/styles/base.css`
- `src/styles/foundation.css`
- `src/styles/layout.css`
- `src/styles/header.css`
- `src/styles/components/auth-form.css`
- `src/styles/pages/auth.css`
- `src/pages/SignupPage.jsx`

## 핵심 변경
### base
- body/font/color/spacing 전역 변수 정의
- auth에서 쓰는 색상/간격/radius 토큰 고정

### layout
- section/container/grid/flex/footer 기본 구조 변수화
- header 버튼/경계/배경 색상 토큰화

### components
- `auth-card`, `auth-card-row`, `auth-card-label-row`
- `auth-line-input`, `field-input`, `field-select`
- `auth-submit-button`
- `auth-check-input`
- `auth-bottom-links`

### signup markup
- `회원정보` 라벨 추가
- `비밀번호`, `연락처 인증`, `주소`, `약관동의` 라벨 통일
- 체크박스 공통 클래스 적용

## 검증
- `npm run build` 통과

## 남은 리스크
- 실제 모바일 화면에서 라벨 크기와 줄간격은 육안 미세조정이 더 필요할 수 있다.
- `legacy.css` 전역 영향은 현재 build 기준 문제 없지만, 다른 페이지 실화면 확인은 추가로 보는 것이 안전하다.

## 문서 메모
- 실행 계획 문서는 `docs/PHASE/2026-05-28_AUTH_STYLE_SYSTEM_LOCK_PHASE_PLAN.md`
- 이번 완료 문서는 auth 스타일 잠금 작업의 결과 기록이다.
