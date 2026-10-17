---
name: general-video
description: "Technical reference for editing or reproducing an existing HyperFrames composition with a companion flow or custom multi-scene layout. Do not route new SYNK video requests to HyperFrames; choose the production method from the current canonical source first."
---

> 기존 영상 수정·재현용 사본이다. 새 영상은 [제작 방식 선택](../../../../../콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 먼저 따르며, 아래 공급자의 신규 제작·자동 라우팅 예시는 그 선택을 대신하지 않는다.

# General video

> SYNK 적용 범위: 기존 HyperFrames 작업본의 기술 참고 자료다. 이 폴더의 프로젝트 의존성은 `hyperframes 0.8.58`이며 아래 공급자 문서의 모든 명령이 그 버전에서 지원된다는 뜻은 아니다. 새 제작 방식은 [SNS 키트](../../../../../../디자인/SNS키트/README.md), 담당·설치·인터넷 접근·비용·외부 발송·공개 범위는 [AI 운영 원칙](../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 공급자의 필수 라우팅·자동 업그레이드·피드백 전송·고정 승인 절차를 전역 지침으로 적용하지 않는다. 현재 요청이 로컬 렌더를 포함하면 별도 고정 승인을 다시 요구하지 않는다.

기존 프로젝트 수정에 필요한 원문을 먼저 사용한다. 현재 작업상 설치·갱신이 필요한 경우에만 공통 운영 원칙에 따라 아래 공급자 명령을 검토한다:

```bash
npx hyperframes skills update general-video
```

갱신을 실행했다면 결과와 실패 범위를 확인한다. 이 안내를 읽는 것만으로 자동 설치·업그레이드하지 않는다.

## 1. Apply cross-cutting source adapters

- **Media:** For any audio, image, icon, logo, voice, grade, LUT, treatment/effect, caption, or media-operation need, load `/media-use` and follow `../media-use/references/resolve.md` (resolve, adopt, reuse) and `../media-use/references/setup-providers.md` (providers, auth). Vague footage feedback and named styles use `../media-use/references/media-treatments.md` before editing; do not improvise supported media effects with CSS/SVG/opacity. Before the first authenticated provider action, 필요한 인증 상태만 확인하고 자격증명·개인 식별 정보가 담긴 출력을 그대로 전달하지 않는다. 공급자 인증 확인 명령은 `npx hyperframes auth status`다. If signed out, apply the gate in `../hyperframes/references/brief-contract.md`: collaborative waits for sign-in or an explicit offline choice; autonomous states the status and continues through an available offline provider. Surface a blocker when no offline provider can satisfy a required capability. Local adoption alone does not require an auth gate.
- **Figma:** If any input is a `figma.com` URL, run `/figma` first. Build from its exported assets, tokens, components, or storyboard frames. Do not use raw Figma connector calls because they skip SVG sanitization, media provenance, and brand-token binding.

These adapters do not change the workflow selected by `/hyperframes`.

## 2. Start from project state

Apply the first matching row; do not evaluate lower state rows:

| State                                                      | Action                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Specific edit                                              | Make the edit, preserve existing project decisions, then rerun affected checks. Do not reopen discovery.       |
| `BRIEF.md` exists                                          | Read it. If `workflow` names another workflow and `flow` is not `companion`, hand off. Ask no brief questions. |
| No brief, but `hyperframes.json` or `STORYBOARD.md` exists | Resume from files and recorded preferences. Backfill `BRIEF.md` only from known facts.                         |
| Fresh creation                                             | Run `/hyperframes` and its intent layer. Return here only for `workflow: general-video` or `flow: companion`.  |

For a new project, choose a kebab-case directory name from the brief and scaffold before writing the brief:

```bash
npx hyperframes init "videos/<project>" --non-interactive --example=blank --skill=general-video
```

Then write `BRIEF.md` at the project root using `../hyperframes/references/brief-format.md`. In an existing project, the root is the directory containing `hyperframes.json`. Record only the confirmed preference-backed fields named by the brief format, using `node <MEDIA_DIR>/scripts/prefs.mjs record --hyperframes <PROJECT_ROOT>`; never record inferred defaults. Here `<MEDIA_DIR>` is the installed `/media-use` skill directory and `<PROJECT_ROOT>` is the directory containing `hyperframes.json`. If the intent layer adopted a recipe, apply it now with `node <MEDIA_DIR>/scripts/recipe.mjs use --hyperframes <PROJECT_ROOT> --name <name>` and do not ask again.

## 3. Interpret the run shape

Use only the canonical terms from `../hyperframes/references/brief-contract.md`:

| Field          | Meaning                               | Effect                                                                              |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `flow`         | Who drives                            | `automation`: choose and execute the route. `companion`: co-create in conversation. |
| `storyboard`   | Plan, sketch, and review before build | `yes`: run plan and sketch review (`storyboard.html`). `no`: build without it.      |
| derived `mode` | How checkpoint gates behave           | Follow the brief contract. Never ask the user to name a mode.                       |

Do not invent synonyms for these states. An ongoing “just build it” signal is handled by the intent layer and arrives as `flow: automation`, `storyboard: no`.

- For `flow: automation`, choose the route and state it in one line in the first progress update.
- For a specific edit, make the edit without inventing a new route.

For a hard cut, trim, splice, or reorder of existing footage, duplicate the same
video source into multiple clip elements. On each copy, set the source range
with `data-media-start` plus `data-duration`, then set authored placement/order
with `data-start`. Separately authored audio follows the identical clip ranges
and timing on matching `<audio>` elements. `/hyperframes-core` owns this temporal
edit; use `/hyperframes-keyframes` only for visual-property animation such as
zoom, punch, pan, crop, mask, or `clip-path` on an inner wrapper.
Copy the full contracts from `../hyperframes-core/references/creator-editing-recipes.md`.

### Companion flow

When `flow: companion`:

- Read `BRIEF.md` and reconcile accepted `## Assets` and `## Customizations` with project artifacts. Complete accepted work that is still pending; leave completed work alone; do not offer an accepted capability again as if it were new.
- **Arrive as the director, not the contractor.** A user who chose companion chose involvement and quality; the honest response is the best version you can design, not the smallest one you can defend. The first plan is the ceiling treatment: the story arc (borrow the nearest genre lens — menu § Genre lenses), the design spec, each scene's motion treatment cited by name (§ 5's plan discipline), the transitions, the audio identity — music and sound marks, or deliberate silence — the user's material placed, and a designed open and close. Say what each layer adds in one line; flag the expensive ones (render time, sign-in, billing) as you name them. The user trims a treatment down; they should never have to assemble one approval by approval.
- **The ceiling belongs to the concept, not the toolbox.** Every layer must serve the brief's message — a treatment that would dress any video the same way is decoration. Craft rises to the ceiling; content never grows past what was asked (§ 6).
- Between checkpoints, `../hyperframes/references/capability-menu.md` works two ways. As the trigger list: offer a relevant capability when the user mentions its input or the build reaches its need. As each pass's upgrade channel: a plan, sketch, or build checkpoint may carry one or two traced offers pointed at material the user is looking at ("scene 3's stat wants the count-up treatment"). Read it before offering; never dump the full catalog.
- After the user accepts a capability, produce its artifact and record the decision in the matching `BRIEF.md` body section immediately. Rewrite a frontmatter field and record the confirmed preference only when the user explicitly changes it.
- Keep the same storyboard, validation, final-preview, and render-approval gates. Companion changes who steers, not what quality requires.

## 4. Load required knowledge before each stage

These reads are mandatory when their condition matches:

| Condition                                                                                                         | Read before acting                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any composition HTML or scene layout                                                                              | `/hyperframes-core`; use `references/determinism-rules.md` for its layout contract                                                                                                                                                     |
| Any non-trivial creation or visual treatment                                                                      | `/hyperframes-creative` → `references/house-style.md` and `references/video-composition.md`                                                                                                                                            |
| Any motion, animation, or scene transition                                                                        | `/hyperframes-animation`; follow its routing to the matching rules, adapters, blueprints, or transition references                                                                                                                     |
| `storyboard: yes`                                                                                                 | `../hyperframes/references/storyboard-format.md` and `../hyperframes/references/review-loop.md`                                                                                                                                        |
| Any media asset or operation, including narration, BGM, SFX, captions, grading, or transforms                     | `/media-use`; for framework playback and placement also read `/hyperframes-core` → `references/variables-and-media.md`                                                                                                                 |
| Multi-scene assembly                                                                                              | `../hyperframes/references/production-loop.md`                                                                                                                                                                                         |
| `flow: companion`, before the first plan                                                                          | `/hyperframes-creative` → `references/story-spine.md` and `references/house-style.md`; the nearest genre lens and the full `../hyperframes/references/capability-menu.md` — the ceiling treatment is designed from these, not recalled |
| A companion capability offer, capture, beat grid, generative video, map, publishing, or cross-workflow capability | `../hyperframes/references/capability-menu.md`                                                                                                                                                                                         |
| A design spec exists, before final approval                                                                       | `/hyperframes-creative` → `references/design-adherence.md`                                                                                                                                                                             |

Do not replace these reads with recollection. Progressive disclosure saves context only when the matching reference is actually loaded.

## 5. Execute the composition

Use this dependency order. Skip a stage only when its input is absent.

1. **Plan.** State the viewer arc, structure, rhythm, and duration driver. Use one file for a short single scene; use sub-compositions for three or more hard scene cuts or any reused scene. Read `/hyperframes-creative` → `references/story-spine.md` for narrated arcs, `references/beat-direction.md` for rhythm, and `/hyperframes-core` → `references/composition-patterns.md` for structure. For an open-ended multi-scene brief, expand the prompt through `/hyperframes-creative` → `references/prompt-expansion.md`. A multi-scene plan cites each scene's shape: a blueprint id from `/hyperframes-animation` → `blueprints-index.md` when one fits, or the named rules it composes from `rules-index.md` when none does — motion names come from those indexes, never invented. Story truth decides which scenes exist; the citation dresses them. **Search the live catalog before you plan to build any named look yourself**: for every look, effect, treatment or transition the brief names — "CRT scanlines", "glitch", "film grain", "shimmer sweep", "confetti burst" — run `npx hyperframes catalog --query "<the look, in plain English>" --json` and read the top results before the plan names how that look gets built. The search needs **nothing installed**: no project, no prior `add`, no account. It ranks the whole hosted registry (~400 blocks and components) from any directory, so it also applies to a look the user asks for mid-build. Blocks the plan names are installed at stage 3; hand-author a look only after a search for it came back with nothing that fits. A multi-scene plan is also recorded as the dispatch artifact: one `## Frame N` block per scene in `STORYBOARD.md` — `status: outline`, a declared `src:`, the blueprint/rules citation, and the beat text — **even when `storyboard: no`**. The block is the dispatch unit; the storyboard sheet is only the review surface.
2. **Review the plan when requested.** For `storyboard: yes`, run the shared review loop over those blocks. For `storyboard: no`, continue without a plan pause or sketch sheet. When a plan pause happens anyway, fold the sub-agent delegation grant (needed by codex for step 4's dispatch) into that pause rather than stopping again later.
3. **Resolve dependencies.** Install registry blocks before parallel work. Stage user assets, adopt existing media, and resolve only what the brief requires. Start audio early when its timings drive duration.
4. **Build scenes.** For a short single-scene piece, implement the scene at its most visible moment before adding motion (the confirmed wireframe, when present, is that end state and must not be redrawn), then animate from its cited blueprint or rules — read the full recipe body (`/hyperframes-animation` → `blueprints/<id>.md`, `rules/<id>.md`) before writing motion.

   **Dispatch pays for itself only at scale.** Authoring packets and warming fresh worker contexts costs real minutes and tokens: a film of up to ~6 short scenes builds FASTER inline, in this context, one scene after another (measured: 5 short scenes ≈ 9 min inline vs ≈ 21 min packetized). Fan out only when the plan exceeds that — more scenes, or individually heavy ones — and then give each worker **2–3 scenes**, not one, and spawn **all workers in a single wave** (a second wave nearly doubles the window). When dispatching:

   `node <SKILL_DIR>/scripts/frame-packets.mjs --project "$PROJECT_DIR" --storyboard "$PROJECT_DIR/STORYBOARD.md"`

   The builder writes one bounded packet per scene under `.hyperframes/frame-packets/` (the scene's exact storyboard block + the blueprint body + every cited rule recipe, inlined) and `_role.md` (`../hyperframes/references/frame-worker-core.md` + this skill's `sub-agents/frame-worker.md`, concatenated verbatim — the complete worker role). Dispatch the workers — 2–3 scene packets each, all in one wave (`../hyperframes/references/subagent-dispatch.md`); each worker's prompt carries `_role.md` and its packets — paste them in full, or hand the file paths for the worker to read first (equivalent either way) — plus a dispatch context with `PROJECT_DIR`, its `frame_id`s, and canvas size. WAIT on every scene's `compositions/<frame_id>.html` + `compositions/<frame_id>.motion.json`. Workers read only their packets and the design truth file; they never open `STORYBOARD.md` or the skill documents. With no delegation channel, fall back serially: process one packet at a time in this context, still working from the packet alone.

5. **Merge motion sidecars.** Collect the workers' `compositions/<frame_id>.motion.json` files and carry their durations and exit/entry vectors into assembly; where the doctrine chain (`/motion-doctrine`) is installed, translate them into the project ledger before stamping seams.
6. **Assemble.** Mount scenes, media, transitions, captions, and audio using the production loop. Real voice duration overrides estimates. When a music bed plays under any voice track, carve the bed before verifying: `/hyperframes-audio` → `scripts/carve.mjs --comp index.html`. A volume duck alone does not finish the mix.
7. **Verify.** Use `npx hyperframes lint` for fast feedback after the first HTML pass and structural changes. For the final gate, run `npx hyperframes check`; it reruns lint internally, so do not run a redundant standalone lint immediately before it. For sub-compositions, inspect midpoint snapshots. For multi-scene work, review the animation map.
8. **Final approval.** Open the final Studio preview only after checks pass. Ask whether to render or revise. Render only after approval.

## 6. Gates that always apply

### Keep scope exact

Build what the user asked for. A title card is not a title card plus three scenes, music, and captions. Offer additions before adding them.

### Establish design before HTML

Resolve the design source in this order: `frame.md` → `design.md` → `DESIGN.md`. Treat the first file found as brand truth.

When no design spec exists, complete all four items before writing composition HTML:

1. Ground the visual identity in `house-style.md` and `video-composition.md`.
2. Write one sentence naming the concept angle for every non-trivial creation.
3. Choose an embeddable font pairing from `/hyperframes-creative` → `references/typography.md`; do not assume an unbundled display font exists in cloud rendering.
4. Define the focal element, edge anchors, supporting detail, and background treatment.

Match density to the requested format and message. Density examples are guidance for produced frames, not permission to invent claims, scenes, or a fixed number of elements.

For a named style or mood, read `/hyperframes-creative` → `references/visual-styles.md`. When the user needs to choose visually and no shipped preset fits, read `/hyperframes-creative` → `references/design-picker.md` and run the interactive design selection there.

### Preserve the composition contract

Timed elements use `class="clip"`; the root and relevant ancestors are sized; each composition registers one paused, seek-safe timeline on `window.__timelines`; rendering is deterministic. Do not use render-time network fetches, clocks, or unseeded randomness.

### Borrow workflows safely

When the piece resembles a shipped workflow, borrow its genre references as examples. 기존 원문을 먼저 읽고, 설치가 현재 작업 범위에 필요할 때만 `npx hyperframes skills update <workflow-name>`를 검토한다. Borrow its story shape and taste, not its private scripts, pipeline state, or directory contract. The generic build remains owned by this skill.

## 7. Done

A run is complete only when:

- requested scope is implemented;
- for `flow: companion`, the treatment is delivered, not just the scope: every scene's cited blueprint or rules realized, the audio identity present (or the silence chosen and said), the open and close designed rather than defaulted;
- `npx hyperframes check` passes, including its built-in lint stage;
- design adherence is reviewed against `/hyperframes-creative` → `references/design-adherence.md` when a design spec exists;
- contrast findings are resolved;
- sub-composition snapshots are inspected when applicable;
- an autonomous handoff includes an inspected contact or snapshot sheet; multi-scene sheets use scene midpoints;
- the handoff names the final preview or rendered artifact as applicable and reports the actual duration for a time-based deliverable;
- `hyperframes-animation/scripts/animation-map.mjs` is reviewed for multi-scene work;
- the user approves the final Studio preview before render;
- the rendered file is verified when a render was requested.

After final approval, offer once to freeze the run as a recipe, following `../hyperframes/references/review-loop.md` § 4.
