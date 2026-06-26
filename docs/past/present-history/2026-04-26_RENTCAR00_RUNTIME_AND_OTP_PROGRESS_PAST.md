# 2026-04-26 RENTCAR00 runtime + OTP progress past

## 문서 상태
- 상태: archived past
- 용도: 2026-04-26 기준 완료된 운영/문서 항목 기록

---

## 완료된 항목

### 1. IMS sync 운영 복구
- launchd 경로를 현재 프로젝트 기준으로 복구했다.
- 수동 IMS sync 1회 실행 검증을 마쳤다.
- `reservation_sync_runs`, `ims_sync_reservations` 적재가 다시 동작함을 확인했다.
- 검색에서 IMS 예약 차량이 실제로 제외되는 것도 확인했다.

### 2. 관리자 예약목록 상단 IMS sync 상태 표시
- `api/admin/bookings.js` 에 최신 `reservation_sync_runs(sync_type='ims_reservations')` 조회를 추가했다.
- 관리자 예약목록 상단에 최근 업데이트 시각 + 성공/실패 상태 1줄을 표시하도록 반영했다.
- 운영 배포 완료.

### 3. 메인 검색 후 결과 리스트 상단 자동 스크롤
- 검색 버튼 클릭 시 `#search-results` 로 스크롤되도록 반영했다.
- 운영 배포 완료.

### 4. 회원가입용 OTP 기본 런타임 구현
- `api/auth/otp/send`
- `api/auth/otp/verify`
- `server/auth/phoneOtp.js`
- `server/sms/sendSolapiMessage.js`
- `phone_verifications` 저장 구조
- cooldown / 만료 / 시도횟수 제한 / verification token 발급

즉, signup OTP는 "설계 전 단계"가 아니라 "기본 서버 구현 완료 + 운영 env 미설정" 상태로 올라왔다.

---

## 이 시점 이후 current 문서 기준
- current 문서에서는 위 완료 항목을 다시 TODO 로 두지 않는다.
- 남은 핵심은 아래다.
  1. Solapi 운영 ENV 설정
  2. signup submit 과 OTP verified 최종 연결
  3. profiles 추가 필드 저장 마무리
  4. kakao / guest OTP 확장 여부 정리
