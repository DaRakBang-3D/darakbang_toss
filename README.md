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
    auth/         appLogin → 서버 /auth/toss (토큰 교환은 서버, mTLS)
    ads/          전면·보상형 공용 훅, 전면 광고는 저장/공유 직후만
    iap/          상품 조회 · 구매 · 미결 주문 복원
    ai-generate/  생성권 잔량 (하루 무료 3회, 서버 관리)
  scene/      Three.js 방 씬, 성능 프리셋(low/high)
  lib/        env, analytics(이벤트 이름 고정)
  api/        백엔드 fetch 래퍼 (세션 쿠키)
```

## 백엔드에 필요한 API (TODO)

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| POST | `/auth/toss` | 인가 코드 → 토큰 교환(mTLS) → userKey → 세션 발급 |
| GET | `/ai/quota` | 남은 생성권 |
| POST | `/ai/quota/ad-reward` | 보상형 광고 시청 +1 (하루 상한 서버 검사) |
| POST | `/iap/grant` | 주문 상태 조회 API로 검증 후 생성권 지급 |

## 검수 규칙 (코드로 강제한 것)

- iframe 금지 → ESLint 규칙
- 보상은 `userEarnedReward`에서만 지급
- 전면 광고 호출 시점은 `'after-save' | 'after-share'` 타입으로 제한
- 개발 중 광고 ID 미설정 시 테스트 ID 사용
- 앱 시작 시 `getPendingOrders` → 지급 → `completeProductGrant`
