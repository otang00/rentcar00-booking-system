# SEARCH STABILIZATION PLAN

## 목적
DB-only 검색 상태에서 발생하는 문제를 fix-forward 로 수습한다.

## Step 1. 관측 기준 잠금
- 검증 시나리오 확정
- 오류 등급 기준 확정

## Step 2. 이슈 큐 작성
- 실제 검색 결과 기준으로 문제 목록 수집
- 재현 쿼리 확보

## Step 3. DB 추가 판단
- 코드로 해결 안 되는 항목 식별
- 가격표/설정값 추가 범위 확정

## Step 4. 보정 구현
- 노출
- blocking
- 가격
- delivery
- 정렬

## Step 5. 재검증
- 같은 시나리오 재실행
- critical 0건 확인

## 현재 단계
- 지금은 **Step 1, 관측 기준 잠금 직후** 상태로 본다.
