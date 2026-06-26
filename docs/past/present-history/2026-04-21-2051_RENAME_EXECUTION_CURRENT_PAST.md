# rentcar00-booking-system rename 실행 준비 문서

## 문서 상태
- 상태: active present
- 용도: rename 작업의 전체 진행 단계와 현재 세부 진행 단계를 잠그는 실행 준비 문서
- 성격: 실행 준비 문서, 아직 실행 승인 범위 확장 아님
- 기준 브랜치: `feat/db-preview-home`

---

## 0. 목적

이 문서는 아래 3가지를 잠그기 위해 만든다.

1. rename 작업의 최종 목표 상태
2. 전체 진행 단계와 단계별 종료 조건
3. 현재 단계에서 해야 할 검증과 실행 준비 범위

이 문서의 범위는 `rename` 이다.
기능 개발, 배포 확대, 구조 개편 자체를 다루는 문서가 아니다.

---

## 1. 현재 기준점

### 1.1 유지하는 새 기준
아래 항목은 롤백하지 않고 새 기준으로 유지한다.

- 로컬 프로젝트 폴더명: `rentcar00-booking-system`
- Vercel 프로젝트명: `rentcar00-booking-system`
- IMS sync read model 물리 테이블명: `ims_sync_reservations`
- 관련 migration 적용 상태

### 1.2 아직 정합이 덜 맞는 항목
아래 항목은 아직 새 기준으로 완전히 잠기지 않았다.

- GitHub 원격 저장소 이름은 아직 `premove-clone`
- `origin` remote URL 도 아직 `premove-clone`
- Vercel link repo / deployment metadata / alias 는 아직 `premove-clone` 계열
- Supabase display name 은 아직 `premove-cars`
- 문서와 작업트리는 rename 정리와 기타 수정이 일부 섞여 있다

### 1.3 현재까지 확인된 사실
- `npm run build` 통과
- 현재 코드의 실사용 테이블 참조는 `ims_sync_reservations` 기준으로 맞아 있음
- `supabase db push --linked --dry-run` 결과 remote DB 는 up to date
- `.vercel/project.json` 은 새 프로젝트명 기준으로 정렬됨

### 1.4 직접 검증한 현재 상태

#### 로컬 저장소
- 작업 브랜치: `feat/db-preview-home`
- 기준 커밋: `5ffdf8e`
- `git remote -v` 기준 `origin` 은 아직 `https://github.com/otang00/premove-clone.git`
- rename 관련 수정 파일은 현재 작업트리에 남아 있다.
- 현재 tracked 변경 파일:
  - `README.md`
  - `docs/README.md`
  - `docs/references/IMS_API_CALLS.md`
  - `package.json`
  - `package-lock.json`
  - `scripts/ims-sync/fetch-ims-reservations.js`
  - `scripts/ims-sync/fetch-ims-vehicles.js`
  - `scripts/ims-sync/lib/ims-auth.js`
  - `scripts/ims-sync/run-launchd.sh`
  - `scripts/ims-sync/upsert-ims-reservations.js`
  - `scripts/mirror-car-images.js`
  - `server/search-db/repositories/fetchBlockingReservations.js`
  - `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
  - `supabase/migrations/20260414213000_fix_reservations_upsert_unique.sql`
  - `supabase/seed.sql`
- 삭제 상태 파일:
  - `docs/present/EXECUTION_MASTER_PRESENT.md`
- 신규 추가 상태 파일:
  - `docs/past/present-history/2026-04-21-1830_EXECUTION_MASTER_PRESENT_PAST.md`
  - `docs/past/present-history/2026-04-21-1834_RENTCAR00_RESERVATION_CURRENT_PAST.md`
  - `docs/phase-specs/RENTCAR00_DB_DECISION_CHECKLIST.md`
  - `docs/present/RENAME_SCOPE_CHECKLIST.md`
  - `docs/present/RENTCAR00_DB_EXECUTION_CURRENT.md`
  - `docs/present/RENAME_EXECUTION_CURRENT.md`
  - `supabase/migrations/20260421195800_rename_reservations_to_ims_sync_reservations.sql`

#### GitHub
- 현재 원격 저장소는 `otang00/rentcar00-booking-system`
- 기본 브랜치: `master`
- 현재 권한: `ADMIN`
- old 저장소 경로 `otang00/premove-clone` 조회도 새 저장소로 redirect 된다.
- local `origin` 도 `https://github.com/otang00/rentcar00-booking-system.git` 로 맞춰졌다.

#### Vercel
- Vercel project name: `rentcar00-booking-system`
- project id: `prj_3TMA5tuzNK70GNbgCAUnTlNQUn2m`
- `.vercel/project.json` 의 local metadata 는 새 이름 기준
- Git link 는 새 저장소로 교체 완료
  - `link.repo = rentcar00-booking-system`
  - production branch = `master`
- 새 수동 alias 추가 완료
  - `rentcar00-booking-system.vercel.app`
- 다만 기존 배포 이력 메타는 old 기준이 남아 있다.
  - latest deployment `name = premove-clone`
  - deployment meta `githubRepo = premove-clone`
  - 기존 alias `premove-clone.vercel.app`

#### Supabase
- project ref: `ieswwzsqasuqppacxepl`
- display name: `premove-cars`
- region: `ap-northeast-2`
- 상태: `ACTIVE_HEALTHY`
- `supabase db push --linked --dry-run` 결과: `Remote database is up to date.`
- 현재 실행 환경에서는 `SUPABASE_ACCESS_TOKEN` 이 없어 Management API 경로를 바로 쓸 수 없다.
- 현재 CLI 기준 display name 변경용 표준 명령도 확인되지 않았다.

---

## 2. 상세 변경 필요 리스트

## 2.1 로컬에서 변경 또는 정리해야 하는 항목

### A. 코드/스크립트 rename 변경분을 커밋 가능한 단위로 정리
현재 rename 관련 변경이 아래 파일에 흩어져 있다.

- `package.json`
- `package-lock.json`
- `scripts/ims-sync/fetch-ims-reservations.js`
- `scripts/ims-sync/fetch-ims-vehicles.js`
- `scripts/ims-sync/lib/ims-auth.js`
- `scripts/ims-sync/run-launchd.sh`
- `scripts/ims-sync/upsert-ims-reservations.js`
- `scripts/mirror-car-images.js`
- `server/search-db/repositories/fetchBlockingReservations.js`
- `supabase/migrations/20260414195200_create_ims_sync_tables.sql`
- `supabase/migrations/20260414213000_fix_reservations_upsert_unique.sql`
- `supabase/seed.sql`

필요 작업:
- rename 목적 변경과 기타 변경을 섞지 않도록 diff 목적별로 다시 점검
- 각 파일이 정말 새 기준만 반영하는지 확인
- 문서/원격 rename 전에 로컬 rename 변경분 설명 가능 상태로 정리

### B. 문서 current 체계 정리
현재 문서 정책과 실제 상태가 충돌한다.

확인된 충돌:
- `docs/README.md` 는 active present 1개 원칙을 말함
- `README.md` 도 현재 기준 문서를 `docs/present/RENTCAR00_DB_EXECUTION_CURRENT.md` 1개로 설명함
- 실제로는 rename current 문서가 추가되었고 present 문서가 1개를 초과한다.

필요 작업:
- `README.md` 의 현재 기준 문서 안내 수정 여부 결정
- `docs/README.md` 의 active present 정책과 실제 운영 방식 재정렬
- `RENAME_EXECUTION_CURRENT.md` 와 `RENTCAR00_DB_EXECUTION_CURRENT.md` 의 역할 분리 기준 명시
- `RENAME_SCOPE_CHECKLIST.md` 를 유지할지, 실행 후 past 로 내릴지 기준 고정

### C. 문서 경로/기준 불일치 수정
확인된 불일치:
- `supabase/README.md` 는 존재하지 않는 migration 파일명 `20260414_create_cars.sql` 을 가리킨다.
- 실제 migration 파일은 `supabase/migrations/20260414000000_create_cars.sql`

필요 작업:
- `supabase/README.md` 의 migration 경로와 적용 순서를 실제 파일 기준으로 수정
- rename 이후 current 문서 참조 순서가 맞는지 재검토

### D. 삭제/이관 문서 처리 기준 고정
확인된 상태:
- `docs/present/EXECUTION_MASTER_PRESENT.md` 는 삭제 상태
- 대응 past 문서는 생성되어 있음

필요 작업:
- 삭제가 의도된 이관인지 최종 확인
- present 에서 빠진 이유와 대체 기준 문서를 current 문서에서 명확히 설명

## 2.2 GitHub 에서 바꿔야 하는 항목

### Phase 2 직접 검증 결과
- 현재 GitHub 저장소명은 `otang00/premove-clone` 으로 유지 중이다.
- 현재 기본 브랜치는 `master` 다.
- 현재 권한은 `ADMIN` 이므로 저장소 rename 자체는 수행 가능하다.
- 현재 `origin` 은 old URL 을 그대로 가리킨다.
- 이번 rename 에서는 저장소명 변경과 `origin` URL 갱신만 우선 범위로 두고, 기본 브랜치 rename 은 scope 밖으로 분리한다.

### A. 저장소 이름
현재 상태:
- 완료, `otang00/rentcar00-booking-system`

실행 결과:
- GitHub 저장소명을 `rentcar00-booking-system` 으로 rename 완료
- old 경로 조회 시 새 저장소로 redirect 확인

검증 포인트:
- `gh repo view --json name,nameWithOwner,url`
- GitHub 웹 기준 redirect 동작 여부

### B. local origin URL
현재 상태:
- 완료, `origin = https://github.com/otang00/rentcar00-booking-system.git`

실행 결과:
- GitHub rename 이후 local `origin` 이 새 URL 기준으로 정렬됨

검증 포인트:
- `git remote -v`
- 새 URL 로 fetch 가능 여부

### C. 기본 브랜치 영향
현재 상태:
- production branch / default branch 모두 `master` 축에 묶여 있음

필요 작업:
- 이번 rename 에서는 브랜치명 변경까지 할지 분리 결정
- 브랜치 rename 을 섞지 않으면 scope 에서 제외 명시

### D. GitHub rename 직후 즉시 확인할 항목
- `gh repo view --json name,nameWithOwner,url,defaultBranchRef`
- `git remote -v`
- GitHub old URL redirect 동작 여부

판정 기준:
- 저장소명이 `rentcar00-booking-system` 으로 조회되어야 한다.
- `origin` fetch/push URL 이 새 이름으로 바뀌어야 한다.
- 기본 브랜치는 여전히 `master` 로 유지되어야 한다.

## 2.3 Vercel 에서 바꿔야 하는 항목

### Phase 2 직접 검증 결과
- Vercel project name 은 이미 `rentcar00-booking-system` 으로 바뀌어 있다.
- 그러나 `link.repo`, deployment `name`, deployment meta `githubRepo`, production alias 는 모두 old 이름 축이다.
- 현재 production branch 도 `master` 기준으로 묶여 있다.
- 따라서 GitHub rename 뒤에는 Vercel 이 link 와 metadata 를 자동 추적하는지 먼저 확인해야 한다.
- alias 변경은 외부 접근 경로 변경이므로 GitHub rename 과 분리해서 판단한다.

### A. Git link repo 정합
현재 상태:
- 완료, `link.repo = rentcar00-booking-system`

실행 결과:
- GitHub rename 후 자동 갱신은 되지 않았고, `vercel git connect https://github.com/otang00/rentcar00-booking-system.git` 로 직접 교체 완료

검증 포인트:
- `vercel api /v9/projects/prj_3TMA5tuzNK70GNbgCAUnTlNQUn2m --raw`
- `link.repo`
- deployment metadata 의 `githubRepo`, `githubCommitRepo`

### B. production alias / deployment name 잔존 old name
현재 상태:
- 새 alias 추가 완료: `rentcar00-booking-system.vercel.app`
- 기존 alias `premove-clone.vercel.app` 도 아직 유지
- latest deployment `name = premove-clone`

실행 결과:
- 기존 production deployment 에 새 alias 를 추가했다.
- 기존 alias 는 끊지 않고 남겨서 외부 접근 리스크를 낮췄다.

주의:
- alias 추가와 old alias 제거는 별개 작업이다.
- 기존 배포 메타와 deployment name 은 새 배포 전까지 old 흔적이 남을 수 있다.

### C. 로컬 metadata 와 원격 상태 차이
현재 상태:
- `.vercel/project.json` 은 새 이름
- 원격 deployment lineage 는 old name 기반 흔적 유지

필요 작업:
- local metadata 만 새 기준인 상태를 해소할지
- 아니면 원격 rename 후 다시 재동기화할지 결정

### D. GitHub rename 직후 Vercel 확인 항목
- `vercel api /v9/projects/prj_3TMA5tuzNK70GNbgCAUnTlNQUn2m --raw`
- `link.repo`
- latest deployment `meta.githubRepo`
- latest deployment `meta.githubCommitRepo`
- production alias 목록

판정 기준:
- 최소 기준: Git 연동이 끊기지 않고 새 GitHub 저장소로 추적 가능해야 한다.
- 경계 기준: alias 는 즉시 변경하지 않아도 되지만, old alias 유지 여부를 명시적으로 결정해야 한다.
- 중단 기준: GitHub rename 후 link 추적이 끊기거나 배포 메타가 비정상으로 변하면 즉시 중단한다.

## 2.4 Supabase 에서 바꿔야 하는 항목

### Phase 2 직접 검증 결과
- Supabase project ref `ieswwzsqasuqppacxepl` 는 변경 대상이 아니다.
- display name `premove-cars` 만 old 이름 축이다.
- DB 자체는 `Remote database is up to date.` 상태다.
- 현재 CLI 2.75.0 기준 display name 변경용 표준 명령은 확인되지 않았다.
- 따라서 Supabase 는 기능 영향 경로와 운영 표시 경로를 분리해 다뤄야 한다.

### A. 기능 경로
현재 상태:
- 기능 경로는 이미 새 기준으로 맞음
- DB 는 up to date
- 실사용 테이블 참조는 `ims_sync_reservations`

필요 작업:
- 추가 기능 변경 없음
- rename 완료 후에도 dry-run 으로 drift 재검증만 수행

### B. display name
현재 상태:
- 미변경, `premove-cars`

필요 작업:
- 콘솔 또는 Management API 로 display name 변경
- 현재 실행 환경에는 `SUPABASE_ACCESS_TOKEN` 이 없어 API 집행은 보류

주의:
- project ref 는 바꾸는 대상이 아니다.
- display name 변경은 기능 영향보다 운영 표기 정리 성격이 크다.

## 2.5 변경 불필요 또는 의도적 잔존 항목

### 유지 가능한 항목
- `supabase` project ref `ieswwzsqasuqppacxepl`
- migration 파일 내부의 old table 명 참조, rename 자체를 수행하기 위한 구문
- `docs/past`, `docs/archive` 내부 old name 기록
- `logs/legacy-premove-clone/` 경로, 과거 로그 보존 목적

### 실행 전 반드시 분리해야 할 항목
- 과거 기록용 잔존 문자열
- 운영 경로의 실사용 문자열
- 외부 노출 alias 와 내부 metadata

---

## 3. 최종 목표 상태

rename 완료 상태는 아래를 모두 만족해야 한다.

1. 로컬 폴더명, package name, 문서명이 새 기준과 일치한다.
2. 운영 코드와 스크립트에서 old name 의 실사용 참조가 제거된다.
3. GitHub 저장소명과 `origin` URL 이 새 기준으로 일치한다.
4. Vercel project name 과 Git link 기준이 새 저장소명과 정합을 이룬다.
5. Supabase 는 기능 경로와 표시 경로를 분리해 설명 가능하다.
6. old name 잔존은 과거 기록 문서나 배포 이력처럼 의도된 영역으로 한정된다.
7. 최종 검증표로 현재 상태를 재현 가능하게 설명할 수 있다.

---

## 3. 전체 진행 단계

## Phase 1. 기준 잠금
### 목적
무엇을 유지하고 무엇을 아직 건드리지 않을지 확정한다.

### 범위
- 새 기준 유지 항목 확정
- 미정합 항목 목록화
- 롤백 비대상 / 후순위 대상 분리

### 종료 조건
- 유지 기준 1세트가 문서에 명시됨
- 후속 단계의 변경 대상이 분리됨

### 현재 상태
- 완료

---

## Phase 2. 참조 정리 검증
### 목적
코드, 스크립트, 문서, DB 참조가 새 기준과 얼마나 맞는지 검증한다.

### 범위
- old project name 잔존 검색
- old table reference 잔존 검색
- build 검증
- migration / seed / sync 경로 논리 검토

### 종료 조건
- 실사용 참조와 기록용 참조가 구분됨
- 빌드 및 DB 기준 검증 결과가 정리됨

### 현재 상태
- 완료

---

## Phase 3. 원격 rename 영향 고정
### 목적
GitHub 저장소 rename 전에 영향 범위를 완전히 잠근다.

### 범위
- GitHub repo name
- local origin URL
- Vercel link repo
- deployment metadata / alias 영향
- 관련 문서 표기

### 종료 조건
- GitHub rename 전후 바뀌는 항목 목록이 고정됨
- rename 직후 검증 명령이 준비됨

### 현재 상태
- 완료

---

## Phase 3 결론
- GitHub rename 실행 단위는 `저장소명 변경 -> local origin 갱신 -> GitHub redirect 확인 -> Vercel link/meta 확인` 순서로 집행 완료했다.
- 기본 브랜치 `master` rename 은 이번 단계에 포함하지 않았다.
- Vercel Git link 는 직접 교체 완료했다.
- Supabase 는 display name 만 후속 검토 대상으로 남기고, project ref 와 DB 기능 경로는 유지한다.

---

## Phase 4. 원격 rename 실행
### 목적
GitHub 저장소명과 remote URL 을 새 기준으로 맞춘다.

### 범위
- GitHub repo rename
- local `origin` 변경
- Vercel link 상태 재확인

### 종료 조건
- `gh repo view` 와 `git remote -v` 가 새 이름 기준 반환
- Vercel 연동이 끊기지 않았음이 확인됨

### 현재 상태
- 완료

---

## Phase 5. 표시명 및 운영 메타 정리
### 목적
기능 영향이 낮은 관리 콘솔 이름 불일치를 정리한다.

### 범위
- Supabase display name 변경 여부 결정 및 반영
- Vercel 표시 메타 최종 확인
- 필요 시 문서 표현 정리

### 종료 조건
- 표시명 불일치가 설명 가능하거나 해소됨

### 현재 상태
- 부분 완료
- 완료: Vercel Git link 갱신, 새 Vercel alias 추가
- 미완: Supabase display name 변경

---

## Phase 6. 최종 검증과 마감
### 목적
새 기준이 전체적으로 잠겼는지 검증하고 마감 기준을 남긴다.

### 범위
- git status
- build
- grep 기반 잔존 참조 재검증
- GitHub / Vercel / Supabase 상태 재검증
- 문서 current 기준 재확인

### 종료 조건
- 새 기준으로 전체 상태 설명 가능
- old name 잔존은 의도된 예외로만 남음

### 현재 상태
- 미실행

---

## 4. 현재 진행 단계의 세부 단계

현재 진행 단계는 `Phase 3. 원격 rename 영향 고정` 이전까지의 실행 준비 정리다.
즉, 실제 원격 변경 전에 검증과 준비만 끝내는 단계다.

### 4.1 세부 단계 A. 유지 기준 재확인
#### 할 일
- 새 기준 유지 항목을 문서상 다시 고정
- 롤백 비대상 항목 확인

#### 확인 포인트
- 로컬 폴더명 유지
- Vercel 프로젝트명 유지
- `ims_sync_reservations` 유지

#### 종료 조건
- 후속 단계에서 되돌리지 않을 축이 명시됨

### 4.2 세부 단계 B. 잔존 참조 분류
#### 할 일
- `premove-clone`
- `premove-cars`
- `reservations`
문자열을 실사용 / 기록용 / 관리용으로 분류

#### 확인 포인트
- 실사용 코드에 old 기준이 남아 있는지
- migration 파일의 old 참조는 의도된 것인지
- 과거 문서 잔존은 허용 범위인지

#### 종료 조건
- 잔존 참조가 제거 대상과 유지 대상으로 분리됨

### 4.3 세부 단계 C. 연동 영향 표 작성
#### 할 일
- GitHub rename 시 영향을 받는 연결점 정리

#### 확인 포인트
- `origin`
- `gh repo view`
- Vercel `link.repo`
- deployment metadata 의 old repo 흔적
- alias 와 project 표시명 차이

#### 종료 조건
- GitHub rename 전후 점검 항목이 체크리스트로 정리됨

### 4.4 세부 단계 D. 최종 실행 순서 잠금
#### 할 일
- 실제 실행 순서를 선후관계대로 고정

#### 고정 순서
1. 로컬 참조와 문서 정리
2. GitHub rename 영향 재확인
3. GitHub repo rename
4. local origin URL 변경
5. Vercel link / metadata 재검증
6. Supabase display name 최종 판단
7. 최종 검증

#### 종료 조건
- 바로 실행 가능한 순서표가 문서에 잠김

### 4.5 세부 단계 E. 중단 조건 잠금
#### 할 일
- 실행 중 멈춰야 하는 조건 명시

#### 중단 조건
- GitHub rename 후 Vercel 연동 이상 징후 확인
- 실사용 코드에서 old repo/path/table 참조 재발견
- 현재 기준 문서와 실제 원격 상태 불일치 확대
- build 또는 핵심 검증 실패

#### 종료 조건
- 실행 중 무리하게 계속 밀지 않도록 중단 기준이 고정됨

---

## 5. 단계별 검증표

## Phase 2 검증표
- `rg` 로 old project name 잔존 검색
- `rg` 로 old table reference 잔존 검색
- `npm run build`
- `supabase db push --linked --dry-run`

통과 기준:
- 실사용 참조 정리 가능
- build 통과
- remote DB drift 없음

## Phase 3 검증표
- `git remote -v`
- `gh repo view --json name,nameWithOwner,url,defaultBranchRef,viewerPermission`
- `vercel api /v9/projects/prj_3TMA5tuzNK70GNbgCAUnTlNQUn2m --raw`
- `supabase projects list -o json`
- `supabase db push --linked --dry-run`

통과 기준:
- old/new 기준이 어디서 갈리는지 설명 가능
- rename 시 수정 대상이 명확함
- GitHub, Vercel, Supabase 의 즉시 확인 포인트가 잠김

## Phase 4 검증표
- GitHub repo rename 후 `gh repo view`
- `git remote -v`
- Vercel project/link 상태 재확인

통과 기준:
- GitHub, local origin, Vercel 연결이 새 기준으로 맞음

## Phase 5 검증표
- Supabase 표시명 확인
- Vercel 표시 메타 확인

통과 기준:
- 기능 경로와 관리 표시 경로 차이가 설명 가능하거나 해소됨

## Phase 6 검증표
- `git status`
- `npm run build`
- old/new name grep
- `gh repo view`
- `git remote -v`
- `vercel api /v9/projects/...`
- `supabase db push --linked --dry-run`

통과 기준:
- 새 기준으로 전체 상태 설명 가능
- old name 잔존은 의도된 영역만 남음

---

## 6. 실행 원칙

1. 현재 문서는 실행 준비 문서다.
2. 실제 상태 변경은 별도 승인 범위 안에서만 진행한다.
3. GitHub rename 은 로컬 정리와 영향 고정 뒤에만 수행한다.
4. Vercel 과 Supabase 는 기능 영향과 표시 영향으로 분리해 다룬다.
5. build, grep, remote status 검증 없이 다음 단계로 넘어가지 않는다.

---

## 7. 현재 판단

현재 기준에서 가장 안전한 방향은 아래다.

- DB rename 과 로컬 새 기준은 유지
- GitHub repo rename 은 마지막 원격 핵심 단계로 둠
- 그 전에 참조 정리, 연동 영향 고정, 검증표 잠금을 먼저 끝냄

즉, 지금 단계의 목표는
`바로 실행` 이 아니라
`실행 순서를 잠그고, 실패 조건을 먼저 고정하는 것` 이다.
