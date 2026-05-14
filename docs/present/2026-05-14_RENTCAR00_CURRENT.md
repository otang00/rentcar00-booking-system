# 2026-05-14 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: 전체 페이지 초기 로드 부담을 줄이기 위해 route-level code splitting 과 admin 분리를 현재 우선 작업으로 잠근다.

## 현재 active 범위
현재 active 범위는 **페이지 분리 / lazy loading / admin 번들 분리** 다.

### 우선순위 변경 메모
- 기존 비밀번호 재설정 + 로그인 보호 current 초안은 아래 parked 문서로 이동했다.
- `docs/past/present-history/2026-05-14_RENTCAR00_AUTH_HARDENING_PARKED.md`

### 지금 바로 다룰 것
1. 현재 라우트 로딩 구조 확인
2. 초기 번들에 같이 묶이는 페이지 범위 확인
3. admin 페이지 분리
4. auth/guest/member 페이지 lazy loading 적용 범위 확정

## 현재 기준
- 장기 구조 기준은 `docs/policies/RENTCAR00_POLICY.md`
- 프로젝트 구조 기준은 `PROJECT_RENTCAR00_BOOKING_SYSTEM.md`
- 방금 완료된 인증/비회원 흐름 기준은 `docs/complete/2026-05-14_RENTCAR00_AUTH_AND_GUEST_FLOW_COMPLETE.md`

## 현재 문제
### 1. 초기 로드 번들 부담
- 최근 build 에서 500kB 초과 chunk warning 이 계속 보였다.
- 현재 구조는 초기 진입과 무관한 페이지까지 함께 묶일 가능성이 있다.

### 2. admin 화면의 불필요한 동반 로드
- admin 페이지는 일반 고객 흐름과 사용자가 완전히 다르다.
- 따라서 일반 사용자 초기 로드에 admin 관련 코드가 섞이면 낭비가 크다.

### 3. 저빈도 페이지의 상시 포함 가능성
- 로그인 / 회원가입 / 비밀번호 재설정 / 비회원 예약조회 / 회원 예약내역 / admin 은 메인 검색보다 진입 빈도가 낮다.
- 이런 페이지는 route 단위로 분리하는 편이 맞다.

## 방향 잠금
### 핵심 방향
- `App.jsx` 라우트 기준으로 page-level lazy loading 을 적용한다.
- 최소 1차 범위는 admin / auth / guest/member reservation 페이지를 분리한다.
- 메인 검색과 상세 흐름은 UX 영향을 보고 유지 또는 2차 분리 대상으로 본다.

### 1차 분리 대상
- `AdminPricingHubPage.jsx`
- `AdminBookingsPage.jsx`
- `AdminBookingConfirmPage.jsx`
- `LoginPage.jsx`
- `SignupPage.jsx`
- `ForgotPasswordPage.jsx`
- `ResetPasswordPage.jsx`
- `GuestBookingsPage.jsx`
- `MemberReservationsPage.jsx`
- `MemberReservationDetailPage.jsx`

### 2차 검토 대상
- `ReservationCompletePage.jsx`
- `LegalPage.jsx`
- `PostcodeTestPage.jsx`
- 필요 시 `CarsPage.jsx` 와 `CarDetail` 계열 내부 분리

## 목표 UX
1. 메인 진입 시 필요한 최소 번들만 먼저 로드
2. 특정 페이지 이동 시 해당 route chunk 만 추가 로드
3. admin 진입은 admin chunk 만 별도 로드
4. 로딩 중에는 가벼운 fallback UI 표시
5. 기존 URL 구조와 라우팅 동작은 유지

## 정책 잠금
### 코드 분리 정책
- 분리 기준은 page route 단위 우선이다.
- component 내부를 과하게 잘게 쪼개기보다, 먼저 page route 를 나눈다.
- 기존 기능/권한/URL 구조는 바꾸지 않는다.

### admin 분리 정책
- admin 관련 페이지는 일반 사용자 주요 번들에서 우선 분리한다.
- admin 공통 컴포넌트가 있다면 2차에서 묶음 최적화를 검토한다.

### fallback 정책
- lazy route 는 사용자에게 빈 화면이 아니라 간단한 loading UI 를 보여준다.
- fallback 은 과한 skeleton 보다 현재 UI 톤에 맞는 가벼운 문구형 로딩을 우선한다.

### 검증 정책
- 기준 검증은 `npm run build` 와 chunk 변화 확인이다.
- 가능하면 build 결과에서 초기 진입 chunk 와 분리 chunk 변화를 같이 확인한다.

## 다음 구현 phase
### 목적
- 일반 사용자 초기 로드를 가볍게 만들고,
- admin/auth/예약 관련 저빈도 페이지를 route chunk 로 분리한다.

### 기준점
- 현재 앱은 `App.jsx` 에서 라우트를 직접 묶고 있을 가능성이 높다.
- 최근 build warning 상 500kB 초과 chunk 가 존재한다.
- 우선은 route-level lazy loading 으로 접근하고, 더 세밀한 manualChunks 는 2차로 미룬다.

### 예상 수정 파일
- `src/App.jsx`
- 필요 시 `src/components/Layout.jsx`
- 필요 시 로딩 fallback 공통 컴포넌트 파일
- build 설정을 건드려야 할 때만 `vite.config.*`

### Phase 1. 현재 라우트/번들 구조 확인
#### 작업
- `src/App.jsx` 라우트 import 구조 확인
- 어떤 page 가 eager import 인지 확인
- 현재 build 결과를 기준점으로 남긴다.

#### 종료조건
- 어떤 route 를 1차 분리할지 파일 기준으로 고정된다.

### Phase 2. admin route lazy loading 적용
#### 작업
- admin 3개 페이지를 `React.lazy` 로 전환
- route fallback UI 연결

#### 종료조건
- admin 페이지가 일반 주요 번들에서 우선 분리된다.

### Phase 3. auth / guest / member route lazy loading 적용
#### 작업
- 로그인/회원가입/비밀번호 재설정/비회원예약조회/회원예약내역 계열을 lazy loading 으로 전환
- redirect 와 기존 route path 는 유지

#### 종료조건
- 저빈도 페이지가 초기 번들에서 분리된다.

### Phase 4. 2차 대상 판단
#### 작업
- 예약완료 / 법률 / 테스트 페이지 분리 여부 판단
- 필요 시 Cars/Detail 내부 분리까지 갈지 판단

#### 종료조건
- 2차 분리 대상이 명확해진다.

### Phase 5. build 검증
#### 검증 항목
- `npm run build`
- 생성 chunk 구조 확인
- 기존 라우트 path 유지 확인
- lazy fallback 노출 확인

#### 종료조건
- 기능 변화 없이 chunk 분리와 초기 부담 감소가 확인된다.

## 리스크
- lazy route fallback 처리가 어색하면 첫 화면 전환 체감이 나빠질 수 있다.
- Layout/shared import 구조에 따라 기대만큼 분리가 안 될 수 있다.
- admin page 가 공용 모듈을 많이 끌고 있으면 1차 분리 효과가 제한될 수 있다.
- 과도한 세분화는 오히려 chunk 요청 수를 늘릴 수 있다.

## 구현 전 확인 필요 사항
1. 현재 `App.jsx` 의 route import 구조
2. Suspense fallback 공통 위치
3. admin/page 공용 의존도가 큰지 여부
4. build 결과에서 가장 큰 chunk 가 어떤 경로인지

## 구현 상태
- 아직 미구현이다.
- 현재는 route splitting 기준을 잠그는 단계다.

## current 운영 원칙
- active current 는 이 문서 1개만 유지한다.
- 밀린 우선순위는 parked/past 로 빼고 current 에 중첩 적재하지 않는다.
- 다음 구현은 이 문서 phase 기준으로만 진행한다.

## 한 줄 결론
지금 active current 는 **route-level code splitting + admin 분리 + 초기 번들 경량화** 다.
