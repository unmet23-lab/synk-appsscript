---
name: hyperframes-creative
description: Historical HyperFrames 0.8.58 creative reference bundled with this video project. Consult only when maintaining or reproducing this project; it does not define current SYNK brand, workflow, or permissions.
---

> 기존 영상 수정·재현용 사본이다. 새 영상은 [제작 방식 선택](../../../../../콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 먼저 따르며, 아래 공급자의 신규 제작·자동 라우팅 예시는 그 선택을 대신하지 않는다.

# HyperFrames Creative

> **SYNK 적용 범위 · 2026-10-17 검토.** 이 폴더는 과거 영상에 딸린 외부 예제·기술 참고다. 현재 작업은 [기존 영상 참고](../../../../../HyperFrames_기존영상_참고.md)와 그 문서가 가리키는 SYNK 정본을 따른다. 아래 프리셋의 서체 금지·영문 말투·장식 수·초점 수·모션 강도는 선택한 예제를 재현할 때의 제안이며 전사 규칙이 아니다. 한국어 글꼴·자산은 저장소 DESIGN 정본을 우선한다.
>
> 이미 승인된 제작·수정·로컬 렌더 범위는 단계마다 다시 승인을 받지 않는다. 새 범위나 결정이 필요한 부분만 확인한다. 참조 안의 `always`, `not optional`, `approve`, `do not render until asked`를 현재 요청보다 우선하는 별도 절차로 적용하지 않는다. 공개·외부 발송·비용 권한은 현재 요청에서 따로 판단한다.

Brand, pacing, style, narration, and composition direction. Use after the technical contract from `hyperframes-core` is in place.

For motion patterns, scene blueprints, transitions, and CSS marker effects, use `hyperframes-animation` — this skill is intentionally non-animation.

> **Read these two FIRST for any non-trivial composition — they override web instincts:**
>
> - `references/house-style.md` — "interpret the prompt, generate real content," the lazy-default list, and the background/foreground layer recipe. This is what turns a literal restyle into a _concept_.
> - `references/video-composition.md` — video-medium scale, depth, and foreground detail. It explains how to avoid empty web-page layouts without imposing a universal element count.
>
> Skipping these is the single biggest cause of generic, web-page-looking output. They are not optional rows in the routing table below — for anything beyond a one-line edit, open both before you choose colors or write HTML.

## Workflow

1. If a project has a design spec, **read it first** and treat its frontmatter tokens as brand truth (colors, fonts, spacing, tone, constraints). Which file to read (precedence `frame.md` → `design.md` → `DESIGN.md`) and how to parse it (frontmatter = normative, prose = context) are defined once in [`references/design-spec.md`](references/design-spec.md) — resolve and load per that doc.
2. If no design spec exists and the user asks for visual direction, choose a route:
   - Ready-made frame-preset (optional) → `frame-presets/` (adopt a `FRAME.md` as `frame.md`; see `references/design-spec.md`)
   - Named style or mood → `references/visual-styles.md`
   - Fast defaults → `references/house-style.md`
   - Interactive selection → `references/design-picker.md`
3. For multi-scene work, plan beats and rhythm before writing HTML → `references/beat-direction.md`. For scene transitions, jump to `hyperframes-animation/transitions/`.
4. For motion-heavy work, read `references/motion-principles.md` (high-level guardrails), then go to `hyperframes-animation` for atomic rules.

## Routing

| Topic                                                                                                   | Read                                           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Adopt a ready-made frame-preset as `frame.md` (optional)                                                | `frame-presets/` · `references/design-spec.md` |
| Default palettes, motion, typography, lazy defaults to question                                         | `references/house-style.md`                    |
| Named style presets, mood-to-style routing                                                              | `references/visual-styles.md`                  |
| Palette-specific color tokens                                                                           | `palettes/*.md`                                |
| Composition patterns — PiP, text-behind-subject, title card, slide show                                 | `references/composition-patterns.md`           |
| Stats / infographic presentation                                                                        | `references/data-in-motion.md`                 |
| Structured expansion for open-ended prompts                                                             | `references/prompt-expansion.md`               |
| Video-medium density, scale, color, frame composition                                                   | `references/video-composition.md`              |
| Per-beat direction, rhythm planning, transition timing                                                  | `references/beat-direction.md`                 |
| Post-authoring spec verification (colors, type, corners, spacing, depth)                                | `references/design-adherence.md`               |
| High-level motion guardrails and GSAP-quality rules                                                     | `references/motion-principles.md`              |
| Font selection, pairings, rendered-video type guardrails                                                | `references/typography.md`                     |
| Story doctrine — hook language, value-before-evidence, storyboard-as-proposal, source-traceable visuals | `references/story-spine.md`                    |
| Script pacing, tone, openings, number pronunciation                                                     | `references/narration.md`                      |
| Precomputed audio bands mapped to motion                                                                | `references/audio-reactive.md`                 |

## Scripts

- `scripts/contrast-report.mjs` — inspect contrast warnings from rendered frames.
- `scripts/extract-audio-data.py` — pre-extract audio bands for audio-reactive compositions.
- `scripts/package-loader.mjs` — support script for bundled creative tooling.

`contrast-report.mjs` resolves helper packages from the current project first, then can bootstrap the bundled HyperFrames package version. Set `HYPERFRAMES_SKILL_PKG_VERSION=<version>` only when running the skill outside the bundled CLI/skill install and you need to pin that bootstrap version explicitly.

Run from the repo root with explicit paths, for example:

```bash
python skills/hyperframes-creative/scripts/extract-audio-data.py <audio-file>
```

Animation analysis (`animation-map.mjs`) lives in `hyperframes-animation/scripts/`.

## Boundaries

- Do not override `hyperframes-core` technical rules.
- Do not require a design system for a minimal technical composition.
- Do not add extra scenes, narration, music, captions, or transitions unless the request calls for them or you first propose the expansion.
- Keep recipe references task-specific; do not read every reference for simple edits.
