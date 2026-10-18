# 공통 코드 규칙 (항상 적용)

새 규칙을 만들기보다 **주변 코드와 똑같이** 쓰는 것이 1순위다. 이 문서와 기존 코드가 다르면 기존 코드를 따르고 이 문서를 고친다.

## 포맷·검사

- 포맷은 Prettier가 정한다 (`singleQuote`, `printWidth: 110`, `trailingComma: all`). 손으로 줄맞춤하지 않는다
- `tsconfig`는 `strict` + `noUncheckedIndexedAccess`. `any`, `as any`, `@ts-ignore`, `eslint-disable` 금지
  - 불가피하면 `as` 단언 + 이유 주석 한 줄 (`navigator as Navigator & { deviceMemory?: number }` 형태)
- 작업 끝나면 CLAUDE.md의 "검사 명령"을 돌리고, 실패를 숨기지 않는다

## 이름

| 대상                    | 규칙                                     | 예                                   |
| ----------------------- | ---------------------------------------- | ------------------------------------ |
| 컴포넌트 파일·이름      | PascalCase, 파일명 = 컴포넌트명          | `HomePage.tsx` → `HomePage`          |
| 훅 / zustand 스토어     | `useXxx`, 파일명 camelCase               | `useInterstitialAfter.ts`, `useAuth` |
| 그 외 모듈              | camelCase                                | `tokenStore.ts`, `perfPreset.ts`     |
| 폴더                    | kebab-case                               | `features/ai-generate/`              |
| 모듈 상수               | UPPER_SNAKE, 단위를 이름에               | `MIN_INTERVAL_MS`, `FREE_DAILY`      |
| 저장소 키               | `darakbang.<이름>` (기존 키 이름 변경 금지 — 사용자 데이터 유실) | `darakbang.refresh` |
| 미사용 인자             | `_` 접두사                               | `_moment`                            |

## 타입

- 값의 종류는 `enum` 대신 **문자열 리터럴 유니언** (`type Page = 'home' | 'editor'`)
- 호출 시점·종류를 제한해야 하는 규칙은 타입으로 강제한다 (`InterstitialMoment`, `AppEvent` 참고)
- 객체 모양은 `interface`, 유니언·조합은 `type`
- 고정 매핑 테이블은 `Record<Union, T>` 또는 `as const`

## import / export

- **named export만** 쓴다. `export default` 금지 (설정 파일 제외)
- `src/`: 다른 폴더는 `@/` 별칭, 같은 폴더는 `./`. `../` 상대경로 금지 (`supabase/`는 30-server.md)
- 순서: 외부 패키지 → `@/…` → `./…` (그룹 사이 빈 줄 없음)
- 타입만 쓰면 `import type` (`verbatimModuleSyntax` 켜져 있음)

## 주석

- 한국어. **왜** 그렇게 했는지만 쓴다 (무엇을 하는지는 코드로)
- export 하는 함수·상수·상태 필드에는 `/** 한 줄 */` JSDoc
- 정책·검수 때문에 생긴 코드는 근거를 남긴다 (`// 앱인토스 검수: …`, `// iOS 서드파티 쿠키 차단`)
- 미완성은 `// TODO(<영역>): 내용` — 영역 예: `backend`, `design`, `perf`

## 에러 처리

- 사용자 흐름에 영향 없는 실패(로깅, 저장소 쓰기)는 삼키되 **이유 주석**을 단다: `.catch(() => {})`, `catch { /* … */ }`
- 결과를 기다리지 않는 Promise는 `void`를 붙인다 (`void track(...)`)
- 개발자용 경고는 `console.warn('[모듈] 한국어 설명', e)`. `console.log` 커밋 금지
- 사용자에게 보이는 실패는 상태(`status: 'error'`)로 올려서 화면이 재시도 버튼을 보여주게 한다

## 변경 범위

- 요청받은 것만 바꾼다. 리팩터링이 필요해 보이면 제안만 하고 묻는다
- 새 의존성 추가 전에 묻는다 (번들 크기가 WebView 첫 로딩에 직결)
- 구조·스택이 바뀌면 README의 "구조", 결정이 바뀌면 CLAUDE.md의 "지켜야 할 결정"을 같이 고친다
