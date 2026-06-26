# SEARCH_CONTRACT_AUDIT

## 1. 결론
- 검색 API 입력은 `deliveryDateTime, returnDateTime, pickupOption, driverAge, order, dongId, deliveryAddress (+ deliveryAddressDetail=프론트 전용)` 조합으로 고정돼 있으며, 서버는 `pickupOption=delivery`일 때만 위치 파라미터를 인정한다.
- 서버 응답은 `search + company + totalCount + cars + meta` 5요소를 항상 포함하며, DB 검색 엔진도 동일 shape 를 반환해야 프론트(`src/services/cars.js`, `SearchResultsSection`, `CarCard`)가 깨지지 않는다.
- 프론트가 계산에 직접 쓰는 필드는 `company.companyName`, `totalCount`, `cars[].{carId,name,imageUrl,minModelYear,maxModelYear,insuranceAge,oilType,capacity,options,price,discountPrice,deliveryPrice}`이며, 이 최소 계약을 보존하면 DB 전환 시 UI 영향이 없다.
- `meta.source` 는 현재 `partner-url-fetch` 고정으로 "어떤 백엔드 소스가 응답을 만들었는가"만 표기한다. DB 전환 시에도 동일 키를 유지하고 값만 변경하면 된다.
- `deliveryAddressDetail` 은 검색 계약이 아니라 예약/상세 입력을 돕는 프론트 상태 필드다. 서버에서 요구하거나 삭제하면 안 된다.

## 2. 근거 파일
- `api/search-cars.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/parsePartnerSearch.js`
- `server/partner/mapPartnerDto.js`
- `src/services/cars.js`
- `src/components/SearchResultsSection.jsx`
- `src/components/CarCard.jsx`
- `src/components/DetailSearchBox.jsx`
- `src/utils/searchQuery.js`
- `docs/present/VALIDATION_PRESENT.md`, `docs/present/IMPLEMENTATION_RULES_PRESENT.md`

## 3. 입력 query 표
| 필드 | 형식 / 옵션 | 필수 조건 | 서버 사용처 | 비고 |
| --- | --- | --- | --- | --- |
| `deliveryDateTime` | 문자열 `YYYY-MM-DD HH:mm` | 항상 필요 | partner URL `deliveryDateTime` | normalize 실패 시 기본값 (buildPartnerUrl L6-L48) |
| `returnDateTime` | 문자열 `YYYY-MM-DD HH:mm` | 항상 필요, `>` delivery | partner URL `returnDateTime` | 유효성은 서버/프론트 둘 다 검사 |
| `pickupOption` | `pickup` \| `delivery` | 항상 필요 | partner URL `pickupOption` (L61-L77) | `delivery`일 때만 위치 파라미터 허용 |
| `driverAge` | 숫자 `21` 또는 `26` | 항상 필요 | partner URL `driverAge` | 검색 결과 필터링에 쓰임 (프론트 mock에도 동일 옵션) |
| `order` | `lower` \| `higher` \| `newer` | 항상 필요 | partner URL `order` | 프론트 sort 버튼 state와 연동 |
| `dongId` | 양의 정수 | `pickupOption=delivery`일 때 필수 | partner URL `dongId` | pickup일 때는 강제로 `null` 처리|
| `deliveryAddress` | 문자열 | `pickupOption=delivery`이고 값 입력 시 전달 | partner URL `deliveryAddress` | 미입력 시 빈 문자열 |
| `deliveryAddressDetail` | 문자열 | 서버에서는 미사용 | **전송 X**, URL query/프론트 상태만 유지 | Detail 페이지에서 상세주소 입력 가이드를 위해 사용 (`DetailSearchBox`) |

## 4. 응답 DTO 표
### 4.1 최상위 필드
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `search` | 객체 | `validateSearchState`가 돌려준 normalized 검색 상태 (`deliveryDateTime` 등, detail 미포함). |
| `company` | 객체 | `mapCompany(companyInfo)` 결과. 업체 기본 정보 + 딜리버리 요금표. |
| `totalCount` | 숫자 | partner flight 의 `총 n대` 파싱 혹은 car 배열 길이 fallback. |
| `cars` | 배열 | `parsed.carInfos.map(mapCar)` 결과. 각 요소는 partner 단일 차량 DTO. |
| `meta` | 객체 | `{ source: 'partner-url-fetch' }`. 응답 계산 소스를 나타내는 유일 필드. |

### 4.2 `company` 오브젝트 필드 (server/partner/mapPartnerDto.js)
| 필드 | 타입 | 비고 |
| --- | --- | --- |
| `companyId` | 숫자 | partner 식별자 |
| `companyName` | 문자열 | 검색 결과 헤더에서 `company.name`으로 사용 (`SearchResultsSection`) |
| `companyTel` | 문자열 | 상세 박스에서 표시/예약용 |
| `fullGarageAddress` | 문자열 | 픽업 옵션이 `pickup`일 때 수령 위치로 노출 (DetailSearchBox) |
| `garageLat`/`garageLng` | 숫자 | 현재 UI 미사용, 추후 지도 용도 가능 |
| `deliveryTimes` | 배열 | `dayOfWeek/startAt/endAt/holiday` 구조. 현재 UI 직접 사용 X. |
| `deliveryCostList` | 배열 | 광역시/군/동별 배송비 정보. Detail/예약 폼에서 향후 사용 가능, 현재 UI 직접 사용 X. |

### 4.3 `car` 오브젝트 필드
| 필드 | 타입 | 프론트 사용 여부 |
| --- | --- | --- |
| `carId` | 숫자/문자열 | `toCardModel` → `car.id` 로 사용 (링크 key). |
| `name` | 문자열 | 카드/상세 제목 |
| `capacity` | 숫자 | `seats` 레이블 생성(정확히 `${capacity}인승`) |
| `imageUrl` | 문자열 | 썸네일 URL |
| `oilType` | 문자열 | 연료 레이블 |
| `minModelYear`/`maxModelYear` | 숫자 | `yearLabel` 계산 |
| `insuranceAge` | 숫자 | `ageLabel` 생성 (`만XX세`) |
| `options` | 배열 | 카드 feature line 에서 join |
| `price` | 숫자 | 총액 계산 (`totalPrice`) |
| `discountPrice` | 숫자 | 일당 가격 (`dayPrice`) |
| `deliveryPrice` | 숫자 | pickupOption=delivery일 때 `dayPrice`/`totalPrice` 가산 |

## 5. 프론트 필수 의존 필드
- `payload.company.companyName` → 랜딩 상단 카피 (`SearchResultsSection` L52-L66).
- `payload.totalCount` → “총 n대” 카운터 및 Empty state 분기.
- `payload.cars[]` 필드 중 `carId,name,imageUrl,minModelYear,maxModelYear,insuranceAge,oilType,capacity,options,price,discountPrice,deliveryPrice` → `toCardModel`과 `CarCard` 렌더링.
- `payload.search` 는 그대로 내려오지만, 화면은 URL 파싱한 `searchState` 를 주로 사용. 단, 최소한 서버는 정상화된 search 오브젝트를 포함해야 downstream 로깅/디버깅에 사용 가능.
- `payload.meta` 는 현재 UI에서 직접 읽지 않지만, 관측/로그용으로 포함되어야 하며 제거 시 디버깅 근거가 사라짐.

## 6. 주의 필드 / 애매한 필드
- `deliveryAddressDetail`: URL query 구성에는 포함되지만 서버 검색 로직에 쓰이지 않는다. **예약 요청 시 사용되는 프론트 상태 필드**이므로 DB 검색 엔진이 이를 요구하거나 응답에 넣으려 할 필요가 없다. 제거 시 상세 페이지 주소 입력 flow 가 깨질 수 있다.
- `company.deliveryTimes`, `company.deliveryCostList`: 현재 검색 결과 화면에서 직접 표출하지 않는다. 그러나 딜리버리 가능 시간/요금 안내 근거여서 삭제 금지.
- `meta.source`: 지금은 상수 `'partner-url-fetch'`. DB 모드에선 `'db-search'` 등의 새 값을 넣되, `meta` 객체를 유지해야 한다.
- `totalCount`: partner flight 가 제공하지 못할 때 car 배열 길이로 fallback. DB 검색은 실제 totalCount 를 계산해야 하며 0일 때 Empty state 조건이 민감하므로 주의.

## 7. DB 전환 시 유지해야 할 계약 요약
1. Endpoint 입력 파라미터 이름과 validation 규칙을 그대로 지켜서 프론트 `buildSearchQuery()` 출력과 서버 normalize 결과가 일치해야 한다.
2. 응답 최상위 키(`search, company, totalCount, cars, meta`) 와 각 car/company 필드는 타입/필드명을 바꾸지 않는다.
3. `toCardModel` 이 기대하는 필드 타입(shape) 그대로 전달해야 카드 UI/가격 계산이 동일하게 동작한다.
4. `meta.source` 는 반드시 남기고, DB/partner 모드 식별값만 변경한다.
5. `deliveryAddressDetail` 은 검색 계약 밖 상태 필드이므로 DB 쿼리 계층에서 요구하지 않는다.

## 8. 변경 제안 파일
- (미집행) 추후 `deliveryAddressDetail` 을 검색 필드에 포함시키려면 `src/utils/searchQuery.js`, `server/partner/buildPartnerUrl.js`, `api/search-cars.js` 전체 계약을 동시에 수정해야 하므로 이번 단계에서는 **제안만 기록**한다.

## 9. 금지/주의 파일
- `api/search-cars.js`, `server/partner/buildPartnerUrl.js`, `server/partner/mapPartnerDto.js`, `src/services/cars.js`, `src/utils/searchQuery.js` 는 공동 choke point라 병렬 수정 금지 (IMPLEMENTATION_RULES 참조).

## 10. 확인 필요 사항
- 현재 `meta` 객체가 `source` 외 키를 필요로 하는지, 향후 shadow mode 로깅 시 추가 필드가 필요한지 별도 결정 필요.
- 파트너 응답에서 `totalCount` 를 항상 신뢰할 수 있는지 (파싱 실패 대비), DB 검색 엔진에서 어떤 기준으로 totalCount 를 계산할지 검증 필요.

## 11. 다음 단계
1. 오케스트레이터는 본 계약 문서를 Stream 1/3/4 산출물과 교차 검증해 DB read model, diff spec 이 이 contract 를 준수하도록 조정.
2. Shadow mode 설계 시 `meta.source` 확장 규칙, totalCount diff 기준을 명시.
3. DB 검색 엔진 시뮬레이션 시 `toCardModel` 대비 필수 필드 자동 테스트 케이스 추가 (예: car 필드 누락 감지).
