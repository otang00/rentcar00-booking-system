# IMPLEMENTATION RULES

## 목적
검색 DB 연결 작업 중 기존 검색/상세/API 구조가 꼬이지 않도록 작업 규칙을 잠근다.

## 1. Canonical 파일
### 검색 query canonical
- 프론트 canonical: `src/utils/searchQuery.js`
- 서버 canonical: `server/partner/buildPartnerUrl.js`

### 검색 endpoint canonical
- `api/search-cars.js`

### 검색 DTO canonical
- 서버 DTO 매핑: `server/partner/mapPartnerDto.js`
- 프론트 소비: `src/services/cars.js`

### 상세 endpoint canonical
- `api/car-detail.js`

### 상세 병합 canonical
- `server/detail/mergeCarDetailSources.js`
- `server/supabase/fetchCarBySourceCarId.js`

---

## 2. 절대 규칙
### Rule 1. 프론트 직접 Supabase 조회 금지
- 프론트는 계속 우리 서버 API만 호출한다.
- DB 검색 로직은 서버 내부 서비스로만 추가한다.

### Rule 2. 기존 endpoint 우선 유지
- 검색 전환 초기에는 `GET /api/search-cars` 를 유지한다.
- 새 공개 endpoint 추가는 꼭 필요할 때만 한다.

### Rule 3. DTO shape 선변경 금지
- `src/services/cars.js` 가 기대하는 shape 를 먼저 깨지 않는다.
- DB 검색 엔진도 우선 현재 DTO shape 를 반환해야 한다.

### Rule 4. detail 범위 확장 금지
- 이번 범위는 검색 DB 연결이다.
- `api/car-detail.js` 구조를 이번 작업에 끌어들여 크게 흔들지 않는다.

### Rule 5. shared choke point 동시 수정 금지
아래 파일은 동시에 여러 에이전트가 수정하지 않는다.
- `api/search-cars.js`
- `src/utils/searchQuery.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/mapPartnerDto.js`
- `src/services/cars.js`

---

## 3. 명명/계층 규칙
### 새 DB 검색 코드는 server 내부에 둔다
권장 위치 예시:
- `server/search-db/*`
또는
- `server/search/*`

### 책임 분리
- `partner/*` = 기존 partner fetch/parse 책임
- `search-db/*` = 우리 DB 조회/겹침 계산 책임
- `api/*` = request validation + service orchestration
- `src/services/*` = 프론트 fetch + view model 변환

### 금지
- partner 파서 파일 안에 DB 조회 로직 섞기
- 프론트 컴포넌트 안에 검색 엔진 계산 로직 넣기
- `mapPartnerDto.js` 를 범용 DB mapper 처럼 오염시키기

---

## 4. 검색 계약 규칙
### 현재 검색 핵심 필드
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- `order`
- `dongId`
- `deliveryAddress`

### 주의 필드
- `deliveryAddressDetail`
  - 현재 프론트 query 에는 실릴 수 있음
  - 하지만 현재 search result 결정 필드로는 쓰지 않음
  - 임의 삭제/승격/의미 변경 금지

### 성공 기준
아래는 전환 후에도 우선 유지 대상이다.
- 결과 차량 수
- 포함 차량 목록
- 정렬
- 가격
- 제외 사유 설명 가능성

---

## 5. 통합 순서 규칙
1. 문서/계약 잠금
2. DB read model 설계
3. shadow mode 규격 설계
4. safe edit rules 확정
5. 그 후에만 구현 시작
6. 실제 `api/search-cars.js` 통합 수정은 1명이 담당

---

## 6. 에이전트 작업 규칙
- 각 에이전트는 자기 문서 범위 밖 파일을 임의 수정하지 않는다.
- 결과물은 가능하면 문서/스펙/패치 초안 중심으로 낸다.
- 서로 다른 에이전트가 같은 shared file 을 동시에 수정하지 않는다.
- 통합 전까지는 "권장 변경 파일"과 "금지 변경 파일"을 명시한다.

---

## 7. 이번 준비 단계의 최종 판단
지금 단계에서 가장 중요한 것은 구현 속도가 아니라 **계약 안정성**이다.
검색 DB 연결은 가능하지만, 먼저 문서/계층/ownership 을 잠가야 안전하다.
