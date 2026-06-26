# 05. DETAIL DB INTEGRATION PHASE 1

## 목적
상세 페이지를 새 Supabase `cars` 테이블로 옮기기 전에,
**현재 상세 응답 shape / source 분리 / 병합 규칙**을 먼저 잠근다.

이 문서는 **실행 전 기준 문서**다.
지금 단계에서는 구현보다 **필드 기준과 우선순위 고정**이 목적이다.

---

## 현재 상세의 고정 원칙

### 1. 상세 URL/진입 규칙은 유지한다
- 경로: `/cars/:carId`
- 상세는 `carId + searchState` 기준으로 열린다.
- 새로고침해도 같은 차량 상세가 열려야 한다.
- query search state는 계속 source of truth 로 유지한다.

### 2. 프론트 상세 DTO shape는 먼저 유지한다
상세 전환 1차 목표는
**프론트 UI를 최소 수정하면서 내부 source 만 교체하는 것**이다.

즉, `/api/car-detail` 이 반환하는 응답 shape는 당분간 유지한다.

### 3. 초기 전환은 혼합 구조를 허용한다
상세 전환 1차에서는 아래 혼합 구조를 허용한다.
- 차량 기본 정보: Supabase `public.cars`
- 가격/보험/검색 종속 정보: 기존 partner 상세 또는 기존 계산 로직
- 회사/딜리버리 정보: 기존 partner 상세 유지

이 단계에서 목표는 **현재 상세를 깨지 않고 source 분리를 시작하는 것**이다.

---

## 현재 상세 DTO 기준

`/api/car-detail` 응답에서 프론트가 사실상 기대하는 주요 필드는 아래다.

### search
- `search.deliveryDateTime`
- `search.returnDateTime`
- `search.pickupOption`
- `search.driverAge`
- `search.order`
- `search.dongId`
- `search.deliveryAddress`

### company
- `company.companyId`
- `company.companyName`
- `company.companyTel`
- `company.fullGarageAddress`
- `company.garageLat`
- `company.garageLng`
- `company.deliveryTimes`
- `company.deliveryCostList`

### car
- `car.carId`
- `car.name`
- `car.displayName`
- `car.imageUrl`
- `car.fuelType`
- `car.capacity`
- `car.minModelYear`
- `car.maxModelYear`
- `car.manufacturerName`
- `car.model`
- `car.rentAge`
- `car.drivingYears`
- `car.options`

### pricing
- `pricing.rentalCost`
- `pricing.originCost`
- `pricing.insurancePrice`
- `pricing.delivery.oneWay`
- `pricing.delivery.roundTrip`
- `pricing.finalPrice`

### insurance
- `insurance.general.*`
- `insurance.full.*`

### meta
- `meta.source`

---

## 상세 필드 source 분리 기준

### A. Supabase에서 우선 공급 가능한 필드
`public.cars` 에서 바로 공급 가능한 필드:
- `source_car_id` -> `car.carId`
- `name` -> `car.name`
- `display_name` -> `car.displayName`
- `image_url` -> `car.imageUrl`
- `fuel_type` -> `car.fuelType`
- `seats` -> `car.capacity`
- `model_year` -> `car.minModelYear` / `car.maxModelYear`의 단일 기준 후보
- `rent_age` -> `car.rentAge`
- `options_json.names` -> `car.options`
- `metadata` -> 내부 매핑/추적 용도
- `car_number` -> 상세 확장 시 별도 노출 후보

### B. 기존 partner 상세를 계속 써야 하는 필드
초기에는 계속 partner 또는 기존 로직에 의존하는 필드:
- `company.*`
- `pricing.*`
- `insurance.*`
- `car.drivingYears`
- `car.manufacturerName`
- `car.model`
- 딜리버리 지역/운영시간 상세
- 검색 조건에 따라 달라지는 값

### C. derived 필드
직접 저장보다 조합/가공으로 만드는 필드:
- `yearLabel`
- `seats` 표시 문자열
- 가격 표시 문자열
- 최종 프론트 표시용 `features`
- `meta.source`

---

## 병합 규칙

### 1. car identity 기준
- 상세 차량 식별의 기준은 `carId` 이다.
- Supabase에서는 `source_car_id` 가 `carId` 와 매핑된다.

### 2. 우선순위
초기 상세 전환의 우선순위는 아래로 잠근다.

#### 차량 기본 정보
- 1순위: Supabase
- 2순위: partner 상세
- 이유: 이번 단계의 목적이 차량 기본 정보의 소스 이전이기 때문

#### 가격/보험/회사 정보
- 1순위: partner 상세
- 이유: 현재 검색 맥락 의존성이 크고, Supabase `cars` 범위를 벗어난다.

### 3. 옵션 규칙
- 상세 옵션 목록은 우선 `options_json.names` 사용
- 값이 비면 partner `carDetailInfo.options` fallback 허용
- 출력 형식은 기존과 동일하게 한글 라벨 배열 유지

### 4. 이미지 규칙
- `image_url` 가 있으면 Supabase 우선
- 없으면 partner 상세 이미지 fallback 허용

### 5. 연식 규칙
- Supabase에는 현재 `model_year` 단일값만 있다.
- 상세 DTO가 `minModelYear`, `maxModelYear` 를 요구하면,
  초기 단계에서는 아래 중 하나로 고정한다.
  - partner 상세 값이 있으면 partner 유지
  - 없으면 Supabase `model_year` 를 양쪽에 동일 대입

---

## 상세 전환 1차 구현 원칙

### 유지할 것
- `/api/car-detail` route 이름
- 프론트의 상세 fetch 호출 방식
- URL/query 규칙
- loading / error / success 상태 구조

### 바꿀 것
- `/api/car-detail` 내부 source 조합 방식
- 차량 기본 정보 공급 source
- `meta.source` 값

### 아직 안 바꿀 것
- 목록 `/api/search-cars`
- 가격 계산 구조
- 보험 구조
- 회사/딜리버리 source
- 예약/결제 단계

---

## 구현 전 검증 체크리스트
- [ ] 현재 상세 UI가 쓰는 DTO 필드 목록이 이 문서와 일치하는가
- [ ] `carId -> source_car_id` 매핑 규칙이 확정되었는가
- [ ] Supabase 기본 정보 우선, partner fallback 규칙이 확정되었는가
- [ ] `options_json.names` 를 상세 옵션 source 로 써도 현재 UI 요구와 충돌 없는가
- [ ] `pricing / insurance / company` 를 이번 단계에서 건드리지 않는다는 범위가 명확한가
- [ ] 목록 전환은 이번 단계 범위 밖임이 명확한가

---

## Phase 1 종료 조건
아래가 모두 충족되면 Phase 1 완료로 본다.
- 상세 DTO 기준 문서가 존재한다.
- source 분리 규칙이 문서로 잠겼다.
- Supabase / partner / derived 경계가 명확하다.
- 다음 구현 phase 에서 무엇을 바꾸고 무엇을 안 바꾸는지 분명하다.

---

## 다음 phase 예고
다음 단계는 구현 phase 다.

예정 순서:
1. `/api/car-detail` 내부 source 조합 함수 설계
2. Supabase `cars` 조회 추가
3. partner fallback 포함한 merge DTO 작성
4. 샘플 3대 기준 응답 검증
5. 브라우저 상세 페이지 수동 검증
