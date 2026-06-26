# 2026-06-19 RESERVATION VERCEL ANALYTICS PHASE PLAN

## Purpose
예약홈페이지의 방문, 직접문의, 예약 전환 흐름을 Vercel 배포 상태와 분리해서 측정 가능한 운영 지표로 만든다.

이 문서는 OPS 평가와 별도다. OPS 직원 사용 평가는 `rentcar00_OPS`의 `rc00_ops_action_logs`를 기준으로 하고, 이 문서는 홈페이지/고객 유입/전환만 다룬다.

## Baseline
- 배포는 Vercel을 사용 중이다.
- Vercel 배포 자체만으로 비즈니스 전환 이벤트가 자동 집계되지는 않는다.
- 현재 필요한 것은 단순 방문수보다 직접문의 증가를 설명할 수 있는 이벤트다.
- 고객명, 전화번호, 상세 메모 같은 개인정보 원문은 analytics 이벤트에 저장하지 않는다.
- 기존 프로젝트 문서 위치 기준상 phase 문서는 `docs/PHASE/`에 둔다.

## Measurement Boundary
| Area | Owner | Use |
| --- | --- | --- |
| Vercel deployment/runtime logs | Vercel | 배포, 함수 오류, 런타임 문제 확인 |
| Vercel Web Analytics | Vercel | page view, referrer, device level overview |
| Custom funnel events | Reservation app + Supabase | 문의/예약 전환 평가의 핵심 |
| OPS action logs | rentcar00_OPS | 직원 운영 사용성 평가. 이 문서 범위 밖 |

## Event Taxonomy
| Event | Meaning | Required Fields | Forbidden Fields |
| --- | --- | --- | --- |
| `page_view` | 주요 페이지 진입 | path, referrer, device, session_id | customer name, phone |
| `search_submit` | 차량 검색 실행 | date range, rental duration bucket, pickup area bucket | raw customer input |
| `search_no_result` | 검색 결과 없음 | date range, duration bucket | customer identity |
| `car_detail_view` | 차량 상세 조회 | car/group id, price bucket | customer identity |
| `phone_click` | 전화 문의 클릭 | page, car/group id optional | phone number typed by user |
| `kakao_click` | 카카오 문의 클릭 | page, car/group id optional | message body |
| `reservation_form_open` | 예약/문의 폼 진입 | page, car/group id optional | customer identity |
| `reservation_submit` | 예약/문의 제출 | source, success/fail, validation error type | phone/name/raw memo |
| `reservation_submit_error` | 제출 실패 | error category | raw error with PII |

## Phase 1. Current Instrumentation Audit
- 목적:
  - 현재 홈페이지 프로젝트가 어떤 분석/로그 도구를 이미 쓰는지 확인한다.
- 범위:
  - `package.json`
  - `vercel.json`
  - app entry/client router
  - API routes
  - Supabase client/server usage
- 종료 조건:
  - Vercel Analytics 설치 여부, custom event 저장 여부, 문의/예약 버튼 위치가 문서화된다.
- 검증:
  - 코드 검색 결과와 실제 라우트 목록 확인.
- 리스크:
  - 기존 analytics 흔적이 있으면 중복 이벤트 방지 필요.

## Phase 2. Event Schema Design
- 목적:
  - 홈페이지 전환 이벤트 저장 구조를 확정한다.
- 포함:
  - `analytics_events` 후보 테이블 또는 기존 event table 재사용 검토
  - `event_name`, `created_at`, `session_id`, `path`, `referrer`, `device`, `utm_*`, `payload_json`
  - privacy-safe payload 기준
- 종료 조건:
  - 저장 위치와 필드가 확정된다.
- 검증:
  - 개인정보 원문 저장 금지 조건 점검.
- 리스크:
  - 고객 예약 원장과 분석 이벤트를 섞으면 운영/개인정보 경계가 흐려진다.

## Phase 3. Vercel Analytics Wiring
- 목적:
  - 방문/페이지/기기/유입 경로의 기본 통계를 확보한다.
- 포함:
  - Vercel Web Analytics 설치 여부 확인
  - 필요 시 클라이언트 엔트리에 analytics 컴포넌트 추가
  - Vercel dashboard에서 확인할 항목 정의
- 종료 조건:
  - page view 계열 기본 지표 확인 가능.
- 검증:
  - preview/prod에서 page view 수집 여부 확인.
- 리스크:
  - Vercel Web Analytics만으로는 전화/카카오/예약 제출 같은 운영 전환을 설명할 수 없다.

## Phase 4. Custom Funnel Event Implementation
- 목적:
  - 실제 문의/예약 전환 이벤트를 앱에서 기록한다.
- 포함:
  - 전화 버튼 click handler
  - 카카오 버튼 click handler
  - 검색/상세/예약 폼 이벤트
  - API route 또는 server action을 통한 event insert
- 종료 조건:
  - 주요 고객 행동이 analytics event row로 남는다.
- 검증:
  - 로컬 또는 preview에서 각 이벤트 1건씩 발생 확인.
  - 중복 클릭 방지/debounce 확인.
- 리스크:
  - 클라이언트에서 직접 Supabase write를 허용하면 abuse/PII 위험이 생긴다.

## Phase 5. Monthly Cortex Report Integration
- 목적:
  - 홈페이지 이벤트를 월말평가에 넣을 수 있는 형태로 집계한다.
- 포함:
  - 월별 방문수
  - 전화/카카오 클릭수
  - 검색수/결과없음 비율
  - 예약 폼 진입/제출/실패
  - 직접문의 증가 판단 메모
- 종료 조건:
  - 월말결산에 붙일 수 있는 고정 표가 생긴다.
- 검증:
  - 임의 월 집계 query 또는 export가 동작한다.
- 리스크:
  - 매출이 없을 때도 문의 증가는 별도 성과로 인정해야 한다.

## Stop Conditions
- OPS 직원 사용 로그와 홈페이지 고객 전환 로그를 같은 테이블/평가축으로 섞으려 할 때.
- 고객명/전화번호/메모 원문을 analytics payload에 저장해야만 한다는 구조가 나올 때.
- Vercel 설정, production env, DB migration, deploy가 별도 승인 없이 필요해질 때.
- 기존 예약 원장/결제 흐름을 분석 이벤트 때문에 바꿔야 할 때.

## Verification Notes
- Vercel은 배포/방문/런타임 확인용이다.
- 비즈니스 전환 평가는 custom event가 핵심이다.
- OPS 사용성 평가는 `rentcar00_OPS`의 `rc00_ops_action_logs`가 핵심이다.

## Approval Request
이 문서는 phase plan이다. 구현, DB migration, Vercel 설정 변경, 배포는 별도 승인 후 진행한다.
