# 2026-06-15 SEO Monitoring Phase 5 Complete

## 완료 범위
검색 노출 강화 후 사후 점검 루틴을 정리했다. 이번 phase에서는 cron 등록, 외부 검색엔진 제출, 계정 로그인, 배포를 하지 않았다.

## 점검 주기
- 배포 직후: `robots.txt`, `sitemap.xml`, 메인 페이지 응답 확인
- 제출 후 1주: `site:rentcar00.com` 검색 노출 확인
- 제출 후 2주: Google Search Console / 네이버 서치어드바이저 수집 상태 확인
- 이후: SEO 관련 변경이 있을 때마다 sitemap, canonical, robots 기준 재확인

## 기본 점검 명령
```bash
curl -I https://rentcar00.com/
curl -I https://rentcar00.com/robots.txt
curl https://rentcar00.com/robots.txt
curl -I https://rentcar00.com/sitemap.xml
curl https://rentcar00.com/sitemap.xml
```

## 봇 접근 점검
```bash
curl -A "Googlebot" -I https://rentcar00.com/
curl -A "Yeti" -I https://rentcar00.com/
curl -A "bingbot" -I https://rentcar00.com/
```

## 검색 노출 점검 쿼리
- `site:rentcar00.com`
- `site:rentcar00.com 빵빵카`
- `site:rentcar00.com 서울 렌터카`
- `site:rentcar00.com 수도권 렌터카`
- `site:rentcar00.com 단기렌트`
- `site:rentcar00.com 월렌트`

## 판정 기준
### 정상
- `/`가 검색 결과에 대표 페이지로 노출된다.
- title/description이 메인 SEO 문구와 크게 어긋나지 않는다.
- sitemap 수집 상태가 성공 또는 정상 수집 대기 상태다.
- robots가 `/`, `/sitemap.xml` 접근을 막지 않는다.

### 확인 필요
- `rentcar00.cafe24.com`이 `rentcar00.com`보다 상위에 계속 노출된다.
- `/search`, `/cars`, 예약/회원/관리자 URL이 검색 결과에 노출된다.
- 네이버가 메인 페이지를 수집하지 못한다.
- sitemap 제출 후 1~2주가 지나도 대표 URL이 전혀 잡히지 않는다.

## 현재 응답 확인
- `https://rentcar00.com/` 200 확인.
- `https://rentcar00.com/robots.txt` 200 확인.
- `https://rentcar00.com/sitemap.xml` 200 확인.
- Googlebot / Yeti / bingbot 메인 접근 200 확인.
- 주의: 이번 phase는 배포가 아니므로 운영 응답은 아직 이전 배포 기준일 수 있다.

## 후속 후보
1. Google Search Console / 네이버 서치어드바이저 실제 등록 및 sitemap 제출.
2. Cafe24 기존 도메인 canonical/redirect 정리.
3. 네이버 수집 품질 강화를 위한 정적 SEO 랜딩 또는 SSG/SSR 검토.
4. 실제 검색 유입 키워드 기준으로 메인 문구와 FAQ 보강.

## 현재 유지 기준
- sitemap 색인 대상은 `/`, `/terms`, `/privacy`, `/special-terms`만 유지한다.
- 검색·차량·예약·회원·관리자 페이지는 검색 유입 대상에서 제외한다.
- 외부 등록/제출/도메인 정리는 별도 승인 후 진행한다.
