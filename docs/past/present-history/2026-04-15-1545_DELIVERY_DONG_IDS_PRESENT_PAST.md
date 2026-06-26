# DELIVERY / DONG IDS PRESENT

## 현재 상태
- delivery 검색은 DB-only 운영 기준으로 유지한다.
- 다만 `dongId` 와 실제 delivery 정책/요금 규칙은 아직 미완성일 수 있다.

## 현재 판단
- `dongId` 는 검색 입력 계약상 유지한다.
- 하지만 운영상 정확한 지역 정책은 별도 DB 설정으로 보강해야 한다.

## 다음 작업
1. 실제 운영에 필요한 dong mapping 기준 확정
2. delivery 가능 지역/비용 테이블 정의
3. 검색 결과와 가격 계산에 반영

## 주의
- delivery 품질 문제는 코드 버그로 단정하지 않는다.
- 먼저 정책 데이터 부족 여부를 확인한다.
