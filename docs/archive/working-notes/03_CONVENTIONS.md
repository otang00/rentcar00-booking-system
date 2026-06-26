# 03. CONVENTIONS

## 목적
이 문서는 `premove-clone` 전반에서 사용하는 변수명, id, query key, DTO key, 상태명, 문서 용어를 통일하기 위한 기준이다.

이 문서의 목적은 다음과 같다.
- 같은 뜻의 값을 서로 다른 이름으로 두세 번 만들지 않기
- 검색/차량/예약/결제 관련 상태를 일관되게 유지하기
- 프론트와 서버 사이의 계약을 고정하기

---

## 1. 용어 통일

### 검색(Search)
사용자가 메인에서 입력하는 조건 전체를 `search` 라고 부른다.

### 차량 목록(Car List)
검색 조건에 따라 내려오는 차량 배열을 `car list` 라고 부른다.

### 차량 상세(Car Detail)
특정 차량 1대의 예약 준비 화면에 필요한 정보를 `car detail` 이라고 부른다.

### 예약 준비(Reservation Prepare)
결제 직전까지 예약 가능 조건을 검증하고 서버에서 준비 데이터를 만드는 단계를 `reservation prepare` 라고 부른다.

### 예약 생성(Reservation Create)
결제 성공 이후 실제 예약을 생성/저장하는 단계를 `reservation create` 라고 부른다.

---

## 2. Query Key 규칙
검색 조건은 URL query string과 내부 API request 모두 아래 키를 기준으로 통일한다.

### 필수 query key
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- `order`

### 선택 query key
- `dongId`
- `deliveryAddress`

### 금지
아래처럼 같은 의미의 대체 이름 금지
- `pickupType` 금지 → `pickupOption` 사용
- `age` 금지 → `driverAge` 사용
- `sort` 금지 → `order` 사용
- `startDate` / `endDate` 금지 → `deliveryDateTime`, `returnDateTime` 사용

---

## 3. 값(Value) 규칙

### pickupOption 값
- `pickup`
- `delivery`

다른 값 사용 금지
- `visit`
- `direct`
- `dispatch`

### order 값
- `lower`
- `higher`
- `newer`

다른 값 사용 금지
- `asc`
- `desc`
- `latest`

---

## 4. ID 규칙

### 차량 id
- 이름: `carId`
- 타입: number

### 업체 id
- 이름: `companyId`
- 타입: number

### 예약 id
- 이름: `reservationId`
- 타입: string 또는 number
- 아직 미확정이면 문서에 타입 명시

### 지역 id
- 동 식별자: `dongId`

### 금지
- `id` 단독 남발 금지
- 컨텍스트 없는 `selectedId` 금지
- `carID`, `car_id` 혼용 금지

코드에서는 camelCase 사용

---

## 5. DTO Key 규칙

### Search DTO
```json
{
  "deliveryDateTime": "",
  "returnDateTime": "",
  "pickupOption": "pickup",
  "driverAge": 26,
  "order": "lower",
  "dongId": null,
  "deliveryAddress": ""
}
```

### Car Summary DTO
```json
{
  "carId": 0,
  "name": "",
  "capacity": 5,
  "imageUrl": "",
  "oilType": "",
  "minModelYear": 2024,
  "maxModelYear": 2024,
  "insuranceAge": 26,
  "options": [],
  "price": 0,
  "discountPrice": 0,
  "deliveryPrice": 0
}
```

### Search Cars Response DTO
```json
{
  "search": {},
  "company": {},
  "totalCount": 0,
  "cars": []
}
```

### Company DTO
```json
{
  "companyId": 0,
  "companyName": "",
  "companyTel": "",
  "fullGarageAddress": ""
}
```

### Reservation Prepare Request DTO
```json
{
  "carId": 0,
  "search": {},
  "customer": {
    "name": "",
    "phone": "",
    "birth": ""
  },
  "terms": {
    "allAgreed": true
  },
  "paymentMethod": "card"
}
```

---

## 6. State Naming 규칙

### 원칙
- 단수 객체는 단수형
- 배열은 복수형
- boolean은 `is/has/can/should` 로 시작
- 파생 상태는 `selected/current/active` 접두어 사용

### 예시
- `searchParams`
- `searchState`
- `cars`
- `selectedCar`
- `company`
- `isLoading`
- `isSubmitting`
- `hasError`
- `activeTab`
- `currentStep`

### 금지 예시
- `data` 단독 사용 금지
- `info` 남발 금지
- `listData` 같은 중복 의미 금지
- `tmp`, `temp1`, `testData` 금지

---

## 7. API Route Naming 규칙

### 조회
- `GET /api/search-cars`
- `GET /api/cars/:carId`

### 예약
- `POST /api/reservations/prepare`
- `POST /api/reservations/create`

### 결제
- `POST /api/payments/confirm`

### 금지
- `/api/getCars`
- `/api/carSearchList`
- `/api/reserveCarStep1`

REST에 가깝고 의미가 바로 드러나는 이름 유지

---

## 8. 문서 Naming 규칙

### phase 문서
- `phase-specs/PHASE_01_FOUNDATION.md`
- `phase-specs/PHASE_02_PARTNER_PROXY.md`
- 형식 고정

### 결정 로그
- `99_DECISIONS.md`
- 주요 구조 결정이 생기면 여기에 누적 기록

---

## 9. 검증 원칙

### 검색 검증
- `deliveryDateTime` 필수
- `returnDateTime` 필수
- `returnDateTime > deliveryDateTime`
- `driverAge` 필수
- `pickupOption` 허용값 검증
- `order` 허용값 검증

### 예약 검증
- `carId` 필수
- `customer.name` 필수
- `customer.phone` 필수
- `terms.allAgreed === true`

---

## 10. 최종 원칙
같은 의미의 값을 새 이름으로 다시 만들지 않는다.

새 필드가 필요하면 먼저 아래를 확인한다.
1. 이미 같은 의미의 키가 있는가
2. 기존 DTO에 합칠 수 있는가
3. query/state/api에서 같은 이름으로 유지 가능한가

이 원칙을 지키지 못하면
나중에 partner 파싱 교체, IMS 연결, 결제 연결 단계에서 구조가 흔들린다.
