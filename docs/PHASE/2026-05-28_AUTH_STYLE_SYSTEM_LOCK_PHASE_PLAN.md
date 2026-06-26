# Auth Style System Lock Phase Plan

## 목적
로그인/회원가입 페이지를 기준으로 색상, 폰트, 간격, 카드, 입력창, 버튼, 체크박스 스타일을 변수와 공통 컴포넌트 스타일로 잠근다.

이번 작업의 핵심은 `로그인 입력 묶음처럼 보이는 카드 스타일`을 회원가입의 모든 카드에 동일하게 적용하는 것이다.

## 기준점

### 대상 화면
- `src/pages/LoginPage.jsx`
- `src/pages/SignupPage.jsx`

### 현재 확인한 구조
- 로그인은 `auth-card`, `auth-card-row`, `auth-input-label`, `auth-line-input`, `auth-submit-button` 기준으로 비교적 정리되어 있다.
- 회원가입은 같은 `auth-card`를 쓰기 시작했지만, 일부 입력은 `field-label`, `field-input`, `field-select`, `btn` 조합이 섞여 있다.
- `비밀번호`, `연락처 인증`, `주소`는 카드 라벨 역할의 `SectionTitle`을 사용한다.
- `이름/생년월일/이메일` 카드에는 아직 카드 라벨이 없다.
- 약관 체크박스는 기본 브라우저/기존 terms 스타일 영향으로 체크 시 색상이 튈 수 있다.
- 토큰 후보는 `src/styles/base.css`, `src/styles/foundation.css`, `src/styles/layout-v2.css`, `src/styles/components/auth-form.css`, `src/styles/pages/auth.css`, `src/styles/account.css`, `src/styles/legacy.css`에 흩어져 있다.

## 잠글 스타일 구조

### 1. base
파일 후보:
- `src/styles/base.css`
- `src/styles/foundation.css`

잠글 항목:
- `body`
- `font-family`
- 기본 글자색
- 배경색
- 색상 변수
- 기본 여백/박스 모델
- input/button/select 공통 font 상속

필수 토큰:
```css
--color-bg-page
--color-surface
--color-text-strong
--color-text-main
--color-text-muted
--color-border
--color-border-soft
--color-primary
--color-primary-hover
--color-primary-soft
--color-danger
--color-success
--font-family-base
--container-width
--space-page-y
--space-card-row-y
--space-card-row-x
--radius-card
--radius-button
--shadow-card
```

### 2. layout
파일 후보:
- `src/styles/layout.css`
- `src/styles/layout-v2.css`
- `src/styles/header.css`

잠글 항목:
- section
- container
- grid
- flex
- header/footer 구조
- auth 페이지 폭과 상하 간격

기준:
- 로그인/회원가입 auth container 폭은 동일하게 `420px` 기준.
- 모바일은 `calc(100% - 32px)` 기준.
- header/footer는 기존 화면 유지, 색상값만 토큰으로 교체.

### 3. components
파일 후보:
- `src/styles/components/auth-form.css`
- 필요 시 `src/styles/components/button.css`, `card.css`, `form.css` 신설 검토

잠글 항목:
- button
- card
- nav
- hero
- form

우선 적용 컴포넌트:
- `.auth-card`
- `.auth-card-row`
- `.auth-card-label-row`
- `.auth-section-label`
- `.auth-input-label`
- `.auth-line-input`
- `.auth-action-grid`
- `.auth-submit-button`
- `.auth-check-input`
- `.auth-terms-row`

## 화면별 수정 기준

### 로그인
- 현재 로그인 입력 묶음을 기준 스타일로 삼는다.
- 색상/간격/폰트는 하드코딩 대신 토큰으로 교체한다.
- 눈에 보이는 형태는 최대한 유지한다.

### 회원가입
- 이름/생년월일/이메일 카드 상단에 `회원정보` 라벨을 추가한다.
- `비밀번호`, `연락처 인증`, `주소`, `약관동의` 라벨은 같은 라벨 스타일로 맞춘다.
- 카드 라벨 글씨 크기는 현재보다 키우되, 제목처럼 과하게 튀지 않게 한다.
- 모든 회원가입 카드는 로그인 입력 묶음과 같은 border/radius/row/divider/입력 스타일을 쓴다.
- `field-input`, `field-label`이 남더라도 auth 영역 안에서는 `.auth-*` 토큰 스타일과 동일하게 보이게 한다.
- 약관 체크박스 체크 색상은 `--color-primary` 또는 지정된 auth 체크 색상으로 고정한다.

## Phase 목록

### Phase 1. 스타일 토큰 잠금
목적:
- 색상, 폰트, 간격, radius를 변수로 잠근다.

수정 대상:
- `src/styles/base.css`
- `src/styles/foundation.css`
- 필요 시 `src/styles.css` import 순서 확인

종료 조건:
- auth에서 사용할 색상/폰트/간격 변수가 정의된다.
- 기존 화면 색상 기준과 충돌하지 않는다.

검증:
- `npm run build`
- 로그인/회원가입 화면 육안 확인

되돌릴 방법:
- 추가한 토큰 블록 제거

### Phase 2. auth form 컴포넌트 잠금
목적:
- 로그인/회원가입 카드, 입력, 버튼, 체크박스 스타일을 공통화한다.

수정 대상:
- `src/styles/components/auth-form.css`
- `src/styles/pages/auth.css`
- 필요 시 `src/styles/account.css`의 auth 중복 규칙 축소

종료 조건:
- `auth-card` 기반 카드가 모두 같은 외형으로 보인다.
- `field-input`과 `auth-line-input`이 auth 페이지 안에서 같은 입력창으로 보인다.
- 체크박스 색상이 튀지 않는다.

검증:
- `npm run build`
- `/login`, `/signup` 화면 확인

되돌릴 방법:
- auth 관련 CSS 변경분 revert

### Phase 3. 회원가입 마크업 정리
목적:
- 회원가입 카드 라벨을 일관되게 만든다.

수정 대상:
- `src/pages/SignupPage.jsx`

구체 변경:
- 이름/생년월일/이메일 카드 첫 줄에 `회원정보` 라벨 추가
- 기존 `비밀번호`, `연락처 인증`, `주소` 라벨을 공통 라벨 컴포넌트/클래스로 통일
- 약관 카드에도 필요 시 `약관동의` 라벨 추가
- 버튼 포함 행은 로그인 카드 row 스타일에서 벗어나지 않게 유지

종료 조건:
- 회원가입의 모든 카드가 같은 라벨/row/입력 구조를 가진다.
- 별도 카드마다 다른 스타일을 만들지 않는다.

검증:
- `npm run build`
- 회원가입 입력/OTP/주소/약관 영역 화면 확인

되돌릴 방법:
- `SignupPage.jsx` 변경분 revert

### Phase 4. 중복/레거시 충돌 정리
목적:
- 같은 auth 스타일이 `account.css`, `pages/auth.css`, `components/auth-form.css`에 중복 선언되어 꼬이는 것을 줄인다.

수정 대상:
- `src/styles/account.css`
- `src/styles/pages/auth.css`
- `src/styles/components/auth-form.css`

종료 조건:
- auth 스타일의 기준 파일이 명확해진다.
- 남기는 파일 역할이 분리된다.
  - `components/auth-form.css`: 카드/입력/버튼/체크박스
  - `pages/auth.css`: auth 페이지 조합/타이틀/섹션 간격
  - `account.css`: 다른 계정/관리자 페이지 전용

검증:
- `npm run build`
- `/login`, `/signup`, `/guest-bookings` 최소 화면 확인

되돌릴 방법:
- CSS 변경분 revert

## 리스크
- `legacy.css`가 큰 파일이고 전역 스타일을 많이 갖고 있어 import 순서 충돌 가능성이 있다.
- `account.css`가 로그인/회원가입/비회원조회/관리자 화면을 함께 건드리고 있어 삭제형 정리는 위험하다.
- 체크박스는 상세/예약 약관 스타일과 공유될 수 있어 auth 범위 스코프로 제한해야 한다.
- 외형 통일 작업이 다른 예약 상세 폼까지 번지면 범위 초과다.

## 승인 전 금지
- 코드 수정 금지
- 배포 금지
- 설정/env/vercel/DB 수정 금지
- auth API/server 로직 수정 금지

## 승인 문구
아래 중 하나로 승인받은 phase만 실행한다.

- `Phase 1 실행`
- `Phase 1-2 실행`
- `Phase 1-3 실행`
- `전체 phase 실행`

승인 범위 밖 변경이 필요하면 즉시 중단하고 재승인받는다.
