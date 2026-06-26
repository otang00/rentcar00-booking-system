# PHASE 01. EXECUTION PLAN

## 목적
이 문서는 `PHASE_01_FOUNDATION.md`를
**현재 코드베이스 기준 실제 작업 순서**로 쪼갠 실행 문서다.

핵심 원칙:
- 한 번에 크게 뜯지 않는다.
- `01A → 검증 → 01B → 검증` 순서로 간다.
- 현재 단계에서는 구조 전환만 한다.
- partner 실제 fetch/parse 구현은 PHASE 02에서 한다.

---

## 현재 코드 기준 진단

### 현재 파일 구조
- `src/App.jsx`
- `src/components/SearchBox.jsx`
- `src/components/CarCard.jsx`
- `src/pages/MainPage.jsx`
- `src/pages/CarsPage.jsx`
- `src/pages/CarDetailPage.jsx`
- `src/data/mock.js`

### 현재 문제 요약
1. `MainPage.jsx` 와 `CarsPage.jsx` 가 둘 다 목록 화면 역할을 하고 있다.
2. `SearchBox.jsx` 가 mock 데이터(`searchState`, `company`)를 직접 가져온다.
3. `MainPage.jsx`, `CarsPage.jsx`, `CarDetailPage.jsx` 가 모두 mock 데이터에 직접 의존한다.
4. 검색 상태 파싱/정규화/검증 로직이 컴포넌트에 흩어져 있다.
5. 가격/차량/검색 상태 타입이 고정돼 있지 않다.
6. 상세 페이지는 query 누락/오류 상태 처리가 없다.
7. `mock.js` 가 회사 정보 + 검색 상태 + 차량 데이터를 한 파일에 섞어 들고 있다.

### 현재 구조 판단
지금은 **디자인 프로토타입이 하나 더 있는 상태**에 가깝다.
PHASE 01의 목적은 이걸 **API를 받을 수 있는 구조**로 바꾸는 것이다.

---

## 실행 단계 개요

### 01A. Search State / Query 통일
목표:
- 검색 상태의 기준을 URL query로 통일한다.
- 현재 컴포넌트 내 분산된 query 처리 코드를 공통 유틸로 뽑는다.

### 01B. Mock 격리 + Service Layer 뼈대
목표:
- 컴포넌트가 mock 파일을 직접 import 하지 않게 만든다.
- 이후 partner API로 교체 가능한 진입점을 만든다.

### 01C. 라우트 구조 정리
목표:
- `/` 와 `/cars` 중복 역할을 정리한다.
- 메인을 검색/목록의 단일 시작점으로 맞춘다.

### 01D. 메인 페이지 상태 전환
목표:
- 메인 페이지를 service 기반 목록 화면으로 바꾼다.
- loading / empty / error 상태를 수용할 수 있게 만든다.

### 01E. 상세 페이지 초기화 구조 정리
목표:
- 상세 페이지가 `carId + searchState` 기준으로 초기화되게 만든다.
- 이후 예약 폼 상태를 붙일 준비를 끝낸다.

---

# 01A. Search State / Query 통일

## 목표
현재 `SearchBox.jsx`, `CarsPage.jsx`, `CarDetailPage.jsx` 에 흩어진 query 파싱 로직을 공통화한다.

## 새로 만들 파일
- `src/utils/searchQuery.js`
- `src/constants/search.js`

## 수정 파일
- `src/components/SearchBox.jsx`
- `src/pages/CarsPage.jsx`
- `src/pages/CarDetailPage.jsx`
- 필요 시 `src/pages/MainPage.jsx`

## 정의할 것

### SearchState shape
```js
{
  deliveryDateTime: '',
  returnDateTime: '',
  pickupOption: 'pickup',
  driverAge: '26',
  order: 'lower',
  dongId: null,
  deliveryAddress: '',
}
```

### `src/constants/search.js`
포함 항목:
- `DEFAULT_SEARCH_STATE`
- `PICKUP_OPTIONS`
- `ORDER_OPTIONS`
- `DRIVER_AGE_OPTIONS`

### `src/utils/searchQuery.js`
필수 함수:
- `parseSearchQuery(searchStringOrParams)`
- `normalizeSearchState(rawState)`
- `validateSearchState(searchState)`
- `buildSearchQuery(searchState)`

## 세부 작업
1. `mock.js` 의 `searchState`를 상수 원본으로 쓰지 않게 한다.
2. 기본 검색 상태는 `constants/search.js`로 이동한다.
3. `SearchBox.jsx` 는 URL → SearchState 파싱을 유틸에서만 하게 바꾼다.
4. `CarsPage.jsx` 와 `CarDetailPage.jsx` 도 동일 유틸을 사용하게 바꾼다.
5. query key는 반드시 아래만 사용한다.
   - `deliveryDateTime`
   - `returnDateTime`
   - `pickupOption`
   - `driverAge`
   - `order`
   - 선택: `dongId`, `deliveryAddress`

## 완료 기준
- 세 화면이 모두 같은 방식으로 query를 읽는다.
- query key 이름이 한 곳에서 관리된다.
- 새로고침/링크 공유 시 같은 검색 상태를 복원할 수 있다.

## 검증 포인트
- `/cars?pickupOption=delivery&dongId=440...` 파싱이 깨지지 않는가
- `pickupOption`, `order`, `driverAge` 허용값이 normalize 되는가
- 잘못된 값이 들어와도 기본값으로 정리되는가

---

# 01B. Mock 격리 + Service Layer 뼈대

## 목표
컴포넌트에서 mock 직접 import를 제거한다.

## 새로 만들 파일
- `src/services/cars.js`
- `src/services/company.js`
- `src/services/search.js`

## 수정 파일
- `src/components/SearchBox.jsx`
- `src/components/CarCard.jsx`
- `src/pages/MainPage.jsx`
- `src/pages/CarsPage.jsx`
- `src/pages/CarDetailPage.jsx`
- `src/data/mock.js`

## 세부 작업
1. `mock.js` 는 fixture 역할만 남긴다.
2. `cars`, `company`, `searchState` 직접 import를 서비스 레이어 뒤로 숨긴다.
3. `services/cars.js` 에 아래 함수 추가
   - `getMockCars(searchState)`
   - `getMockCarById(carId)`
4. `services/company.js` 에 아래 함수 추가
   - `getMockCompany()`
5. `services/search.js` 에 아래 함수 추가
   - `getDefaultSearchState()`

## 중요 규칙
- 페이지/컴포넌트는 `../data/mock` 를 직접 import 하지 않는다.
- mock 구조 변경이 컴포넌트 전체에 전파되지 않게 한다.

## 완료 기준
- `src/data/mock.js` 직접 import가 서비스 파일 외부에서 사라진다.

## 검증 포인트
- `rg "../data/mock|./data/mock" src` 결과가 service 외부에서 없어야 함

---

# 01C. 라우트 구조 정리

## 목표
목록 화면이 두 군데(`MainPage`, `CarsPage`)인 중복 상태를 정리한다.

## 수정 파일
- `src/App.jsx`
- `src/pages/MainPage.jsx`
- `src/pages/CarsPage.jsx`
- `src/components/SearchBox.jsx`

## 권장 방향
- `/` = 검색 + 목록의 단일 시작점
- `/cars/:carId` = 상세/예약
- `/cars` = 제거 또는 `/` 로 리다이렉트

## 현재 코드 기준 판단
지금 `SearchBox.jsx` 는 `navigate('/cars?...')` 로 이동한다.
PHASE 01에서는 이걸 아래 둘 중 하나로 정리한다.

### 권장안 A
- `SearchBox` 검색 버튼 → `/?query...`
- `CarsPage` 삭제

### 보수안 B
- 이번 단계는 `CarsPage` 유지
- 하지만 역할은 점차 `/` 로 합칠 준비만 하고,
- 실제 제거는 01D 끝난 뒤 진행

## 추천
현재는 **보수안 B로 먼저 정리 후, 01D에서 `/` 중심으로 합치는 것**이 안전하다.

## 완료 기준
- 라우트 역할이 문서와 코드에서 충돌하지 않는다.

---

# 01D. 메인 페이지 상태 전환

## 목표
`MainPage.jsx` 를 mock 직결 렌더에서 service 기반 구조로 바꾼다.

## 수정 파일
- `src/pages/MainPage.jsx`
- 필요 시 `src/components/SearchBox.jsx`
- 필요 시 `src/components/CarCard.jsx`

## 세부 작업
1. `MainPage.jsx` 에서 `cars` 직접 import 제거
2. `searchState` 를 query 유틸에서 읽음
3. `getMockCars(searchState)` 호출
4. 아래 상태를 수용할 구조 준비
   - `isLoading`
   - `errorMessage`
   - `cars`
   - `totalCount`
   - `company`
5. 아직 실제 API 호출은 안 하더라도,
   함수 시그니처는 나중에 async로 바꾸기 쉬운 방향으로 작성

## 완료 기준
- 메인 페이지가 service 결과로 목록을 렌더링한다.
- 이후 PHASE 02에서 API 연결 시 페이지 수정량이 작아진다.

---

# 01E. 상세 페이지 초기화 구조 정리

## 목표
상세 페이지를 `carId + searchState` 기반 초기화 구조로 정리한다.

## 수정 파일
- `src/pages/CarDetailPage.jsx`
- 필요 시 `src/services/cars.js`
- 필요 시 `src/services/company.js`

## 세부 작업
1. `cars`, `company` 직접 import 제거
2. `carId` 읽기 → service에서 차량 조회
3. query 파싱 → 공통 searchState 사용
4. 차량 없음 처리
5. query 핵심값 누락 처리
6. 현재 hardcoded fallback 날짜 제거 또는 최소화

## 완료 기준
- 상세 페이지가 잘못된 query / 잘못된 `carId` 를 구분해서 처리한다.
- 이후 예약 폼 state 추가가 쉬운 구조가 된다.

---

## 권장 실제 진행 순서
1. **01A 먼저 진행**
2. 검증
3. **01B 진행**
4. 검증
5. **01C / 01D 묶어서 진행**
6. 검증
7. **01E 진행**

---

## 지금 바로 착수할 단계
**다음 작업은 01A다.**

이유:
- query/state 이름이 먼저 고정돼야
- 그 다음 mock 격리, route 정리, service 분리도 흔들리지 않는다.

즉, 지금 시작점은
**`SearchBox.jsx`, `CarsPage.jsx`, `CarDetailPage.jsx` 에 흩어진 query 처리 로직을 공통 유틸로 정리하는 것**이다.
