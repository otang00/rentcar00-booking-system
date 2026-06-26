# ROADMAP

## 목적
검색을 DB-only 상태로 유지한 채, 남은 문제를 우선순위대로 fix-forward 한다.

## 현재 단계
- 기준 잠금 완료
- 검색 partner 제거 완료
- 서버 정렬 보정 완료
- 이제 **남은 핵심 우선순위 처리 단계**로 들어간다.

## 실행 순서
### Phase 1. Delivery 조건 반영
#### 목적
pickup 과 delivery 결과를 실제로 분리한다.

#### 범위
- `dongId`
- delivery 가능 여부
- delivery 조건 필터

#### 종료 조건
- delivery 검색 결과가 pickup 과 구분된다.
- 재현 쿼리 기준으로 차이가 설명 가능하다.

### Phase 2. Delivery 가격 반영
#### 목적
배송 검색 시 `deliveryPrice` 와 최종 가격이 실제 규칙을 따른다.

#### 범위
- delivery 비용 데이터
- 검색 응답 deliveryPrice
- 프론트 표시 가격

#### 종료 조건
- delivery 케이스에서 배송비가 0 고정이 아니다.

### Phase 3. 그룹 기준 가격 체계 구축
#### 목적
IMS 그룹 기준 가격표를 DB source of truth 로 구축한다.

#### 범위
- `car_groups`
- `price_policies`
- `price_policy_groups`
- 그룹 기준 계산 공식
- import / validation 기준

#### 종료 조건
- 가격 스키마, 공식, 로드맵이 `docs/present/PRICE_SYSTEM_PRESENT.md` 기준으로 잠긴다.
- 이후 구현 phase 에서 동일 문서를 기준으로 적재/계산/검증을 진행한다.

### Phase 4. 21세 결과 검증
#### 목적
21세 0건이 정상인지 확인한다.

#### 범위
- `rent_age`
- 필터 조건
- seed/실데이터 상태

#### 종료 조건
- 0건의 이유가 정상/비정상 중 하나로 확정된다.

### Phase 5. 검색-상세 불일치 점검
#### 목적
검색 안정화 이후 상세 진입 리스크를 정리한다.

#### 종료 조건
- 검색 결과 차량의 상세 진입 리스크 목록이 정리된다.

## 비목표
- 지금은 상세/예약 partner 제거를 같이 하지 않는다.
- 검색 문제를 해결한다고 partner 검색 경로를 복구하지 않는다.
