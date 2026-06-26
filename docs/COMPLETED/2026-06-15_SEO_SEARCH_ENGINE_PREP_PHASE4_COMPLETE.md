# 2026-06-15 SEO Search Engine Prep Phase 4 Complete

## 완료 범위
검색엔진 등록·제출을 위한 준비 기준을 정리했다. 이번 phase에서는 외부 서비스에 실제 등록, 제출, 인증, API 호출을 하지 않았다.

## 현재 제출 대상 URL
- `https://rentcar00.com/`
- `https://rentcar00.com/terms`
- `https://rentcar00.com/privacy`
- `https://rentcar00.com/special-terms`

## 제외 유지 URL
- `https://rentcar00.com/search`
- `https://rentcar00.com/cars`
- `https://rentcar00.com/cars/:carId`
- `https://rentcar00.com/login`
- `https://rentcar00.com/signup`
- `https://rentcar00.com/reservations`
- `https://rentcar00.com/guest-bookings`
- `https://rentcar00.com/reservation-complete`
- `https://rentcar00.com/admin/*`
- `https://rentcar00.com/faq`

## Google Search Console 준비
1. 속성은 가능하면 도메인 속성 `rentcar00.com`으로 등록한다.
2. URL prefix를 쓸 경우 canonical 기준인 `https://rentcar00.com`만 우선 등록한다.
3. sitemap 제출 URL: `https://rentcar00.com/sitemap.xml`
4. 우선 URL 검사 대상: `/`
5. 약관 URL 3개는 sitemap 제출로 충분하며, 수동 색인 요청 우선순위는 낮다.

## 네이버 서치어드바이저 준비
1. 사이트는 호스트 기준 `https://rentcar00.com`으로 추가한다.
2. 소유권 확인 방식은 HTML meta 또는 DNS 중 현재 운영 권한에 맞춰 선택한다.
3. sitemap 제출 URL: `https://rentcar00.com/sitemap.xml`
4. 웹페이지 수집 요청 우선순위: `/`
5. robots 수집 확인 시 Yeti가 `/`와 `/sitemap.xml`에 접근 가능한지 확인한다.

## IndexNow 준비
- 대상: 네이버/Bing/Yandex 등 IndexNow 참여 엔진 알림 보조.
- 비대상: Google 일반 웹페이지 색인.
- 필요한 결정:
  1. IndexNow key 생성 여부
  2. key 파일 배치 방식
  3. 제출 스크립트를 둘지, 수동 curl로 처리할지
- 이번 phase에서는 key 생성, 파일 배치, API 제출을 하지 않았다.

## Cafe24 기존 도메인 정리 메모
검색 결과에 `rentcar00.cafe24.com` 흔적이 함께 보인다. 정리는 별도 phase가 필요하다.

확인 후보:
- 기존 Cafe24 사이트 접근 가능 여부
- canonical이 `rentcar00.com`을 가리키는지
- 301 redirect 가능 여부
- 기존 도메인에 남은 상품/카테고리 URL 중 현재 사이트와 중복되는 페이지 여부

## 검증 기준
- `https://rentcar00.com/robots.txt` 200
- `https://rentcar00.com/sitemap.xml` 200
- Googlebot/Yeti/Bingbot `/` 접근 200
- sitemap URL과 canonical URL 불일치 없음

## 남은 리스크
- 외부 검색엔진 등록 여부는 계정 접근 권한이 있어야 확인 가능하다.
- Cafe24 도메인 정리는 기존 쇼핑몰/도메인 설정 영향이 있을 수 있어 별도 승인 필요.
