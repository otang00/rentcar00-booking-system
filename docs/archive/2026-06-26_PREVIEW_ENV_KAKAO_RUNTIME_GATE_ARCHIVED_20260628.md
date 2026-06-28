# ARCHIVED: 2026-06-26 Preview Env / Kakao Runtime Gate

## Archive Reason

이 문서는 Preview env/Kakao/runtime gate 작업 기록으로 작성되었으나, 2026-06-28 기준 브랜치 정리·dev 반영·최종 PR까지 포함하는 실행 PM 문서로는 범위가 부족해 폐기한다.

현재 실행 기준 문서:

- `docs/PHASE/2026-06-28_DEV_PREVIEW_BRANCH_FINISH_PR_PM.md`

이 문서는 참고 기록으로만 보존하며, 이후 실행 승인·phase gate·커밋/PR 판단 기준으로 사용하지 않는다.

---

# 2026-06-26 Preview Env / Kakao Runtime Gate

## 목적

Preview에서 운영 배포 전 검증이 깨지는 문제를 줄인다.

- `DETAIL_TOKEN_SECRET` 누락으로 `/api/search-cars`가 `detail_token_secret_missing` 실패하는 문제 재발 방지
- Kakao Maps 로딩 실패 원인을 코드/CSP/env 기준으로 분리
- 딜리버리 지역 조회 실패/빈 결과를 운영 로그와 UI 상태로 드러냄

## 확인된 사실

- `DETAIL_TOKEN_SECRET`는 Production/Development에는 있었지만, Preview는 일부 브랜치 전용으로만 존재했다.
- `dev` Preview에는 `DETAIL_TOKEN_SECRET`가 없어 검색 API가 실패했다.
- Kakao Maps JavaScript key는 env가 아니라 `src/data/landing.js`의 공개 브라우저 키로 관리된다.
- `vercel.json` CSP에는 Kakao Maps 주요 로딩 경로가 포함되어 있다.
  - `https://developers.kakao.com`
  - `https://dapi.kakao.com`
  - `https://t1.daumcdn.net`
  - `https://*.daumcdn.net`
  - `https://*.kakaocdn.net`
- 따라서 Preview Kakao Maps 실패는 우선 Kakao Developers JavaScript 도메인 등록 여부를 확인해야 한다.

## 변경 내용

### Vercel env

- `DETAIL_TOKEN_SECRET`를 Preview `dev` 브랜치에 추가했다.
- 값은 Production의 기존 값을 복제했고, 로그/문서에 secret 값은 남기지 않았다.

### Runtime env gate

- `scripts/check-runtime-env.mjs` 추가
- Vercel build 또는 `CHECK_RUNTIME_ENV_STRICT=true`에서 `DETAIL_TOKEN_SECRET` 누락 시 실패한다.
- 일반 로컬 build에서는 skip하여 개발 편의성을 유지한다.

### External integration gate

- `scripts/check-external-integrations.mjs` 추가
- Kakao JavaScript key 존재 여부와 Kakao Maps CSP 허용 origin을 검사한다.
- Kakao Developers 도메인 등록은 외부 콘솔 설정이라 자동 검증 대상이 아니다.

### Build gate

- `package.json` build 순서에 아래 체크를 추가했다.
  1. `scripts/check-frontend-env.mjs`
  2. `scripts/check-runtime-env.mjs`
  3. `scripts/check-external-integrations.mjs`
  4. `vite build`

### Delivery region UX/logging

- 임시 Preview 진단 로그는 제거했다.
- `delivery_regions` 실패/빈 결과만 `appLogger`로 남긴다.
- 딜리버리 지역 모달에 loading/error/empty 상태를 추가했다.
- API가 빈 `deliveryCostList`를 반환하면 mock 지역으로 덮지 않고 빈 상태 UI가 보이도록 수정했다.

## 검증

- `node scripts/check-frontend-env.mjs`
- `CHECK_RUNTIME_ENV_STRICT=true node scripts/check-runtime-env.mjs`
- `node scripts/check-external-integrations.mjs`
- `npm run build`
- `git diff --check`
- Preview 배포 완료

최신 Preview:

- `https://rentcar00-booking-system-7j0ebxzyi-otang00s-projects.vercel.app`

Preview 고정 alias:

- `https://rentcar00-booking-system-git-dev-otang00s-projects.vercel.app`
- 새 Preview가 매번 바뀌어도 Kakao Developers에는 이 alias를 유지 등록해 검증 주소로 사용한다.

## 남은 확인

- Kakao Developers 콘솔에 아래 도메인 추가 완료 보고됨.
  - `rentcar00-booking-system-7j0ebxzyi-otang00s-projects.vercel.app`
  - `rentcar00-booking-system-git-dev-otang00s-projects.vercel.app`
- `dapi.kakao.com/v2/maps/sdk.js`는 현재 Preview Referer 기준 `200 OK` 확인됨.
- Vercel SSO 보호로 assistant 쪽 전체 화면 렌더링 확인은 제한됨. 실제 브라우저 지도 노출은 사용자 화면 확인 필요.
- 운영 배포는 아직 하지 않았다.
- 커밋/푸시는 아직 하지 않았다.

