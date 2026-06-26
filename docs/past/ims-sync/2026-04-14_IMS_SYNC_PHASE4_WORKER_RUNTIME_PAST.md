# 2026-04-14 20:03 / e3c8850 / IMS SYNC PHASE 4 WORKER RUNTIME

## 결론
IMS 예약 동기화는 **웹 요청 경로가 아니라 repo 내부의 별도 백그라운드 워커**로 운영한다.

구조:
- 웹앱/API 서버
- IMS sync worker
- Supabase

워커는 같은 repo 안에 두되, 실행 경로를 분리한다.

---

## 1. 코드 위치
권장 위치:
- `scripts/ims-sync/`
  - `run-ims-reservation-sync.js`
  - `fetch-ims-reservations.js`
  - `normalize-ims-reservation.js`
  - `upsert-ims-reservations.js`
  - `lib/ims-auth.js`
  - `lib/supabase-admin.js`

원칙:
- 웹 요청 핸들러와 분리
- 수집 / 정규화 / upsert 책임 분리
- 수동 실행 가능한 entrypoint 유지

---

## 2. 실행 방식
1차 기준:
- cron 또는 외부 스케줄러가
  `node scripts/ims-sync/run-ims-reservation-sync.js`
  를 3분마다 실행

원칙:
- 워커를 웹 서버 부팅 라이프사이클에 묶지 않음
- 서버 트래픽과 동기화 작업을 분리
- 로컬 수동 실행과 운영 주기 실행을 같은 entrypoint 로 맞춤

---

## 3. 인증 주입 방식
현재 검증된 인증 방식은 **브라우저 없는 직접 로그인 + JWT 사용**이다.

초기 기준:
- 환경변수 `IMS_ID` 와 `IMS_PW` 를 워커에 주입
- 워커가 `IMS_PW` 를 `sha256(...).hex()` 로 변환
- `POST https://api.rencar.co.kr/auth` 로 `access_token` 발급
- 이후 `Authorization: JWT <access_token>` 로 IMS API 호출

보조 기준:
- 필요 시 `IMS_AUTHORIZATION` 직접 주입을 임시 디버깅/비상 우회값으로 허용할 수 있다.
- 그러나 기본 운영 경로는 토큰 자동 로그인 재발급이다.

즉:
- Phase 4의 워커는 **IMS 계정 기반 자동 로그인** 기준으로 잠근다.

---

## 4. 실행 주기
기본 주기:
- 3분마다 1회

이유:
- 너무 짧으면 IMS 부하/차단 리스크 증가
- 너무 길면 가용성 반영 오차 증가

---

## 5. 실패 재시도 규칙
- 한 번 실패하면 1분 이내 1회 짧은 재시도 허용
- 재시도도 실패하면 해당 run 을 실패 처리하고 다음 정기 주기로 복귀
- 실패 상세는 `reservation_sync_errors` 와 `reservation_sync_runs.error_summary` 에 남김

원칙:
- 무한 루프 재시도 금지
- 단기 장애와 구조적 장애를 구분

---

## 6. 실행 잠금 규칙
동시에 두 개 이상 sync 가 겹치지 않게 한다.

초안:
- 새 run 시작 전 `running` 상태 sync run 존재 여부 확인
- 존재하면 새 실행 스킵 또는 stale timeout 기준으로 중단 처리 후 시작

이유:
- 중복 fetch / 중복 upsert / 로그 혼선 방지

---

## 7. 환경변수
최소:
- `IMS_ID`
- `IMS_PW`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

선택:
- `IMS_AUTHORIZATION` (디버깅/비상 우회)
- `IMS_SYNC_WINDOW_DAYS=30`
- `IMS_SYNC_RETRY_ONCE=true`
- `IMS_SYNC_STALE_MINUTES=10`

---

## 8. run 흐름
1. 실행 잠금 확인
2. `reservation_sync_runs` 에 run 생성
3. IMS fetch
4. raw 저장
5. normalize
6. reservations upsert
7. 성공/실패 집계
8. run 종료 처리

---

## 9. 이 Phase에서 아직 안 하는 것
- Authorization 자동 재발급
- 상태값 enum 전수 수집 자동화
- overlap 차단 SQL 고도화
- 실운영 배포 스케줄 연결

---

## Phase 4 종료 조건 점검
- 워커 위치 확정: 완료
- 실행 경로 확정: 완료
- 인증 주입 방식 확정: 완료
- 3분 주기 / 재시도 규칙 확정: 완료
- 실행 잠금 원칙 확정: 완료
��: 완료
- 실행 잠금 원칙 확정: 완료
