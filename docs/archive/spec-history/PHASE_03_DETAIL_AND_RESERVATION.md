# PHASE 03. DETAIL AND RESERVATION

## 목적
차량 상세 페이지를 정적 소개 화면에서 벗어나,
**실제 예약 준비 화면**으로 바꾼다.

---

## 이 단계에서 해결할 문제
- 상세 페이지가 현재는 보여주기용 성격이 강함
- 목록에서 넘어온 검색 맥락이 끊길 수 있음
- 예약자 입력/약관 동의/결제 전 검증 구조가 필요함

---

## 선행 기준
- PHASE 01 완료
- PHASE 02의 `SearchCarsResponse` / `CarSummary` DTO 기준 확보
- `docs/03_CONVENTIONS.md` 기준 이름 사용
- 실제 UI/플로우 참고: `docs/04_PARTNER_SITE_REFERENCE.md`

---

## 페이지 역할 재정의
상세 페이지는 아래 4가지를 동시에 담당한다.
1. 선택 차량 확인
2. 검색 조건 확인
3. 예약자 정보 입력
4. 결제 직전 검증

즉, 단순 차량 소개 페이지가 아니다.

---

## 입력 데이터

### path param
- `carId`

### search query
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- 선택: `dongId`, `deliveryAddress`

### 화면 상태
- `selectedCar`
- `searchState`
- `reservationForm`
- `termsState`
- `paymentMethod`
- `isSubmitting`
- `errorMessage`

---

## 상태 모델 권장

### reservationForm
```json
{
  "customerName": "",
  "customerPhone": "",
  "customerBirth": ""
}
```

### termsState
```json
{
  "allAgreed": false,
  "serviceAgreed": false,
  "privacyAgreed": false,
  "rentalPolicyAgreed": false
}
```

### paymentMethod
허용값 예시
- `card`
- `kakaoPay`
- `general`

아직 결제 확정 전이어도 값 체계는 먼저 고정

---

## 컴포넌트 분리 권장
- `CarSummaryCard`
- `ReservationScheduleSummary`
- `ReservationDriverForm`
- `ReservationPickupInfo`
- `ReservationPolicySection`
- `ReservationPaymentMethodSection`
- `ReservationPriceBox`
- `ReservationSubmitBar`

### 분리 원칙
- 입력 폼과 가격 계산을 같은 컴포넌트에 섞지 않는다.
- 약관 동의와 결제 수단도 분리한다.

---

## 검증 규칙

### 필수 입력
- `carId`
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `customerName`
- `customerPhone`
- `customerBirth`
- `termsState.allAgreed === true`

### 형식 검증
- 연락처 기본 형식 검증
- 생년월일 기본 형식 검증
- 대여/반납 시간 역전 금지

### 흐름 검증
- 검색 상태 누락 시 메인으로 복귀 유도
- 차량 정보 누락 시 에러 처리

---

## 가격 영역 원칙
상세 페이지의 가격 박스는 아래 값을 명확히 분리해야 한다.
- 기본 대여료 (pickup 기준 `rentalCost`)
- 보험 비용 (기본 일반자차 0원)
- 딜리버리 비용 (현재 관측 기준 delivery 모드에서 `delivery.roundTrip`)
- 최종 표시 금액 (위 합산 결과)

### 딜리버리 모드 추가 요소
- `딜리버리 신청` 섹션
- 버튼: `위치 선택` (동 선택 모달 트리거)
- 입력
  - `차량 대여/반납 위치를 선택해 주세요.`
  - `상세 주소 및 업체에 전달하실 내용을 적어주세요. ...`

#### 주의
- 화면 계산용 숫자와 표시 문자열을 섞지 않는다.
- 숫자는 number, 표시 포맷은 util에서 처리
- 더 자세한 UI 구성은 `docs/04_PARTNER_SITE_REFERENCE.md` 참고

---

## 체크리스트
- [ ] 상세 페이지가 `carId` + `searchState` 로 초기화되는가
- [ ] 선택 차량 표시가 `CarSummary` 기준으로 통일되는가
- [ ] 예약자 입력 상태가 별도 모델로 관리되는가
- [ ] 약관 동의 상태가 분리되어 있는가
- [ ] 예약 버튼 활성 조건이 명확한가
- [ ] 가격 계산과 렌더링이 분리되어 있는가

---

## 완료 기준
- 사용자가 상세 페이지에서 실제 입력을 할 수 있다.
- 예약 버튼 활성/비활성 로직이 정리되어 있다.
- 목록→상세로 검색 상태가 끊기지 않는다.
- 다음 단계에서 `/api/reservations/prepare` 연결이 가능한 상태다.

---

## 이 단계에서 하지 말 것
- 실제 PG SDK 확정 연동
- IMS 예약 생성 처리
- 운영자용 상태 관리 추가

이 단계는 **예약 준비 화면 완성**까지다.
