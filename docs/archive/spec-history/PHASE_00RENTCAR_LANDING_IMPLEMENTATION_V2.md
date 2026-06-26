# PHASE. 00RENTCAR LANDING IMPLEMENTATION V2

## 목적
이 문서는 `PHASE_00RENTCAR_LANDING_REFRAME.md`의 방향을
**실구현 직전 수준으로 더 구체화한 구현 설계안**이다.

핵심 기준은 아래 3가지다.

1. `00rentcar.com`의 필요한 셸만 차용한다.
2. 정렬 기준으로 화면을 설계한다.
3. 쇼핑몰 구조는 배제하고 예약 진입이 메인 목적이 되게 한다.

---

## 최종 목표 화면 한 줄 정의
새 `/landing` 페이지는

> 상업 사이트처럼 신뢰감 있는 회사형 랜딩 위에,
> 우리가 만든 예약 시스템을 어색하지 않게 바로 연결한 구조

여야 한다.

---

## 차용 자산 전략

## 1. 사용 가능 자산
실제 확인된 자산 중 랜딩에서 재사용 가치가 높은 것은 아래다.

### A. 상단 로고
- `https://00rentcar.com/web/upload/category/logo/v2_b1017127a7ad64cc17fd4b6a082c443b_dj8Tv9dkmd_top.jpg`

### B. 푸터/보조 로고
- `https://00rentcar.com/web/upload/category/logo/v2_b1017127a7ad64cc17fd4b6a082c443b_Rc7VocaZby_bottom.jpg`

### C. 배너/히어로 후보 이미지
- `https://file.cafe24cos.com/banner-admin-live/upload/rentcar00/7217f1ea-19e4-43a6-eab4-88d35dafb734.png`
- `https://file.cafe24cos.com/banner-admin-live/upload/rentcar00/231fadb3-48f7-4a5f-a5b4-bdef938540b6.png`
- `https://file.cafe24cos.com/banner-admin-live/upload/rentcar00/6fa790ff-9602-4721-a6f8-d3402de8daf4.png`

### D. 차량 썸네일 후보
- `https://00rentcar.com/web/product/medium/202311/ea2167bc8b55a065dd6d6cc1b8424e32.jpg`
- `https://00rentcar.com/web/product/medium/202311/749966c4e1906081322e94efdc83168a.jpg`
- `https://00rentcar.com/web/product/medium/202312/af5afdc5956bdf1a003ea41bc5845332.jpg`
- `https://00rentcar.com/web/product/medium/202312/5451200abbe317f7a0cf4e196ee29c38.jpg`
- `https://00rentcar.com/web/product/medium/202312/ddd8c5ce9de8c331587df45006bf1e9f.jpg`
- `https://00rentcar.com/web/product/medium/202312/470f4b0aa32c1decca7a4ae79c807cc9.jpg`

---

## 2. 자산 사용 원칙

### 로고 사용 원칙
- 헤더에서는 상단 로고 버전 사용
- 흰 배경 기준으로 그대로 사용 가능
- 비율 강제 변형 금지
- 과도한 그림자/필터 금지

### 배너 이미지 사용 원칙
- Hero의 우측 또는 배경 비주얼로 사용 가능
- 텍스트 가독성을 위해 어두운 오버레이 허용
- 배너를 여러 장 회전시키더라도 1차는 정적 1장 우선

### 차량 썸네일 사용 원칙
- “대표 차량 운영 중”이라는 신뢰 증거용
- 가격/상품 버튼 없이 이미지+차명 정도만 노출
- 쇼핑몰 상품카드처럼 보이지 않게 정보량 제한

---

## 랜딩 전체 레이아웃 원칙

## 1. 정렬 우선 원칙
이번 페이지는 장식보다 **정렬과 간격**으로 설계한다.

### 기본 원칙
- 섹션은 하나의 중심축(container) 위에서 정렬
- 좌우 컬럼은 같은 상단선에서 시작
- 카드 높이를 억지로 맞추기보다 내부 흐름을 맞춘다
- gap / padding / align-items / grid-template 비율로 정리
- absolute positioning 최소화

### 금지 원칙
- 의미 없는 고정 높이 남발
- 텍스트 블록별 들쭉날쭉한 좌우 시작점
- 이미지마다 다른 비율/정렬축
- Hero와 예약블록이 서로 다른 사이트처럼 보이는 분리감

---

## 2. 컨테이너 전략
### 공통 중심 폭
- 랜딩 전체는 현재 사이트 container 규격을 기본 재사용 가능
- 단, Hero는 시각적으로 조금 더 넓어 보여도 됨

### 권장 구조
- `page-shell`
- `landing-page`
- `landing-section`
- `landing-container`

### 원칙
모든 섹션 텍스트/카드/입력 시작점이
가능하면 같은 x축에서 출발해야 한다.

---

## 페이지 구조 상세 설계

## SECTION 1. TopNoticeBar

### 역할
운영 정보를 가장 먼저 짧게 전달한다.

### 포함 정보
- 서울·수도권 배차/반차 가능
- 전화상담 번호
- 카카오톡 문의 채널
- 운영시간 축약

### 정보 우선순위
1. 배차 가능 지역/운영 가능 메시지
2. 전화번호
3. 카카오톡
4. 운영시간

### 정렬 기준
- 데스크탑: 좌측 운영 문구 / 우측 연락 수단
- 모바일: 세로 2줄 또는 좌측 정렬 1열
- 텍스트 baseline 정렬 유지

### UI 톤
- 얇은 스트립
- 브랜드 컬러 또는 어두운 중립색 배경 가능
- 폰트는 `s` 또는 `m`
- 링크 수는 최대 2개

### 예시 구조
```txt
[서울·수도권 전지역 배차/반차 가능]    [전화 010-xxxx-xxxx | 카카오톡 00RENTCAR]
```

---

## SECTION 2. BrandHeader

### 역할
브랜드 홈페이지의 신뢰감 있는 헤더

### 구성
#### 왼쪽
- 로고 이미지
- 필요 시 브랜드명 텍스트 생략 가능

#### 오른쪽
- 예약내역
- FAQ
- 문의하기 또는 전화번호

### 정렬 기준
- 로고와 메뉴의 수직 중앙 정렬
- 메뉴 간격 균일
- 로고 높이는 고정하되 과대 노출 금지
- 메뉴 텍스트 baseline 통일

### 모바일 기준
- 로고 좌측
- 우측 햄버거 또는 1~2개 핵심 액션만 노출
- 1차는 단순 축약형으로 충분

### 구현 메모
- 기존 `Layout`의 헤더와 분리된 랜딩 전용 헤더가 더 적합
- 기존 로고 파일 교체 또는 새 컴포넌트에서 직접 이미지 사용 가능

---

## SECTION 3. HeroShowcase
이 섹션이 랜딩의 중심이다.

### 목적
- 브랜드/운영범위 소개
- 차량 이미지를 통한 신뢰 형성
- 사용자가 아래 예약 시작 섹션으로 자연스럽게 내려가게 유도

### 기본 레이아웃
#### 데스크탑
2열 레이아웃 권장
- 좌측: 카피 + 보조 설명 + CTA
- 우측: 메인 배너 이미지 또는 대표 썸네일 구성

#### 모바일
- 상단: 카피
- 하단: 이미지
- CTA는 텍스트 아래

---

### Hero 좌측 텍스트 블록
#### 포함 요소
- eyebrow: `SEOCHO / SEOUL` 또는 `단기렌트 · 딜리버리 가능`
- headline: 한 줄 또는 두 줄
- body copy: 2~3줄 이내
- CTA 1~2개

#### 문장 톤
- 과장된 광고문구보다 실제 운영 어조
- 예: `서울·수도권 단기렌트, 방문수령과 왕복 딜리버리까지 한 번에 예약하세요.`

#### 정렬 기준
- 모든 텍스트 좌측 정렬
- eyebrow / headline / body / button 시작점 동일
- CTA 그룹도 같은 축에서 시작
- 문단 간격은 `gap` 중심

---

### Hero 우측 비주얼 블록
#### 추천안 A — 메인 배너 1장
- 00rentcar 배너 이미지 1장을 크게 사용
- 가장 안정적
- 1차 구현 추천

#### 추천안 B — 메인 1장 + 하단 대표 차량 2~3썸네일
- Hero 이미지 1장
- 아래에 대표 차량 썸네일 카드 2~3개
- 신뢰감은 더 좋지만 복잡도 증가

#### 1차 권장
A 또는 A-lite로 시작한다.
즉,
- 우측 큰 비주얼 1장
- 필요 시 하단에 작은 thumbnail rail만 추가

---

### Hero 비주얼 정렬 기준
- 텍스트 블록 상단선과 이미지 블록 상단선 맞춤
- 이미지 자체를 수직 중앙 정렬하지 않고 상단 정렬 우선
- 이미지 crop은 텍스트 공간을 침범하지 않게 처리
- border-radius / shadow는 과하지 않게

### Hero에서 하지 않을 것
- 가격표
- 상품 리스트 반복
- 차종 카테고리
- 할인/세일 레이블
- 쇼핑몰 상품 카드 버튼

---

## SECTION 4. ReservationEntrySection

### 역할
Hero에서 형성된 관심을 실제 예약 행동으로 전환한다.

### 구성
- 섹션 제목
- 짧은 보조 설명
- 기존 SearchBox

### 1차 연결 방식
기존 `SearchBox`를 그대로 또는 wrapper를 통해 삽입한다.

### 정렬 기준
- 섹션 제목 / 설명 / SearchBox 시작축 동일
- SearchBox 좌우 폭이 Hero보다 지나치게 넓거나 좁지 않게 조정
- 랜딩 섹션과 앱 섹션의 간격은 충분히 두되, 끊긴 페이지처럼 보이지 않게 한다.

### 추천 문구 톤
- 제목: `예약 시작`
- 보조문구: `대여 일정과 수령 방식을 선택하면 바로 예약 가능한 차량을 확인할 수 있습니다.`

### UI 원칙
- 여기서부터는 기능이 우선
- Hero보다 장식 줄임
- 입력 UI의 안정감 확보

---

## SECTION 5. ContactInfoStrip

### 역할
실무 정보와 신뢰 정보를 구조적으로 정리한다.

### 포함 카드 후보
- 전화상담
- 카카오톡 문의
- 방문 주소
- 운영시간

### 레이아웃
#### 데스크탑
4칸 카드형 또는 2x2 그리드

#### 모바일
1열 스택 또는 2열 compact grid

### 정렬 기준
- 각 카드 내부는 `라벨 -> 핵심값 -> 보조설명` 순서 고정
- 라벨 상단 시작선 통일
- 핵심값 크기 통일
- 카드 간 높이 강제보다 내부 gap 정렬 우선

### 정보량 원칙
- 카드당 핵심 한 줄
- 설명 한 줄
- 너무 많은 문장 금지

---

## SECTION 6. Footer

### 역할
법적/사업자 정보 정리

### 원칙
- 기존 Footer를 최대한 유지 가능
- 단, 상단 랜딩 톤과 너무 멀어 보이면 spacing/로고 정도만 보정
- footer는 정보 마감용이지 마케팅 블록이 아님

---

## 썸네일/이미지 영역 상세 규칙

## 1. 대표 썸네일 rail
Hero 아래 또는 Hero 우측 하단에 배치 가능

### 역할
운영 차량의 실제감을 전달

### 카드 구성
- 썸네일 이미지
- 차종명(짧게)
- 보조 설명 1줄

### 금지
- 가격 노출
- 구매 버튼
- 카테고리 뱃지 남발

### 정렬 원칙
- 모든 썸네일 동일 비율
- 이미지 프레임 비율 통일
- 텍스트 2줄 이내
- 제목 시작점 통일

---

## 2. 이미지 톤 통일
실제 자산이 서로 다르면 톤이 섞일 수 있으므로 아래 기준을 둔다.

### 원칙
- Hero 이미지: 무드/브랜드 인상
- Thumbnail 이미지: 정보/신뢰
- 한 섹션 안에서는 같은 radius / shadow / background 처리 유지

### 처리 방법
- 흰 배경 product 이미지에는 연한 카드 배경 사용 가능
- 진한 배너 이미지는 어두운 오버레이 허용
- 이미지 효과보다 레이아웃 정렬로 통일감 확보

---

## 컴포넌트 책임 상세

## TopNoticeBar
### props 후보
- `phone`
- `kakaoId`
- `serviceNotice`
- `hours`

### 책임
- 운영 한 줄 공지 렌더링
- 외부 링크/전화 링크 처리

---

## BrandHeader
### props 후보
- `logoSrc`
- `menuItems`
- `phone`

### 책임
- 로고 렌더링
- 최소 메뉴 렌더링
- 모바일 축약 헤더 처리

---

## HeroShowcase
### props 후보
- `headline`
- `subcopy`
- `eyebrow`
- `heroImageSrc`
- `thumbnailItems`

### 책임
- Hero 텍스트/CTA 렌더링
- 이미지 비주얼 렌더링
- 선택 시 썸네일 rail 포함 가능

---

## ReservationEntrySection
### props 후보
- `title`
- `description`

### 책임
- SearchBox wrapper
- 섹션 소개 텍스트 렌더링
- 예약 시스템 진입 강조

---

## ContactInfoStrip
### props 후보
- `items[]`

### 책임
- 연락/운영 정보 카드 렌더링
- 카드 반복 구조 통일

---

## LandingPage
### 책임
- 위 섹션 순서 조립
- 랜딩 전용 데이터 공급
- 기존 Footer 연결

---

## 추천 DOM/레이아웃 뼈대
```txt
<PageShell variant="landing">
  <TopNoticeBar />
  <BrandHeader />

  <main class="landing-page">
    <section class="landing-hero-section">
      <div class="landing-container landing-hero-grid">
        <div class="landing-copy-column">
          eyebrow
          headline
          body
          cta-row
        </div>
        <div class="landing-visual-column">
          hero-image
          thumbnail-rail(optional)
        </div>
      </div>
    </section>

    <section class="landing-reservation-section">
      <div class="landing-container">
        section-title
        section-copy
        SearchBox
      </div>
    </section>

    <section class="landing-contact-section">
      <div class="landing-container">
        contact-grid
      </div>
    </section>
  </main>

  <Footer />
</PageShell>
```

---

## 타이포/정렬 기준

## 1. 타이포 위계
랜딩에서도 기존 `xs/s/m/l/xl` 구조를 유지한다.

### 권장 맵
- eyebrow / 작은 라벨: `s`
- body / 메뉴 / 입력 보조: `m`
- Hero headline / 섹션 제목: `l` 또는 `xl`
- contact card value: `l`
- caption / 아주 작은 note: `xs`

---

## 2. 정렬 기준 고정
### 수평 정렬
- Hero 카피 시작점
- 예약 섹션 제목 시작점
- ContactInfo 카드 시작점
가능하면 같은 container x축에서 맞춘다.

### 수직 정렬
- Hero 좌우 컬럼은 상단선 기준 정렬
- Contact 카드 내부는 상단 정렬
- 섹션 간 여백은 점진적으로 감소/증가하지 않게 일관된 scale 사용

---

## 3. 버튼 정렬 기준
- Hero CTA와 예약 영역 버튼은 스타일 문법을 공유
- 버튼 간 높이 통일
- 우선순위는 Primary 1개 + Secondary 1개 이내

---

## 데이터 구성 예시

## TopNoticeBar 데이터
```js
{
  serviceNotice: '서울·수도권 전지역 배차/반차 가능',
  phone: '010-2416-7114',
  kakaoId: '00RENTCAR',
  hours: '09:00 - 18:00'
}
```

## Hero 데이터
```js
{
  eyebrow: 'SHORT RENT · DELIVERY',
  headline: '서울·수도권 단기렌트,\n방문수령과 딜리버리를 한 번에',
  subcopy: '대여 일정과 수령 방식을 선택하면 예약 가능한 차량을 바로 확인할 수 있습니다.',
  heroImageSrc: '00rentcar hero asset',
  thumbnails: [
    { title: '디 올 뉴 그랜저', imageSrc: '...' },
    { title: '소나타 DN8', imageSrc: '...' },
    { title: '올 뉴 K7', imageSrc: '...' },
  ]
}
```

## ContactInfo 데이터
```js
[
  { label: '전화상담', value: '010-2416-7114', note: '평일 운영시간 내 상담 가능' },
  { label: '카카오톡', value: '00RENTCAR', note: '간편 문의 가능' },
  { label: '방문 주소', value: '서울 서초구 신반포로23길 78-9', note: '수푸레하우스 1층 빵빵카(주)' },
  { label: '운영시간', value: '09:00 - 18:00', note: '점심 12:00 - 13:00 / 주말·공휴일 휴무' },
]
```

---

## 구현 단계

## STEP 1. 랜딩 데이터 고정
- 로고/배너/썸네일 자산을 상수 또는 service 파일에 정리
- Hero 문구/운영 정보도 상수화

## STEP 2. `/landing` 라우트 생성
- 빈 페이지와 기본 레이아웃 추가

## STEP 3. 상단 3개 섹션 구현
- `TopNoticeBar`
- `BrandHeader`
- `HeroShowcase`

## STEP 4. 예약 진입 섹션 연결
- `ReservationEntrySection`
- 기존 SearchBox 삽입

## STEP 5. 연락 정보 블록 구현
- `ContactInfoStrip`

## STEP 6. 랜딩 전용 스타일 정리
- 섹션 간격
- Hero 2열
- 모바일 스택
- 이미지 톤/ratio 조정

## STEP 7. 검증
- 랜딩 첫인상
- SearchBox 연결
- 모바일 레이아웃
- 기존 `/cars` 전환 확인

---

## 완료 기준
- `/landing` 이 기존 메인과 별도로 동작한다.
- 00rentcar 셸 감성은 보이되 쇼핑몰 구조는 보이지 않는다.
- Hero → 예약 진입 → 운영 정보 흐름이 자연스럽다.
- 대표 이미지/썸네일이 조잡하지 않고 정렬 기준으로 정돈되어 보인다.
- 기존 예약 흐름에는 영향이 없다.

---

## 이번 단계에서 하지 않을 것
- Hero 슬라이더 고도화
- 차종 필터/상품 목록 이식
- 쇼핑몰 카테고리 복제
- 기존 `/` 바로 교체
- 랜딩에서 상세 페이지 전용 분기 추가

이번 단계는 **랜딩 뼈대를 단단하게 만들고, 정렬된 구조 안에 예약 진입을 붙이는 것**까지다.
