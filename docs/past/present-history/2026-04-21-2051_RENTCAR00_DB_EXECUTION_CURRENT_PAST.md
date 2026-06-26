# rentcar00-booking-system DB 구축 실행 문서

## 문서 상태
- 상태: active present
- 용도: DB 구조 잠금 전용 현재 기준 문서
- 성격: 구현 문서가 아니라 구조 확정 문서
- 기준 브랜치: `feat/db-preview-home`
- 직전 active present 문서: `docs/past/present-history/2026-04-21-1834_RENTCAR00_RESERVATION_CURRENT_PAST.md`

---

## 0. 이 문서의 목적

### 0.1 프로젝트명 현재 기준
- 저장소 및 개발 프로젝트명: `rentcar00-booking-system`
- 현재 작업 폴더도 이 이름으로 정리한다.
- Vercel 프로젝트명도 같은 이름으로 맞춘다.
- Supabase 는 project ref 와 display name 을 구분해서 다룬다.

이 문서는 기능 구현 문서가 아니다.
이 문서의 목적은 아래 3가지를 먼저 잠그는 것이다.

1. 예약 원장(system of record)이 무엇인지
2. IMS sync read model 의 역할이 어디까지인지
3. 예약 가능 차량 계산 시 어떤 데이터를 어떤 규칙으로 합칠지

지금 단계에서는 UI, 로그인, 결제 구현보다
**예약 원장 / sync / blocking 구조**를 먼저 확정한다.

---

## 1. 현재 가장 중요한 문제

현재 구조를 잘못 잡으면 아래 문제가 바로 생긴다.

- 홈페이지에서 생성한 예약과 IMS sync 예약이 이중으로 잡힘
- 같은 예약이 local 과 IMS 양쪽에 따로 존재하면서 중복 차단 발생
- 반대로 매핑 실패 시 실제 예약이 blocking 에서 빠짐
- 비회원 예약조회가 IMS 기준인지 local 기준인지 꼬임
- 결제 완료 전 상태와 IMS 반영 후 상태의 책임 경계가 무너짐

즉, 지금은 테이블을 늘리는 것보다
**무엇이 원장이고 무엇이 projection 인지**를 먼저 잠가야 한다.

---

## 2. 현재 잠정 결론

### 2.1 원장은 local-owned 하나만 둔다
- 명칭: `빵빵카 예약 시스템 원장`
- 홈페이지 예약이 들어오면 이 원장에 먼저 기록한다.
- 이 원장 테이블이 이후 결제, 조회, 취소, 운영처리의 기준이 된다.
- 전화예약 등 기타 로컬 예약도 별도 로컬 예약 관리 DB에서 들어올 수 있으나, 개념적으로는 `빵빵카 예약 시스템 원장` 과 구분해서 설명한다.
- IMS는 외부 연동 시스템이며 원장을 대체하지 않는다.

### 2.2 IMS sync 테이블은 read model 이다
- IMS에서 읽어오는 예약 데이터는 원장이 아니다.
- 목적은 외부 상태 반영, 가용성 계산 보조, 운영 비교, 동기화 검증이다.
- IMS sync 결과가 local 예약 원장을 새로 만들거나 덮어쓰면 안 된다.

### 2.3 `ims_sync_reservations` 는 원장이 아니라 IMS sync read model 로 고정한다
- `ims_sync_reservations` 는 비회원 예약조회나 자체 예약의 source of truth 로 사용하지 않는다.
- `ims_sync_reservations` 의 공식 역할은 IMS 기준 upsert read model, 가용성 계산 보조, 외부 상태 캐시다.
- 문서상 개념과 실제 테이블명을 이미 일치시켰고, 중간 호환 상태를 길게 끌지 않는다.

### 2.4 가용성 계산은 통합 blocking view 기준이다
- 예약 가능 차량 목록 제거 기준은 local 원장 단독이 아니다.
- IMS sync 테이블 단독도 아니다.
- 둘을 합치되, 이미 같은 예약으로 연결된 건은 중복 제거한
  **unified blocking set** 을 기준으로 계산한다.

---

## 3. 사장님 질문에 대한 현재 기준 답

### 질문 1
홈페이지 예약이 들어온다 → 우리 DB 원장 추가 → IMS로 전송 → IMS에도 예약 추가 → 다시 IMS를 읽어오면 중복예약 아닌가?

### 현재 답
그대로 두면 중복처럼 보일 수 있다.
그래서 **예약 매핑 계층**이 반드시 필요하다.

원칙은 아래와 같다.

1. 홈페이지 예약 생성 시 `booking_orders` 에 원장을 만든다.
2. IMS 전송 성공 시 `reservation_mappings` 에
   - `booking_order_id`
   - `ims_reservation_id`
   를 연결한다.
3. 이후 IMS sync 로 같은 `ims_reservation_id` 가 들어오면
   새 local 원장을 만드는 것이 아니라
   **기존 local 예약과 연결된 외부 상태**로만 취급한다.
4. 따라서 같은 예약이 local 과 IMS 양쪽에 있어도
   논리적으로는 1건으로 본다.

즉,
- local = 원장
- IMS sync = 외부 반영 상태
- mapping = 둘을 같은 예약으로 묶는 연결키

---

## 4. 예약 가능 차량 목록 제거 기준

### 잘못된 기준
#### A. 원장만 보는 방식
문제:
- IMS에서 직접 생성된 예약을 놓칠 수 있다.
- 외부 운영 변경분이 늦게 반영되면 빈차로 잘못 노출될 수 있다.

#### B. IMS sync 만 보는 방식
문제:
- 우리 사이트에서 결제 직후 아직 IMS 반영 전인 예약을 놓칠 수 있다.
- local 취소, 보류, 결제대기 상태를 제대로 표현하지 못한다.

### 현재 권장 기준
예약 가능 차량 목록은 아래를 합친 통합 blocking 기준으로 계산한다.

1. `booking_orders` 중 blocking 상태
2. `ims_sync_reservations` 중 blocking 상태
3. 단, `reservation_mappings` 로 이미 연결된 동일 예약은 1건으로 dedupe

즉, 차량 제거 기준은
**원장이냐 IMS sync 냐의 이분법이 아니라, 매핑 반영 unified blocking set** 이다.

### 현재 기준 답
사장님 질문, "예약 가능 차량 목록 생성할 때 뭘 기준으로 리스트에서 제거하냐, 원장이냐 IMS 싱크냐" 에 대한 현재 기준 답은 아래와 같다.

- 최종 제거 기준은 `unified blocking set`
- local 원장 예약도 반영한다
- IMS sync 예약도 반영한다
- 다만 둘이 같은 예약이면 `reservation_mappings` 기준으로 한 번만 막는다

즉,
- 결제 직후 아직 IMS 반영 전이면 local 원장이 먼저 막고
- IMS에만 존재하는 외부 예약은 IMS sync 가 막고
- 둘 다 존재하면 mapping 으로 dedupe 해서 한 번만 막는다

---

## 5. 지금 잠가야 할 핵심 구조 원칙

### 원칙 1. source of truth 는 `빵빵카 예약 시스템 원장`
- 현재 홈페이지 예약 기준 구현 테이블은 `booking_orders` 다.
- 고객 예약번호
- 결제상태
- 고객 조회 기준
- 취소/환불 기준
- 우리 서비스 내부 예약 상태
이 5개는 `빵빵카 예약 시스템 원장` 에서 관리한다.

### 원칙 2. ims_sync_reservations 는 sync-owned projection
- IMS 현재 상태 반영
- 외부 예약 blocking 반영
- 비교/검증/운영 보조
- local 원장 대체 금지

### 원칙 3. 중복 해소는 mapping 으로 한다
같은 예약이 local 과 IMS 에 동시에 존재하는 것은 허용한다.
하지만 조회/차단/운영 판단에서는
`reservation_mappings` 를 통해 동일 예약으로 묶어야 한다.

### 원칙 4. blocking 판단은 상태 규칙으로 고정한다
어떤 상태가 차량을 막는지 local 과 IMS 각각 규칙이 있어야 한다.
이후 unified blocking set 에서 공통 형태로 변환한다.

### 원칙 5. sync 가 local 원장을 overwrite 하면 안 된다
IMS sync 가 local 예약의 고객정보, 결제상태, 내부 상태를 직접 덮어쓰면 안 된다.
덮어쓸 수 있는 것은 sync-owned 범위로 한정해야 한다.

---

## 6. 잠정 테이블 역할

### A. booking_orders (local-owned)
목적:
- 현재 홈페이지 예약 기준 `빵빵카 예약 시스템 원장` 구현 테이블

책임:
- public 예약번호
- 고객 식별 기준
- 결제 상태
- 내부 예약 상태
- 취소 / 환불 / 실패 분기

### B. ims_sync_reservations
목적:
- IMS 예약 read model

책임:
- `ims_reservation_id` 기준 외부 상태 저장
- 차량 blocking 계산 보조
- 외부 변경 감시

### C. reservation_mappings
목적:
- local 예약과 IMS 예약을 같은 논리 예약으로 연결

핵심 컬럼 후보:
- `booking_order_id`
- `external_system`
- `external_reservation_id`
- `ims_reservation_id`
- `mapping_status`

### D. reservation_status_events
목적:
- 상태 이력 저장

예시 이벤트:
- booking_created
- payment_pending
- payment_succeeded
- payment_failed
- ims_sync_requested
- ims_synced
- reservation_cancelled
- reservation_refunded
- manual_adjusted

### E. booking_lookup_keys
목적:
- 비회원 예약조회 인증용 키 저장

예시:
- `booking_order_id`
- `phone_hash`
- `phone_last4`
- `lookup_token`
- `verified_at`

---

## 7. 이미 잠가도 되는 사실

아래 항목은 추가 고민 대상이 아니라 현재 기준으로 확정한다.

1. `ims_sync_reservations` 는 원장이 아니다.
2. `ims_sync_reservations` 는 IMS sync read model 이다.
3. 자체 예약 원장은 별도 local-owned 테이블이 필요하다.
4. 물리 테이블명도 `ims_sync_reservations` 로 rename 한다.
5. 테스트 데이터(`shadow-seed`)는 운영 불필요 데이터면 삭제를 우선한다.
6. 비회원 조회는 `예약번호 + 뒤4자리` 1차, 필요 시 2차 본인확인 구조로 간다.
7. 비회원 조회용 공개 식별자와 상태 이력이 필요하다.

---

## 8. 확정된 결정사항

### 8.1 생성, blocking, IMS 생성
1. `booking_orders` 는 결제 승인 성공 후 생성한다.
2. 차량 blocking 은 결제창 진입부터 시작하고, 홀드 시간은 5분이다.
3. 결제 승인 직후 바로 IMS 로 동기화하여 예약을 생성한다.
4. 결제는 곧 예약확정으로 본다.

### 8.2 실패, 취소, 소멸 처리
1. IMS 생성 실패 시에도 예약 성공은 유지한다.
2. 이때 local 상태는 `manual_review_required` 로 둔다.
3. 취소 authority 는 `빵빵카 예약 시스템 원장` 우선이다.
4. local 취소 후 IMS 취소 동기화가 실패해도 local 취소를 되돌리지 않는다.
5. 대신 반드시 관리자 확인 대상으로 올린다.
6. `빵빵카 예약 시스템 원장` 에 없는 IMS sync 예약이 IMS 에서 사라지면 즉시 없는 예약으로 처리한다.
7. `빵빵카 예약 시스템 원장` 에 연결된 예약이 IMS 에서 사라지면 자동 정리하지 않고 관리자 확인 대상으로 올린다.

### 8.3 조회, 공개번호, 테스트데이터
1. 비회원 조회 인증은 `예약번호 + 뒤4자리` 1차 조회를 기본으로 한다.
2. 필요 시 2차 본인확인을 추가한다.
3. 2차 수단의 구체 방식은 추후 확정한다.
4. `public_reservation_code` 는 결제 성공 후 발급한다.
5. IMS 반영 성공 여부와 공개 예약번호 발급을 직접 묶지 않는다.
6. `shadow-seed` 는 운영 불필요 테스트 데이터면 삭제한다.
7. 삭제 전 참조/검증 의존성은 확인한다.

### 8.4 테이블명 정리
1. 물리 테이블명은 `ims_sync_reservations` 로 고정한다.
2. 개념명과 물리 테이블명을 일치시킨다.
3. rename 시 쿼리, API, admin 화면, 배치, mapping 참조를 함께 수정한다.
4. 문제를 뒤로 미루지 않고 지금 드러나게 해서 한 번에 정리한다.

---

## 9. 상태 시뮬레이션 및 검증표

이 표는 구현 전에 구조가 실제로 버티는지 확인하기 위한 검증표다.
핵심 목적은 아래 3가지다.

1. 어떤 시점부터 차량을 blocking 해야 하는지 확인
2. local / IMS / mapping 이 어떻게 상호작용하는지 확인
3. 중복, 유령예약, sync 누락 위험을 미리 찾기

### 9.1 blocking 판단 기본 전제
- local blocking 은 아직 확정 전이지만 최소 후보는 `payment_pending`, `payment_succeeded`, `confirmed_pending_sync`, `confirmed`, `in_use` 계열이다.
- IMS blocking 은 현재 코드 기준 `pending`, `confirmed`, `paid` 다.
- IMS `completed`, `cancelled`, `failed` 는 non-blocking 으로 본다.
- 최종 차량 제거 기준은 `unified blocking set` 이다.

### 9.2 시뮬레이션 표
| 시나리오 | local 상태 | IMS 상태 | mapping 상태 | blocking 여부 | 사용자/운영 해석 | 현재 판단 |
|---|---|---|---|---|---|---|
| 검색만 함, 예약 생성 전 | 없음 | 없음 | 없음 | 비차단 | 정상 노출 | 문제 없음 |
| 예약 진입 후 결제 전 대기 | draft 또는 payment_pending | 없음 | 없음 | 미확정 | 여기서 막으면 유령예약 위험, 안 막으면 동시결제 경쟁 위험 | **정책 잠금 필요** |
| 결제 성공 직후, IMS 전송 전 | payment_succeeded 또는 confirmed_pending_sync | 없음 | 없음 | 차단 필요 | 우리 사이트 재판매 방지용으로 local이 먼저 막아야 함 | **차단 권장** |
| 결제 성공, IMS 전송 성공, sync 전 | confirmed_pending_sync | IMS 아직 미유입 | mapping 생성 완료 또는 대기 | 차단 | local만으로 막힘 | 문제 없음 |
| IMS sync 유입 후 정상 매핑 | confirmed | confirmed 또는 paid | linked | 차단 | 동일 예약 1건으로 취급 | **dedupe 필수** |
| IMS sync 유입, mapping 누락 | confirmed | confirmed 또는 paid | 없음 | 차단은 되지만 중복처럼 보임 | 운영 화면/조회에서 이중예약처럼 보일 수 있음 | **고위험** |
| 결제 성공, IMS 전송 실패 | confirmed_pending_sync 또는 sync_failed | 없음 | 없음 | 차단 | 고객은 예약됐다고 느끼는데 운영 반영 안 됨 | **수동보정 필요** |
| IMS에서 직접 생성된 외부 예약 | 없음 | pending 또는 confirmed | 없음 | 차단 | 사이트는 IMS sync 이후부터 막을 수 있음 | **sync 지연 리스크** |
| local 취소 성공, IMS 취소 전 | cancelled_pending_sync | confirmed 또는 paid | linked | 정책 필요 | 너무 빨리 풀면 실제 IMS엔 남아 있음 | **취소 authority 필요** |
| IMS 취소 먼저 반영, local 미반영 | confirmed | cancelled | linked | 정책 필요 | 고객 화면과 운영 상태 불일치 | **상태 우선순위 필요** |
| 완료 반납 후 | completed | completed | linked | 비차단 | 정상 종료 | 문제 없음 |
| IMS에서 이번 배치에 누락됨 | 없음 또는 과거 local | stale 가능 | linked 또는 없음 | 즉시 해제 금지 | API 누락과 실제 삭제를 구분해야 함 | **tombstone 필수** |

### 9.3 검증 결과 요약
#### 이미 구조상 맞는 것
1. `booking_orders` 를 원장으로 두는 방향은 맞다.
2. `reservations` 를 IMS read model 로 제한하는 방향은 맞다.
3. 차량 제거 기준을 local 또는 IMS 한쪽만으로 결정하면 안 된다.
4. `reservation_mappings` 없이는 중복 해소가 불가능하다.

#### 지금 그대로 구현 들어가면 깨지는 것
1. `booking_orders` 생성 시점과 blocking 시작 시점이 아직 분리되지 않았다.
2. mapping 누락 시 중복예약처럼 보이는 문제를 막는 규칙이 없다.
3. IMS 생성 재시도 시 idempotency 규칙이 없다.
4. local 취소와 IMS 취소 중 누가 최종 authority 인지 없다.
5. IMS 누락건을 stale 로 볼지 실제 삭제로 볼지 기준이 없다.

### 9.4 지금 추가로 잠가야 하는 규칙
#### 규칙 A. mapping 은 선택사항이 아니라 필수
- IMS 전송 성공 후 mapping 생성 실패는 정상 완료로 보면 안 된다.
- 최소 `manual_review_required` 로 떨어져야 한다.

#### 규칙 B. blocking 시작 시점은 생성 시점과 별도로 잠가야 한다
- `booking_orders` 를 일찍 생성하더라도 모든 상태가 blocking 이면 안 된다.
- 그렇지 않으면 결제 실패/이탈 건이 유령예약으로 남는다.

#### 규칙 C. IMS 생성은 idempotent 해야 한다
- 동일 local 예약이 재전송돼도 IMS 중복생성이 나면 안 된다.
- 이를 위한 client reference 또는 external key 전략이 필요하다.

#### 규칙 D. 취소 authority 를 정해야 한다
- local 주도 취소인지
- IMS 주도 취소인지
- 또는 상태별 authority 분리인지 먼저 정해야 한다.

#### 규칙 E. final booking 전 재검증이 필요할 수 있다
- 검색 시점 차단만으로는 부족할 수 있다.
- 결제 승인 직전 또는 예약 확정 직전에 availability 재검증 단계가 필요하다.

### 9.5 현재 기준 실무 결론
- 이 구조는 큰 방향은 맞다.
- 다만 아래 4개를 잠그기 전에는 구현 시작 금지다.
  1. local blocking 상태 집합
  2. `booking_orders` 생성 시점 vs blocking 시작 시점
  3. IMS 생성 idempotency 규칙
  4. 취소 authority 및 tombstone 규칙

---

## 10. rename 영향 범위 정리

`reservations` 를 `ims_sync_reservations` 로 바꾸면 이름만 바꾸고 끝나지 않는다.
아래 연결 지점을 한 묶음으로 같이 수정해야 한다.

### 10.1 SQL / 스키마
1. 테이블 생성/변경 migration
2. foreign key, index, unique key 명
3. view, function, trigger, seed, backfill 스크립트

### 10.2 서버 코드
1. ORM schema 또는 raw SQL
2. repository / service / sync job
3. API response 조립부
4. tombstone, dedupe, mapping 연결 로직

### 10.3 운영 화면 / 배치 / 문서
1. admin 조회 화면
2. 예약 비교 화면
3. 배치/cron/log 문구
4. present 문서와 phase spec 문서

### 10.4 완료 기준
1. 코드/문서/로그에서 `reservations` 를 IMS sync read model 뜻으로 남겨두지 않는다.
2. local 원장과 IMS sync read model 이 이름만 봐도 구분된다.
3. rename 후 sync, blocking, mapping 설명이 더 짧아져야 한다.

---

## 11. Phase 1 목표

Phase 1 에서는 SQL 부터 쓰지 않는다.
먼저 아래만 고정한다.

1. 원장 테이블의 책임
2. sync read model 의 책임
3. mapping 필요 여부와 연결 규칙
4. unified blocking set 계산 규칙
5. local-owned / sync-owned 경계
6. local blocking 상태 집합
7. `booking_orders` 생성 시점 vs blocking 시작 시점
8. IMS 생성 idempotency 원칙
9. 취소 authority 와 tombstone 원칙

### Phase 1 종료 조건
- 중복예약이 논리적으로 어떻게 해소되는지 설명 가능
- 차량 제거 기준을 한 문장으로 정의 가능
- local 과 IMS 의 책임이 섞이지 않음
- 상태 시뮬레이션 표에서 고위험 케이스 처리 원칙이 빠지지 않음
- 이후 컬럼 설계로 내려가도 방향이 안 흔들림

---

## 12. 현재 기준 한 문장 요약

**예약 원장은 local 이고, IMS 는 projection 이며, 차량 blocking 은 mapping 반영된 unified blocking set 기준으로 계산한다.**

---

## 13. 다음 입력 대기

다음 단계는 아래 순서로 진행한다.

1. `ims_sync_reservations` rename 영향 범위 전수 식별
2. local blocking 상태 집합 최종 잠금
3. IMS 생성 idempotency 규칙 잠금
4. 그 다음에만 컬럼 설계 시작
