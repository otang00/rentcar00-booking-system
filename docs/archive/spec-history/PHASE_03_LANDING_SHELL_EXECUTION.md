# PHASE 03A. LANDING SHELL EXECUTION

## 목적
기존 `/landing` 페이지를 앱의 메인 진입점(`/`)으로 승격한다.

핵심은 페이지를 새로 만드는 것이 아니라,
**랜딩 셸은 유지하고 중앙 콘텐츠만 `landing / results / detail`로 전환**하는 것이다.

---

## 이번 작업 범위
이번 단계에서는 아래 4개만 한다.

1. `/`를 랜딩 셸로 바꾼다.
2. 검색 결과를 랜딩 셸 아래에 붙인다.
3. 상세도 같은 셸 문맥으로 맞춘다.
4. 뒤로가기 / 새로고침 / 로고 초기화 동작을 정리한다.

그 외 디자인 확장, 예약 폼 리팩터링, 데이터 계층 재설계는 이번 범위에서 제외한다.

---

## 현재 기준 상태
### 현재 라우팅
- `/` → `MainPage`
- `/landing` → `LandingPage`
- `/cars` → `/` redirect
- `/cars/:carId` → `CarDetailPage`

### 현재 문제
- 랜딩과 메인이 분리되어 있어 진입점이 이중화되어 있다.
- 검색 결과는 `MainPage` 문맥, 랜딩은 `/landing` 문맥으로 갈라져 있다.
- 상세는 `PageShell` 기준이라 랜딩의 브랜드 셸과 연결감이 약하다.
- 링크 전달 시 `/` 와 `/landing` 중 어느 쪽을 보내야 하는지 헷갈린다.

---

# 1단계. 루트를 랜딩 셸로 변경

## 목표
- `/` 진입 시 랜딩 셸이 뜨게 한다.
- 기존 `/landing`은 더 이상 메인 진입점이 아니게 만든다.

## 변경 대상 후보
- `src/App.jsx`
- `src/pages/LandingPage.jsx`
- 필요 시 `src/pages/MainPage.jsx`

## 실행 내용
### 1-1. 라우팅 변경
- `/` → `LandingPage` 또는 새 `LandingShellPage`
- `/landing` → `/` redirect 처리
- `/cars/:carId`는 유지

### 1-2. LandingPage 역할 확장 준비
현재 `LandingPage`는 아래 구조다.
- `TopNoticeBar`
- `BrandHeader`
- `HeroShowcase`
- `ReservationEntrySection`
- `ContactInfoStrip`
- `Footer`

이 구조를 메인 셸로 승격할 수 있도록,
**고정 영역과 중앙 가변 영역을 나눌 준비**를 한다.

## 완료 기준
- Vercel 루트(`/`)로 들어가면 랜딩이 뜬다.
- `/landing` 직접 진입 시에도 결과적으로 같은 랜딩으로 간다.
- 기존 랜딩 UI는 깨지지 않는다.

## 체크 포인트
- 루트 진입 확인
- `/landing` redirect 확인
- 헤더/푸터/공지바 렌더 깨짐 여부 확인

---

# 2단계. 검색 결과를 랜딩 셸 아래에 연결

## 목표
검색 버튼 클릭 시 다른 페이지로 튀지 않고,
**같은 셸 아래에서 결과 리스트가 이어서 보이게 만든다.**

## 변경 대상 후보
- `src/pages/LandingPage.jsx`
- `src/components/ReservationEntrySection.jsx`
- `src/pages/MainPage.jsx`
- `src/components/CarCard.jsx`
- `src/utils/searchQuery.js`
- `src/services/cars.js`

## 실행 내용
### 2-1. 결과 영역 분리
현재 `MainPage`가 갖고 있는 아래 책임을 분리한다.
- query 파싱
- 검색 유효성 검사
- 차량 목록 fetch
- 결과 목록 렌더

이 중 결과 렌더링 부분을
`LandingPage` 아래에 붙일 수 있는 단위로 분리한다.

예상 분리 단위:
- `SearchResultsSection`
- 또는 `MainPage` 내부 로직을 LandingShell용으로 이관

### 2-2. 결과 노출 조건 통일
- query 없음 → landing 모드
- 유효한 검색 query 있음 → results 모드

즉 `/`는 그대로 유지하되,
query 존재 여부에 따라 hero 아래에 결과 영역을 붙인다.

### 2-3. 랜딩 hero 처리
results 상태에서는 아래 중 하나로 처리한다.
- hero 숨김
- hero 축약
- hero 유지 + 결과 아래 노출

이번 단계의 우선순위는 구조 안정화이므로,
**가장 단순한 방식부터 적용**한다.

권장:
- landing: hero 표시
- results: hero 숨김 또는 축약, 검색 + 리스트 집중

## 완료 기준
- 검색 실행 후 URL은 `/` + query 상태를 가진다.
- 랜딩 큰틀은 유지된다.
- 결과 리스트가 같은 페이지 아래에 붙는다.
- 새로고침 시 결과가 그대로 복원된다.

## 체크 포인트
- 검색 직후 results 노출 확인
- query 복원 확인
- 결과 0건 / loading / 에러 상태 확인
- 모바일에서 리스트 붙는 위치 확인

---

# 3단계. 상세를 같은 셸 문맥으로 정리

## 목표
차량 상세 진입 시 다른 서비스 페이지처럼 튀지 않고,
**같은 브랜드 셸 안에서 detail 모드로 보이게 맞춘다.**

## 변경 대상 후보
- `src/pages/CarDetailPage.jsx`
- `src/components/Layout.jsx`
- `src/components/DetailSearchBox.jsx`
- `src/pages/LandingPage.jsx`
- 필요 시 공용 header/footer 컴포넌트

## 실행 내용
### 3-1. 셸 통일
현재 상세는 `PageShell` 기반이다.
이걸 아래 둘 중 하나로 맞춘다.
- `PageShell`을 랜딩 셸 스타일로 흡수
- `CarDetailPage`가 랜딩 셸 구조를 재사용

이번 단계의 목적은 “완전 리팩터링”이 아니라,
**사용자 눈에 같은 틀로 보이게 만드는 것**이다.

### 3-2. 검색 컨텍스트 유지
상세 진입 URL은 계속 유지한다.
- `/cars/:carId?...searchParams`

유지 이유:
- 뒤로가기 자연스러움
- 새로고침 복원
- 공유 가능성

### 3-3. 상세 상단 검색영역 정리
현재 `DetailSearchBox`가 이미 있다.
이 컴포넌트를 유지하되,
브랜드 셸과 시각적으로 이어지게 맞춘다.

## 완료 기준
- 결과 리스트에서 상세로 이동 가능
- 상세 진입 시 브랜드 셸/헤더/푸터 톤이 유지됨
- 새로고침 시 상세 화면이 그대로 복원됨
- 브라우저 뒤로가기 시 결과 리스트로 자연 복귀함

## 체크 포인트
- `/cars/:carId` direct entry 확인
- query 포함 상세 진입 확인
- 뒤로가기 시 results 복귀 확인
- 상세 상단 검색영역 표시 확인

---

# 4단계. 로고 / 뒤로가기 / 새로고침 정책 마감

## 목표
마지막으로 사용자 행동 규칙을 정리한다.

## 변경 대상 후보
- `src/components/BrandHeader.jsx`
- `src/pages/LandingPage.jsx`
- `src/pages/CarDetailPage.jsx`
- router 링크 구성 파일 전반

## 실행 내용
### 4-1. 로고 클릭
- 항상 `/` 로 이동
- query 제거
- 최초 랜딩으로 초기화

즉,
- results에서 눌러도 초기 랜딩
- detail에서 눌러도 초기 랜딩

### 4-2. 뒤로가기
브라우저 기본 히스토리를 따른다.
- landing → results → detail 순으로 push가 쌓이게 유지
- detail에서 뒤로가기 시 results 복귀
- results에서 뒤로가기 시 landing 복귀

### 4-3. 새로고침
- `/` → landing
- `/` + query → results
- `/cars/:carId` + query → detail

URL이 곧 복원 기준이 되게 유지한다.

## 완료 기준
- 로고 클릭 시 항상 최초 랜딩 복귀
- 뒤로가기 동작이 자연스러움
- 새로고침 후 현재 화면 유지

## 체크 포인트
- logo reset 확인
- browser back 2회 확인
- results refresh / detail refresh 확인
- 공유 URL 재진입 확인

---

# 단계별 실제 실행 순서
1. `App.jsx` 라우팅 정리
2. `LandingPage`를 메인 셸로 승격
3. `MainPage`의 결과 로직을 Landing 아래로 이동/분리
4. 상세 페이지 셸 톤 정리
5. 로고/히스토리/복원 검증
6. preview 링크 확인

---

# 이번 작업에서 하지 말 것
- 예약 폼 전체 재설계
- 상세 비즈니스 로직 확장
- 데이터 모델 전체 변경
- 디자인 욕심으로 대규모 CSS 개편
- 기존 구조를 한 번에 다 지우는 정리 작업

이번 목표는 **방향 전환**이지, 전체 리빌드가 아니다.

---

# 승인 후 실행 순서 제안
승인되면 아래 단위로 바로 들어간다.

## 실행 1
- `/`를 랜딩으로 변경
- `/landing` redirect 처리
- preview 확인

## 실행 2
- results를 Landing 아래에 연결
- query 복원 확인
- preview 확인

## 실행 3
- detail 셸 정리
- back/refresh 확인
- preview 확인

## 실행 4
- logo reset / 마감 정리
- 최종 preview 전달
