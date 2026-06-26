# PHASE 02. PARTNER PROXY

## 목적
partner 검색 결과를 우리 서버가 받아,
프론트가 바로 쓸 수 있는 차량 목록 JSON으로 변환한다.

이 단계의 핵심은
**외부 응답을 우리 시스템의 안정된 DTO로 바꾸는 것**이다.

---

## 이 단계에서 해결할 문제
- 프론트가 partner 응답 형식에 직접 의존하면 안 됨
- partner는 `_rsc` 기반 서버 렌더 결과를 내려주므로 파서가 필요함
- query key/DTO key가 흔들리면 이후 예약 단계가 꼬임

---

## 선행 기준
- PHASE 01 완료
- `docs/03_CONVENTIONS.md` 기준 이름 사용
- 실제 사이트 구조 참고: `docs/04_PARTNER_SITE_REFERENCE.md`

---

## 서버 구조 기준

```txt
server/
  routes/
    searchCars.ts
  services/
    partner/
      buildPartnerUrl.ts
      fetchPartnerSearch.ts
      parsePartnerSearch.ts
      mapPartnerDto.ts
      types.ts
```

### 역할
- `buildPartnerUrl.ts`
  - partner 검색 URL 생성
- `fetchPartnerSearch.ts`
  - 외부 요청/헤더/재시도 담당
- `parsePartnerSearch.ts`
  - `_rsc` 또는 응답 본문에서 필요한 데이터 추출
- `mapPartnerDto.ts`
  - 파싱 결과를 우리 DTO로 변환
- `types.ts`
  - partner raw type / internal dto type 정의

---

## 입력 규칙
입력은 반드시 아래 키만 받는다.
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- `order`
- 선택: `dongId`, `deliveryAddress`

#### 금지
- fetch 단계에서 임의 파라미터 생성
- 프론트용 키와 partner용 키를 뒤섞기

---

## 파싱 대상
partner 응답에서 최소한 아래를 추출한다.

### company
- `companyId`
- `companyName`
- `companyTel`
- `fullGarageAddress`
- 필요 시 `deliveryCostList`

### list meta
- `totalCount`

### cars[]
- `carId`
- `name`
- `capacity`
- `imageUrl`
- `oilType`
- `minModelYear`
- `maxModelYear`
- `insuranceAge`
- `options`
- `price`
- `discountPrice`
- `deliveryPrice`

---

## 내부 DTO 기준

### SearchCarsResponse
```json
{
  "search": {},
  "company": {},
  "totalCount": 0,
  "cars": []
}
```

### CarSummary
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

---

## API 설계

### `GET /api/search-cars`
#### request query
- convention 문서 기준 query key 그대로 받음

#### response
- `search`
- `company`
- `totalCount`
- `cars`

#### response principle
- partner 원문 응답 전달 금지
- `_rsc` raw fragment 전달 금지
- UI에 필요한 값만 재조합

---

## 에러 처리 기준

### 외부 요청 실패
- 상태: 502 또는 내부 표준 에러
- 메시지: 외부 조회 실패

### 파싱 실패
- 상태: 500 또는 parser error code
- 로그: 원인 식별 가능하게 남김

### 결과 없음
- 에러 아님
- `cars=[]`, `totalCount=0`

---

## 검증 포인트
- [ ] partner URL이 query key 기준으로만 조합되는가
- [ ] parser와 mapper가 분리되어 있는가
- [ ] `carId` / `companyId` / `totalCount` 명칭이 고정되었는가
- [ ] 프론트가 partner 응답 원문을 몰라도 되는가
- [ ] 빈 결과와 실패가 구분되는가

---

## 완료 기준
- 프론트가 `/api/search-cars` 하나로 실제 차량 목록을 받는다.
- partner 포맷이 바뀌더라도 서버 내부 수정으로 막을 수 있다.
- 다음 단계에서 상세/예약 페이지에 안정적으로 연결 가능하다.

---

## 이 단계에서 하지 말 것
- 예약 생성 API 구현
- 결제 연동
- IMS 저장 처리

이 단계는 **조회 안정화**만 담당한다.
