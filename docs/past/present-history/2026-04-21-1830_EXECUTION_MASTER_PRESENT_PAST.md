# EXECUTION MASTER PRESENT

## 목적
프리무브 클론의 상세 흐름을 **검색 결과 기반 진입권(detailToken) 구조**로 재정의한다.
이 문서는 새 실행 기준 문서 1개로만 사용한다.

## 기준점
- 브랜치: `feat/db-preview-home`
- active present 문서: 이 문서 1개만 사용
- 직전 present 문서: `docs/past/present-history/2026-04-20-1626_EXECUTION_MASTER_PRESENT_PAST.md`
- 이미 완료된 기준:
  - Phase 1. `cars` 테이블 차량 상태 컬럼 잠금 완료
  - Phase 2. IMS 차량 상태 sync 완료
  - Phase 3. 검색 후보 단계 `ims_can_general_rental = true` 반영 완료
- 새 기준 전환 이유:
  - 상세가 과거 partner 상세/단건 조회 관성 위에 남아 있음
  - 검색 결과에서 선택된 차량만 상세에 진입해야 한다는 제품 기준 재확정

## 현재 제품 기준
### 1. 검색과 상세 관계
- 상세 페이지는 독립 상품 페이지가 아니다.
- 상세 페이지는 **검색 결과에서 선택한 차량의 후속 화면**이다.
- 따라서 상세 유효성은 `carId` 단독이 아니라 **검색 결과에서 발급된 진입권**으로 판단한다.

### 2. 가격 기준
- 가격은 차량 고정값이 아니다.
- 가격은 **검색 시점의 검색 조건 기준**으로 계산한다.
- 상세는 검색에서 사용한 조건을 이어받아 같은 기준으로 보여준다.

### 3. 보안/노출 기준
- `carId`만으로 상세가 열리면 안 된다.
- 검색 결과를 거치지 않은 임의 상세 호출은 차단한다.
- 상세는 `detailToken` 검증 통과 시에만 열린다.

## 현재 구조 문제
### 1. 검색 API
- `/api/search-cars` 는 공개 GET 엔드포인트다.
- 현재는 인증/서명/진입권 없이 query 검증 후 검색 결과를 반환한다.

### 2. 상세 API
- `/api/car-detail` 도 공개 GET 엔드포인트다.
- 현재는 검색 컨텍스트 검증보다 `carId` 단건 조회 중심이다.
- 즉, 상세가 검색 결과의 자식 뷰라는 제품 기준을 구조적으로 강제하지 못한다.

### 3. 구조 리스크
- `carId` 추측 또는 수집으로 임의 상세 접근 가능성이 남는다.
- 검색에서 숨긴 차량과 상세 진입 기준이 어긋날 수 있다.
- 과거 partner 상세 페이지를 긁어오던 관성이 남아 있어 이후 예약 단계까지 기준이 흔들릴 수 있다.

## 새 구조 원칙
### 1. 검색은 진입권 발급기
- `/api/search-cars` 는 검색 결과를 계산한다.
- 각 차량 카드에 `detailToken` 을 함께 발급한다.
- 이 토큰은 해당 차량이 **이 검색 조건에서 선택된 결과**였음을 증명한다.

### 2. 상세는 진입권 검증기
- `/api/car-detail` 은 `carId + detailToken` 이 없으면 열지 않는다.
- 상세는 검색 전체를 다시 계산하지 않는다.
- 토큰 검증이 끝나면 해당 `carId` 차량 1건만 조회해서 상세/가격을 만든다.

### 3. search 비교 방식
- raw query 문자열을 직접 비교하지 않는다.
- 검색 상태는 `normalizeSearchState()` 기준으로 정규화한다.
- 정규화 결과를 stable stringify 후 hash 한다.
- 토큰 안에는 raw query 전체가 아니라 **search hash + carId + 만료시각 + 서명**을 넣는다.

### 4. 구현 복잡도 제한
- 상세에서 검색 후보 전체를 다시 계산하지 않는다.
- 검색/상세 API 파일에 토큰 로직을 직접 길게 쓰지 않는다.
- 토큰 생성/검증은 별도 유틸로 분리한다.

## 잠금할 목표 구조
### API 역할
#### `/api/search-cars`
입력:
- 기존 검색 query 유지

출력:
- 기존 검색 결과
- 각 차량별 `detailToken`

동작:
1. 검색 query 검증
2. 후보 계산
3. 결과 매핑
4. 각 차량에 `detailToken` 부여

#### `/api/car-detail`
입력:
- `carId`
- `detailToken`
- 검색 query

동작:
1. 검색 query 정규화
2. `detailToken` 검증
3. `carId` 와 token 내부 carId 일치 확인
4. search hash 일치 확인
5. 만료 확인
6. 통과 시 차량 1건 조회
7. 상세/가격 DTO 반환

실패 정책:
- token 누락/불일치/만료 시 상세 차단
- 응답 코드는 구현 시점에 `403` 또는 `404` 중 하나로 잠근다

## 추천 파일 구조
- `server/security/detailToken.js`
  - `createDetailToken({ carId, search })`
  - `verifyDetailToken({ token, carId, search })`
- `server/security/hashSearchState.js`
  - normalize된 search를 stable stringify + hash
- `api/search-cars.js`
  - 검색 결과에 token 부여
- `api/car-detail.js`
  - token 검증 후 단건 상세 조회
- `src/components/CarCard.jsx`
  - 상세 링크에 token 포함
- `src/services/carDetail.js`
  - 상세 요청에 token 포함

## 실행 phase 잠금
### Phase 1. 토큰 계약 잠금
목적:
- detailToken 구조와 검증 규칙을 구현 가능한 수준으로 먼저 고정한다.
- 이후 phase에서 API와 프론트가 같은 계약을 공유하게 만든다.

세부 작업:
1. token payload 최소 필드 확정
2. search hash 규칙 확정
3. 만료시간 확정
4. 실패 응답 정책 확정
5. 프론트 전달 방식 확정
6. 비범위와 후속 phase 경계 확정

#### Phase 1-A. token payload 잠금
잠금 원칙:
- token 은 상세 진입권이며, 검색 결과 1건에 대응한다.
- token 하나는 특정 `carId` 와 특정 검색 상태 1개에만 유효하다.
- token 에 원문 query 전체를 그대로 싣지 않는다.

payload 최소 필드:
- `carId`
- `searchHash`
- `exp`

서명 원칙:
- payload 자체를 신뢰하지 않는다.
- 서버 secret 기반 서명 검증이 가능해야 한다.
- 구현 형태는 아래 둘 중 하나로 잠근다.
  1. `payload + sig` 분리 구조
  2. 서명 포함 단일 opaque token 구조
- 구현은 자유지만, 외부 계약 의미는 동일해야 한다.

payload 제외 항목:
- 가격 값 자체
- 차량 상세 DTO 전체
- raw query 전체 문자열
- 사용자 식별자 전제 필드

#### Phase 1-B. search hash 잠금
목적:
- 같은 검색은 항상 같은 hash 가 나오게 고정한다.

search hash 생성 규칙:
1. query 를 `normalizeSearchState()` 로 정규화
2. 정규화 결과를 stable stringify
3. stringify 결과를 sha256 hash

정규화 원칙:
- 파라미터 순서 차이는 제거한다.
- 숫자/문자열 표현 흔들림을 제거한다.
- 빈값, null, undefined 처리 규칙을 고정한다.
- 가격 표시와 무관한 UI 상태값은 hash 대상에서 제외한다.

hash 대상 범주:
- 대여/반납 일시
- 지점/지역 등 실제 검색 결과를 바꾸는 위치 조건
- 운전자 연령 등 필터 조건
- 가격 계산에 직접 영향을 주는 검색 조건

Phase 2 구현 기준 hash 포함 필드:
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `dongId`
- `driverAge`

Phase 2 구현 기준 hash 제외 필드:
- `order`
- `deliveryAddress`

hash 제외 범주:
- 정렬 방식
- 화면 표시용 UI 상태
- 확장/접힘 여부
- 추적용 파라미터

#### Phase 1-C. TTL 및 실패 정책 잠금
TTL 기준:
- 기본값은 `15분`
- Phase 1 에서는 고정값으로 시작한다.
- 동적 TTL, refresh token, 재발급 흐름은 현재 범위에서 제외한다.

상세 실패 정책:
- 아래는 모두 "유효하지 않은 상세 진입" 으로 본다.
  - token 없음
  - token 서명 불일치
  - token 만료
  - token 내부 `carId` 불일치
  - token 내부 `searchHash` 불일치
- 응답 코드는 구현 시 `403` 또는 `404` 중 하나로 통일한다.
- 프론트 노출 문구는 구체 내부 사유를 과도하게 드러내지 않는다.

프론트 처리 원칙:
- 검색 카드에서 상세 링크 생성 시 `detailToken` 을 함께 전달한다.
- 상세 진입에 필요한 검색 query 도 함께 유지한다.
- `detailToken` 전달 위치는 우선 **URL query parameter** 로 잠근다.
- 상세 API 호출도 같은 `detailToken` query parameter 를 사용한다.
- 새로고침은 유효 TTL 안에서만 정상 동작을 기대한다.
- token 만료 시 검색으로 되돌리거나 재검색 안내를 준다.

응답 코드 정책:
- 구현 Phase 에서는 `403` 으로 먼저 고정한다.
- 사유: 입력은 존재하지만 유효한 진입권 검증에 실패한 상태로 해석한다.
- `404` 위장 정책은 필요 시 후속 hardening phase 에서 별도 검토한다.

#### Phase 1-D. 비범위 잠금
이번 phase 에서 하지 않는 것:
- 검색 API 자체 인증 도입
- 사용자 세션 종속 설계
- token 재발급 API 추가
- 상세 진입용 별도 DB 저장소 추가
- 상세에서 검색 후보 전체 재계산

Phase 1 산출물:
- token payload 계약 1개
- search hash 규칙 1개
- 실패 정책 1개
- 프론트 전달 규칙 1개
- 구현 기준 고정값 1개

Phase 2 구현 전 최종 잠금 항목 5개:
1. hash 포함 필드는 `deliveryDateTime`, `returnDateTime`, `pickupOption`, `dongId`, `driverAge` 로 고정
2. `order`, `deliveryAddress` 는 hash 제외로 고정
3. `detailToken` 전달 위치는 URL query parameter 로 고정
4. token 검증 실패 응답은 우선 `403` 으로 고정
5. 상세는 token 검증 후 `carId` 단건 조회 유지로 고정

종료 조건:
- 토큰 payload가 문서에 잠겨 있다
- 서명 방식의 외부 계약이 문서에 잠겨 있다
- hash 규칙과 hash 대상/제외 대상이 문서에 잠겨 있다
- TTL이 문서에 잠겨 있다
- 실패 정책과 프론트 처리 원칙이 문서에 잠겨 있다
- 비범위가 문서에 잠겨 있다

### Phase 2. 서버 토큰 유틸 구현
상태:
- 완료

목적:
- 검색/상세가 공통으로 쓰는 진입권 유틸을 만든다.

완료 내용:
1. `server/security/detailToken.js` 추가
2. `server/security/hashSearchState.js` 추가
3. search hash 포함/제외 필드 기준 구현
4. 샘플 검증으로 정상/불일치/만료 케이스 확인

실검증 결과:
- `order`, `deliveryAddress` 차이는 hash 에 영향 없음
- `driverAge` 변경 시 hash 변경 확인
- valid token 검증 통과 확인
- `car_id_mismatch`, `search_hash_mismatch`, `expired_token` 분기 확인

종료 상태:
- 토큰 생성/검증 유틸이 분리되어 있다
- search hash 결과가 안정적으로 재현된다
- 잘못된 token, 만료 token, hash mismatch를 구분 검증할 수 있다

### Phase 3. 검색 API에 token 발급 연결
상태:
- 완료

목적:
- 검색 결과가 상세 진입권을 같이 내려주게 만든다.

완료 내용:
1. `api/search-cars.js` 에서 각 차량에 `detailToken` 부여
2. `src/services/cars.js` card model 에 `detailToken` 반영

확인된 사실:
- 코드 경로상 검색 결과 각 차량에 token 이 붙도록 연결됨
- 실검증 결과 `/api/search-cars` 200, `totalCount=13`, 첫 차량 `detailToken` 포함 확인

종료 조건:
- 검색 결과 각 차량에 token 이 실제 응답으로 포함된다
- 기존 검색 결과 소비 코드와 충돌하지 않는다

### Phase 4. 상세 API를 token 검증 구조로 전환
상태:
- 완료

목적:
- 상세 진입을 검색 결과 기반으로 강제한다.

완료 내용:
1. `api/car-detail.js` 입력에 `detailToken` 추가
2. token 검증 실패 시 `403 invalid_detail_token` 반환
3. 검증 통과 시 `carId` 단건 조회 유지
4. 상세 가격 계산은 기존 search 기반 로직 유지

실검증 결과:
- token 없음 → `403`
- malformed token → `403`

종료 상태:
- token 없으면 상세가 열리지 않는다
- token mismatch면 상세가 열리지 않는다
- 유효 token이면 기존 상세/가격 흐름이 유지된다

### Phase 5. 프론트 상세 링크/요청 정리
상태:
- 완료
- 만료 UX 보강은 후속 정리 가능

목적:
- 프론트가 검색 결과의 자식 뷰라는 정책을 그대로 반영한다.

완료 내용:
1. `src/components/CarCard.jsx` 에서 상세 링크 query 에 token 포함
2. `src/services/carDetail.js` 에서 상세 API 호출에 token 포함
3. `src/components/CarDetailSection.jsx` 에서 URL query 의 token 사용

현재 상태:
- 검색에서 상세로 token 전달 경로가 연결됨
- 잘못된 진입 시 API 기준으로 차단됨
- token 만료 전제 새로고침 구조로 동작함

잔여 확인:
- 브라우저 실사용 기준 검색 → 상세 이동 URL 최종 확인
- 만료 token 사용자 안내 문구 보강 여부 판단

### Phase 6. 검색 API 남용 방지 후속 검토
목적:
- 상세 보호 이후 검색 API 보호 수준을 별도 판단한다.

세부 작업:
1. rate limit 필요성 판단
2. bot 남용 시나리오 점검
3. 필요 시 검색 API 보호 phase 분리

종료 조건:
- 상세 보호와 검색 보호가 분리된 과제로 정리되어 있다
- 검색 보호가 지금 할 일인지 후속인지 결정되어 있다

### Phase 7. 최종 설계 기준 잔재 정리
상태:
- 완료

목적:
- detailToken 기준으로 최종 설계가 고정된 뒤, 과거 구조 잔재를 코드와 문서에서 제거한다.

완료 내용:
1. `CarCard.jsx` 의 `carSummary` link state 제거
2. 미사용 `getMockCarById()` 제거
3. `server/partner/` 런타임 폴더 제거
4. `README.md` 를 현재 구조 기준으로 정리

정리 결과:
- 현재 실행 경로에서 partner 상세 런타임 참조 0건 확인
- 현재 기준 문서와 README 설명 방향 일치
- dead code 2건 제거 후 빌드 통과

종료 상태:
- 최종 설계와 충돌하는 구 코드가 제거되어 있다
- 현재 기준 문서와 README, 참조 문서 설명이 서로 일치한다
- 구현 결과를 읽을 때 현재 구조가 한 번에 이해되게 정리되어 있다

## 우선순위
1. Phase 1. 토큰 계약 잠금
2. Phase 2. 서버 토큰 유틸 구현
3. Phase 3. 검색 API token 발급 연결
4. Phase 4. 상세 API token 검증 전환
5. Phase 5. 프론트 연결
6. Phase 6. 검색 API 남용 방지 검토
7. Phase 7. 최종 설계 기준 잔재 정리

## 구현 원칙
1. 상세에서 검색 전체를 다시 계산하지 않는다.
2. 검색은 진입권 발급, 상세는 진입권 검증으로 역할을 분리한다.
3. raw query 직접 비교 대신 정규화 후 hash로 비교한다.
4. 상세 DB 조회는 `carId` 단건 조회를 유지한다.
5. 토큰 로직은 API 엔드포인트 밖 유틸로 분리한다.
6. 검색 API 보호는 상세 보호와 별도 phase로 다룬다.
7. 최종 phase에서 과거 구조 잔재를 반드시 정리한다.

## 이번 기준에서 하지 않는 것
- 검색 API 인증 체계 전면 도입
- 세션 기반 구조로 전체 전환
- 상세에서 검색 후보 전체 재계산
- 월대차 확장
- 예약 생성/결제 구조 개편

## 실환경 최종 검증 체크리스트
### A. 검색 응답 확인
- [x] 실제 `/api/search-cars?...` 응답의 각 차량에 `detailToken` 이 포함된다
- [x] `detailToken` 이 비어 있지 않다
- [x] 검색 결과 수와 token 부여 후 결과 수가 같다

### B. 상세 차단 확인
- [x] `detailToken` 없이 `/api/car-detail?...` 호출 시 `403 invalid_detail_token`
- [x] 잘못된 token 으로 호출 시 `403 invalid_detail_token`
- [x] 다른 검색 조건으로 받은 token 재사용 시 `403 invalid_detail_token`

### C. 정상 상세 확인
- [ ] 검색 결과에서 클릭한 URL 에 `detailToken` 이 포함된다
- [x] 유효 token 으로 상세 진입 시 `200`
- [x] 상세의 가격/업체/차량 정보가 검색 조건과 일관된다

### D. 새로고침/만료 확인
- [x] TTL 내 검증 시 상세 token 유효 유지
- [x] TTL 이후 검증 시 `expired_token` 확인

### E. 회귀 확인
- [x] `npm run build` 통과
- [ ] 검색 목록 렌더링 이상 없음
- [ ] 상세 페이지 렌더링 이상 없음

## Phase 1 시작 전 확인 파일
- `api/search-cars.js`
- `api/car-detail.js`
- `server/search/searchState.js`
- `server/detail/buildDbCarDetailDto.js`
- `src/components/CarCard.jsx`
- `src/services/carDetail.js`

## 문서 잠금 규칙
- 이 문서만 active present 로 사용한다.
- 추가 current/present 문서는 만들지 않는다.
- 설계 종료 시 불필요한 구현 잔재와 문서 잔재까지 정리한 뒤에 phase 완료로 본다.
- 이번 phase 종료 후 이 문서를 `past/` 로 이동한다.
