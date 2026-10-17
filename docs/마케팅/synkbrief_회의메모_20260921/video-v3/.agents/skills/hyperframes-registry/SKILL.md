---
name: hyperframes-registry
description: Technical reference for searching, installing, and wiring registry blocks/components in an existing HyperFrames project. This local copy does not require global tool routing, feedback delivery, or upstream publishing.
---

> 기존 영상 수정·재현용 사본이다. 새 영상은 [제작 방식 선택](../../../../../콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 먼저 따르며, 아래 공급자의 신규 제작·자동 라우팅 예시는 그 선택을 대신하지 않는다.

# HyperFrames Registry

> SYNK 적용 범위: 기존 HyperFrames 작업본에 동봉된 공급자 기술 참고다. 이 프로젝트의 설치판은 0.8.58이며 아래 명령·무료 한도·성능·지원 버전은 이 PC에서 재검증된 사실이 아니다. 새 제작의 도구·음성·이미지 경로는 [제작 방식](../../../../../콘텐츠_제작방식_v2_20261002.md), 담당·설치·계정·비용·외부 발송·공개는 [AI 운영 원칙](../../../../../../AI_운영원칙.md)과 현재 요청을 따른다. 아래의 공급자 기본값이나 fallback을 SYNK의 자동 실행·결제·업로드 승인으로 해석하지 않는다.

The registry provides reusable blocks and components installable via `hyperframes add <name>`.

- **Blocks** — standalone sub-compositions (own dimensions, duration, timeline). Included via `data-composition-src` in a host composition.
- **Components** — effect snippets (no own dimensions). Pasted directly into a host composition's HTML.

## Quick reference

```bash
hyperframes add data-chart              # install a block
hyperframes add grain-overlay           # install a component
hyperframes add captions                # install every block tagged captions
hyperframes add shimmer-sweep --dir .   # target a specific project
hyperframes add data-chart --json       # machine-readable output
hyperframes add data-chart --no-clipboard  # skip clipboard (CI/headless)
```

After install, the CLI prints which files were written and a snippet to paste into your host composition. The snippet is a starting point — you'll need to add `data-composition-id` (must match the block's internal composition ID), `data-start`, and `data-track-index` attributes when wiring blocks.

The positional value is resolved as an exact item name first. If no item matches and the value is a tag, the command installs every block with that tag. Registry dependencies are installed before the requested item. `hyperframes add` works only for blocks and components; for examples, use `hyperframes init <dir> --example <name>` instead.

## Install locations

Blocks install to `compositions/<name>.html` by default. Components install to `compositions/components/<name>.html` by default.

These paths are configurable in `hyperframes.json`:

```json
{
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks": "compositions",
    "components": "compositions/components",
    "assets": "assets"
  }
}
```

See [install-locations.md](./references/install-locations.md) for full details.

## Wiring blocks

Blocks are standalone compositions — include them via `data-composition-src` in your host `index.html`:

```html
<div
  data-composition-id="data-chart"
  data-composition-src="compositions/data-chart.html"
  data-start="2"
  data-duration="15"
  data-track-index="1"
  data-width="1920"
  data-height="1080"
></div>
```

Key attributes:

- `data-composition-src` — path to the block HTML file
- `data-composition-id` — must match the block's internal ID
- `data-start` — when the block appears in the host timeline (seconds)
- `data-duration` — how long the block plays
- `data-width` / `data-height` — block canvas dimensions
- `data-track-index` — layer ordering (higher = in front)

See [wiring-blocks.md](./references/wiring-blocks.md) for full details.

## Wiring components

Components are snippets — paste their HTML into your composition's markup, their CSS into your style block, and their JS into your script (if any):

1. Read the installed file (e.g., `compositions/components/grain-overlay.html`)
2. Copy the HTML elements into your composition's `<div data-composition-id="...">`
3. Copy the `<style>` block into your composition's styles
4. Copy any `<script>` content into your composition's script (before your timeline code)
5. If the component exposes GSAP timeline integration (see the comment block in the snippet), add those calls to your timeline

See [wiring-components.md](./references/wiring-components.md) for full details.

## Discovery

Use the CLI as the primary discovery surface. **Search by intent before browsing:** the registry holds more items than you can scan by eye, so listing them and matching on names or tags is the slow path, and it fails whenever the author's wording differs from yours.

```bash
# Rank the whole catalog against what the beat should do
npx hyperframes catalog --query "reveal a headline one line at a time"
npx hyperframes add caption-clip-wipe
```

Search is local and sends nothing. By default it ranks on vocabulary shared with the item's name, title and description, so it only finds items that reuse your words; `--on-device` ranks by meaning instead, after a one-time model download. With `--json` the envelope names which tier answered, so check that rather than assuming a ranking happened.

**Always query in English, whatever language the video is in.** The catalog is written in English and both tiers index it that way (the on-device model is English-only too). A query in another script produces no searchable terms and returns nothing at all. This is easy to get wrong on a Japanese or Chinese project, where the brief, the captions and the narration are all in that language and the query naturally follows: describe the _move_ in English, then write the on-screen copy in whatever language the video needs. If a query does come back with `No searchable words in query`, that is this rule, not a missing component, and it is not worth a gap report.

Installability is applied after ranking, not before it: a name the vectors carry but this registry cannot serve is dropped from the results and counted in `dropped`, so a non-zero `dropped` means the two are different generations. See `/hyperframes-cli` for the offline tier, the consent gates, and how to refresh a stale index.

To browse or filter instead of search:

```bash
npx hyperframes catalog
npx hyperframes catalog --type block
npx hyperframes catalog --type component
npx hyperframes catalog --type block --tag social
npx hyperframes catalog --json
npx hyperframes catalog --human-friendly
```

The normal table and `--json` modes only list matches; install a selected name with `hyperframes add <name>`. `--human-friendly` opens an interactive picker and installs the selected item immediately. In CI or agent workflows, prefer `--json` followed by an explicit `add`.

### 검색 누락과 외부 feedback

검색 결과가 없으면 확인한 한계를 현재 작업 기록에 남긴다. 공급자의 `feedback --search-miss`는 검색어와 요청한 효과를 외부로 보내는 별도 기능이며, 검색 실패만으로 자동 실행하지 않는다. 사용자가 그 발송을 명시적으로 요청한 경우에만 다음 옵션을 참고한다:

```bash
npx hyperframes feedback --search-miss "<the query you ran>" --wanted "<the move you needed>" --tier on-device
```

`catalog --query`의 `report_gap`은 이 명령의 제안값일 뿐 실행 권한이 아니다. `--tier`는 실제 사용한 words/on-device 검색층을 나타낸다.

If the CLI cannot reach the configured registry, inspect the raw manifest as a fallback:

```bash
curl -s https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/registry.json
```

A registry the CLI cannot reach does **not** empty the catalog for **discovery**: a previously fetched manifest keeps serving past its 24h refresh window whenever revalidation fails, so `catalog` and `catalog --query` still list and rank against the last copy on disk.

**`add` still needs the network, even for an item you installed yesterday.** Only manifests are cached; the item's actual files are fetched on every install. So offline you can search, and you can see what an item is, but installing it fails at the file fetch. Do not promise a user an offline install.

Each item's `registry-item.json` contains: name, type, title, description, tags, dimensions (blocks only), duration (blocks only), and file list.

See [discovery.md](./references/discovery.md) for details on filtering by type and tags.

## Contributing a new block or component

To author a NEW registry item (caption style, VFX block, transition, lower third, or a reusable component) and ship it as an upstream PR — not install an existing one — follow the full idea → scaffold → build → validate → preview → ship workflow in [contributing.md](./references/contributing.md). Copy-paste starter templates (caption / VFX / component / `registry-item.json`) are in [templates.md](./references/templates.md).
