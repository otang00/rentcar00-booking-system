# RENTCAR00_LANDING_MAP_CURRENT

## 문서 상태
- 상태: completed → past
- 용도: 랜딩 연락처 영역 방문 주소 모달의 지도 렌더 방식을 정적 지도에서 인터랙티브 카카오맵으로 전환한 완료 기록
- 기준 브랜치: `feat/db-preview-home`
- 관련 current 문서:
  - `docs/present/RENTCAR00_RESERVATION_CURRENT.md`
  - `docs/present/RENTCAR00_ADMIN_FOLLOWUPS_CURRENT.md`

---

## 1. 완료 범위
1. `ContactInfoStrip.jsx`의 방문 주소 모달에서 `StaticMap` 렌더를 제거했다.
2. `kakao.maps.Map` + `Marker` 기반 인터랙티브 지도로 교체했다.
3. 모달 오픈 직후 지도 빈칸 가능성을 줄이기 위해 `relayout()` + center 재설정을 넣었다.
4. 지도 높이를 기기별로 분리했다.
   - 데스크톱: `460px`
   - 모바일: `44vh`, `min-height: 280px`, `max-height: 420px`
5. 프로덕션 배포까지 완료했다.

## 2. 변경 파일
- `src/components/ContactInfoStrip.jsx`
- `src/styles.css`

## 3. 검증 결과
1. 로컬 `npm run build` 통과
2. Vercel production 배포 성공
3. `rentcar00.com` alias 연결 확인
4. 실도메인 번들에서 아래 반영 확인
   - `landing-kakao-map`
   - `kakao.maps.Map(...)`
   - `Marker`
   - 반응형 높이 스타일

## 4. 이번 작업으로 닫힌 항목
1. 방문 주소 모달이 그림 1장처럼 보이는 문제
2. 모바일/데스크톱에서 동일 높이 강제에 따른 모달 답답함
3. 모달 렌더 직후 지도 레이아웃 깨짐 가능성의 1차 대응

## 5. 아직 남을 수 있는 후속 점검
1. 실사용 모바일 기기에서 체감 높이 미세조정
2. 주소/운영시간/문의 CTA 묶음의 UX 정리 여부
3. 예약 플로우 내부 주소검색 + 지도 workstream 과의 기준 연결 여부

## 6. 현재 판단
- 이번 작업은 완료로 닫아도 된다.
- 추가 작업이 있다면 새 current 를 열기보다, 필요 시 `RENTCAR00_RESERVATION_CURRENT.md` 하위 실행 항목으로 잡는 편이 낫다.
