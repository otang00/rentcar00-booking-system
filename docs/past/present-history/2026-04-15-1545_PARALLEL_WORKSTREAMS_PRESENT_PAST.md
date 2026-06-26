# PARALLEL WORKSTREAMS

## 목적
DB-only 검색 안정화를 병렬 가능한 단위로 나눈다.

## Stream 1. 관측 기준
- 검색 샘플 케이스 고정
- 오류 분류 기준 고정
- 검증 표 유지

## Stream 2. 이슈 큐
- 현재 오류 수집
- 재현 쿼리 정리
- 코드 버그 / 데이터 부족 분류

## Stream 3. 검색 로직 보정
- `fetchCandidateCars`
- `fetchBlockingReservations`
- `filterAvailableCars`
- `mapDbCarsToDto`

## Stream 4. DB 확장
- 가격표
- delivery/dong 설정
- 노출/운영 설정

## Stream 5. 상세 전환 준비
- 검색-상세 불일치 점검
- 상세 DB 전환 선행조건 정리

## 원칙
- 검색 endpoint shared file 은 한 번에 한 흐름만 수정
- DB schema 변경과 검색 로직 변경은 같은 이유로 묶어서 처리
- partner 검색 복구 작업은 병렬 stream 으로 두지 않음
