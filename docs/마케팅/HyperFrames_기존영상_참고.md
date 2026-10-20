# 기존 HyperFrames 0.8.x 영상 작업본 — 기술 참고

이 문서는 이미 만들어 둔 HyperFrames 0.8.x 프로젝트를 수정·재현할 때 쓰는 공통 기술 참고다. 2026-10-17 사용자 확정으로 HyperFrames는 기존 영상 수정·재현 때만 참고한다. 새 영상은 [제작 도구 선택](콘텐츠_제작방식_v2_20261002.md#video-tool-selection)에 따라 사용자가 만족한 결과물의 제작 방식을 우선한다. 제작 방식은 [SNS 키트](../디자인/SNS키트/README.md), 역할·도구 설치·비용·권한은 [AI 운영 원칙](../AI_운영원칙.md)과 현재 요청을 따른다.

통합한 12개 프로젝트의 고정 버전은 0.8.58·0.8.71·0.8.77·0.8.78·0.8.79·0.8.96·0.8.97·0.8.104다. 실제 실행 명령·버전·prerender와 별도 동기화 단계는 **각 프로젝트의 package.json과 해당 README가 우선**한다. 아래 공통 명령 예시를 개별 스크립트 대신 무조건 실행하거나 최신 버전으로 자동 변경하지 않는다. 로컬 렌더는 현재 요청 범위에서 진행하고, 공개·외부 발송 권한은 별도로 구분한다.

## Commands

```bash
npm run dev          # human-operated foreground preview (blocks until stopped)
npx hyperframes preview --background  # agent-safe persistent Studio preview
npx hyperframes preview --status      # verify the persistent preview is listening
npx hyperframes preview --stop        # stop it when review is finished
npm run check        # lint + runtime + layout + motion + contrast (one command)
npm run render       # render to MP4
npm run publish      # publish and get a shareable link
npx hyperframes lint --verbose  # include info-level findings
npx hyperframes lint --json     # machine-readable output for CI
npx hyperframes docs <topic> # reference docs in terminal
```

> **Agents must use `npx hyperframes preview --background` for Studio handoff.** Do not rely
> on a shell/tool `run_in_background` wrapper around `npm run dev`: that foreground process
> remains owned by the invoking session and can disappear while the browser stays open,
> leaving refreshes at `ERR_CONNECTION_TIMED_OUT`. Verify with `preview --status`, keep it
> alive through review, and stop it explicitly with `preview --stop` afterward.

> **고정 CLI 버전.** 기존 package.json의 고정 버전은 재현 근거다. 버전 변경이 현재 작업에 필요할 때만 변경 범위에 포함하고 기존 결과와 관련 검사를 대조한다. 최신 릴리스가 있다는 이유만으로 pin을 올리지 않는다.

## Documentation

**For quick reference**, use the local CLI docs command (no network required):

```bash
npx hyperframes docs <topic>
```

Topics: `data-attributes`, `gsap`, `compositions`, `rendering`, `examples`, `troubleshooting`

**For full documentation**, discover pages via the machine-readable index — do NOT guess URLs:

```
https://hyperframes.heygen.com/llms.txt
```

## Project Structure

- `index.html` — main composition (root timeline)
- `compositions/` — sub-compositions referenced via `data-composition-src`
- `meta.json` — project metadata (id, name)
- `transcript.json` — whisper word-level transcript (if generated)

## Linting — ALWAYS RUN AFTER CHANGES

After creating or editing any `.html` composition, **always** run the full check before considering the task complete:

```bash
npm run check
```

Fix all errors before presenting the result. Warnings should be reviewed before rendering.

## Key Rules

1. Every timed element needs `data-start` and a duration. `data-start` is what marks it as timed; `data-track-index` is an optional Studio display lane the render never reads
2. Give timed visual elements `class="clip"`. The framework keys visibility off `data-start`, not the class, but the shared `.clip` CSS is what gives a scene its full-frame box, and `lint` warns without it
3. Register one paused root timeline per composition on `window.__timelines`:
   ```js
   window.__timelines = window.__timelines || {};
   window.__timelines["composition-id"] = gsap.timeline({ paused: true });
   ```
   Scene timelines manually added to this root must not be paused. A paused
   child does not advance when the root is seeked. The runtime activates
   registered composition siblings, not arbitrary nested scene timelines.
4. Videos use `muted` with a separate `<audio>` element for the audio track
5. Sub-compositions use `data-composition-src="compositions/file.html"` to reference other HTML files
6. Only deterministic logic — no `Date.now()`, no `Math.random()`, no network fetches
