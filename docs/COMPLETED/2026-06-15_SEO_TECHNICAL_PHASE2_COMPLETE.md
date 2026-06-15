# 2026-06-15 SEO Technical Phase 2 Complete

## 완료 범위
- 검색 노출 대상인 메인/약관 페이지의 클라이언트 SEO 메타 관리 기준을 추가했다.
- 중복 랜딩 경로 `/landing-shell`은 `/`로 redirect 하도록 정리했다.
- placeholder 성격의 `/faq`는 robots 차단 대상에 추가했다.
- sitemap URL에 `lastmod`를 추가했다.

## 변경 파일
- `src/components/SeoHead.jsx`
- `src/pages/LandingShellPage.jsx`
- `src/pages/LegalPage.jsx`
- `src/App.jsx`
- `public/robots.txt`
- `public/sitemap.xml`

## 유지한 기준
- `/`, `/terms`, `/privacy`, `/special-terms`만 sitemap 색인 대상으로 유지한다.
- `/search`, `/cars`, 예약/회원/관리자 페이지는 검색 유입 대상으로 열지 않는다.
- `detailToken` 전제인 차량 상세는 검색 직접 유입 대상으로 만들지 않는다.
- `vercel.json`, 배포 설정, DB, 외부 검색엔진 등록은 이번 phase에서 변경하지 않았다.

## 검증
- `npm run build` 통과.
- `dist/robots.txt`에 `/faq` 차단 반영 확인.
- `dist/sitemap.xml`에 `/`, `/terms`, `/privacy`, `/special-terms`와 `lastmod` 반영 확인.

## 남은 리스크
- React SPA 구조상 초기 서버 HTML은 여전히 `index.html` 기준이다.
- Google은 JS 렌더링 메타를 해석할 가능성이 있지만, 네이버 수집 품질을 높이려면 SSR/SSG 또는 정적 SEO 랜딩 페이지가 후속 후보가 된다.

## 다음 후보
- Phase 3: 메인 온페이지 콘텐츠 강화 및 FAQ/지역/서비스 설명 블록 확장.
