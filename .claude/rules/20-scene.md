---
paths:
  - 'src/scene/**'
---

# 3D 씬 규칙 (src/scene/)

토스 WebView 안에서 돌아가므로 **발열·끊김이 기능보다 우선**이다.

- 품질 옵션(그림자 해상도, DPR, 파티클 등)은 하드코딩하지 않고 `usePerf((s) => s.preset)`에서 읽는다
- 새 효과를 넣으면 `PerfPreset`에 스위치를 추가하고 `low`에서는 끈다. 판정이 애매하면 `low`
- `three`는 `vite.config.ts`의 `manualChunks`로 분리돼 있다. 씬 밖(pages 등)에서 `three`를 import하지 않는다
- 씬 컴포넌트는 `lazy()`로 불러 첫 화면 로딩에 포함되지 않게 한다
- 만든 Three.js 리소스는 언마운트 시 정리한다: geometry·material·texture `dispose()`, renderer `dispose()`, `requestAnimationFrame` 취소, 이벤트 리스너 해제
- 매 프레임 루프 안에서 `new` 로 객체를 만들지 않는다 (재사용할 벡터·행렬은 바깥에 둔다)
- 드래그 제스처는 WebView 바운스/당겨서 새로고침이 꺼져 있다는 전제(`apps-in-toss.config.ts`)로 작성한다. 그 설정을 바꾸지 않는다
- 브랜드 색·조명값은 씬 안의 상수로 모은다 (TDS 쉘에 새지 않게)
