# PHASE 02. EXECUTION PLAN

## 목적
이 문서는 `PHASE_02_PARTNER_PROXY.md`를
**현재 코드베이스 기준 실제 작업 순서**로 쪼갠 실행 문서다.

핵심 원칙:
- IMS 내부 API 직접 호출로 가지 않는다.
- `partner.premove.co.kr/35457?...` 응답을 **우리 서버가 fetch + parse** 한다.
- 프론트는 partner 원문을 모르고, **우리 내부 응답만 사용**한다.
- 한 번에 끝내려 하지 말고 `02A → 검증 → 02B → 검증` 식으로 간다.

---

## 현재 기준 상태

### PHASE 01 완료 상태
- 검색 상태는 URL query 기준으로 통일됨
- `src/utils/searchQuery.js` 존재
- `src/services/*` 뼈대 존재
- `/` 는 검색 시작점
- `/cars/:carId` 는 상세 페이지

### 아직 없는 것
- 서버 런타임 / API route
- partner URL builder
- partner fetcher
- `_rsc` 파서
- raw → DTO mapper
- 프론트의 실제 데이터 fetch 연결

즉, PHASE 02는 **실제 조회를 붙이는 첫 단계**다.

---

## 목표 결과
PHASE 02가 끝나면 아래가 되어야 한다.

1. 프론트가 `/?query...` 상태에서 검색 가능
2. 프론트는 우리 서버 endpoint를 호출
3. 우리 서버는 `partner.premove.co.kr/35457?...` 응답을 가져옴
4. 응답에서 차량 목록/업체/건수만 파싱
5. 프론트는 가공된 JSON만 받아 렌더

즉, **위험한 외부 API 직결 없이 실제 목록 조회**가 되는 상태가 목표다.

---

# 02A. 서버 진입점 구조 만들기

## 목표
Vite 프론트 프로젝트 안에 partner 조회를 붙일 수 있는 서버 진입점 구조를 만든다.

## 먼저 결정할 것
현재 프로젝트는 Vite 프론트 단일 앱이다.
그래서 PHASE 02 시작 시점에 아래 둘 중 하나를 골라야 한다.

### 권장안 A
- Vercel serverless 함수 사용
- `api/search-cars.js` 추가
- 내부에서 partner fetch/parse 수행

### 대안 B
- 별도 Node 서버 디렉토리 추가
- 프론트와 서버를 분리

## 현재 추천
**권장안 A**가 맞다.
이유:
- 지금 배포가 이미 Vercel에 붙어 있음
- 빠르게 검증 가능
- PHASE 02 목표가 조회 안정화이지 서버 아키텍처 분리 자체는 아님

## 생성 파일 초안
- `api/search-cars.js`
- `server/partner/buildPartnerUrl.js`
- `server/partner/fetchPartnerSearch.js`
- `server/partner/parsePartnerSearch.js`
- `server/partner/mapPartnerDto.js`
- `server/partner/types.js` 또는 js doc 타입 메모 파일

## 완료 기준
- `/api/search-cars` 라우트 파일이 생기고
- 최소 더미 응답이라도 반환 가능해야 함

## 검증 포인트
- Vercel 함수 경로가 실제로 동작하는가
- query를 그대로 받는가

---

# 02B. partner URL builder 작성

## 목표
검색 상태를 partner URL로 안전하게 변환한다.

## 생성/수정 파일
- `server/partner/buildPartnerUrl.js`

## 입력
반드시 아래 key만 사용:
- `deliveryDateTime`
- `returnDateTime`
- `pickupOption`
- `driverAge`
- `order`
- 선택: `dongId`, `deliveryAddress`

## 출력
예시 방향:
- `https://partner.premove.co.kr/35457?...`

## 중요 규칙
- 입력 key 이름을 임의로 바꾸지 말 것
- `pickup` 일 때 `dongId`, `deliveryAddress` 제거
- `delivery` 일 때만 관련 query 포함
- partner에서 실제 쓰는 query 구성과 문서값 일치시킬 것

## 완료 기준
- 같은 SearchState면 항상 같은 URL이 생성된다.
- 잘못된 값은 PHASE 01 유틸 기준 normalize 후 사용한다.

## 검증 포인트
- pickup URL / delivery URL 각각 1개씩 샘플 비교
- 문서(`04_PARTNER_SITE_REFERENCE.md`)와 query 구조 일치 여부 확인

---

# 02C. partner fetcher 작성

## 목표
partner 검색 URL을 실제로 가져오는 fetch 레이어를 만든다.

## 생성/수정 파일
- `server/partner/fetchPartnerSearch.js`

## 역할
- URL 요청
- 기본 헤더 설정
- status code 검사
- timeout / 실패 처리
- 원문 body 반환

## 중요 규칙
- 여기서 데이터 구조 파싱하지 말 것
- fetcher는 raw text/body만 반환
- parser 책임과 섞지 말 것

## 에러 처리 기준
- 외부 실패 → 명확한 에러 throw
- 응답 없음 / 차단 / 비정상 status 구분 가능하게 메시지 구성

## 완료 기준
- 로컬에서 partner raw 응답을 받아올 수 있다.

## 검증 포인트
- 정상 검색 조건 1개 성공
- delivery 조건 1개 성공
- 실패 시 에러 메시지 확인 가능

---

# 02D. `_rsc` / 본문 파서 작성

## 목표
partner 응답 raw body에서 필요한 데이터만 추출한다.

## 생성/수정 파일
- `server/partner/parsePartnerSearch.js`

## 최소 추출 대상
### company
- `companyId`
- `companyName`
- `companyTel`
- `fullGarageAddress`

### meta
- `totalCount`

### cars[] raw fields
- `id`
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

## 중요 규칙
- parser는 raw 구조를 이해하는 계층
- mapper 없이 바로 프론트 DTO를 만들지 말 것
- partner 포맷이 깨졌을 때 parser 단계에서 실패 지점이 드러나야 함

## 완료 기준
- raw 응답을 넣으면 필요한 원시 데이터가 추출된다.

## 검증 포인트
- 실제 응답 샘플 저장 후 parse 테스트
- `company`, `totalCount`, `cars.length` 확인

---

# 02E. internal DTO mapper 작성

## 목표
partner raw parse 결과를 우리 DTO로 고정한다.

## 생성/수정 파일
- `server/partner/mapPartnerDto.js`

## 출력 DTO
```json
{
  "search": {},
  "company": {},
  "totalCount": 0,
  "cars": []
}
```

## 내부 원칙
- raw key 이름을 프론트로 넘기지 않는다.
- 우리 문서(`03_CONVENTIONS.md`) 기준 이름만 남긴다.
- 숫자/문자 타입 정리
- 누락값 fallback 정책 정의

## 완료 기준
- 프론트는 partner 구조를 몰라도 목록 렌더 가능

## 검증 포인트
- mapper 결과 shape가 문서와 완전히 일치하는가
- `carId`, `companyId`, `deliveryPrice` 등 이름이 고정되었는가

---

# 02F. `/api/search-cars` 구현

## 목표
프론트가 호출할 실제 내부 endpoint를 만든다.

## 생성/수정 파일
- `api/search-cars.js`

## 내부 흐름
1. query 받기
2. SearchState normalize/validate
3. partner URL build
4. raw fetch
5. raw parse
6. DTO map
7. JSON 반환

## 응답 원칙
- partner raw 전달 금지
- `_rsc` fragment 전달 금지
- UI에 필요한 값만 반환

## 에러 처리
- validation 실패 → 400
- 외부 fetch 실패 → 502
- parse 실패 → 500
- empty result → 200 + `cars=[]`

## 완료 기준
- 브라우저에서 `/api/search-cars?...` 호출 시 JSON 확인 가능

## 검증 포인트
- pickup 검색 성공
- delivery 검색 성공
- 빈 결과 성공
- 잘못된 query 400 반환

---

# 02G. 프론트 연결

## 목표
`MainPage` 가 mock service 대신 실제 `/api/search-cars` 결과를 쓰게 바꾼다.

## 생성/수정 파일
- `src/services/cars.js`
- `src/pages/MainPage.jsx`
- 필요 시 `src/pages/CarDetailPage.jsx`

## 방향
- `getMockCars()`를 유지하되 fallback으로만 사용하거나 제거 전환 준비
- 새 함수 예시:
  - `fetchSearchCars(searchState)`

## UI 상태
- loading
- error
- empty
- success

## 완료 기준
- 메인 검색 시 실제 partner 기반 목록이 뜬다.

## 검증 포인트
- 검색 조건 변경 시 목록이 실제로 달라지는가
- 새로고침 시 같은 결과가 복원되는가

---

## 권장 실제 진행 순서
1. **02A 서버 진입점 구조**
2. 검증
3. **02B URL builder**
4. 검증
5. **02C fetcher**
6. 검증
7. **02D parser**
8. 검증
9. **02E mapper**
10. 검증
11. **02F endpoint**
12. 검증
13. **02G 프론트 연결**
14. 최종 검증

---

## 이번 phase에서 절대 하지 말 것
- IMS 직접 API 호출
- 브라우저 Authorization 캡처 사용
- 예약 생성 구현
- 결제 구현

PHASE 02는 **partner URL fetch + parse 기반 조회 안정화**까지만 한다.

---

## 지금 바로 착수할 단계
**다음 작업은 02A다.**

이유:
- 어디에 서버 로직을 둘지 먼저 정해야
- builder / fetcher / parser / mapper를 순서대로 얹을 수 있기 때문이다.
