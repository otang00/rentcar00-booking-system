# 06. EXTERNAL PREVIEW / DEPLOY RUNBOOK

## 목적
사장님이 **외부 브라우저에서 바로 확인**해야 할 때,
배포 경로를 헷갈리지 않고 **한 번에 공개 URL**을 만드는 절차를 고정한다.

이 문서는 `premove-clone`에서
- 로컬 미리보기
- Vercel preview
- Vercel production
중 무엇을 써야 하는지 판단 기준을 잠근다.

---

## 결론

### 1. 사장님이 직접 외부에서 봐야 하면
**기본값은 Vercel production 배포**다.

사용 명령:
```bash
vercel deploy --prod --yes
```

사용 이유:
- `premove-clone.vercel.app` 는 외부 공개 접근이 된다.
- preview 배포는 프로젝트 설정에 따라 인증 보호가 걸릴 수 있다.
- 링크를 전달했는데 로그인/인증에 막히면 확인 흐름이 끊긴다.

### 2. preview URL은 기본 외부 확인용으로 쓰지 않는다
사용 명령:
```bash
vercel deploy --yes
```

주의:
- preview 도메인은 **Authentication Required** 보호가 걸릴 수 있다.
- 따라서 사장님에게 바로 보내는 외부 확인 링크로는 부적합할 수 있다.

### 3. `vite preview` / `vercel dev` 는 내부 확인용이다
이 둘은 아래 용도로만 쓴다.
- 내가 로컬에서 빠르게 확인할 때
- API 동작을 로컬에서 점검할 때
- 외부 공개 전에 임시 검증할 때

사장님에게 보내는 최종 링크 기본값으로 쓰지 않는다.

---

## 배포 선택 규칙

### A. 외부에서 사장님이 바로 봐야 한다
선택:
- **Vercel production**

순서:
1. 필요한 Vercel env 존재 확인
2. `vercel deploy --prod --yes`
3. `https://premove-clone.vercel.app/...` 로 실제 응답 확인
4. 그 URL을 전달

### B. 내가 혼자 로컬 검증만 하면 된다
선택:
- `vercel dev` 또는 `vite preview`

### C. API까지 포함한 로컬 동작 확인이 필요하다
선택:
- **`vercel dev` 우선**

이유:
- `vite preview` 는 `api/*` 라우트를 실제 서버리스처럼 처리하지 못할 수 있다.
- `vercel dev` 가 API 확인에는 더 안전하다.

---

## 외부 확인용 표준 절차

### 1. 배포 전 확인
```bash
git status --short --branch
vercel env ls
```

확인 포인트:
- 불필요한 미추적 파일이 없는가
- 필요한 env 가 production에 있는가

현재 상세 merge 기준 필수 env:
- `SUPABASE_PROJECT_REF`
- `SUPABASE_PUBLISHABLE_KEY`

### 2. production 배포
```bash
vercel deploy --prod --yes
```

### 3. 배포 후 실제 응답 확인
최소 2개는 확인한다.

#### 메인/목록 링크 확인
예:
```bash
https://premove-clone.vercel.app/?deliveryDateTime=2026-04-20%2010:00&returnDateTime=2026-04-21%2010:00&pickupOption=pickup&driverAge=26&order=lower
```

#### API 확인
예:
```bash
https://premove-clone.vercel.app/api/car-detail?carId=24154&deliveryDateTime=2026-04-20%2010:00&returnDateTime=2026-04-21%2010:00&pickupOption=pickup&driverAge=26&order=lower
```

### 4. 전달 형식
사장님에게는 **상세 직링크가 아니라 기본적으로 목록부터 보는 링크**를 준다.

기본 전달 형식:
- 목록 링크 1개
- 필요 시 상세 직링크는 보조로만 추가
- 현재 반영 포인트 1~2줄

---

## 이번 이슈에서 확인된 실패 패턴

### 실패 패턴 1. `vite preview` 를 외부 확인 링크처럼 전달
문제:
- API 포함 검증이 불완전할 수 있다.
- 프로세스가 오래 유지되지 않으면 죽는다.

### 실패 패턴 2. `vercel dev` 링크를 외부 최종 링크처럼 전달
문제:
- 로컬 장비/포트 접근성에 의존한다.
- 외부 네트워크 경로가 막히면 사장님이 못 본다.

### 실패 패턴 3. protected preview 링크 전달
문제:
- Vercel 인증 보호로 401 발생 가능
- 사장님 입장에서는 그냥 "안 열림" 으로 보인다.

### 실패 패턴 4. env 없이 production 먼저 배포
문제:
- 페이지는 열리지만 최신 기능이 일부 비활성화될 수 있다.
- 예: partner-only fallback 으로 보일 수 있다.

---

## 앞으로의 고정 원칙
- 사장님이 "볼 수 있게 띄워" 라고 하면 기본값은 **production 배포**다.
- 링크는 **목록부터 들어가는 URL** 기준으로 준다.
- 배포 후에는 반드시 **실제 URL + 실제 API 응답** 둘 다 확인하고 전달한다.
- preview/dev 링크는 내부 점검용으로만 사용한다.

---

## 빠른 체크리스트
- [ ] 외부 확인 요청인가?
- [ ] production env 확인했는가?
- [ ] `vercel deploy --prod --yes` 로 올렸는가?
- [ ] `premove-clone.vercel.app` 실제 접속 확인했는가?
- [ ] 목록 링크 기준으로 전달하는가?
- [ ] API 응답까지 확인했는가?
