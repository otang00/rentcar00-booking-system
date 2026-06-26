# 2026-05-12 RENTCAR00 KCP PC/MOBILE SPLIT CURRENT

## 문서 상태
- 상태: active current
- 목적: NHN KCP 결제 진입을 PC 표준웹 / 모바일 결제창으로 분기하는 기준과 실행 로드맵을 잠근다.
- 선행 완료: KCP Phase 1(거래등록, 모바일 Hosted 진입, 승인 후 예약생성 기본 흐름)은 과거 문서로 이동했다.

## 현재 기준점
1. 현재 운영 결제는 모든 기기에서 모바일 Hosted 흐름 하나만 사용 중이다.
2. 그래서 PC에서도 모바일 결제 UX가 노출된다.
3. 결제 완료 후 서버 흐름은 이미 존재한다.
   - `/api/payments/prepare`
   - `/api/payments/return`
   - `/api/payments/approve`
   - 승인 후 `booking_orders` 생성
4. 최근 보정 완료 항목
   - 상품명 한글 인코딩 보정
   - alias 이메일(`@bbangbbangcar.local`) 비노출 처리
   - KCP 승인 후 완료 페이지 연결 확인

## 이번 변경 목표
1. PC 접속 시 KCP PC 표준웹 결제창을 연다.
2. 모바일/태블릿 접속 시 KCP 모바일 결제창을 연다.
3. 승인 후 서버 처리(`return -> approve -> booking create`)는 공통으로 유지한다.
4. 사용자에게는 기기별로 자연스러운 결제 UX를 제공한다.

## 분기 기준
- desktop browser: `pc_web`
- phone / tablet / in-app mobile browser: `mobile_web`
- 기본 원칙: 태블릿은 모바일 흐름에 포함한다.

## 잠긴 원칙
1. 결제 전 검증, 세션토큰 발급, 금액검증, 예약생성 규칙은 공통 유지한다.
2. 분기 대상은 결제창 진입 방식과 필수 파라미터 세트다.
3. 1차 범위의 결제수단은 계속 카드만 허용한다.
4. 모바일 Hosted에서 확인된 인코딩/이메일 보정은 PC 분기 후에도 유지한다.
5. KCP hosted UI 자체 커스터마이즈는 이번 범위에 포함하지 않는다.

## 실행 phase
### Phase 1. prepare 응답 분기
- 서버에서 공통 결제세션 생성 후 `paymentChannel=pc_web|mobile_web` 별 payload를 반환한다.
- mobile: `approval_key`, `PayUrl`, `Ret_URL`, `encoding_trans` 기반 유지
- pc: `req_tx`, `site_cd`, `site_name`, `pay_method`, `module_type`, `action` 기반 표준웹 payload 생성

종료 조건
- 프런트가 채널별 payload를 구분할 수 있다.

### Phase 2. 프런트 결제 진입 분기
- 상세 페이지에서 기기 판별
- mobile: 외부 form submit 유지
- pc: KCP PC 스크립트 로드 후 `KCP_Pay_Execute(form)` 호출
- PC callback에서 `enc_data`, `enc_info`, `res_cd`, `res_msg` 를 받아 `/api/payments/return` 으로 submit

종료 조건
- PC와 모바일에서 각기 다른 결제창이 열린다.

### Phase 3. 승인/복귀 정합성 검증
- PC callback payload로도 기존 `/api/payments/return` 이 동작하는지 확인
- 중복 승인/중복 예약생성 방어 유지 확인
- 실패 시 완료페이지 에러 라우팅 유지 확인

종료 조건
- 양쪽 채널 모두 같은 완료/실패 후속 흐름을 사용한다.

### Phase 4. 운영 검증
- PC: 결제창 진입, 승인 후 완료페이지, 예약생성
- 모바일: 동일 시나리오 재확인
- 차량명 한글, 이메일 기본값, 실패 문구 함께 점검

종료 조건
- 기기별 smoke test 통과 또는 blocker 명시

## 수정 대상 파일
- `api/payments/[action].js`
- `server/payments/kcpClient.js`
- `server/payments/kcpConfig.js` (필요 시 helper만)
- `src/components/CarDetailSection.jsx`
- `src/services/guestBookingApi.js`

## 리스크
1. PC 표준웹은 모바일과 필수 hidden field 구성이 달라 누락 시 결제창 호출 실패가 날 수 있다.
2. 브라우저/인앱 환경에 따라 기기 판별 오탐 가능성이 있다.
3. KCP PC 스크립트 로드 타이밍이 어긋나면 결제창 호출 실패가 날 수 있다.
4. `/api/payments/return` 는 POST만 허용하므로 PC callback submit이 정확히 맞아야 한다.

## 검증 기준
1. PC에서 모바일 결제창이 아니라 PC 표준웹이 열린다.
2. 모바일에서 기존 mobileGW 흐름이 유지된다.
3. 승인 성공 시 `confirmed + paid` 예약생성이 유지된다.
4. 완료 페이지와 실패 페이지가 기존처럼 동작한다.
5. 한글 상품명과 이메일 표시 문제가 재발하지 않는다.

## 한 줄 결론
이번 active current 범위는 KCP 결제 진입을 PC 표준웹과 모바일 결제창으로 분리하되, 승인 후 예약확정 서버 흐름은 공통으로 유지하는 작업이다.
