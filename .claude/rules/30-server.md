---
paths:
  - 'supabase/**'
---

# 서버 규칙 (supabase/)

Deno 런타임이다. ESLint 대상이 아니므로 `deno check` / `deno test`로 검사한다 (CLAUDE.md "검사 명령").
서버 코드를 새로 쓰거나 인증·파트너 API를 건드리면 `/ait:server`를 먼저 실행한다.

## 구조

```
functions/<함수명>/index.ts   진입점. 라우팅과 요청 검증만
functions/_shared/            여러 함수가 쓰는 것 (http, session, toss mTLS 클라이언트)
migrations/<타임스탬프>_<이름>.sql
```

- 함수 사이 공용 코드는 `_shared/`로. 함수 폴더끼리 import 금지
- import는 Deno 방식: 상대경로 + 확장자 (`'../_shared/http.ts'`). `@/` 별칭 없음
- 앱이 부르는 함수의 응답은 `_shared/http.ts`의 `json(req, status, body)` (CORS 헤더가 붙는다)
  - 예외: OPTIONS 프리플라이트(`new Response(null, { status: 204, headers: cors(req) })`), 토스 서버가 부르는 콜백(`toss-unlink`, CORS 불필요)
- 에러 응답 모양은 `{ error: '<snake_case 코드>' }` 고정 — 클라이언트 `ApiError.code`가 이 값을 읽는다
- 예상 못 한 예외는 핸들러 바깥에서 잡아 `500 { error: 'internal' }`. 내부 메시지를 응답에 싣지 않는다

## 보안 (어기면 안 됨)

- 클라이언트가 보낸 anonKey·userKey·사용자 ID를 믿지 않는다. 사용자는 **JWT(`_shared/session.ts`)에서만** 꺼낸다
- 파트너 API 성공 판정은 `resultType === 'SUCCESS'`. HTTP 200만 보고 판단 금지
- CORS 허용 origin은 `_shared/http.ts`의 목록만. `*` 금지, 개발용은 `ALLOWED_DEV_ORIGINS` env
- 비밀값은 `Deno.env.get()` + `supabase secrets`. 코드·로그에 출력 금지
- 지급(생성권 +1, 결제 지급)은 하루 상한·주문 상태 조회 등 **서버 검증 후**에만

## DB

- 스키마 변경은 새 마이그레이션 파일로만. 이미 적용된 마이그레이션 수정 금지
- 새 테이블은 RLS 켜고 service role 전용으로 시작한다
- 테이블·컬럼은 snake_case

## 테스트

- 파트너 API는 `__setTossFetcherForTest`로 가짜 fetch를 주입해서 테스트한다. 로그인 우회 플래그 금지
- 테스트 파일은 대상 옆에 `<이름>.test.ts`
