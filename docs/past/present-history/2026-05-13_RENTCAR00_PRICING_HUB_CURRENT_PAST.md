# 2026-05-13 RENTCAR00 PRICING_HUB CURRENT PAST

이 문서는 과거 `docs/present/2026-05-13_RENTCAR00_PRICING_HUB_CURRENT.md` 내용을 보존하기 위한 past 이력 문서다.
장기 허브 기준은 `docs/policies/RENTCAR00_PRICING_HUB.md` 로 분리했고,
현재 자사플랫폼 가격 계산식 기준은 `docs/present/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT.md` 로 분리했다.

---

# 2026-05-13 RENTCAR00 PRICING CURRENT

## 문서 상태
- 상태: active current
- 목적: 이번 가격 작업의 실제 구현 범위를 legacy 경로 기준으로 잠근다.

## 이번 current 의 범위
이번 단계는 프라이싱 허브를 멀티채널 구조로 재정의하는 단계가 아니다.
지금은 아래 4개를 먼저 맞춘다.

1. legacy 가격 테이블 기준 유지
2. `7일 / 14일 / 30일` 가격값 정리
3. 메인 플랫폼 계산식 반영
4. `7일 미만` 일수/시간/주중주말 공식 잠금

연결 문서:
- `docs/present/2026-05-13_RENTCAR00_PRICING_FORMULA_CURRENT.md`

## 기준 경로
### DB / view
- `price_policies`
- `price_policy_groups`
- `v_active_group_price_policies`

### 코드
- `server/search-db/repositories/fetchGroupPricePolicies.js`
- `server/search-db/pricing/calculateGroupPrice.js`
- 필요 시 관리자 가격 편집 경로
  - `api/admin/pricing-hub.js`
  - `src/pages/AdminPricingHubPage.jsx`

## 기간값 해석 기준
이번 작업에서 기간값은 아래처럼 본다.
- `7일 금액`
- `14일 금액`
- `30일 금액`

기존 문서 기준 대응:
- `week_1_price` = 7일 금액
- `week_2_price` = 14일 금액
- `month_1_price` = 30일 금액

## 현재 잠금 판단
1. 메인 플랫폼 실검색 가격은 아직 legacy 경로가 기준이다.
2. 따라서 이번 작업에서 중요한 것은 새 허브 구조가 아니라 **실제 검색가격이 어떤 값으로 계산되느냐**다.
3. `7일 / 14일 / 30일` 값은 운영상 직접 의미가 있는 기간값으로 본다.
4. 이번 단계에서는 신규 채널 파생/배포 구조를 열지 않는다.
5. 이번 단계에서는 **기존 가격 경로가 7/14/30 값을 읽고 계산하도록 만드는 것**이 완료 조건이다.

## 수식 기준 후보
### 1. 7일 / 14일 / 30일 값
현재 기준 대응은 아래로 본다.
- `7일 금액 = week_1_price`
- `14일 금액 = week_2_price`
- `30일 금액 = month_1_price`

### 2. 실제 수식 원본 기준
이번 기준은 문서 추정이 아니라 JJIMCAR 입력용 산출물이다.
실제 참고 기준은 아래다.
- `tmp/zzimcar-fee-section-2111-target-template.csv`
- 보조 확인: `tmp/zzimcar-fee-section-2111-input-ready.csv`

배수 리스트는 아래 3종으로 잠근다.
- 기준형: `1h 0.12 / 7d 5.5 / 14d 8.0 / 30d 12.0`
- 준프리미엄: `1h 0.13 / 7d 5.8 / 14d 8.5 / 30d 12.8`
- 프리미엄: `1h 0.14 / 7d 6.0 / 14d 9.0 / 30d 13.5`

반올림 규칙은 아래로 잠근다.
- `1h: 1000`
- `7/14/30d: 10000`

`target-template` 집계 기준으로는 아래 분포가 확인됐다.
- 기준형: 14개 모델
- 준프리미엄: 7개 모델
- 프리미엄: 5개 모델
- 예외 0값 행: 1개 모델 (`22년 펠리세이드`)

### 3. 현재 legacy 구조 판단
현재 legacy 구조는 아직 `7d+` 한 칸만 직접 보유한다.
- `price_policies.weekday_7d_plus_price`
- `price_policies.weekend_7d_plus_price`
- `v_active_group_price_policies` 도 같은 구조를 노출한다.

즉 `14일 / 30일` 전용 저장 칸은 legacy 경로에 아직 없다.

### 4. 이번 단계 해석
- 7일 / 14일 / 30일 값은 단순 fallback 비율로 방치하지 않는다.
- 메인 플랫폼 가격 계산이 실제 운영 기대값에 맞게 이 기간값을 읽도록 조정한다.
- 찜카 가격 수정 때 만든 `target-template` 배수 리스트를 구현 기준으로 삼는다.
- legacy 경로에는 14일/30일 저장 구간을 추가 준비해야 한다.

## 구현 우선순위
### Phase 1. legacy 가격값 기준 잠금
목적
- 어느 값이 7일 / 14일 / 30일인지 문서상 모호함 제거

종료 조건
- 운영자가 보는 기간값과 코드 필드 대응이 명확하다.

### Phase 2. 계산식 반영
목적
- 메인 플랫폼 가격 계산식이 7/14/30 값을 실제 반영하도록 수정

종료 조건
- 검색 결과 가격이 새 기준으로 계산된다.

### Phase 3. 운영 확인
목적
- 관리자 편집/preview 와 메인 검색 결과 해석이 어긋나지 않게 정리

종료 조건
- 운영 확인 포인트가 문서상 정리된다.

## 이번 current 에서 하지 않는 것
1. 멀티채널 허브 전체 재설계
2. IMS / 찜카 / 홈페이지 publish 구조 확장
3. 신규 대형 가격 테이블 체계 추가

## 리스크
1. 현재 `api/admin/pricing-hub.js` fallback 은 `6.5 / 12.5 / 24` 계열이라 JJIMCAR 배수 리스트와 어긋난다.
2. legacy 구조에 14일/30일 저장 칸이 없어서 계산식만 먼저 바꾸면 값 출처가 불안정해진다.
3. 관리자 편집값과 메인 검색 계산식이 다른 기준을 쓰면 다시 혼선이 생긴다.

## 한 줄 결론
지금 가격 작업의 핵심은 **legacy 가격 경로를 유지한 채 7일 / 14일 / 30일 값을 제대로 채우고, 메인 플랫폼 계산식이 그 값을 실제 반영하도록 맞추는 것**이다.
