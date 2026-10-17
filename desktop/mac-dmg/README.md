# SYNK Platform Preview — Signal Mac DMG window

This is the **2026-10-13, 0.4.3 packaging record**, including its pinned source files and historical reproduction commands. For the current public release, installed version and release workflow, start from [the desktop README](../README.md) and [LIFECYCLE](../LIFECYCLE.md). The old homepage targets and pinned versions below are not instructions to replace the current release.

This directory repackages the published Mac Platform Preview **0.4.3** DMGs (Apple silicon and Intel) with the Signal DMG window. The DMG window revision is **mac-signal.1** (2026-10-13). The application bundle `SYNKPlatformPreview.app` is copied out of the pinned public DMG and placed in the new DMG byte for byte: every file, permission and symbolic link is compared before and after, and the ad-hoc signature is verified with `codesign --verify --deep --strict`. Only the DMG window and the file name change.

The window follows the platform Signal 2 grammar (`docs/디자인/플랫폼_시그널/README.md` in the SYNK design repository): the lapis platform surface with studio light and grain, a mono `SYNK · PLATFORM · 0.4.3` label, a tilted `끌어서 설치` sticker, a white arrow from the app to Applications and a Korean instruction that also says where to find **그래도 열기** (Open Anyway) for this unnotarized Preview. Finder draws the icons (112 pt) and their names (13 pt). Finder counts its title bar (28 pt on macOS 15) inside the window height stored in the DMG, so the background is 660 × 448 pt: the design occupies the top 660 × 420 pt and the bottom 28 pt only continues the surface. Finder draws the icon names in black in both light and dark mode, so each name sits on a white pill. These sizes were measured in the real Finder window on the macOS 15 runners (Apple silicon and Intel).

| File | Purpose |
| --- | --- |
| `background.html` | Design source of the window background (660 × 448 pt, content in the top 420 pt), set in SUIT and DM Mono from the SYNK design repository (`docs/브랜드_폰트`). |
| `make-background.mjs` | Renders `background.png` (1×) and `background@2x.png` (2×) with Playwright. electron-builder combines them into a Retina TIFF. |
| `repackage.cjs` | Downloads the pinned DMG and checks its size and SHA-256, copies the app out, builds the new DMG with electron-builder's prepackaged DMG target, then mounts it read-only and checks the app tree, signature, Applications link, background and Finder layout file. `--shots` also opens the window in Finder in light and dark mode, and the published DMG's window for comparison, and saves screenshots. |
| `release.cjs` | Used by the release job: checks both DMGs against the records of one build run and writes the checksum file, manifest and release notes. |

Pinned originals, from [platform-preview-0.4.3-20261012](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.3-20261012):

- `SYNK-Platform-Preview-0.4.3-mac-arm64.dmg`: **457,408,094 bytes**, SHA-256 `e0796502af692e386aa28dacfae2492b1ca30e6241435213e4a73521cc32a28a`
- `SYNK-Platform-Preview-0.4.3-mac-x64.dmg`: **475,085,655 bytes**, SHA-256 `28919a62be30fb86733356ab7636c20b20f5257571eb7aa704f6b0946afbb333`

## Reproduce

Run `.github/workflows/desktop-macos-dmg-signal.yml` with `workflow_dispatch` (architecture `both`). Each job uses a native macOS 15 runner, installs the pinned build tools from `../package-lock.json` (electron-builder **26.15.3**) and runs:

```sh
cd .github/desktop-preview
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
node mac-dmg-signal/repackage.cjs --arch=arm64 --shots
```

Outputs are `out/<arch>/SYNK-Platform-Preview-0.4.3-Signal-mac-<arch>.dmg`, `SHA256SUMS-mac-signal.1-<arch>.txt` and `mac-dmg-mac-signal.1-<arch>.json`, with screenshots in `shots/<arch>/`. The DMG container records its build time, so a rebuild gives a different DMG checksum while the application tree checksum stays the same. No signing or notarization credentials are used, and the script never installs or publishes anything.

To publish, dispatch the workflow again with `release_from_run` set to the id of the build run that was checked. The release job downloads that run's DMGs, checks them against its records and creates the prerelease.

## WORLD and Workspace DMGs inside the Platform (signal.3)

`repackage.cjs --product=world|messenger` gives the 0.4.1 WORLD and Workspace DMGs that the Platform installs their own Signal windows: coral with dark type (`background-world*.png`) and ink with light lapis type (`background-messenger*.png`), the platform web `--face`/`--on-face` values, with 「WORLD를·워크스페이스를 Applications 폴더로 끌어 놓으세요」 and a line that sends the user back to **설치 상태 확인** in the Platform. The apps inside are the pinned public bytes: every file is compared, and the executable and `app.asar` are checked against the 0.4.3 Platform's pins in `../platform-performance/manifest.json`. `--source=<DMG>` repackages a DMG built in the same job instead of a published one, and `--revision` names the output.

`build-platform-children-mac.cjs` (workflow `desktop-platform-signal-children.yml`, native macOS 15 runners) then rebuilds Platform 0.4.3 exactly like `../build-platform-performance.cjs` — frozen 0.4.1 sources, the 0.4.3 performance overlay, `build.cjs` `buildClient`, the Intel graphics loader on x64 — with those DMGs as `Contents/Resources/clients/world.dmg` and `messenger.dmg`. It writes the deliverables in the public 0.4.3 shape so `../qa/run-macos-qa.cjs --scope=platform` checks the mounted DMGs and the native Platform, and finally repackages the new Platform DMG with the Signal window (revision **signal.3**). The Platform app is rebuilt and ad-hoc signed again, so its bytes are not those of the public 0.4.3 Mac app; its sources, overlay and child apps are. A dispatch with `release_from_run` drafts the prerelease from the DMGs that run checked (`release-children.cjs`); the Windows installer from `../signal-installer/` is added before it is published.

## Published

[platform-preview-0.4.3-mac-signal.1-20261013](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.3-mac-signal.1-20261013) (prerelease, 2026-10-13) holds the DMGs built and checked by [run 38296456890](https://github.com/unmet23-lab/synk-policy/actions/runs/38296456890) from commit `e2c81d55` and published by its release job ([run 38296894702](https://github.com/unmet23-lab/synk-policy/actions/runs/38296894702)):

- `SYNK-Platform-Preview-0.4.3-Signal-mac-arm64.dmg`: **459,131,084 bytes**, SHA-256 `6515cd82d6737c00344b647bbd2080693f8402bded0da96b7990ee50384c7ca0`; app tree of 268 files, SHA-256 `8c7ed7b87dcb16975dd4791616f039ae9f43f79ac07fd87d1892e3ff8dc1489a`
- `SYNK-Platform-Preview-0.4.3-Signal-mac-x64.dmg`: **476,792,659 bytes**, SHA-256 `1b8a9e5230f6e700841b64b6052cc5082a4ffb79a01a362620ed7f680ae2edb3`; app tree of 276 files, SHA-256 `d4887e4884e0121fc4eeeb219d274d21ac79aa23d9ed088d9215d1a2177f563c`

The homepage Mac downloads point to this release since `d29be3d4`. The earlier `platform-preview-0.4.3-20261012` release stays published.
