# 2026-05-16 RENTCAR00 CURRENT

## 문서 상태
- 상태: active current
- 목적: KCP 운영 결제 검증의 현재 blocker와 다음 세션 인수인계 기준을 잠근다.
- 범위: NHN KCP 운영 결제창 진입/복귀, DB 오염 여부, 다음 조치.

## 현재 결론
현재 결제 실패는 홈페이지 서버 로직이나 DB 저장 단계 문제가 아니라, **KCP 상점 ALRFN의 승인 가능 상태값 문제로 보는 것이 맞다.**

KCP 결제창에서 아래 오류가 발생했다.

```text
상점 승인가능 상태값 확인후 결제 바랍니다.
KCP 전화 1544-8660
```

## 확인된 런타임 흐름
Vercel production 로그 기준 결제 시도 흐름은 아래와 같았다.

```text
23:26:25 POST /api/payments/prepare
23:27:10 POST /api/payments/return
```

해석:

```text
1. 홈페이지 서버의 결제 준비 API는 호출됨
2. KCP 결제창 단계로 넘어감
3. KCP가 실패 res_cd/res_msg로 /api/payments/return 호출
4. 서버는 실패 메시지를 /reservation-complete?paymentError=... 로 전달
5. KCP approve API는 호출되지 않음
6. booking_orders 생성 단계까지 가지 않음
```

중요:

```text
KCP_CERT_INFO는 approve API 호출 때 사용된다.
이번 실패는 approve API 이전의 KCP 결제창/상점 상태 단계에서 발생했다.
따라서 현재 오류만 놓고 보면 신규 인증서가 쓰이기도 전에 막힌 상태다.
```

## DB 오염 확인
문제 발생 직후 production DB를 read-only로 확인한 결과, 23:20 이후 아래 생성/소비는 없었다.

```text
booking_orders 생성: 0
booking_lookup_keys 생성: 0
reservation_status_events 생성: 0
phone_verifications consumed: 0
```

결론:

```text
예약 원장 오염 없음
lookup key 오염 없음
status event 오염 없음
OTP consumed 오염 없음
rollback 불필요
```

## 현재 반영/조치 상태
민감값 자체는 문서에 남기지 않는다.

확인된 조치:

```text
KCP_SITE_KEY 운영값 교체 완료
KCP_CERT_INFO 신규 인증서 계열로 교체 완료
KCP_MODE production 기준
production 재배포 완료
DB rollback 불필요
```

주의:

```text
.env, Vercel env, KCP 인증서/키 값은 protected target이다.
새 세션은 값 자체를 문서/로그/채팅에 노출하지 말 것.
```

## KCP에 문의할 내용
KCP에 아래 내용으로 문의한다.

```text
상점코드 ALRFN 운영 결제 테스트 중입니다.

오류 메시지:
“상점 승인가능 상태값 확인후 결제 바랍니다.
KCP 전화 1544-8660”

확인 요청:
1. ALRFN 상점이 카드 승인 가능 상태인지
2. 카드사 심사/오픈이 완료됐는지
3. 운영 결제 승인 가능한 상태인지
4. ALRFN 운영 상점의 승인가능 상태값을 KCP 쪽에서 열어야 하는지
5. 현재 서비스 인증서/상점키 조합이 ALRFN 운영용으로 정상 연결되어 있는지
6. production endpoint로 호출 가능한 상태인지
7. 해당 오류의 정확한 res_cd와 KCP 내부 원인
```

## 다음 세션 작업 순서

### Step 1. KCP 답변 수신
KCP가 상점 상태를 열어주거나, 별도 값/절차를 안내하는지 확인한다.

### Step 2. 필요 시 환경값 점검
KCP가 값 불일치를 말할 때만 아래를 별도 승인 받고 점검한다.

```text
KCP_SITE_CD
KCP_SITE_KEY
KCP_CERT_INFO
KCP_MODE
KCP_PAYMENT_SESSION_SECRET
Vercel production env
```

### Step 3. 재검증
상점 상태 변경 후 production에서 소액 결제를 다시 시도한다.

검증 기준:

```text
/api/payments/prepare 성공
KCP 결제창 결제 가능
/api/payments/return으로 enc_data/enc_info 복귀
approve API res_cd=0000
booking_orders 1건 생성
reservation-complete 정상 표시
중복 승인/중복 예약 방어 유지
```

### Step 4. 실패 시 분기
다시 실패하면 아래 순서로 본다.

```text
1. KCP res_cd/res_msg
2. /api/payments/return payload shape
3. approve API 호출 여부
4. KCP_CERT_INFO 사용 단계 도달 여부
5. booking_orders 생성 여부
```

## 관련 코드

```text
api/payments/[action].js
server/payments/kcpClient.js
server/payments/kcpConfig.js
src/components/CarDetailSection.jsx
src/services/guestBookingApi.js
src/pages/ReservationCompletePage.jsx
```

## 관련 과거 문서

```text
docs/past/present-history/2026-05-11_RENTCAR00_KCP_PHASE1_CURRENT_PAST.md
docs/past/present-history/2026-05-12_RENTCAR00_KCP_PC_MOBILE_SPLIT_CURRENT_PAST.md
```

## 한 줄 결론
현재 active 기준은 **홈페이지 결제 구현이 아니라 KCP ALRFN 상점의 운영 카드 승인 가능 상태 확인**이다.

---

## 2026-05-18 추가 작업: 고객 SMS / 운영자 이메일 / KCP 표시명

### 목적
- KCP 결제창 표시명을 `빵빵카(주)` 기준으로 맞춘다.
- 운영자 전용 예약 이메일에는 전화번호와 생년월일을 전체 표시한다.
- 결제 성공 후 고객에게 Solapi 예약확정 SMS를 발송한다.
- 카카오 알림톡은 채널/pfId/템플릿 승인 후 다음 phase로 분리한다.

### 구현 기준
- Mobile KCP payload: `shop_name = 빵빵카(주)`
- PC KCP payload: `site_name`, `kcp_pay_title = 빵빵카(주)`
- 운영자 이메일은 `BOOKING_EMAIL_TO` 전용으로 보고 고객 전화번호/생년월일 전체를 표시한다.
- 고객 SMS는 결제 승인 및 예약 생성 성공 후 발송한다.
- SMS 실패는 예약/결제 성공을 롤백하지 않고 `reservation_status_events`에 기록한다.
- 회원 예약은 `https://rentcar00.com/reservations`, 비회원 예약은 `https://rentcar00.com/guest-bookings` 링크를 보낸다.
- 문의번호 기본값은 `02-592-0079`이며 필요 시 `BOOKING_CUSTOMER_SMS_CONTACT` env로 덮어쓸 수 있다.

### 고객 SMS 문구
```text
[빵빵카(주)] 예약이 확정되었습니다.
예약번호: {예약번호}
차량: {차량명}
대여: {대여일시}
반납: {반납일시}
금액: {금액}

예약 조회:
{회원/비회원별 링크}

문의: 02-592-0079
```

### 남은 리스크
- 카드 승인 문자에 표시되는 `렌터카_2`가 계속 나오면 코드 파라미터가 아니라 KCP/카드사 가맹점 등록명 수정이 필요하다.
- 카카오 알림톡은 `SOLAPI_KAKAO_PF_ID`, `SOLAPI_KAKAO_BOOKING_TEMPLATE_ID`, 승인 템플릿 확정 후 별도 phase로 구현한다.

---

## 2026-05-19 Landing V2 삭제

사용자 판단에 따라 `/landing-v2` 실험 페이지는 운영 후보에서 제외하고 코드/라우트/전용 CSS/전용 hero 이미지를 제거한다. 기존 운영 메인 `/` 구조는 유지한다.
