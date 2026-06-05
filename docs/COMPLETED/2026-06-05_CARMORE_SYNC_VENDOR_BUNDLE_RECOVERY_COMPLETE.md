# 2026-06-05 카모어 싱크 vendors bundle 복구 완료

## 목적
카모어 휴무 동기화가 `/tmp/carmore_js/vendors.bundle.js` 임시 파일 누락으로 실패하던 문제를 복구하고 재발 가능성을 낮춘다.

## 원인
- 카모어 로그인 암호화에 필요한 `vendors.bundle.js`를 `/tmp` 경로에서만 읽고 있었다.
- `/tmp` 파일이 사라진 뒤 launchd 카모어 싱크가 10분마다 실패했다.
- 실패 메시지: `ENOENT: no such file or directory, open '/tmp/carmore_js/vendors.bundle.js'`

## 변경 내용
- `scripts/carmore-sync/lib/carmore-client.js`
  - 기본 vendors 경로를 안정 경로로 변경했다.
  - 안정 경로가 없으면 기존 `/tmp` 경로를 fallback으로 확인한다.
  - 둘 다 없을 때 확인한 경로를 포함해 명확한 오류를 낸다.
  - 카모어 번들 신/구 CRYPTR 할당 패턴을 모두 지원한다.
- 안정 보관 경로:
  - `/Users/otang_server/.openclaw/skills/manual/manuals/carmore-api/files/vendors.bundle.js`
- 호환용 임시 경로:
  - `/tmp/carmore_js/vendors.bundle.js`

## 검증
- `npm run test:carmore-sync`: 14 pass
- crypto 초기화 확인: stable vendors 경로에서 `encForServer()` 생성 성공
- dry-run:
  - 복구 전 계획: desired 45, actual 46, additions 5, deletions 6, changes 3, unchanged 37, errors 0
- save-run:
  - desired 45, actual 46, additions 5, deletions 6, changes 3, unchanged 37, errors 0
- save 후 dry-run:
  - desired 45, actual 45, additions 0, deletions 0, changes 0, unchanged 45, errors 0
- launchd kickstart:
  - `ai.otang.carmore-reconcile-sync` runs 921
  - last exit code 0

## 남은 리스크
- 카모어 프론트 번들 구조가 다시 바뀌면 CRYPTR 추출 패턴 보강이 필요할 수 있다.
- 안정 경로 파일은 secret 자체는 아니지만 로그인 암호화 구현이 포함된 외부 번들이므로 일반 공개 파일처럼 취급하지 않는다.

## 후속 후보
- vendors bundle 자동 갱신/검증 스크립트를 별도 phase로 만들 수 있다.
- 현재는 수동 확보 + 안정 경로 보관 기준으로 운영한다.
