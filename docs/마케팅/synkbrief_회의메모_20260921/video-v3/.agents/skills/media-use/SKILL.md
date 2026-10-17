---
name: media-use
description: Technical reference for media resolution, provenance, captions, and processing in an existing HyperFrames project. Follow current SYNK production and operating sources for provider, installation, cost, and publishing decisions.
---

> 기존 영상 수정·재현용 사본이다. 새 영상은 [제작 방식 선택](../../../../../콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 먼저 따르며, 아래 공급자의 신규 제작·자동 라우팅 예시는 그 선택을 대신하지 않는다.

# media-use

> SYNK 적용 범위: 기존 HyperFrames 작업본에 동봉된 공급자 기술 참고다. 이 프로젝트의 설치판은 0.8.58이며 아래 명령·무료 한도·성능·지원 버전은 이 PC에서 재검증된 사실이 아니다. 새 제작의 도구·음성·이미지 경로는 [제작 방식](../../../../../콘텐츠_제작방식_v2_20261002.md), 담당·설치·계정·비용·외부 발송·공개는 [AI 운영 원칙](../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 아래의 공급자 기본값이나 fallback을 SYNK의 자동 실행·결제·업로드 승인으로 해석하지 않는다.

The media OS for HyperFrames: resolve · generate · operate · remember — every media type, one skill, zero context noise.

기존 작업의 media-use 기능을 실제로 사용할 필요가 있을 때만 저장된 자산·설치 상태와 provider 분기를 확인한다. 공급자 설정 계약은 `references/setup-providers.md`에 있으며, 이 문서 열람이 가입·설치·생성 실행을 요구하지 않는다.

## Resolve — the one verb

```bash
node <SKILL_DIR>/scripts/resolve.mjs --type <type> --intent "<description>" --project <dir>
```

Returns one line: `resolved <id> → <path> (<type>, <metadata>)`. All search noise stays on disk.

| Type    | One-line intent                                                                     |
| ------- | ----------------------------------------------------------------------------------- |
| `bgm`   | background music (HeyGen catalog, 10k+ tracks)                                      |
| `sfx`   | sound effects (bundled 19-file library + catalog)                                   |
| `image` | photos, backgrounds (HeyGen asset search, 75k+ vectors)                             |
| `icon`  | icons, symbols (transparent)                                                        |
| `logo`  | official brand marks (svgl → simple-icons → GitHub avatar → favicon; never redrawn) |
| `voice` | TTS voiceover (HeyGen free-usage path; optional local Kokoro)                       |
| `grade` | measured correction candidate; broad polish/stylization follows Media Treatments    |
| `lut`   | user-provided or explicitly chosen reusable validated `.cube` file                  |

Before resolving fresh, list reusable candidates with `--candidates` and judge fit yourself — reuse rules, all flags, ingest (`--from`), and adopt are in `references/resolve.md`.

## Treat broad visual feedback as media intent

When a user explicitly asks to fix, polish, stylize, obscure, emphasize, or
reveal photographic media, read `references/media-treatments.md` even if they
do not name color grading or an effect. Inspect the real `<img>`/`<video>`,
choose one primary intent, then use deterministic persistence and verification.
Use a matching recipe as an optional tested seed, or inspect
`hyperframes media-treatment --capabilities --json`, then request one relevant
family/effect with `--capability <id>` and assemble a custom treatment from
canonical controls. Never load `--all` for ordinary authoring. A treatment may
compose correction, a preset, finishing, compatible shader effects, supported
keyframes, and optional Registry overlays. Add only source-justified bounded
tuning and compatible parts, never effects merely to make the result look more
sophisticated. Persist the final combined payload with
`hyperframes media-treatment`.

Use one progressively escalating workflow. For video, inspect one labeled
early/middle/late contact sheet rather than reading frames separately. Apply one
candidate and inspect one after-sheet for ordinary correction or polish.
Escalate to individual frames or moving draft evidence only when the result is
ambiguous, temporal, stylized, LUT-based, HDR/LOG-sensitive, private, or
brand-critical.

For ordinary correction or polish, persist the final treatment's
preset/adjustment JSON.
Do not generate a `.cube` LUT merely to encode exposure, shadows, contrast, or
warmth. Use a LUT only when the user supplies one or the selected treatment
explicitly owns one. `resolve --type grade --for ... --analyze` is measurement
evidence, not permission to replace the chosen treatment with a generated LUT.
Do not recreate supported vignette, grain, blur, pixelate, color, or treatment
effects with CSS/SVG overlays; that bypasses Studio controls and the canonical
preview/render shader path.

## Be proactive — run a media opportunity pass

The human usually can't tell which media would lift the piece. You can. When you build or review a composition, do **one** grounded scan and then **ask once** — don't silently add, and don't nag per asset.

Surface an opportunity only when a concrete signal is present:

| Signal detected                                          | Offer                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| On-screen text / a script with no voiceover              | TTS voiceover (audio engine)                                                                           |
| Emoji or a `<div>` styled as an icon                     | resolve real `icon`s                                                                                   |
| Image that is a placeholder, tiny, or upscaled-looking   | a better `image` (and/or upscale — see `references/operations.md`)                                     |
| Hard scene cuts / transitions with no sound              | transition `sfx`                                                                                       |
| A piece over ~10s with no music bed                      | `bgm`                                                                                                  |
| Footage that reads under/over-exposed or color-cast      | a corrective grade (inspect it with `hyperframes media-treatment --selector '#hero' --analyze --json`) |
| Photographic media that feels visually flat or off-topic | one specific source-appropriate preset or custom treatment, with the intended target named             |
| A meaningful media entrance/reveal that feels static     | one supported seek-safe treatment animation; preserve color unless the request also justifies a preset |

Rules that keep this a help, not nagware: **grounded, not generic** (no signal → no suggestion); **opinionated + concrete** (propose the specific fix with defaults chosen — the human approves **all / some / none**); **once per project** (one consolidated ask; respect "leave it"); **surface, never silently mutate** (color grades especially: propose and preview — a gray-world "correction" ruins an intentional sunset or neon look).

## Where to look — read only the file your task needs

| Task                                                                      | Read                             |
| ------------------------------------------------------------------------- | -------------------------------- |
| resolve / reuse / adopt / ingest, flags, cascade, inventory               | `references/resolve.md`          |
| color grading, LUTs, smart grade (`--for`), grade-compare                 | `references/grading.md`          |
| voiceover / TTS, music, SFX, captions, transcription (audio engine)       | `references/audio.md`            |
| cut / reframe / transform existing media, exact error diffusion, HEVC     | `references/operations.md`       |
| source-aware creative treatments, realtime effects, overlays, reveals     | `references/media-treatments.md` |
| install + auth, provider table, RAM ladders, `--local-only`, `--provider` | `references/setup-providers.md`  |
| remembered preferences + frozen recipes (user memory)                     | `references/memory.md`           |
| ownership matrix, usage stats, telemetry, privacy (maintainer-facing)     | `references/meta.md`             |
