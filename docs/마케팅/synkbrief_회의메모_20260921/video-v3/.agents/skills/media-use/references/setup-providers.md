# Setup and providers — install, auth, RAM ladders, forcing a provider

> SYNK 적용 범위: 기존 HyperFrames 작업본에 동봉된 공급자 기술 참고다. 이 프로젝트의 설치판은 0.8.58이며 아래 명령·무료 한도·성능·지원 버전은 이 PC에서 재검증된 사실이 아니다. 새 제작의 도구·음성·이미지 경로는 [제작 방식](../../../../../../콘텐츠_제작방식_v2_20261002.md), 담당·설치·계정·비용·외부 발송·공개는 [AI 운영 원칙](../../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 아래의 공급자 기본값이나 fallback을 SYNK의 자동 실행·결제·업로드 승인으로 해석하지 않는다.

## Setup — 공급자 도구를 선택한 경우의 설정 참고

Install the HeyGen CLI through its [verified release instructions](https://developers.heygen.com/cli), then run:

```bash
heygen update             # free usage needs the OAuth-capable CLI (v0.3.0+)
heygen auth login --oauth # OAuth = free subscription credits; --api-key bills API credits
```

This unlocks the FREE path for bgm/sfx/image/icon catalog search, TTS (voice), and avatar videos. Sign in with `--oauth` — the free allowance rides on the OAuth session (an API key bills API credits instead). **media-use requires heygen >= v0.3.0 uniformly** (the OAuth free-usage path needs it), so `--doctor` nudges older CLIs to update even for API-key-only use. Before resolving anything, verify setup with:

```bash
node <SKILL_DIR>/scripts/resolve.mjs --doctor
```

## Providers

media-use holds no keys; every external tool owns its auth. Generation is
centered on the HeyGen CLI free-usage path. Install and authenticate `heygen`
before resolving bgm/sfx/image/icon/voice/avatar-video. Local tools are opt-in
alternatives where they exist: mflux for image, Kokoro for voice, Parakeet for
transcription, and LTX for local video generation. `resolve` spec-checks
AVAILABLE RAM for those local ladders (`describeModelLadder`); the agent can
see the ladder and override.

| Type      | Provider / path                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bgm/sfx   | heygen catalog free-usage path                                                                                                                                                |
| image     | heygen search free-usage path; optional local mflux; codex `image_gen` upsell                                                                                                 |
| voice     | heygen tts free-usage path; optional local **Kokoro** (free, on-device)                                                                                                       |
| icon      | heygen asset search free-usage path                                                                                                                                           |
| logo      | svgl, then simple-icons, then GitHub org avatar, then domain favicon (all free)                                                                                               |
| grade/lut | local core-preset map, params/CDN look index, deterministic `buildCube` fallback                                                                                              |
| video     | heygen avatar video free-usage path (sign-in nudge on auth failure); optional local LTX (`videogen` ladder). Image-to-video / photo-avatar / dub stay manual `heygen` recipes |

Local Kokoro (voice), mflux (image), and LTX (video) run on-device (free,
private, offline once cached). The `codex` CLI remains the ChatGPT-sub image
upsell. SYNK의 유료 호출·결제 판단은 위 AI 운영 원칙이 담당한다. 영상 제작 요청만으로 별도 유료 provider 호출이나 한도 우회를 승인받은 것으로 해석하지 않는다. `heygen.video`의 공급자 분류는 paid이며 무료 제공량을 소진할 수 있으므로 실행 전에 실제 계정·예상 비용을 확인한다.

To force a specific generator (e.g. a user says "make this image with codex"),
pass `--provider codex`: it pins resolution to that provider and skips the
free-usage default. See `references/operations.md` for the RAM ladders and
provider recipes.

`--local-only` skips every network provider, including the free HeyGen ones,
leaving the project + global cache and any installed local provider. For
HeyGen-only types, that means no fresh resolve.

## CLI tools used (what to run, and how to enable each)

`resolve` auto-cascades; each provider shells one CLI. HeyGen is the
free-usage path for bgm/sfx/image/icon catalog search, TTS (voice), and avatar
video, so those capabilities need `heygen` installed and authenticated. Local
tools are OPT-IN alternatives where they exist; install one to unlock its free,
private, on-device path instead of or ahead of HeyGen for that type. Only
`ffmpeg`/`ffprobe` are strictly required for the tool to run at all.

| Tool               | Serves                                                                          | Install                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ffmpeg`/`ffprobe` | adopt probing, smart-grade signalstats, cut, duck bake, loudnorm                | system package (`brew install ffmpeg`)                                                                                                        |
| `heygen`           | catalog (bgm/sfx/image/icon) + TTS (voice) + avatar video — the free-usage path | install through [verified HeyGen release instructions](https://developers.heygen.com/cli), then `heygen auth login --oauth` (needs >= v0.3.0) |
| `mflux-generate`   | local image gen (FLUX), best-for-RAM                                            | `uv venv ~/.venvs/mflux && VIRTUAL_ENV=~/.venvs/mflux uv pip install mflux==0.9.6`                                                            |
| `codex`            | image gen upsell (ChatGPT sub)                                                  | Codex CLI, logged in via ChatGPT (owns its own auth)                                                                                          |
| `parakeet-mlx`     | local transcription (default ASR, best)                                         | `uv venv ~/.venvs/parakeet && VIRTUAL_ENV=~/.venvs/parakeet uv pip install parakeet-mlx`                                                      |
| `ltx-2-mlx`        | local video gen                                                                 | `git clone https://github.com/dgrauet/ltx-2-mlx && cd ltx-2-mlx && uv sync --all-extras`                                                      |
| `npx hyperframes`  | Kokoro TTS (voice), whisper.cpp (transcribe fallback), remove-background        | via the hyperframes CLI; whisper.cpp is built on first use (Homebrew on macOS, else git+cmake), models download from HuggingFace              |

The RAM-graded local-model shortlist + exact per-tier install/invoke lives in
`scripts/lib/local-models.mjs` (the agent can read `describeModelLadder(cap, specs)`
to see which model fits this machine). Without a tool on PATH, its provider
prints a one-line diagnostic to stderr and resolve falls through where another
provider exists (e.g. no `mflux` -> codex image upsell; no `parakeet-mlx` -> whisper.cpp).

`heygen asset search` is a pre-launch command hidden from `heygen --help`, but it
runs; providers tag requests with the allowlisted `X-HeyGen-Client-Source` header
(v0.3.0+).
