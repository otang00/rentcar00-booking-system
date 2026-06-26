# PARALLEL WORKSTREAMS

## 목적
검색 DB 연결 작업을 에이전트 병렬 수행 가능 단위로 분해한다.

## 기준
- 기준 commit: `31f55f2`
- 현재 source: partner 검색
- 목표: 기존 결과를 유지한 채 DB 검색 엔진 추가

---

## 전체 원칙
- **공유 choke point 파일은 동시에 수정하지 않는다.**
- 먼저 문서/계약/규칙을 잠근 뒤 구현을 시작한다.
- 구현 병렬화는 **설계 산출물** 중심으로 먼저 진행한다.
- 실제 코드 반영은 마지막 통합 담당 1명이 수행한다.

---

## Stream 0. Contract Lock
### 성격
선행 필수 / 병렬 시작 전 완료 권장

### 범위
- 검색 query 계약 잠금
- 검색 응답 DTO shape 잠금
- 성공 기준 정의
- 샘플 비교 쿼리 정의

### 산출물
- 계약 문서
- 샘플 케이스 문서
- diff 기준 문서

### 비고
다른 모든 stream 의 기준점이다.

---

## Stream 1. DB Read Model Spec
### 성격
병렬 가능

### 목적
`cars + reservations` 로 검색 후보 차량을 계산하기 위한 read model 정의

### 주요 질문
- 어떤 reservation status 가 blocking 인가
- 시간 겹침 판정은 어떤 조건인가
- `cars` 에서 어떤 필드가 검색 노출에 필요한가
- 정렬/필터 최소 기준은 무엇인가

### 예상 산출물
- read model 설계 문서
- SQL/조회 전략 초안
- 필요한 인덱스/필드 목록

### 공유 파일 수정 금지
- `api/search-cars.js`
- `src/utils/searchQuery.js`

---

## Stream 2. Search DTO / Contract Audit
### 성격
병렬 가능

### 목적
현재 partner 검색 결과 DTO 와 프론트 소비 shape 를 잠근다.

### 주요 질문
- 프론트가 실제로 쓰는 car/company/search/meta 필드는 무엇인가
- partner DTO 와 DB DTO 사이 변환 경계는 어디인가
- `deliveryAddressDetail` 은 검색 계약인지 예약 보조 필드인지

### 예상 산출물
- 검색 DTO 계약 문서
- 필수/선택 필드 표
- 유지해야 할 `meta` 규칙

### 공유 파일 수정 금지
- `src/services/cars.js`
- `server/partner/mapPartnerDto.js`

---

## Stream 3. Shadow Mode / Diff Logging Spec
### 성격
병렬 가능

### 목적
partner 결과와 DB 결과를 동시에 계산하고 차이를 기록하는 규격 정의

### 주요 질문
- diff 는 어디에 저장할 것인가
- 어떤 단위로 비교할 것인가
- 결과 수/차량 id/가격/정렬/제외 사유를 어떻게 기록할 것인가

### 예상 산출물
- shadow mode 설계 문서
- diff schema 초안
- 샘플 로그 payload 예시

### 공유 파일 수정 금지
- `api/search-cars.js`

---

## Stream 4. Integration Rules / Safe Edit Rules
### 성격
병렬 가능

### 목적
에이전트가 기존 검색/상세 구조를 꼬지 않게 하는 규칙 문서화

### 주요 질문
- 어떤 파일이 canonical 인가
- 어떤 파일은 단일 담당자만 수정할 수 있는가
- 어떤 명명/계층 규칙을 지켜야 하는가

### 예상 산출물
- 구현 규칙 문서
- 파일 ownership 문서
- 통합 순서 문서

---

## Stream 5. Final Integration Plan
### 성격
병렬 비권장 / 통합 담당 1명

### 목적
앞선 산출물을 실제 코드 변경 순서로 합친다.

### 범위
- `api/search-cars.js`
- 새 `dbSearchService`
- feature flag
- shadow mode wiring
- 통합 검증

### 비고
이 stream 은 문서가 잠긴 뒤 1명이 맡는 것이 맞다.

---

## 추천 에이전트 분배
- Agent A: Contract Lock + DTO Audit
- Agent B: DB Read Model Spec
- Agent C: Shadow Mode / Diff Logging Spec
- Agent D: Integration Rules / Safe Edit Rules
- Orchestrator(메인): 문서 검토, 충돌 정리, 최종 통합 준비

---

## 지금 바로 병렬 가능한 부분
1. DTO/계약 감사
2. DB read model 설계
3. shadow mode 기록 설계
4. 충돌 방지 규칙 문서화

## 지금 병렬 비권장 부분
1. `/api/search-cars` 코드 수정
2. `src/utils/searchQuery.js` 수정
3. `server/partner/buildPartnerUrl.js` 수정
4. 검색 응답 shape 변경
