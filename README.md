# 다락방 — 토스 미니앱 (darakbang_toss)

앱인토스(Apps in Toss) WebView 미니앱. 비게임 카테고리.

## 스택

| 영역 | 사용 |
| --- | --- |
| 빌드 | Vite 7 + React 18 + TypeScript 5.9 (TDS가 React 18까지만 지원) |
| 앱인토스 | `@apps-in-toss/web-framework` 3.x, `@apps-in-toss/devtools` |
| UI | TDS (`@toss/tds-mobile`, `@toss/tds-mobile-ait`). 브랜드 스타일은 3D 씬 안에만 |
| 3D / 상태 | three, zustand |

## 실행

```bash
npm install
cp .env.example .env   # API 주소 입력
npm run dev            # 브라우저: SDK가 devtools mock으로 치환됨 (우하단 AIT 패널)
npm run build          # tsc → vite build → ait build (darakbang.ait 생성)
npm run deploy         # 콘솔 업로드 (ait token add 먼저)
```

- 샌드박스 앱: `intoss://darakbang`
- 콘솔 QR 테스트: `intoss-private://darakbang`
- **광고는 샌드박스에서 동작하지 않음** → 콘솔 QR 테스트로 확인
- devtools는 Node 24 이상 권장

## 구조

```
apps-in-toss.config.ts   appName, 네비게이션 바, WebView 옵션 (SDK 3.x 설정 파일)
src/
  app/        App(TDSMobileAITProvider), 화면 상태 라우터
  pages/      Home · Editor · Visit · Shop
  features/
    auth/         0단계 식별키 · 1단계 토스 로그인, 토큰 저장(SDK Storage)
    ads/          전면·보상형 공용 훅, 전면 광고는 저장/공유 직후만
    iap/          상품 조회 · 구매 · 미결 주문 복원
    ai-generate/  생성권 잔량 (하루 무료 3회, 서버 관리)
  scene/      Three.js 방 씬, 성능 프리셋(low/high)
  lib/        env, analytics(이벤트 이름 고정)
  api/        백엔드 fetch 래퍼 (Bearer 토큰, 401 시 재발급)
```

## 사용자 인증 (2단계)

| 단계 | 시점 | 방식 | 동의 화면 | 개인정보 |
| --- | --- | --- | --- | --- |
| 0 | 앱 진입 즉시 (자동) | `User.createAnonymousKeyAuthCode()` → `/auth/anon` → 서버가 mTLS로 anonKey 교환 | 없음 | 없음 |
| 1 | **결제 직전에만** | `appLogin()` → `/auth/toss` → 서버가 userKey 조회 후 같은 계정에 연결 | 최초 1회 | scope 최소 |

- 세션: 자체 JWT access(1시간, 메모리) + refresh(30일, SDK `Storage`, 사용 시 교체). **쿠키 미사용** (iOS 서드파티 쿠키 차단)
- 토스 AccessToken은 userKey 조회 후 버림 (저장 안 함)
- 연결 끊기 콜백: `UNLINK`·`WITHDRAWAL_TERMS` → 토스 연결만 해제, `WITHDRAWAL_TOSS` → 사용자 삭제

### 백엔드 (Supabase)

```
supabase/
  migrations/…_toss_auth.sql    toss_users, toss_refresh_tokens (RLS on, service role 전용)
  functions/auth/               POST /anon · /toss · /refresh, GET /me
  functions/toss-unlink/        연결 끊기 콜백 (Basic Auth)
  functions/_shared/            mTLS 클라이언트, JWT 세션, CORS
```

```bash
supabase db push
supabase secrets set TOSS_MTLS_CERT="$(cat xxx_public.crt)" TOSS_MTLS_KEY="$(cat xxx_private.key)" \
  APP_JWT_SECRET="$(openssl rand -base64 48)" TOSS_UNLINK_BASIC_AUTH="user:password"
supabase functions deploy auth toss-unlink
# 로컬 개발 origin 허용이 필요하면: ALLOWED_DEV_ORIGINS=http://localhost:5173
```

`.env`의 `VITE_API_BASE` = `https://<project-ref>.supabase.co/functions/v1`

### 남은 백엔드 API (TODO)

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| GET | `/ai/quota` | 남은 생성권 |
| POST | `/ai/quota/ad-reward` | 보상형 광고 시청 +1 (하루 상한 서버 검사) |
| POST | `/iap/grant` | 주문 상태 조회 API로 검증 후 생성권 지급 |

## 콘솔 체크리스트

| 할 일 | 필요 시점 | 비고 |
| --- | --- | --- |
| 앱 등록 (`appName: darakbang`) | 0단계 QR 테스트 전 | 검토 영업일 1~2일 |
| mTLS 인증서 발급 → secrets 등록 | 0단계 QR 테스트 전 | 콘솔 > 개발 > mTLS 인증서. 만료일 관리 |
| `.ait` 업로드 → QR 테스트 | 실기기 테스트 | `npm run deploy`, `intoss-private://` |
| 사업자 등록 | 1단계(토스 로그인)·IAP 전 | 검수 영업일 1일. 광고는 수익 5천원까지 유예 |
| 토스 로그인 설정 (대표관리자) | 1단계 전 | 약관 동의 · scope 최소 · 서비스 약관/개인정보 수집 동의 URL · 연결 끊기 콜백 URL+Basic Auth |
| 복호화 키 수령 | 1단계 전 | 개인정보 받을 때만 필요 (현재 scope 최소라 미사용) |
| 정산 정보 등록 | IAP 전 | 검토 영업일 2~3일 |

미확인 (채널톡 문의 필요): ① 사업자 등록 전 QR 테스트에서 토스 로그인 동작 여부 ② 식별키 교환 API의 사업자 필요 여부

## 검수 규칙 (코드로 강제한 것)

- iframe 금지 → ESLint 규칙
- 보상은 `userEarnedReward`에서만 지급
- 전면 광고 호출 시점은 `'after-save' | 'after-share'` 타입으로 제한
- 개발 중 광고 ID 미설정 시 테스트 ID 사용
- 앱 시작 시 `getPendingOrders` → 지급 → `completeProductGrant`
