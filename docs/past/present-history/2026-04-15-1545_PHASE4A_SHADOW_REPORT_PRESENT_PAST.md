# DB-ONLY SEARCH INCIDENT REPORT

## 목적
partner 제거 이후 검색 페이지에서 드러나는 문제를 수집하는 기준 문서다.

## 현재 해석 원칙
- shadow diff 는 참고 자료다.
- 이제 기준 source 는 partner 가 아니라 DB-only 운영 결과다.
- 따라서 이 문서는 "partner 와 얼마나 다른가" 보다 "운영상 무엇이 깨지는가" 를 우선 본다.

## 현재 주요 문제 유형
1. 가격표 부재 또는 부족
2. delivery/dong 설정 부족
3. 노출 규칙 부족
4. 검색-상세 source 불일치

## 기록 형식
- 현상
- 재현 쿼리
- 분류: code / data
- 영향도: critical / major / minor
- 조치 방향

## 비고
- partner 비교가 필요하면 과거 리포트는 `docs/past/present-history/` 에서 본다.
