# PHASE 04. BOOKING AND PAYMENT PREP

## 목적
결제 직전까지의 예약 생성 구조를 서버와 연결한다.

이 단계의 핵심은
**예약 버튼 이후 흐름을 실제 서버 계약 기반 구조로 만드는 것**이다.

---

## 이 단계에서 해결할 문제
- 지금까지는 상세 페이지에서 입력만 가능한 수준일 수 있음
- 예약 버튼 이후 서버 검증/준비 단계가 필요함
- 결제 전 기준 id 또는 준비 데이터를 생성할 필요가 있음

---

## 선행 기준
- PHASE 03 완료
- 예약자 입력/약관 동의 상태 모델 고정
- `docs/03_CONVENTIONS.md` 기준 key 사용

---

## 핵심 API

### `POST /api/reservations/prepare`
예약 생성 직전의 준비/검증 API

#### request DTO
```json
{
  "carId": 0,
  "search": {
    "deliveryDateTime": "",
    "returnDateTime": "",
    "pickupOption": "pickup",
    "driverAge": 26,
    "dongId": null,
    "deliveryAddress": "",
    "order": "lower"
  },
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

#### response 예시
```json
{
  "prepareId": "prep_xxx",
  "car": {},
  "search": {},
  "price": {
    "basePrice": 0,
    "discountPrice": 0,
    "deliveryPrice": 0,
    "finalPrice": 0
  },
  "customer": {},
  "paymentMethod": "card"
}
```

---

## 서버 역할
- request payload 검증
- 차량/가격 조건 재확인
- 현재 예약 가능 여부 최소 검증
- 결제 단계 진입용 준비 데이터 생성

### 중요
이 단계에서 아직 최종 예약 생성까지 가지 않아도 된다.
핵심은 **결제 가능한 준비 상태를 서버가 공식화하는 것**이다.

---

## UI 역할
- submit 시 `prepare` API 호출
- 로딩 상태 표시
- 검증 실패 메시지 표시
- 성공 시 `prepareId` 기반 다음 단계 진입

---

## 검증 포인트
- [ ] `carId` 누락 방지
- [ ] search state 전체 포함 여부
- [ ] customer 필수값 검증
- [ ] 약관 동의 검증
- [ ] paymentMethod 허용값 검증
- [ ] 서버 응답으로 가격/차량 정보 재확인 가능 여부

---

## 완료 기준
- 예약 버튼 이후 흐름이 alert/console 수준이 아니다.
- 서버가 예약 준비 상태를 공식적으로 만든다.
- 다음 단계 결제 연동을 붙일 수 있는 `prepareId` 또는 동등 개념이 생긴다.

---

## 이 단계에서 하지 말 것
- 실제 PG 완료 처리 전체 구현
- IMS 예약 생성 완료 처리

이 단계는 **결제 이전의 서버 계약 확립**이 목적이다.
