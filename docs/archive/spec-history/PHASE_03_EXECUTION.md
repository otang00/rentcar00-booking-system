# PHASE 03. EXECUTION PLAN

## 목적
이 문서는 `PHASE_03_DETAIL_AND_RESERVATION.md`를
**현재 코드베이스 기준 실제 작업 순서**로 쪼갠 실행 문서다.

핵심 원칙:
- PHASE 03은 **예약 준비 화면 완성**까지다.
- 실제 IMS 예약 생성 / PG 연동은 하지 않는다.
- 목록에서 넘어온 `carId + searchState` 맥락을 유지한다.
- 한 번에 크게 붙이지 말고 `03A → 검증 → 03B → 검증` 식으로 간다.

---

## 현재 기준 상태

### PHASE 02 완료 상태
- 메인 목록은 `partner.premove.co.kr` 응답을 fetch + parse 해서 실제 렌더함
- `/api/search-cars` 존재
- `SearchCarsResponse` 수준 DTO 확보
- 메인 → 상세 이동 시 `carSummary` fallback state 전달 가능

### 아직 없는 것
- 상세용 실제 partner fetch/parse endpoint
- 상세 페이지 전용 DTO
- 예약자 입력 상태 모델
- 약관 동의 / 결제수단 상태 모델
- 가격 계산 로직 분리
- 제출 가능 여부 계산

즉, PHASE 03은 **상세 페이지를 실제 예약 준비 화면으로 바꾸는 단계**다.

---

## 목표 결과
PHASE 03가 끝나면 아래가 되어야 한다.

1. 상세 페이지가 `carId + searchState` 로 안정적으로 초기화됨
2. partner 기반 상세 데이터가 표시됨
3. 예약자 입력 상태가 별도로 관리됨
4. 약관/결제수단/가격 계산이 분리됨
5. 제출 버튼 활성 조건이 정리됨

---

# 03A. 상세 서버 진입점 구조 만들기

## 목표
상세 페이지용 내부 endpoint와 partner 상세 fetch 흐름의 골격을 만든다.

## 생성 파일
- `api/car-detail.js` 또는 `api/cars/[carId].js` 성격의 route
- `server/partner/buildPartnerDetailUrl.js`
- `server/partner/fetchPartnerCarDetail.js`
- `server/partner/parsePartnerCarDetail.js`
- `server/partner/mapPartnerCarDetailDto.js`

## 권장
- 현재 프로젝트 구조와 맞추려면 `api/car-detail.js` 형태가 가장 빠름
- query: `carId + searchState`

## 완료 기준
- 상세용 endpoint 파일이 생기고 더미 응답이라도 반환 가능

## 검증 포인트
- `carId` 필수 검증
- search query 전달 여부 확인

---

# 03B. partner 상세 URL builder 작성

## 목표
목록과 같은 검색 맥락을 유지한 채 상세 partner URL을 만든다.

## 생성/수정 파일
- `server/partner/buildPartnerDetailUrl.js`

## 입력
- `carId`
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- 선택: `dongId`, `deliveryAddress`, `order`

## 출력 예시 방향
- `https://partner.premove.co.kr/35457/cars/:carId?...`

## 완료 기준
- 같은 `carId + searchState` 는 항상 같은 URL 생성

## 검증 포인트
- pickup 상세 URL 1개
- delivery 상세 URL 1개

---

# 03C. partner 상세 fetcher / parser / mapper

## 목표
partner 상세 응답에서 필요한 정보만 추출해 내부 DTO로 고정한다.

## 생성/수정 파일
- `server/partner/fetchPartnerCarDetail.js`
- `server/partner/parsePartnerCarDetail.js`
- `server/partner/mapPartnerCarDetailDto.js`

## 최소 추출 대상
### car
- `carId`
- `name`
- `imageUrl`
- `oilType`
- `capacity`
- `minModelYear`
- `maxModelYear`
- `options`

### pricing
- `rentalCost`
- `originCost`
- `insurancePrice`
- `delivery.oneWay`
- `delivery.roundTrip`
- `finalPrice`

### company
- `companyId`
- `companyName`
- `companyTel`
- `fullGarageAddress`

### policy/display
- 보험 관련 문구
- 약관/유의사항에 필요한 최소 텍스트

## 완료 기준
- 상세 endpoint가 프론트용 DTO를 반환 가능

## 검증 포인트
- pickup 상세 가격 확인
- delivery 상세에서 `roundTrip` 반영값 확인

---

# 03D. 상세 페이지 데이터 연결

## 목표
현재 fallback/mocked 성격의 상세 페이지를 실제 endpoint 기반으로 전환한다.

## 수정 파일
- `src/pages/CarDetailPage.jsx`
- 필요 시 `src/services/cars.js`

## 세부 작업
1. `fetchCarDetail(searchState, carId)` 추가
2. 상세 페이지에서 loading / error / success 상태 분리
3. fallback summary는 초기 표시용으로만 남기고, 실제 응답으로 교체
4. company / 가격 / 차량 요약을 실제 데이터 기반으로 렌더

## 완료 기준
- 새로고침해도 상세가 실제 데이터로 뜬다.
- 목록 state가 없어도 query + carId만 맞으면 상세가 열린다.

---

# 03E. 예약 폼 상태 모델 도입

## 목표
예약자 입력 상태를 명시적 모델로 분리한다.

## 수정 파일
- `src/pages/CarDetailPage.jsx`
- 필요 시 `src/components/detail/*`

## 상태 모델
```js
{
  customerName: '',
  customerPhone: '',
  customerBirth: '',
}
```

## 세부 작업
- controlled input 전환
- 입력값 변경 핸들러 분리
- 기본 형식 검증 준비

## 완료 기준
- 예약자 입력이 단일 state 모델로 관리됨

---

# 03F. 약관 / 결제수단 / 제출 가능 여부 분리

## 목표
약관 동의, 결제수단, 제출 버튼 상태를 분리한다.

## 상태 모델
### termsState
```js
{
  allAgreed: false,
  serviceAgreed: false,
  privacyAgreed: false,
  rentalPolicyAgreed: false,
}
```

### paymentMethod
- `card`
- `kakaoPay`
- `general`

## 세부 작업
- all agree ↔ 개별 동의 동기화
- 결제수단 선택 상태 분리
- 제출 가능 여부 계산 함수 분리

## 완료 기준
- 버튼 활성/비활성 기준이 코드상 분명함

---

# 03G. 가격 계산 로직 분리

## 목표
화면 렌더용 가격 계산을 util 또는 계산 함수로 분리한다.

## 세부 작업
- 기본 대여료
- 보험료
- 딜리버리 비용
- 총 결제 금액
를 숫자로 계산 후 표시 포맷팅

## 중요 기준
- delivery 모드에서는 현재 관측 기준 `delivery.roundTrip` 반영
- 숫자와 표시 문자열 혼용 금지

## 완료 기준
- 상세 가격 박스가 계산 함수 결과만 렌더함

---

# 03H. 딜리버리 입력 섹션 정리

## 목표
delivery 선택 시 필요한 입력 구조를 준비한다.

## 세부 작업
- 위치 선택 버튼
- 선택된 주소 표시
- 상세 주소 / 전달 메모 입력칸
- pickup 모드에서는 숨김

## 주의
- 실제 동 선택 모달 완성까지 못 가더라도 상태 모델은 먼저 고정

## 완료 기준
- 딜리버리 모드일 때 관련 입력 영역이 일관되게 표시됨

---

## 권장 실제 진행 순서
1. **03A 서버 진입점**
2. 검증
3. **03B URL builder**
4. 검증
5. **03C fetch/parser/mapper**
6. 검증
7. **03D 상세 페이지 데이터 연결**
8. 검증
9. **03E 예약 폼 상태**
10. 검증
11. **03F 약관/결제수단/제출 가능 여부**
12. 검증
13. **03G 가격 계산 분리**
14. 검증
15. **03H 딜리버리 입력 섹션**
16. 최종 검증

---

## 이번 phase에서 하지 말 것
- IMS 예약 생성
- 실제 PG 결제 요청
- 운영자 상태 관리

PHASE 03은 **예약 준비 화면 완성**까지만 한다.

---

## 지금 바로 착수할 단계
**다음 작업은 03A다.**

이유:
- 상세 endpoint 구조가 먼저 잡혀야
- 상세 parser / mapper / 폼 상태를 그 위에 안정적으로 얹을 수 있기 때문이다.
