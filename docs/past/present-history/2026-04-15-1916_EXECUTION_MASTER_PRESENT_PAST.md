# EXECUTION MASTER

## 목적
`premove-clone`를 **검색 DB-only + 상세 DB-only 전환** 기준으로 다시 정렬한다.

이번 문서는 분산된 현재 문서를 대체하는 **유일한 실행 기준 문서**다.
기존 present 문서는 모두 `docs/past/present-history/2026-04-15-1751_*` 로 이관했다.

---

## 1. 코드 교차검증 기준 현재 상태
아래는 문서가 아니라 **현재 코드**를 직접 읽고 확인한 기준이다.

### 1.1 검색은 이미 DB-only
근거:
- `api/search-cars.js`
- `server/search-db/dbSearchService.js`
- `server/search-db/repositories/fetchPriceRules.js`
- `server/search-db/transformers/mapDbCarsToDto.js`

확인 내용:
- `/api/search-cars` 는 partner 검색을 호출하지 않는다.
- Supabase client 생성 후 `dbSearchService.run()` 만 탄다.
- 검색 가격은 `v_active_group_price_policies` 우선, 없으면 `car_prices` fallback 이다.
- DTO는 `carId=vehicleId`, `groupId=source_group_id` 구조다.
- group dedupe 가 걸려 있어 그룹당 대표 1건만 내려간다.

### 1.2 상세는 아직 partner HTML 의존
근거:
- `api/car-detail.js`
- `server/partner/buildPartnerDetailUrl.js`
- `server/partner/fetchPartnerCarDetail.js`
- `server/partner/parsePartnerCarDetail.js`
- `server/partner/mapPartnerCarDetailDto.js`
- `server/detail/mergeCarDetailSources.js`

확인 내용:
- `/api/car-detail` 는 partner 상세 URL HTML을 fetch 한다.
- 그 HTML에서 `companyInfo`, `carDetailInfo` 를 파싱하려고 한다.
- 이후에만 Supabase `fetchCarBySourceCarId()` 로 차량 정보를 merge 한다.
- 즉 상세의 1차 source 는 DB가 아니라 partner HTML 이다.

### 1.3 현재 실제 장애와 복구 상태
이전 운영 확인 결과:
- search: 200 정상
- detail: 500 실패
- 대표 케이스: `carId=216821`, `groupId=22533`
- 오류: `partner_detail_parser_failed: carDetailInfo not found`

현재 반영 후 운영 확인 결과:
- search: 200 정상 유지
- detail: 200 복구
- `/api/car-detail?carId=216821...` 응답 정상
- `meta.source='db-detail'`, `meta.pricingSource='group-price-policy'`

추가 확인 결과:
- preview 배포는 `supabase_client_unavailable` 로 검증 불가
- 즉 preview env 에 Supabase 설정이 없거나 연결되지 않았다

판단:
- 상세 장애의 직접 원인은 **partner HTML 파싱 실패**였고,
- 1차 복구는 **DB-only 상세로 컷오버**해서 해결했다.

### 1.4 프론트 상세가 실제로 요구하는 것
근거:
- `src/services/carDetail.js`
- `src/components/CarDetailSection.jsx`

프론트가 실제로 강하게 기대하는 영역:
- `company`
- `car`
- `pricing`
- `insurance`
- `meta`

주의:
- 현재 화면은 `car && pricing && insurance` 가 모두 있어야 렌더된다.
- 즉 `insurance` 를 아예 제거하면 UI가 바로 빈 상태로 남는다.
- DB-only 전환 초기에는 **빈 객체 fallback 이라도 구조를 유지**해야 한다.

---

## 2. 운영 전제 잠금

아래 전제는 다음 실행 phase의 고정 기준이다.

### 보험
- 현재는 `general` 보험만 사용한다.
- `full` 보험은 후속 기능으로 분리한다.
- `full` 보험은 추가금액 구조가 들어가므로 이번 범위에서 구현하지 않는다.

### 운전경력 / 연령
- 현재 운영 차량은 `26세 이상` 기준만 사용한다.
- `21세`는 현재 꺼져 있는 상태로 유지한다.
- 운전경력 표시는 구조만 유지하고, 지금 단계의 핵심 표시 항목으로 보지 않는다.

### 이미지
- 이미지가 없는 차량은 일단 빈값 허용으로 운영한다.
- 이미지 보강은 후속 phase 로 미룬다.
- 단, 자동차 이미지 ID 단서는 확보 가능성이 있으므로 후속 보강 여지는 열어둔다.

### 운영시간
- 기본 운영시간은 `09:00 ~ 21:00` 로 고정한다.
- 배차/반차 가능 시간도 동일하게 이 구간 안으로 본다.
- 이후 설정값으로 수정 가능하게 만들어야 한다.

### 제조사 / 모델명
- 별도 시트가 있으므로 후속 보강 가능하다.
- 이번 단계 우선순위는 아니다.

### 최우선 목표
- 지금은 데이터 완전성보다 **상세가 운영 기준으로 자연스럽게 제대로 보이는 것**이 우선이다.

---

## 3. 지금부터의 source-of-truth

### 검색
- source-of-truth: Supabase DB
- partner 검색 복귀 금지

### 가격
- source-of-truth: 그룹 기반 가격 구조
- 기준: `car_groups`, `price_policies`, `price_policy_groups`, `v_active_group_price_policies`
- 임시 fallback: 뷰 미존재 시 `car_prices`

### 상세
- 목표 source-of-truth: Supabase DB + 검색과 동일한 내부 계산/정책
- partner HTML 의존 제거 대상

### 프론트 계약
- `src/services/cars.js` 의 search 응답 shape 유지
- `src/services/carDetail.js` 의 detail 응답 shape도 초기에는 유지
- 단, 값이 없는 필드는 `null`, `[]`, `0`, 빈 문자열로 안전하게 채운다.

---

## 3. 이번 정리에서 폐기한 기존 문서 운영 방식
기존 문제:
- 현재 문서가 여러 장으로 분산돼 실제 코드와 기준 문서가 자주 어긋남
- search와 detail 우선순위가 시점마다 달라 보임
- price 문서와 실행 문서가 따로 놀기 쉬움

새 원칙:
- **실행 기준은 이 문서 1개만 본다**
- 세부 스펙 원본은 아래만 reference 로 둔다
  - `docs/00_FINAL_GOAL.md`
  - `docs/04_PARTNER_SITE_REFERENCE.md`
  - `docs/06_EXTERNAL_PREVIEW_DEPLOY_RUNBOOK.md`
  - `docs/references/IMS_API_CALLS.md`
- 과거 기준은 모두 `docs/past/` 에 둔다

---

## 5. 실행 로드맵

### Phase 1. 상세 partner 의존 제거
#### 상태
- 완료

#### 결과
- `/api/car-detail` 의 partner HTML fetch/parse 경로 제거
- DB-only 상세 DTO 조립기 `server/detail/buildDbCarDetailDto.js` 추가
- 운영 대표 케이스 API 200 복구

---

### Phase 2. 최소 상세 DTO 고정
#### 상태
- 완료
#### 목적
DB-only 상세에서 프론트가 죽지 않는 최소 응답 계약을 잠근다.

#### 최소 보장 필드
- `search`
- `company.companyId`, `company.companyName`, `company.companyTel`, `company.fullGarageAddress`, `company.deliveryTimes`, `company.deliveryCostList`
- `car.carId`, `car.name`, `car.displayName`, `car.imageUrl`, `car.fuelType`, `car.capacity`, `car.minModelYear`, `car.maxModelYear`, `car.rentAge`, `car.drivingYears`, `car.options`
- `pricing.rentalCost`, `pricing.originCost`, `pricing.insurancePrice`, `pricing.delivery.oneWay`, `pricing.delivery.roundTrip`, `pricing.finalPrice`
- `insurance.general`, `insurance.full`
- `meta.source`

#### 종료 조건
- 프론트 상세가 로딩/에러 루프 없이 렌더 시도 가능
- 응답 shape 오류가 아닌 **실제 누락 필드 목록**이 보이기 시작함

실제 현재 DTO 상태:
- `insurance={ general:null, full:null }`
- `pricing.delivery={ oneWay, roundTrip }` 유지
- `company.deliveryCostList` 유지
- `car.drivingYears=0` 인 경우 프론트 문구는 `확인 필요` 로 처리

---

### Phase 3. 오류 리스트 수집
#### 상태
- 1차 수집 완료
#### 목적
partner 제거 후 실제 부족분을 증상 기준으로 뽑는다.

#### 수집 방식
- API 응답 확인
- 브라우저 상세 진입 확인
- 대표 차량 3~5건 확인

#### 오류 분류
1. API shape 오류
2. DB 누락 필드
3. UI 가정 불일치
4. 계산 로직 누락

#### 종료 조건
- 수정해야 할 실제 오류 리스트가 문서/로그로 정리됨

---

### Phase 4. 운영 표시형 상세 정리
#### 목적
상세가 운영 기준으로 자연스럽게 보이도록 표시 정책을 먼저 정리한다.

#### 이번 phase 에서 할 일
1. 보험 영역을 `general` 기준으로 고정
2. `full` 보험은 후속 영역으로 분리 또는 비노출
3. 운전경력은 현재 운영상 비핵심이므로 문구 비중 축소 또는 fallback 유지
4. 운영시간 `09:00~21:00` 표시 반영
5. 이미지 없을 때도 상세가 어색하지 않게 유지

#### 실제 수정 대상 후보
- `src/components/CarDetailSection.jsx`
- `src/services/carDetail.js`
- 필요 시 `server/detail/buildDbCarDetailDto.js`

#### 종료 조건
- 상세 핵심 정보가 운영 기준으로 자연스럽게 보임
- `확인 필요` 문구가 필요한 최소 범위로 줄어듦

---

### Phase 5. 가격 일치성 검증
#### 목적
검색 가격과 상세 가격이 동일 규칙으로 보이는지 확인한다.

#### 검증 대상
- pickup 대표 샘플
- delivery 대표 샘플
- 서로 다른 그룹 가격 3~5개 샘플

#### 검증 항목
- search `discountPrice` == detail `rentalCost`
- search `price` == detail `originCost`
- delivery 시 배송비 반영 일치
- `meta.pricingSource` 일관성

#### 종료 조건
- 대표 샘플에서 가격 일치
- 불일치가 있으면 케이스별 원인 리스트 확보

---

### Phase 6. general 보험 고정
#### 목적
현재 운영에 필요한 보험 표시를 general-only 기준으로 확정한다.

#### 이번 phase 에서 할 일
- general 보험 필드 계약 고정
- coverage / 면책금 / 안내문구 기준 정리
- `full` 보험은 후속 기능 placeholder 로 유지

#### 종료 조건
- 보험 영역이 운영 기준으로 해석 가능
- full 보험 미구현 상태가 의도된 동작으로 정리됨

---

### Phase 7. 운영 설정값 분리
#### 목적
운영시간과 정책값을 하드코딩에서 설정 가능 구조로 옮길 준비를 한다.

#### 이번 phase 에서 할 일
- 운영시간 `09:00~21:00` 설정화 경로 설계
- 배차/반차 가능 시간도 같은 설정 사용 구조 검토
- 21세 on/off, 운전경력 표기 여부도 설정화 후보로 정리

#### 종료 조건
- 현재 하드코딩 정책을 어떤 설정축으로 뺄지 결정됨

---

### Phase 8. 이미지 보강
#### 목적
현재 없는 차량 이미지를 후속으로 복구한다.

#### 종료 조건
- 이미지 ID 단서로 복구 가능한 차량 목록 확보 또는 실제 복구 시작

---

### Phase 9. 제조사/모델명 보강
#### 목적
별도 시트를 기준으로 상세 부가정보를 채운다.

#### 종료 조건
- `manufacturerName`, `model` 채움 경로가 정리됨

---

## 6. 즉시 실행용 체크리스트

### Phase 4 실행 체크리스트
- [ ] 보험 영역을 general-only 기준으로 화면 문구 재정리
- [ ] full 보험 표시 영역은 제거 또는 후속예정 상태로 정리
- [ ] 운전경력 `0` 표시를 운영 문맥에 맞게 약화 또는 비노출 처리
- [ ] 운영시간 `09:00~21:00` 표시 추가
- [ ] 이미지 없을 때 기본 동작 확인

### Phase 5 검증 체크리스트
- [ ] pickup 샘플 3건 search/detail 가격 대조
- [ ] delivery 샘플 2건 price/deliveryPrice 대조
- [ ] 서로 다른 groupId 샘플 확보
- [ ] 불일치 시 source/policy 원인 기록

### Phase 6 준비 체크리스트
- [ ] general 보험에서 실제 운영상 보여줄 필드 잠금
- [ ] full 보험은 후속 기능으로 문서화
- [ ] 보험 데이터 source 후보 정리

### Phase 7 준비 체크리스트
- [ ] 운영시간 하드코딩 위치 파악
- [ ] 설정 파일 또는 DB 설정화 후보 결정
- [ ] 배차/반차 시간 정책 연결 포인트 확인

---

## 7. 실제 코드 기준 예상 오류 리스트
상세 partner 제거 직후 우선 예상되는 문제는 아래다.

### A. API shape 관련
- 치명적 shape 오류는 1차 해소
- `insurance` 는 구조 유지 상태에서 값만 `null`
- `pricing.delivery` 하위 객체 유지 확인
- `company.deliveryCostList` 제공 확인

### B. DB 누락 데이터 관련
- `drivingYears` 출처 부재, 현재 `0 -> 확인 필요` 처리
- 보험 상세 한도/면책금 부재
- 업체 운영시간은 현재 빈 배열
- 이미지 비어 있는 차량 존재
- `manufacturerName`, `model` 비어 있음

### C. 계약 불일치 관련
- search는 `carId=vehicleId`, `groupId=pricing key`
- detail도 현재 `carId=vehicleId` 유지 확인
- `meta.groupId` 로 그룹 키 별도 노출 중

### D. 가격 관련
- 대표 케이스에서 search/detail 가격은 일치
  - search: `discountPrice=56000`, `price=160000`
  - detail: `rentalCost=56000`, `originCost=160000`
- 추가 케이스 샘플 검증은 더 필요

### E. 배포 환경 관련
- preview는 `supabase_client_unavailable`
- 즉 실제 API 검증은 현재 production 중심으로 해야 함

---

## 8. 실제 파일 단위 작업 대상

### 직접 수정 우선 대상
- `api/car-detail.js`
- 필요 시 `server/detail/*`
- 필요 시 `server/supabase/*`
- 필요 시 `src/components/CarDetailSection.jsx` 최소 fallback

### 삭제 또는 미사용 후보
- `server/partner/buildPartnerDetailUrl.js`
- `server/partner/fetchPartnerCarDetail.js`
- `server/partner/parsePartnerCarDetail.js`
- `server/partner/mapPartnerCarDetailDto.js`
- `server/detail/mergeCarDetailSources.js`

주의:
- 삭제는 Phase 1 완료 후, 실제 참조 제거가 확인된 뒤 한다.
- 1차는 먼저 **호출 경로 제거**가 우선이다.

---

## 9. 검증 순서
1. `/api/search-cars` 기존 정상 유지 확인
2. `/api/car-detail?carId=216821...` 200 확인
3. 대표 3~5대 carId로 상세 API 확인
4. 브라우저에서 search -> detail 진입 확인
5. 가격 표시값이 search와 얼마나 다른지 확인
6. 운영 배포 후 production URL 기준 재검증

---

## 10. 이번 문서 정리 결과
- 기존 present 문서는 모두 past 이관
- 현재 실행 기준 문서는 이 파일 1개
- 이후 문서 추가가 필요하면 원칙은 아래다
  - 실행 기준 변경: 이 문서 수정
  - 과거 이력 보존: `docs/past/` 추가
  - 외부 참고: `docs/references/` 유지

---

## 11. 현재 한 줄 결론
지금 프로젝트의 실질적인 다음 단계는
**상세의 partner HTML 의존을 걷어내고, DB-only 상세를 200으로 먼저 복구한 뒤, 실제 오류 리스트를 기준으로 하나씩 보강하는 것**이다.
