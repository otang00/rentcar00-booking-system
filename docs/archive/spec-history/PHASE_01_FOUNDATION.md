# PHASE 01. FOUNDATION

## 목적
프로토타입 UI를 실제 데이터 흐름을 받을 수 있는 구조로 전환한다.

이 단계의 핵심은 화면을 더 예쁘게 만드는 것이 아니라,
**더미 중심 구조를 API/상태 중심 구조로 갈아타는 것**이다.

---

## 이 단계에서 해결할 문제
- 컴포넌트가 mock 데이터에 직접 묶여 있음
- 메인/목록/상세가 URL 상태로 묶여 있지 않음
- 검색 상태 키가 앞으로 흔들릴 가능성이 있음
- 로딩/에러/빈 결과 상태가 없음
- 상세 페이지가 실제 예약 준비 화면으로 확장될 준비가 부족함

---

## 선행 기준
- `docs/00_FINAL_GOAL.md` 확인
- `docs/01_MAIN_PROMPT.md` 확인
- `docs/03_CONVENTIONS.md` 기준 이름 사용

---

## 반드시 고정할 것

### Query Key
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- `order`
- 선택: `dongId`, `deliveryAddress`

### Route 기준
- `/` = 메인 + 검색 시작점
- `/cars/:carId` = 상세/예약
- `/cars` 는 유지 필요성 재검토, 가능하면 제거 또는 `/`로 정리

---

## 해야 할 일

### 1. 데이터 접근 레이어 추가
추천 구조
```txt
src/
  api/
    http.ts
    cars.ts
    reservations.ts
  services/
    cars.ts
    reservations.ts
```

#### 역할
- `api/*`: HTTP 요청 담당
- `services/*`: 화면에서 쓰는 데이터 가공/조합 담당

#### 금지
- 페이지 컴포넌트에서 직접 fetch 호출
- 컴포넌트에서 mock 직접 import

---

### 2. mock 직접 참조 제거
현재 mock이 있다면 아래 원칙으로 바꾼다.
- `mock`은 service 내부 fallback fixture로만 허용
- 컴포넌트는 `service`가 준 결과만 사용

#### 목표
나중에 partner 프록시 응답으로 바꿔도 컴포넌트는 수정 최소화

---

### 3. 검색 상태 모델 정의
프론트 공통 검색 상태 타입을 먼저 정의한다.

```ts
type SearchState = {
  deliveryDateTime: string
  returnDateTime: string
  pickupOption: 'pickup' | 'delivery'
  driverAge: number
  order: 'lower' | 'higher' | 'newer'
  dongId: number | null
  deliveryAddress: string
}
```

#### 원칙
- 메인/목록/상세 모두 이 상태를 기준으로 동작
- 새 키를 임의로 만들지 않음

---

### 4. URL 상태 동기화 유틸 작성
추천 유틸
- `src/utils/searchQuery.ts`

필수 함수
- `parseSearchQuery(searchParams)`
- `buildSearchQuery(searchState)`
- `normalizeSearchState(raw)`
- `validateSearchState(searchState)`

#### 목표
- 새로고침 시 상태 복원
- 링크 공유 가능
- 잘못된 query 정규화 가능

---

### 5. 메인 페이지 구조 전환
메인 페이지는 단순 외형이 아니라 아래 역할을 해야 한다.
- URL에서 search state 복원
- 검색 UI 표시
- 검색 실행 시 API 호출 준비
- 상태별 UI 분기

#### 최소 상태
- `isLoading`
- `errorMessage`
- `cars`
- `totalCount`
- `company`

#### UI 상태
- 초기 상태
- 검색 중
- 검색 성공
- 결과 없음
- 검색 실패

---

### 6. 차량 카드/리스트 입력 타입 고정
차량 카드가 받는 prop을 partner 원문 기준이 아니라
우리 DTO 기준으로 고정한다.

예시
```ts
type CarSummary = {
  carId: number
  name: string
  capacity: number
  imageUrl: string
  oilType: string
  minModelYear: number
  maxModelYear: number
  insuranceAge: number
  options: string[]
  price: number
  discountPrice: number
  deliveryPrice: number
}
```

#### 중요
- `id` 대신 `carId` 사용 권장
- 카드/상세/예약에서 동일 타입 축 공유

---

### 7. 상세 페이지 초기화 구조 준비
상세 페이지는 아래를 읽을 수 있어야 한다.
- path param: `carId`
- search query: 검색 조건 전체

#### 누락 처리
- `carId` 누락 → 잘못된 경로
- 검색 조건 누락 → 메인으로 복귀 유도 또는 재입력 안내

#### 이 단계 목표
상세 페이지가 아직 완전한 예약 페이지가 아니어도,
적어도 **검색 맥락을 읽는 구조**는 먼저 확보한다.

---

## 산출물
- 검색 상태 타입/유틸
- API/service 레이어 뼈대
- mock 직접 참조 제거
- 메인 페이지 상태 분기 구조
- 상세 페이지 초기화 구조

---

## 체크리스트
- [ ] `deliveryDateTime` 등 query key가 전역적으로 통일되었는가
- [ ] 컴포넌트가 mock를 직접 import하지 않는가
- [ ] 메인 페이지가 URL 상태를 읽는가
- [ ] 잘못된 query를 normalize/validate 하는가
- [ ] 차량 카드 prop 타입이 고정되었는가
- [ ] 상세 페이지가 `carId` + search state를 읽는가

---

## 완료 기준
- 더미 UI가 API를 받을 수 있는 구조로 바뀌었다.
- 검색 상태가 URL과 일관되게 묶였다.
- 메인/상세 페이지가 이후 partner 프록시 연결을 받을 준비가 됐다.

---

## 이 단계에서 하지 말 것
- partner 파싱 구현 깊게 들어가기
- 결제 SDK 연동
- IMS 예약 생성 로직 추가
- 관리자 기능 확장

이 단계는 오직 **구조 전환**에 집중한다.
