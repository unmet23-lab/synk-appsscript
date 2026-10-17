# Ownership matrix, usage stats, telemetry, privacy

> SYNK 적용 범위: 기존 HyperFrames 작업본에 동봉된 공급자 기술 참고다. 이 프로젝트의 설치판은 0.8.58이며 아래 명령·무료 한도·성능·지원 버전은 이 PC에서 재검증된 사실이 아니다. 새 제작의 도구·음성·이미지 경로는 [제작 방식](../../../../../../콘텐츠_제작방식_v2_20261002.md), 담당·설치·계정·비용·외부 발송·공개는 [AI 운영 원칙](../../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 아래의 공급자 기본값이나 fallback을 SYNK의 자동 실행·결제·업로드 승인으로 해석하지 않는다.

Maintainer-facing reference. Nothing here changes how you resolve or operate on media.

## What it owns (the gaps HyperFrames leaves)

HyperFrames owns media _playback_; media-use owns everything else. Each row is enforced by `scripts/lib/coverage.test.mjs` so the claim can't rot.

| HyperFrames gap                            | media-use owns it via                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio-only, no image/icon                  | `resolve --type image\|icon` (heygen asset search)                                                                                                                                                                                                                                  |
| No third-party brand logos                 | `resolve --type logo` (svgl → simple-icons → GitHub org avatar → domain favicon)                                                                                                                                                                                                    |
| No voice / audio generation                | `resolve --type voice` (HeyGen TTS free-usage path; optional local Kokoro) + the audio engine (`audio/scripts/audio.mjs`)                                                                                                                                                           |
| Scattered/duplicated audio engine          | one consolidated engine under `audio/` (hyperframes-media retired)                                                                                                                                                                                                                  |
| No agent media-ops (cut/reframe/transform) | `references/operations.md` + `resolve --from` to register outputs                                                                                                                                                                                                                   |
| No transcript-driven cutting               | `scripts/transcript-cut.mjs` compiles word-timestamp edits into cut lists                                                                                                                                                                                                           |
| No auto-duck / publish loudness            | `scripts/audio-duck.mjs` + `references/operations.md` loudnorm/sidechain recipes                                                                                                                                                                                                    |
| No cross-project memory                    | global content-addressed cache + auto-promote (`~/.media`)                                                                                                                                                                                                                          |
| Grade recipes and LUT freezing             | `resolve --type grade` emits a paste-ready recipe and `resolve --type lut` freezes validated `.cube` files; direct element analysis/authoring lives in `hyperframes media-treatment`                                                                                                |
| No image generation                        | RAM-graded local mflux (FLUX) via `scripts/lib/mflux-provider.mjs`, codex `image_gen` upsell (`scripts/lib/codex-provider.mjs`)                                                                                                                                                     |
| No video generation                        | `resolve --type video` — HeyGen avatar video first (free-usage path, sign-in nudge on auth failure), local LTX fallback (`videogen` in `scripts/lib/local-models.mjs`); image-to-video, photo-avatar, dub/translate remain manual `heygen` CLI recipes (`references/operations.md`) |
| Weak local-model defaults                  | HeyGen free-usage path via the `heygen` CLI; local open-source tools only as opt-in alternatives (`scripts/lib/local-run.mjs`)                                                                                                                                                      |

## Usage stats

Use `resolve --stats` for a local, shareable report over the current project's `.media/` manifest, the global `~/.media/` cache, and local resolve misses. Human output is compact; add `--json` for a single machine-readable object, and `--days N` to window timestamped records.

```bash
node <SKILL_DIR>/scripts/resolve.mjs --stats --project . --days 7
# media-use stats
# total resolves: 12
# misses: 2
# hit rate: 86%
```

## Telemetry

`resolve` and the edit tools (transcribe / transcript-cut / audio-duck) send an
usage event to PostHog (`scripts/lib/telemetry.mjs`), so we can see
which capabilities are actually used. It records only the media TYPE, the
resolution SOURCE, and the winning PROVIDER: never the intent text, file names,
or paths. 이 공급자 설명의 `$ip:null` 설정만으로 네트워크 수신자의 모든 로그에 IP가 남지 않는다고 보장하지 않는다. 아래 Privacy처럼 로그인 뒤 계정과 연결될 수 있다. Best-effort and non-blocking (a
resolve never waits on or fails from telemetry).

Opt out with `DO_NOT_TRACK=1` or `HYPERFRAMES_NO_TELEMETRY=1` (also off in CI and
dev). Same public PostHog project key and opt-outs as the `hyperframes` CLI.

HeyGen request tagging: every generating `heygen` call (TTS, avatar video, catalog
search) carries the allowlisted `X-HeyGen-Client-Source: media-use` header, sourced
from one shared constant (`HEYGEN_CLIENT_SOURCE_ARGV` in `scripts/lib/heygen-cli.mjs`)
so a future call site can't silently ship untagged. Read-only discovery calls
(`voice list`, `avatar list`) are intentionally left untagged.

## Privacy

media-use uses the same shared install id as the `hyperframes` CLI/studio
(`~/.hyperframes/config.json`). When you are signed in to HeyGen, usage is
linked to your account email, or username when email is unavailable, matching
the CLI behavior. The events stay coarse: media type, source, provider, and
small counts only; intent text and paths stay local. Disable telemetry with
`HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1`.
