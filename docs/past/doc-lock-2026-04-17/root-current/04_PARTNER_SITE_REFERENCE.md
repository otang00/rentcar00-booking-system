# 04. PARTNER SITE REFERENCE (`partner.premove.co.kr/35457`)

## 1. 전체 흐름 개요

**경로 구조**
- 메인/목록: `/35457?deliveryDateTime=...&returnDateTime=...&pickupOption=pickup|delivery&driverAge=...&order=...&dongId=&deliveryAddress=`
- 상세/예약: `/35457/cars/:carGroupId` + 동일 query 세트

**기본 동작**
- `/35457`로 진입하면 HTTP 307으로 **기본 검색 조건이 채워진 URL**로 리다이렉트된다.
  - 예: `deliveryDateTime=내일 10:00`, `returnDateTime=+1일`, `pickupOption=pickup`, `driverAge=26`, `order=lower`
- 즉, 메인 페이지는 항상 **검색된 상태**로 열리고, URL query가 상태의 단일 소스다.

---

## 2. 메인 페이지 구조 (검색 + 목록)

### 2.1 상단 영역
- 상단 메뉴: `예약내역`, `FAQ`
- 메인 카피: `믿고 타는 빵빵카(주), 지금 바로 예약해 보세요!`

### 2.2 검색 패널

구성 요소:
1. **대여 방식 탭**
   - 라디오 + 라벨: `픽업`, `딜리버리`
   - 기본은 `픽업` 선택

2. **대여/반납 위치**
   - 픽업 모드: 업체 주소 고정 표시
     - 예: `서울 서초구 신반포로23길 78-9 ...`
   - 딜리버리 모드: 선택된 동/주소 표시
     - 예: `서울특별시 강남구 개포동`

3. **대여/반납 일정**
   - 텍스트 표시 형식
     - `04.04(토) 10:00 ~ 04.05(일) 10:00`
   - 실제 query는 `deliveryDateTime`, `returnDateTime`으로 관리

4. **운전자 연령**
   - 버튼 2개
     - `만 21세~25세`
     - `만 26세 이상`

5. **검색 버튼**
   - `검색`
   - 누르면 동일 URL 내에서 차량 목록만 새로고침되는 구조 (Next.js RSC)

### 2.3 검색 요약 바 (sticky)
- 상단에 붙는 요약 영역
  - 텍스트: `총 12대`
  - 정렬 버튼: `낮은 가격순`, `높은 가격순`, `신차순`

### 2.4 차량 카드 목록

각 카드에 표시되는 정보 (pickup 기준):
- 차량명: 예) `올 뉴 K7`
- 연식 범위: `16~18년식`
- 연령 조건: `만26세`
- 연료: `LPG`, `가솔린`, `전기`, `디젤`
- 인승: `5인승`, `9인승`
- 가격 2줄:
  - 할인 가격: `90,000원` (실제 결제 기준 가격, `discountPrice`)
  - 원가: `180,000원` (정가, `price`)
- 옵션 요약: `네비게이션, 블루투스, 후방센서, ... (여러 개)`

**delivery 선택 시 가격 변화 예시 (개포동 40,000원)**
- `pickupOption=pickup`일 때 K7:
  - 90,000 / 180,000
- `pickupOption=delivery & dongId=440`일 때 K7:
  - 130,000 / 220,000
- 즉, **현재 관측 기준으로는 딜리버리 비용이 `roundTrip` 값(예: 40,000원) 기준으로 가격에 더해져 표시**된다.

---

## 3. 딜리버리 위치 선택 플로우

### 3.1 딜리버리 모달

1. 메인에서 `딜리버리` 라벨 클릭 시 상단에 모달/오버레이 등장
2. 구조:
   - 1단계: 광역 선택 버튼 (`서울`, `인천`, `경기` ...)
   - 2단계: 시/구 선택 버튼 (`강남구`, `서초구` ...)
   - 3단계: 동 + 요금 버튼 (`개포동 (40,000원)` 등)
   - 안내 문구: `차량을 받으실 지역을 선택해 주세요. ... 딜리버리 비용은 왕복 기준으로 산정됩니다.`

3. 동 선택 후:
   - 모달이 닫히고
   - 검색 패널의 위치 라벨에 **선택된 동** 표시
   - 예: `서울특별시 강남구 개포동`

4. 이 상태에서 `검색` 버튼을 누르면 URL이 아래처럼 갱신된다.

```txt
/35457?
  deliveryDateTime=...
  &returnDateTime=...
  &pickupOption=delivery
  &driverAge=26
  &order=lower
  &dongId=440
  &deliveryAddress=서울특별시 강남구 개포동 (URL 인코딩)
```

5. 이후 목록 카드 가격에는 딜리버리 비용이 반영된 값이 표시된다.

**주의:**
- 딜리버리 모달에서 동만 선택한 상태에서는 `pickupOption`이 아직 `pickup`으로 남아 있고,
- `검색`을 눌러야 `pickupOption=delivery` 와 `dongId`, `deliveryAddress`가 URL에 반영된다.

---

## 4. 상세/예약 페이지 구조 (`/35457/cars/:carGroupId`)

예시 URL (pickup):
```txt
/35457/cars/22024?
  deliveryDateTime=2026-04-04 10:00
  &returnDateTime=2026-04-05 10:00
  &pickupOption=pickup
  &driverAge=26
```

예시 URL (delivery + 개포동):
```txt
/35457/cars/22024?
  deliveryDateTime=...
  &returnDateTime=...
  &pickupOption=delivery
  &driverAge=26
  &dongId=440
  &deliveryAddress=서울특별시 강남구 개포동
```

### 4.1 상단 공통 영역
- 메인과 동일한 검색 패널
  - `픽업/딜리버리`
  - 대여/반납 위치 (픽업: 업체 주소, 딜리버리: 선택 위치)
  - 대여/반납 일정 표시
  - 운전자 연령 버튼
  - `검색` 버튼

### 4.2 차량 요약 카드
- 차량명: `올 뉴 K7`
- 연식: `16~18년식`
- 연료/인승: `LPG / 5인승`
- 대여/반납 일정: 시작/종료 시각 및 `1일` 같은 기간 표시
- 옵션 리스트

### 4.3 탭/섹션
- 탭 텍스트 (실제 UI 상):
  - `예약 정보`
  - `보험/유의사항`
  - `업체 정보`
- 해당 탭 아래에서 차례로 섹션 배치

### 4.4 예약 폼 섹션

1. **보험 정보**
   - 제목: `보험 정보`, `보험 안내`
   - 플랜 선택:
     - `일반 자차 + 0원`
     - 보상한도: `1,000만원`
     - 자차 면책금: `50만원`

2. **운전자 정보**
   - `이름` → input(text, placeholder: `이름을 입력해 주세요.`)
   - `생년월일` → input(text, placeholder: `YYMMDD`)
   - `휴대폰번호` → input(text, id: `phoneNumberInput`, placeholder: `휴대폰번호를 입력해 주세요.`)
   - `인증번호` 버튼 (초기: disabled)

   버튼 활성 로직 (관측 기준):
   - 이름/생년월일/휴대폰번호 세 필드를 채우면 → `인증번호` 버튼 **활성화**
   - 실제 결제 버튼은 여전히 disabled (SMS 인증 완료 후 활성화 추정)

3. **차량 대여 방법**
   - 픽업/딜리버리 라디오 (상단과 연동)
   - 픽업 옵션
     - `업체 직접 방문 (무료) ...`
   - 딜리버리 옵션
     - `딜리버리 (유료) ...`

   **딜리버리 전용 추가 입력**
   - 버튼: `위치 선택`
     - 딜리버리 동 선택 모달과 연동 (목록 화면과 유사)
   - 텍스트 input 2개:
     1. `차량 대여/반납 위치를 선택해 주세요.` (위치 선택 버튼과 연계)
     2. `상세 주소 및 업체에 전달하실 내용을 적어주세요. ...` (상세 주소/요청사항)

4. **결제 수단**
   - 버튼 3개
     - `신용/체크카드`
     - `카카오페이`
     - `일반결제(법인/개인)`
   - 시각적으로는 버튼이지만 **상태는 라디오 성격** (하나만 선택)

5. **이용 약관 동의**
   - 체크박스 + 라벨
     - `서비스 이용약관`
     - `렌터카 이용 특약사항`
     - `개인정보 수집 및 이용 동의`
     - `개인정보 제3자 제공 동의`
   - 마지막 확인 문구
     - `위 내용을 모두 확인하였으며, 결제에 동의합니다.` (별도 체크박스)

### 4.5 결제 정보 박스

**픽업 모드 예시**
- `대여료` 90,000원
- `보험 (일반자차 포함)` 0원
- `총 결제 금액` 90,000원
- 버튼: `90,000원 바로 결제하기` (초기 disabled → 인증/약관 후 활성 추정)

**딜리버리 모드 + 개포동(40,000원) 예시**
- `대여료` 90,000원
- `보험 (일반자차 포함)` 0원
- `딜리버리 비용` 40,000원
- `총 결제 금액` 130,000원
- 버튼: `130,000원 바로 결제하기` (초기 disabled)

즉, 상세 페이지에서의 **가격 분리 규칙은**:
- 현재 관측값 기준 `finalPrice = rentalCost + delivery.roundTrip`
- main list 카드의 두 줄 가격과 합을 유지한다.

---

## 5. 서버 측 데이터 모델 (RSC에서 추출)

### 5.1 메인 목록: `carInfo`

각 차량 카드 데이터 예시:
```jsonc
{
  "id": 22024,
  "name": "올 뉴 K7",
  "capacity": 5,
  "imageUrl": "https://.../cars/71.png",
  "oilType": "LPG",
  "minModelYear": 2016,
  "maxModelYear": 2018,
  "insuranceAge": 26,
  "options": ["네비게이션", "블루투스", ...],
  "price": 180000,
  "discountPrice": 90000,
  "deliveryPrice": 0 // pickup 기준
}
```

premove-clone의 `CarSummary` DTO는 위 구조를 **우리 쪽 이름으로 래핑**하면 된다.

### 5.2 상세 페이지: `carDetailInfo`

```jsonc
{
  "id": 22024,
  "name": "올 뉴 K7 (2016년~)_LPG",
  "minModelYear": 2016,
  "maxModelYear": 2018,
  "seater": 5,
  "model": "K7",
  "segmentCode": "sedan_e",
  "manufacturerName": "기아",
  "fuelType": "lpg",
  "rentAge": 26,
  "originCost": 180000,
  "rentalCost": 90000,
  "options": ["navigation", "bluetooth", ...],
  "submodel": {
    "id": 71,
    "name": "올 뉴 K7",
    "externalName": "K7 2세대",
    "imageUrl": "https://.../cars/71.png"
  },
  "insurance": {
    "carInsurance": [
      { "id": 0, "category": "general", "fee": 0, "coverage": 1000, "indemnificationFee": 50 }
    ],
    "fullInsurance": { ... }
  },
  "delivery": {
    "oneWay": 20000,
    "roundTrip": 40000
  }
}
```

### 5.3 렌트 기간 정보: `rentPeriodInfo`

```jsonc
{
  "pickupAt": "2026-04-04 10:00",
  "dropoffAt": "2026-04-05 10:00"
}
```

이 데이터는 상세 페이지 상단의 일정 표시 및 일수 계산에 사용된다.

---

## 6. premove-clone 설계에 바로 반영해야 할 포인트

1. **URL = 상태**
   - 우리도 `/companyId` + query 를 기준 상태로 삼는 것이 자연스럽다.
   - `pickupOption`, `dongId`, `deliveryAddress` 까지 URL로 관리.

2. **딜리버리 플로우**
   - 메인: 딜리버리 선택 → 지역/동 모달 → dongId/주소/추가요금 계산 → 검색 → 목록/URL 반영
   - 상세: 딜리버리 선택 → `위치 선택` + 상세주소 입력 → 결제 박스에 `딜리버리 비용` 라인 추가

3. **가격 분리/합산 규칙**
   - 목록 카드: 할인가/정가
   - 상세 박스: 대여료/보험/딜리버리/총 금액
   - 현재 관측 기준 총액 계산은 `rentalCost + delivery.roundTrip`로 이해하는 것이 맞다.
   - 서버 DTO에는 `delivery.oneWay`, `delivery.roundTrip` 둘 다 보존한다.

4. **폼/버튼 상태 규칙**
   - 이름/생년월일/전화번호 미입력 → 인증 버튼 disabled
   - 인증 전/약관 미체크 → 결제 버튼 disabled
   - 예약 준비/결제 전 API 설계 시 이 상태 흐름을 그대로 반영해야 자연스럽다.

5. **문서/구현 연결**
   - 이 문서는 **실제 사이트 관찰을 바탕으로 한 참조 스펙**이다.
   - `PHASE_02_PARTNER_PROXY`, `PHASE_03_DETAIL_AND_RESERVATION` 구현 시 이 문서의 구조를 그대로 따라가면 된다.
�� 시 이 문서의 구조를 그대로 따라가면 된다.
