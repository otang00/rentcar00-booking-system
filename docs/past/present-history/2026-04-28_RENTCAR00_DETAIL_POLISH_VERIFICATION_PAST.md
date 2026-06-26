# 2026-04-28 RENTCAR00 상세 마감 검증 기록 PAST

## 상태
- 상태: verified past
- 검증 시점: 2026-04-28
- 기준 브랜치: `feat/db-preview-home`
- 최종 기준 커밋: `501708e`
- 운영 alias: `https://rentcar00.com`

---

## 이번 반영 범위
1. 딜리버리 주소 선택 모달 스크롤/정렬 보정
2. 로그인 회원 운전자 정보 잠금 상태 시각화 강화
3. 운전자 정보 수정 확인 모달 가독성 개선
4. footer 문의 정보 구조화
5. 인증문자 문구에서 `3분 내 입력` 표현 제거

---

## 검증 결과

### 1. 코드 상태
- 기준 커밋 확인: `501708e`
- 검증 시 worktree 추가 변경 없음 확인

### 2. 빌드 검증
- 명령: `npm run build`
- 결과: 통과

### 3. 운영 응답 검증
- 주소: `https://rentcar00.com`
- 결과: HTTP 200 확인
- HTML title 확인: `빵빵카(주)`
- meta description 확인: `렌터카 예약 서비스`

### 4. 문구 검증
- OTP SMS 문구에서 `3분 내에 입력해 주세요` 제거 반영
- 인증 TTL 로직은 유지

---

## 문서 정리 결과
- 실행 준비 문서:
  - `docs/past/present-history/2026-04-28_RENTCAR00_DETAIL_POLISH_EXECUTION_READY_CURRENT_PAST.md`
- 검증 기록 문서:
  - `docs/past/present-history/2026-04-28_RENTCAR00_DETAIL_POLISH_VERIFICATION_PAST.md`
- active present:
  - 없음

---

## 잔여 메모
- footer는 현재 법인 정보와 문의 정보가 같이 보이도록 정리됨
- 전화번호 기준은 여전히 이원화 상태에 주의 필요
  - 회사 기본 정보: `02-592-0079`
  - 문의 안내/landing 기준: `010-2416-7114`
- 다음 단계에서 연락처 source-of-truth를 정책 문서에서 별도로 잠그는 것이 안전함
