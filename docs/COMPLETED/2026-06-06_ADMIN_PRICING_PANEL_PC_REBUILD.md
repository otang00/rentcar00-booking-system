# Admin Pricing Panel PC Rebuild

## 완료 범위

- `/admin/pricing-hub` 관리자 가격조정 페이지 UI를 PC 기준 3단 패널로 교체했다.
- 넓은 PC 화면에서 중앙 모니터링 영역이 더 크게 잡히도록 전체 shell 폭과 column 비율을 조정했다.
- 중앙 모니터링 표에는 가로 스크롤을 추가해 좁은 화면에서도 7/14/30일 계산열이 잘리지 않게 했다.
- 기존 복합 UI의 차량 상세, 연결 정책 선택, 별도 정책 선택 패널은 화면에서 제거했다.
- 가격 수정 입력 항목은 아래 4개로 제한했다.
  - 기준 24시간 금액
  - 주중 비율
  - 주말 비율
  - 정책 등급
- 7일, 14일, 30일, 1시간, 주중24, 주말24 금액은 직접 입력하지 않고 자동 계산 미리보기로 표시한다.
- 카모아/외부 플랫폼 전송 기능은 포함하지 않았다.

## 변경 파일

- `src/pages/AdminPricingHubPage.jsx`

## 유지한 기준

- 라우트 `/admin/pricing-hub` 는 유지한다.
- 관리자 메뉴 `통합요금관리` 연결은 유지한다.
- API endpoint `/api/admin/pricing-hub` 는 변경하지 않았다.
- 저장은 기존 `savePricingHubEditor` 흐름을 사용한다.
- 저장 payload 는 `pricePolicyId`, `base24h`, `weekdayPercent`, `weekendPercent`, `pricingOptionType` 기준이다.

## 검증

```bash
npm run build
node --test server/search-db/pricing/__tests__/*.test.js
```

결과: 통과.

## 남은 리스크 / 후속 결정

- 기존 화면의 `연결 정책 선택` 기능은 이번 가격조정 UI에서 제거됐다.
- 향후 차량그룹과 정책 연결을 운영 화면에서 다시 써야 하면 별도 관리 화면으로 분리하는 것이 안전하다.
- 현재 홈페이지 실계산은 `week_1_price`, `week_2_price`, `month_1_price` 를 anchor truth 값으로 사용한다.
- 다만 현재 어드민 저장 UI는 7/14/30일 값을 별도 입력하지 않고 기준24와 등급 배수로 산출해 저장한다.
- 14일/30일을 별도 지정해야 한다면 별도 정책 phase가 필요하다.
- 이번 변경은 배포 전 프리뷰 확인이 필요하다.
