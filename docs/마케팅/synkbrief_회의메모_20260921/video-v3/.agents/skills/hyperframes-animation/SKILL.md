---
name: hyperframes-animation
description: "Motion rules, blueprints, transitions, and runtime adapters preserved for this existing HyperFrames project. Use only when relevant to the current authorized work; this is not the default tool for all SYNK animation."
---

> 기존 영상 수정·재현용 사본이다. 새 영상은 [제작 방식 선택](../../../../../콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 먼저 따르며, 아래 공급자의 신규 제작·자동 라우팅 예시는 그 선택을 대신하지 않는다.

> SYNK 적용 범위: 기존 HyperFrames 0.8.58 video-v3에 동봉된 공급자 참고다. 현재 모든 영상의 기본 절차가 아니다. 새 작업의 도구·담당·비용·계정·승인 범위는 [제작 방식](../../../../../콘텐츠_제작방식_v2_20261002.md)과 [AI 운영 원칙](../../../../../../AI_운영원칙.md) 및 현재 요청을 따른다. 아래의 고정 인터뷰/승인 횟수·자동 설치·외부 생성·하위 실행기 규칙은 이미 승인된 작업에 새 관문이나 실행 권한을 만들지 않는다. 기술 스키마와 옵션은 보존하되 실제 설치판 지원 여부를 확인한다.

# HyperFrames Animation

All motion knowledge in one skill: **rules** (atomic recipes), **blueprints** (multi-phase scene templates), **transitions** (scene-to-scene), **techniques** (broader motion-design patterns), and **adapters** (per-runtime APIs).

For the composition contract (data attributes, sub-compositions, determinism) see `hyperframes-core`.

## Default: compose atomic rules

Pick 2-4 rules from `rules-index.md`, glue them together with a single paused GSAP timeline, done. This is faster and produces less code than starting from a blueprint.

## Load a blueprint when

- The scene matches an existing pre-designed multi-phase template (brand-reveal, social-proof, etc.) and reusing its phase pipeline saves real authoring time
- You want runnable ground-truth code for a complex 4-5 phase choreography

Blueprints live in `blueprints-index.md`. Each entry points to `blueprints/<id>.md` (recipe). Do not read it speculatively; load it when you've already decided you need scene-level orchestration.

## Routing

| Want to…                                                                       | Read                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Pick an atomic motion pattern by trigger / tag                                 | `rules-index.md`                                    |
| Read one rule's full HTML / CSS / GSAP recipe                                  | `rules/<name>.md`                                   |
| Pick a multi-phase scene template                                              | `blueprints-index.md`                               |
| Read one blueprint's full recipe                                               | `blueprints/<id>.md`                                |
| Author a scene transition (CSS-driven, between two clips)                      | `transitions/overview.md`, `transitions/catalog.md` |
| Look up a broader motion-design technique                                      | `techniques.md`                                     |
| Motion blur — shutter smear on an element, and when not to use it              | `references/motion-blur.md`                         |
| Analyze an existing composition's animation map                                | `scripts/animation-map.mjs`                         |
| GSAP API — timeline / tweens / position parameters                             | `adapters/gsap.md`                                  |
| GSAP — drop-in effect recipes                                                  | `rules/gsap-effects.md`                             |
| GSAP — transforms / perf                                                       | `adapters/gsap-transforms-and-perf.md`              |
| GSAP — eases / stagger                                                         | `adapters/gsap-easing-and-stagger.md`               |
| GSAP — timeline / labels                                                       | `adapters/gsap-timeline-and-labels.md`              |
| Lottie / dotLottie (After Effects exports, `window.__hfLottie`)                | `adapters/lottie.md`                                |
| Three.js / WebGL (3D scenes, `AnimationMixer`, `hf-seek`)                      | `adapters/three.md`                                 |
| Anime.js (`window.__hfAnime`)                                                  | `adapters/animejs.md`                               |
| CSS keyframes (`animation-delay` / `play-state` / `fill-mode`)                 | `adapters/css-animations.md`                        |
| Web Animations API (`element.animate()`, `currentTime` seek)                   | `adapters/waapi.md`                                 |
| TypeGPU / WebGPU (`navigator.gpu`, WGSL, compute pipelines)                    | `adapters/typegpu.md`                               |
| HTML-as-texture + WebGL/GLSL post-fx (capture live DOM via `drawElementImage`) | `adapters/html-in-canvas-patterns.md`               |
| Named text-animation effects (24 IDs via external `animate-text` skill)        | `adapters/animate-text.md`                          |

## Picking a runtime

- **GSAP** is the default for 95% of motion work — covers timeline orchestration, transforms, easing, stagger. All atomic rules in this skill are GSAP-based.
- **Lottie** when an asset has its own pre-baked timeline (typically After Effects exports).
- **Three.js** for 3D scenes, camera motion, shader-driven visuals.
- **Anime.js** for lightweight tweening when GSAP is overkill.
- **CSS** for simple repeated motifs, decoration, shimmer — no JavaScript animation cost.
- **WAAPI** for native browser keyframes without a GSAP dependency.
- **TypeGPU / WebGPU** for GPU-rendered canvases (particles, liquid glass, custom shaders).

Multiple runtimes can coexist in one composition. Each registers its instances on the runtime-specific global so HyperFrames can seek all of them in one pass.

## Critical Constraints

**Composition contract:** [hyperframes-core](../hyperframes-core/SKILL.md)와 [determinism rules](../hyperframes-core/references/determinism-rules.md)를 담당 원문으로 읽는다. 이 사본에 별도의 async/속성 허용 목록을 복제하지 않는다. 실제 0.8.58 지원 여부는 해당 설치판에서 확인한다.

Animation-craft additions on top of core's contract:

- **Pre-calculated layout constants** — never derive positions from `getBoundingClientRect()` at tween time. Tween-time DOM measurements desync because the renderer samples in parallel; compute coordinates once at composition setup and reuse.
- **Spatial motion:** prefer GSAP transform aliases (`x`, `y`, `scale`, `rotation`) for performance. Property support and asynchronous setup follow the core contract above; a performance preference is not a fixed property allowlist.

## Scripts

```bash
node skills/hyperframes-animation/scripts/animation-map.mjs <composition-dir> \
  --out <composition-dir>/.hyperframes/anim-map
```

Reads every GSAP timeline registered on `window.__timelines`, enumerates tweens, samples bboxes, computes flags, outputs `animation-map.json`. Use it to audit choreography (dead zones, stagger consistency, lifecycle warnings) after authoring.

`animation-map.mjs` resolves helper packages from the current project first, then can bootstrap the bundled HyperFrames package version. Set `HYPERFRAMES_SKILL_PKG_VERSION=<version>` only when running the skill outside the bundled CLI/skill install and you need to pin that bootstrap version explicitly.

## See Also

- `hyperframes-core` — composition structure, data attributes, sub-compositions, deterministic render contract
- `hyperframes-creative` — palettes, typography, narration, beat planning (non-animation creative direction)
- `hyperframes-cli` — `npx hyperframes lint / check / snapshot / preview / render`
