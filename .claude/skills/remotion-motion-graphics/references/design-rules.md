# Design Rules — Color, Type, Pacing, Sound, Checklist

## Color system

> 🔴 **SYNK 판 — 원본의 「Proven palettes」 4벌을 지웠다(반입 08-26 · 같은 커밋).**
> 색 정본은 `docs/디자인_토큰.json` 하나다(유호 확정 08-26). 특히 원본이 권하던
> 「Warm editorial hero #D97757」은 SYNK 코랄 `#F96859` 과 **눈으로 구분이 안 된다** —
> 킷 밖 색인데 비슷해서 더 위험하다. 값은 `영상/src/킷/색.ts` 에서만 꺼낸다.

원본이 준 «구조»는 그대로 쓴다 — 값이 아니라 배분이라 킷과 안 부딪힌다:
하나의 바탕 + **주연색 하나** + 조연 하나 + 중립. 60/30/10 으로 나누고,
주연색은 **한 프레임에 최대 한 요소**에만 얹는다 — 그것이 시선을 이끈다.

SYNK 에서 그 자리를 채우는 것(값은 킷이 쥔다):
- 바탕 = `시맨틱.바탕`(Paper) · 글자 = `시맨틱.잉크`(Ink) — **순백·순검정은 금지다**
- 주연 = 코랄. 단 **코랄은 «면»이다** — 종이 위 «글자»로 쓰지 않는다(대비 2.75).
  큰 글자가 필요하면 그 실의 Deep(`Coral 3`)을 쓴다.
- 조연 = 실 하나 더까지. **한 화면의 유채 실은 «주연 1 + 조연 1» 둘까지**가 킷 철칙이다.
- ⏳퇴역 대기 12색(Chalk·Graphite·Ash·Lime·Emerald)과 K-Culture 4색은 새 산출물에 안 쓴다 —
  `영상/src/킷/색.ts` 가 이 둘을 부르면 **던진다.**

Glow on the hero element only:
`boxShadow: 0 0 60px ${hero}66, 0 0 120px ${hero}33` (text: textShadow).
More than one glowing element per frame = Vegas. Don't.

## Typography

> 🔴 **SYNK 판 — 원본의 서체 지정(Clash Display·Cabinet Grotesk·General Sans·Satoshi)을 지웠다.**
> 폰트 정본은 `docs/브랜드_폰트/` 이고 등록은 `영상/src/킷/폰트.ts` 한 곳에서만 한다.
> ⚠ `@remotion/google-fonts` 로 받지 않는다 — 렌더 시점에 망을 타고, 예제가 `subsets:["latin"]`
> 이라 **몽골 키릴(Өө Үү)이 조용히 빠진다**(이 저장소가 이미 한 번 겪은 사고다).
> ⚠ 한 폰트로는 한·몽 병기가 원리상 안 된다 — SUIT 는 키릴 0/7, Inter Tight 는 한글 0/4다.

- Hero text: 한글은 **SUIT**, 라틴·키릴은 **Inter Tight**. 웨이트는 토큰 `서체.웨이트`
  (헤드 800 · 태그라인_한글 900), 자간은 `서체.트래킹.헤드_태그라인`(-0.04em), lineHeight 1.05~1.25.
- Reels hero size: 80–140px at 1080 wide. Landscape: 100–160px at 1920.
- Body/captions: a clean sans (Inter/system) at 400–500, dimmed color.
- Highlight ONE word per headline: hero color, animated underline, or a pill
  scaling in behind it 5 frames after the word lands.
- Numbers: animated counters with tabular-nums (see motion-patterns §9).

## Scene architecture
30s Reel structure:
```
0.0–1.5s  HOOK    boldest visual + claim. Movement within the FIRST 15 frames.
1.5–3.0s  CONTEXT one line, one visual, still moving.
3–22s     BODY    3–4 beats. Each beat: HIT -> hold (15–20 still frames) -> build.
22–27s    PAYOFF  the result/number/demo. Biggest animation of the video.
27–30s    CTA     one action, calm, glow on the CTA word.
```
- New visual element at least every 90 frames.
- Holds are a design tool: fast move -> complete stillness -> next move.
  Constant motion reads amateur; contrast reads expensive.
- 9:16 safe zone: critical text inside the middle ~75% vertically (platform UI
  covers top and bottom).
- 5s logo stings: mark in (0–0.8s) -> wordmark (0.6–1.8s) -> detail/tagline
  (2–3.5s) -> breathe -> exit (last 0.5s).

## Sound design (50% of perceived quality — never deliver silent unless asked)
- Every entrance HIT: short whoosh/click starting 2–3 frames BEFORE the visual
  lands (early feels synced; late feels broken).
- Transitions: riser into the cut, bass hit ON the cut.
- Counters: soft tick loop while counting.
- Music bed at low volume (~0.2–0.3), ducked further under VO.
- Pick music FIRST when possible; compute framesPerBeat = fps*60/BPM and place
  cuts on beats.
- Free SFX sources to suggest: Pixabay, Mixkit, freesound.org. A 10-file kit
  covers everything: 2 whooshes, 2 clicks, riser, bass hit, shimmer, tick, pop,
  reverse-swoosh.

## Asset generation guidance (when user generates images for the video)
Lock a prompt skeleton, vary only the subject, keep lighting + palette words
identical across the set, generate at final aspect ratio:
```
[subject], cinematic product photography, dark moody studio, [hero color] rim
lighting, deep shadows, shallow depth of field, 9:16
```

## Render settings
- Masters for upload: `--codec h264 --crf 16` (platforms re-compress; give headroom)
- Heavy transparency/blur stacks: add `--image-format png`
- Preview suspicious motion at 0.25x in Remotion Studio — easing flaws invisible
  at 1x are obvious at quarter speed.

## PRE-DELIVERY CHECKLIST — run against every video before presenting it
- [ ] Zero linear easing anywhere; every interpolate clamped
- [ ] Entrances = 2–3 properties, staggered; nothing enters simultaneously
- [ ] Exits animated, faster than entrances
- [ ] Every still has Ken Burns; fast moves have motion blur
- [ ] 5-layer stack present (bg mesh, assets, graphics, grade, grain+vignette)
- [ ] One hero color, ≤1 hero-colored/glowing element per frame
- [ ] Display font ≥600 weight on heroes; no default-font hero text
- [ ] Pixel gaps (not em) between large text blocks
- [ ] Holds exist: ≥3 moments of stillness
- [ ] SFX on major hits, cuts on beat (if audio in scope)
- [ ] Text inside safe zone; nothing touching frame edges
- [ ] Rendered, frames extracted with ffmpeg, every extracted frame visually
      inspected, issues fixed, re-rendered, re-inspected
