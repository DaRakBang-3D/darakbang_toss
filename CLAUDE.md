# darakbang_toss — Claude 작업 가이드

다락방(3D 방 꾸미기)의 앱인토스 WebView 미니앱. 비게임. 답변은 한국어로, 간결하게.

## 토스 플러그인 (ait@apps-in-toss)

`.claude/settings.json`에 등록돼 있어 이 레포를 Claude Code로 열면 설치를 제안한다.
수동 설치: `claude plugin marketplace add toss/apps-in-toss-harness && claude plugin install ait@apps-in-toss`
설치 후 `/mcp`에서 `ait-console` 로그인.

| 상황                           | 쓸 스킬                                                |
| ------------------------------ | ------------------------------------------------------ |
| 서버(Supabase) 코드 작성·점검  | `/ait:server`                                          |
| 화면 만들기·다듬기 (TDS)       | `/ait:design`                                          |
| 문구 점검 (반말, 애교체 금지)  | `/ait:ux-writing`                                      |
| 폰에서 확인 (.ait 업로드 → QR) | `/ait:test-on-device`                                  |
| 버그 추적 (브라우저·실기기)    | `/ait:debug`                                           |
| 검수 전 점검 / 반려 대응       | `/ait:launch`                                          |
| SDK·정책 사실 확인             | docs MCP (`apps-in-toss-docs`) — 기억으로 답하지 말 것 |

## 지켜야 할 결정

- React 18 고정 (TDS가 19 미지원). UI 쉘은 TDS만, 브랜드 스타일은 3D 씬 안에만
- SDK 3.x: 설정 파일은 `apps-in-toss.config.ts` (granite.config 아님). 샌드박스 앱 없음 → 브라우저 devtools / 콘솔 QR
- 인증 2단계: 0단계 식별키(진입 즉시, 개인정보 없음) / 1단계 토스 로그인(결제 직전만)
- 쿠키 금지 (iOS 서드파티 쿠키 차단). 자체 JWT, refresh는 SDK `Storage`
- 서버는 클라이언트가 보낸 anonKey·userKey를 믿지 않는다. 교환 API 결과만 사용
- 파트너 API 성공 판정은 `resultType` (HTTP 200 + FAIL 있음). `{"error":"invalid_grant"}`도 실패
- CORS는 `darakbang.apps.tossmini.com`, `darakbang.private-apps.tossmini.com`만. `*` 금지
- 로그인 우회 플래그 금지. 서버 검증은 `__setTossFetcherForTest` 가짜 fetch로
- `VITE_FEATURE_PAYMENTS` 기본 false: 사업자 등록 전 1차 출시는 광고만. 결제·토스 로그인·프로모션은 2차
- 전면 광고는 저장·공유 직후에만 (`useInterstitialAfter`). 보상은 `userEarnedReward`에서만
- iframe 금지 (ESLint로 강제)

## 검사 명령

```bash
npx tsc -b && npx eslint . && npm run build             # 클라이언트 + .ait
cd supabase/functions && deno check auth/index.ts toss-unlink/index.ts && deno test --allow-env
```
