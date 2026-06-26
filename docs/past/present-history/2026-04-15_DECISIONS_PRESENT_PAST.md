# 99. DECISIONS

## 목적
이 문서는 `premove-clone`의 핵심 구조 결정을 누적 기록한다.

---

## 2026-04-03 / 2026-04-04

### 1. 차량 조회는 partner 프록시 방식으로 시작한다
- 프론트에서 IMS/partner를 직접 호출하지 않는다.
- 우리 서버가 `partner.premove.co.kr` 검색 결과를 받아 파싱/가공한다.
- 이유: 구현 속도, 보안, 프론트 단순화.

### 2. 메인 페이지는 랜딩이 아니라 검색 시작점이다
- `/` 는 검색 조건 입력 + 차량 목록 진입의 출발점으로 본다.
- 이유: 실제 partner 구조도 query 기반 검색 상태가 중심이다.

### 3. 상세 페이지는 차량 소개가 아니라 예약 준비 화면이다
- 차량 요약 + 입력 폼 + 약관 + 결제 직전 검증까지 포함한다.
- 이유: 실제 서비스 흐름과 가장 가깝다.

### 4. query / DTO / id 명칭은 통일한다
- `deliveryDateTime`, `returnDateTime`, `pickupOption`, `driverAge`, `order`, `dongId`, `deliveryAddress`
- `carId`, `companyId`, `reservationId`
- 이유: 이후 partner 파싱 / 예약 / 결제 단계에서 구조 흔들림 방지.

### 5. 딜리버리 비용은 현재 관측 기준 roundTrip 값으로 총액에 반영된다
- 예: 개포동 선택 시 `delivery.roundTrip = 40,000원`, 총액에 동일 금액 반영.
- 이유: 실제 사이트 크롤링 결과와 일치.

### 6. 상세 상단 SearchBox는 메인 재사용이 아니라 전용 컴포넌트로 분리한다
- 메인 SearchBox는 검색 시작점이다.
- 상세 상단은 예약 조건 확인 + 위치/수령 방식 조정 UI다.
- 이유: 역할 차이로 인해 재사용 시 책임이 섞이고 UI/상태가 꼬인다.

### 7. 상세에서는 날짜/시간을 수정하지 않는다
- 날짜/시간을 바꾸면 해당 차량이 그 조건에도 가능한지 다시 리스트 단계에서 검증해야 한다.
- 따라서 상세에서는 대여/반납 일시를 읽기 전용으로만 보여준다.
- 이유: 상세는 선택 차량 기준 예약 조정 화면이지, 재검색 화면이 아니다.

### 8. 딜리버리 위치 확정은 메인 검색 단계에서 끝낸다
- 메인에서 `시/도 → 시/구/군 → 동별 요금` 선택으로 딜리버리 지역을 먼저 확정한다.
- 위치 미선택 상태에서는 검색을 진행하지 않는다.
- 이유: 검색 결과와 상세 가격이 같은 딜리버리 기준을 공유해야 흐름이 안정적이다.

### 8-1. 상세는 딜리버리 수정 화면이 아니라 읽기 전용 확인 화면으로 본다
- 상세는 메인에서 넘어온 `pickupOption`, `dongId`, `deliveryAddress`를 표시/소비만 한다.
- 상세에서 딜리버리 위치, 수령 방식, 상세 주소, 전달 메모를 다시 수정하지 않는다.
- 이유: 메인 확정값과 상세 내부 상태가 충돌하면 가격/가용성 흐름이 흔들리기 때문이다.

### 9. 00rentcar 리프레임은 새 랜딩 페이지를 먼저 만든다
- 기존 `/` 메인을 바로 교체하지 않는다.
- 먼저 `/landing` 을 만들고 브랜딩 셸 + 예약 진입 구조를 검증한다.
- 이유: 기존 예약 흐름을 보호하고 비교 가능한 상태에서 판단하기 위해.

### 10. 00rentcar.com에서는 셸만 차용하고 쇼핑몰 구조는 배제한다
- 차용: top notice bar, 브랜드 헤더 톤, hero/차량 비주얼, 연락/운영 정보 블록.
- 배제: 회원/주문/게시판/카테고리/상품 진열/장바구니 계열.
- 이유: 목표는 쇼핑몰 복제가 아니라 브랜드 랜딩 + 예약 시스템 결합이기 때문.

### 11. 루트(`/`)는 랜딩 셸로 승격하고, 중앙 콘텐츠만 `landing / results / detail`로 전환한다
- `/` 는 기존 메인 리스트 페이지가 아니라 랜딩 셸의 진입점으로 본다.
- 검색 결과는 `/` + query 상태로 유지한다.
- 상세는 `/cars/:carId`를 유지하되, UI는 같은 셸 안의 detail 모드처럼 보이게 맞춘다.
- 로고 클릭은 항상 query 없는 `/` 로 이동시켜 최초 랜딩 상태로 초기화한다.
- 이유: 한 페이지처럼 자연스럽게 보이면서도 뒤로가기/새로고침/공유를 안정적으로 유지하기 위해.

### 12. 예약 일정 규칙은 단순 운영 규칙으로 고정한다
- 대여는 현재 시각 기준 3시간 이후부터 가능하다.
- 운영 가능 시간은 매일 `09:00 ~ 21:00` 로 통일한다.
- 반납은 대여 시각 기준 최소 1일(24시간) 이후부터 가능하다.
- 대여 기간은 최대 30일이다.
- 이유: 주말/공휴일 분기를 없애고, 검색/상세/예약 검증 규칙을 하나로 유지하기 위해.

### 13. 상세 전환 1차는 DTO shape 유지 + source 분리 방식으로 간다
- `/api/car-detail` 의 프론트 응답 shape는 먼저 유지한다.
- 차량 기본 정보는 Supabase `public.cars` 를 우선 source 로 본다.
- 가격/보험/회사/딜리버리 정보는 초기 단계에서 partner 상세를 계속 쓴다.
- source 병합 규칙은 `docs/05_DETAIL_DB_INTEGRATION_PHASE1.md` 에서 관리한다.
- 이유: 현재 상세 UI를 깨지 않고 source 전환 범위를 가장 작게 고정하기 위해.

### 14. 외부 확인용 링크 요청은 production 배포를 기본값으로 한다
- 사장님이 외부 브라우저에서 바로 확인해야 하는 경우 기본 배포 경로는 `vercel deploy --prod --yes` 다.
- `vite preview`, `vercel dev`, protected preview URL 은 내부 점검용으로만 본다.
- 사장님에게는 기본적으로 목록부터 들어가는 공개 production URL 을 전달한다.
- 세부 절차는 `docs/06_EXTERNAL_PREVIEW_DEPLOY_RUNBOOK.md` 에서 관리한다.
- 이유: 외부 접근 실패, 인증 보호, 로컬 포트 의존성으로 확인 흐름이 끊기는 문제를 막기 위해.

### 15. 다음 아키텍처 목표는 우리 DB 기반 예약 엔진으로 전환한다
- 목표는 현재 홈페이지 구조를 유지한 채, 내부 데이터 소스를 우리 DB 중심으로 재구성하는 것이다.
- 차량 정보는 우리 차량 DB를 source of truth 로 본다.
- 예약 정보는 IMS 예약을 준실시간 동기화하는 별도 예약 DB로 운영하는 방향을 우선 검토/채택한다.
- 검색은 프론트 입력값을 기준으로 시작하되, 서버가 차량 후보 조회 → 예약 겹침 검증 → 가격 계산 → snapshot 저장을 담당한다.
- 상세는 `searchSessionId + carId` 기반 서버 저장형 방식으로 간다.
- 가격/가용성/예약 확정은 클라이언트 값이 아니라 서버 계산 기준으로 잠근다.
- 세부 로드맵은 `docs/2026-04-14-1842-f5555a8_PHASE_ROADMAP_DB_FIRST.md` 에서 관리한다.
- 이유: partner 상세 의존을 제거하고, 가격/가용성/예약 확정의 일관성과 보안을 확보하기 위해.

### 16. 구현 시작점은 IMS 예약 수집용 DB 설계다
- 목록 API나 상세 API보다 먼저 IMS 예약을 적재하는 DB 구조를 확정한다.
- 예약 DB는 원본 적재층(`ims_reservations_raw`), 정규화 예약층(`reservations`), 동기화 로그층(`reservation_sync_runs`, `reservation_sync_errors`)으로 나눈다.
- 앱의 평시 조회 기준은 정규화 예약층이며, IMS는 준실시간 동기화 source 로 본다.
- 예약 upsert 기준 키는 우선 `ims_reservation_id` 를 사용한다.
- 원본 payload 보관, 상태 raw 보관, 동기화 실패 로그 보관을 필수로 본다.
- 세부 스펙은 `docs/2026-04-14-1920-f5555a8_IMS_RESERVATION_DB_SYNC_SPEC.md` 에서 관리한다.
- 이유: 차량 가용성 판단의 선행 기준을 먼저 잠그고, 이후 목록/상세/예약 확정을 그 위에 올리기 위해.

### 17. IMS 예약 동기화는 별도 워커를 phase 단위로 구현한다
- 프론트 요청 시점이 아니라 백그라운드 워커가 IMS 예약 목록을 주기 수집한다.
- 워커는 같은 repo 내부에 두되, 웹 요청 처리와 별도 실행 경로를 가진다.
- 기본 운영 주기는 3분으로 두고, 실패 직후 1회 짧은 재시도를 허용한다.
- 구현은 API 기준 잠금 → 필드 매핑 → DB 스키마 → 워커 구조 → 수집기 → upsert → 주기 검증 순으로 끊는다.
- 세부 실행계획은 `docs/2026-04-14-1932-f5555a8_IMS_SYNC_WORKER_PHASE_PLAN.md` 에서 관리한다.
- 이유: 동기화 실패/재시도/로그 책임을 사용자 API 흐름과 분리하고, 단계별 검증이 가능한 구조로 고정하기 위해.

### 18. IMS 동기화 Phase 1 API 기준은 reservations 목록 API로 잠근다
- Phase 1 단일 엔드포인트는 `GET /v2/company-car-schedules/reservations` 로 고정한다.
- 기본 쿼리는 `page`, `base_date`, `rental_type=all`, `status=all`, `exclude_returned=false`, `date_option=end_at`, `start`, `end` 를 사용한다.
- 초기 수집 범위는 실행일 기준 `오늘` 부터 `오늘 + 30일` 까지로 본다.
- 이미 시작됐지만 아직 안 끝난 장기 예약이 빠지지 않도록 조회 기준은 `end_at` 중심으로 잡는다.
- 운영 active 기준은 우리 DB에서 `end_at > now()` + blocking status 조건으로 다시 자른다.
- 세부 요청 규칙은 `docs/2026-04-14-1938-d7ecfb2_IMS_SYNC_PHASE1_API_BASELINE.md` 에서 관리한다.
- 이유: 초기엔 누락 방지와 재현성을 우선하고, returned 처리와 active 판정은 우리 쪽에서 통제하기 위해.

### 19. IMS 동기화 Phase 2의 기본 매핑은 schedule id + 실차키 중심으로 잠근다
- `ims_reservation_id` 는 IMS 응답의 상위 `id` 를 사용한다.
- `car_id` 는 실차 기준인 `car.id` 를 사용한다.
- `car.car_identity` 는 `car_number` 로 별도 저장한다.
- `car.car_group_id` 는 차종/가격 규칙 연결용으로 별도 저장한다.
- `status_raw` 는 상위 `status` 원본을 그대로 저장한다.
- 앱 운영용 `status` 는 내부 표준값으로 별도 매핑하되, 실제 enum 전수 확인 전까지는 raw 보관을 우선한다.
- 기간 필드는 `start_at`, `end_at` 를 그대로 사용한다.
- 고객 필드는 `detail.customer_name`, `detail.customer_contact` 를 선택 저장한다.
- 주소는 `pickup_address`, `dropoff_address` 를 둘 다 보관하고, 필요 시 `delivery_address` 를 파생 사용한다.
- 세부 매핑표는 `docs/past/ims-sync/2026-04-14_IMS_SYNC_PHASE2_FIELD_MAPPING_PAST.md` 에서 관리한다.
- 이유: 예약 blocking 은 실차 단위여야 하고, 그룹키는 가격/차종 규칙 연결용으로만 써야 하기 때문이다.

### 20. IMS 동기화 Phase 3 스키마는 raw / normalized / sync-log 4테이블로 확정한다
- `ims_reservations_raw` 는 IMS 원본 payload 보관과 재처리 기준이다.
- `reservations` 는 앱 조회와 가용성 계산의 기준 테이블이다.
- `reservation_sync_runs` 는 실행 단위 로그다.
- `reservation_sync_errors` 는 개별 실패 추적용이다.
- `reservations` upsert 기준 키는 `ims_reservation_id` 로 유지한다.
- `reservations` 는 실차키(`car_id`), 차량번호(`car_number`), 그룹키(`car_group_id`)를 분리 저장한다.
- 주소는 `pickup_address`, `dropoff_address`, `delivery_address` 를 함께 둘 수 있게 둔다.
- active 운영 기준은 `end_at > now()` + blocking status 조건으로 본다.
- SQL 초안은 `supabase/migrations/20260414195200_create_ims_sync_tables.sql` 에서 관리한다.
- 세부 설명은 `docs/2026-04-14-1952-300f32d_IMS_SYNC_PHASE3_DB_SCHEMA.md` 에서 관리한다.
- 이유: raw 보존, idempotent upsert, 실차 단위 blocking, 실패 추적을 동시에 만족하는 최소 구조이기 때문이다.

### 21. IMS 동기화 Phase 4는 repo 내부 별도 워커 + 3분 cron 구조로 잠근다
- IMS 예약 동기화는 웹 요청 경로가 아니라 repo 내부 별도 워커로 실행한다.
- 권장 entrypoint 는 `node scripts/ims-sync/run-ims-reservation-sync.js` 다.
- 기본 운영 주기는 3분이다.
- 실패 시 1회 짧은 재시도만 허용하고, 무한 재시도는 금지한다.
- 동시 실행 방지를 위해 run 잠금 규칙을 둔다.
- 초기 인증은 `IMS_ID` + `IMS_PW` 기반 자동 로그인(`sha256(password)` → `/auth` → JWT)을 기준으로 잡는다.
- `IMS_AUTHORIZATION` 직접 주입은 디버깅/비상 우회 용도로만 둔다.
- 세부 런타임 구조는 `docs/2026-04-14-2003-e3c8850_IMS_SYNC_PHASE4_WORKER_RUNTIME.md` 에서 관리한다.
- 이유: 웹 요청과 동기화 책임을 분리하고, 운영 주기/재시도/장애 추적을 단순하게 유지하기 위해.
