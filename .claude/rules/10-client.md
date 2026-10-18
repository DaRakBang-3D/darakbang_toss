---
paths:
  - 'src/**'
---

# 클라이언트 규칙 (src/)

## 폴더 역할과 의존 방향

```
pages → features → api, lib
app   → pages, features
scene → lib (features 상태는 props나 스토어 셀렉터로만 받음)
```

| 폴더               | 넣는 것                                         | 넣지 않는 것                       |
| ------------------ | ----------------------------------------------- | ---------------------------------- |
| `app/`             | Provider, 화면 라우터, 앱 시작 시 1회 작업       | 화면 UI                            |
| `pages/`           | 화면 하나 = 파일 하나. 조립과 화면 상태만        | fetch, SDK 직접 호출, 비즈니스 로직 |
| `features/<기능>/` | 기능별 스토어·훅·SDK 호출                        | 다른 feature 내부 import (필요하면 위로 올림) |
| `api/`             | `api<T>()` fetch 래퍼 하나                       | 엔드포인트별 로직                  |
| `lib/`             | 기능과 무관한 공용 (`env`, `analytics`)         | 상태                               |
| `scene/`           | Three.js 씬, 성능 프리셋                         | TDS 컴포넌트                       |

- 새 기능은 `features/<kebab-name>/`에 만든다. 파일이 하나뿐이어도 폴더로
- 반대 방향 import(features → pages 등)가 필요하면 설계가 틀린 것. 멈추고 묻는다

## 상태 (zustand)

- 전역 상태는 feature 안의 `create<XxxState>()` 스토어. `interface XxxState`에 값과 액션을 같이 둔다
- 컴포넌트에서는 **셀렉터로 필요한 것만** 구독: `useRouter((s) => s.go)`
- 컴포넌트 밖(이펙트 1회 실행 등)에서는 `useXxx.getState().action()`
- 서버가 진짜 값을 가진 데이터(생성권 등)는 스토어를 캐시로만 쓰고, 액션이 서버 응답으로 덮어쓴다

## 환경 변수·기능 스위치

- `import.meta.env`는 `src/lib/env.ts`에서만 읽는다. 나머지는 `env.xxx` / `features.xxx`
- 새 `VITE_*` 변수 추가 시 3곳을 같이 고친다: `lib/env.ts`, `vite-env.d.ts`, `.env.example`
- 결제 관련 코드(`features/iap`, 상점, 토스 로그인)는 `features.payments`로 막고, **동적 import**로 불러서 꺼져 있을 때 번들에 안 들어오게 한다

## 앱인토스 SDK

- SDK(`@apps-in-toss/web-framework`) 호출은 `features/`·`lib/` 안에서만. pages에서 직접 부르지 않는다
- 지원 여부 확인이 있는 API는 먼저 `.isSupported()` 체크
- 저장은 `localStorage`가 아니라 SDK `Storage` (토큰 등 앱 종료 후 유지가 필요한 값). 단순 기기 설정은 `localStorage` + try/catch 허용
- 분석 이벤트는 `track()`과 `AppEvent` 유니언만. 새 이벤트는 유니언에 먼저 추가 (기획 문서와 맞출 것)
- SDK 사용법이 확실하지 않으면 docs MCP로 확인한다. 기억으로 쓰지 않는다

## 서버 호출

- 반드시 `api<T>(path, { method, json })`. `fetch` 직접 호출 금지
- 응답 타입은 호출부에서 제네릭으로 명시 (`api<{ remaining: number }>(...)`)
- 실패는 `ApiError`(`status`, `code`)로 온다. `code`로 분기한다

## 화면 (pages/)

- UI 쉘은 TDS 컴포넌트만 (`Top`, `Button`, `Spacing` …). 직접 만든 버튼·색상 금지
- 레이아웃 보정 정도의 인라인 `style`만 허용 (여백 등). 색·폰트 지정 금지 — 브랜드 스타일은 3D 씬 안에만
- 화면 이동은 `useRouter((s) => s.go)('editor')`. 새 화면은 `Page` 유니언 + `App.tsx`의 `PAGES`에 추가
- 무거운 화면은 `lazy()`로 분리
- 사용자 문구는 **친근한 반말** (유저와 친한 느낌이 의도. 예: "다락방에 온 걸 환영해", "내 방 꾸미러 가기")
  - 애교체(~용, ~당, 이모티콘 남발) 금지. 해요체·합니다체도 섞지 않는다
  - 문구를 새로 쓰거나 크게 바꾸면 `/ait:ux-writing`으로 점검하되, 해요체로 바꾸자는 제안은 따르지 않는다
  - 검수·정책상 존댓말이 필요한 문구(약관, 결제 고지 등)가 있으면 반말로 바꾸지 말고 묻는다

## 광고

- 전면 광고는 `useInterstitialAfter()`만 사용 (시점 `'after-save' | 'after-share'`)
- 보상 지급은 `userEarnedReward` 이벤트 안에서만, 지급 자체는 서버(`grantFromAd`)
- 광고 ID는 `env`에서. 실제 ID를 코드에 하드코딩 금지
