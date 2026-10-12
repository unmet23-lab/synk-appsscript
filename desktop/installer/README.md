# SYNK Platform Preview — Signal Windows installer

This directory builds the Signal installation window for the existing Windows x64 Platform Preview **0.4.3**. The installer revision is **signal.2** (2026-10-13 redesign; signal.1 was published on 2026-10-12); its Windows file version is **0.4.3.2**. The installed application and bundled child installers remain byte-for-byte identical to the pinned public 0.4.3 payload.

The entry screen, installation progress, failure guidance and completion screen are native WPF UI. The executable contains the NSIS installation engine, application payload, approved SYNK artwork and fonts. The installer does not need a browser, WebView or a development server.

signal.2 follows the platform launcher's Signal 2 grammar (`docs/디자인/플랫폼_시그널/README.md#installer-download-20261013`): a title bar with the 싱ㅋ wordmark and a `PLATFORM` pill, a floating panel, and a lapis "플랫폼" poster (studio light, grain, the approved white felt synk logo, a tilted status sticker) beside a mono eyebrow, a large headline, readouts (installation location, required and available space, no administrator rights), a three-step progress indicator with a segmented bar, and white-pill actions. Steps without a percentage show the elapsed time. Mono labels and large Korean type are drawn with per-glyph tracking (`TrackedText`), because WPF text blocks have no letter spacing. The poster background `art/poster-platform.png` is rendered from `art/poster.html` with `art/make-poster.mjs`; the text on the poster is drawn by the window. The installation location shown before installing comes from the engine's read-only `Preflight`; if that check is blocked, the default location is shown and the engine reports the reason when installation starts. Downloading the build dependencies and original payload requires internet access; the packaged installer contains its installation files.

## Installation behavior

- Windows x64 with .NET Framework 4.8 is required. The installer runs as the current user without requesting elevation; it does not offer an all-users installation.
- An existing current-user installation location is reused. A fresh install uses `%LOCALAPPDATA%\Programs\SYNKPlatformPreview`. An existing all-users installation or a newer registered application version blocks this installer.
- The application is never started automatically. After successful installation, **SYNK 열기** opens it; **나중에 열기** closes the installer.
- A running Platform process blocks installation. The WPF preflight and the NSIS process check both preserve the running application. NSIS exits with code 20 if its final process check cannot establish that the application is closed.
- The installer does not delete account or application data. NSIS is configured with `deleteAppDataOnUninstall: false`; the installer does not log in, log out or change account settings.
- Installation requires approximately 3 GiB of available space on the destination, local application-data and temporary drives. Linked installation directories are rejected. The embedded engine is extracted into a private, randomly named cache directory and verified before execution.
- The final application files are checked against the pinned size and SHA-256 inventory before the completion screen appears. Application registration, uninstaller registration and an existing Start-menu shortcut target are also checked. The executable is checked again when **SYNK 열기** is pressed.
- Closing is disabled while files are being installed or verified. A failed installation shows its error and offers a retry. The installer does not implement a separate rollback transaction.

The download remains an unsigned Preview. This UI revision does not add a trusted publisher signature, an automatic update feed or Apple notarization. Mac packages are unchanged.

## Reproduce the package

Use a Windows x64 build machine with Node.js 24, npm and .NET Framework 4.8, including `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` and its WPF assemblies. The build pins `electron-builder` to **26.15.3** and uses its NSIS and 7-Zip toolchain. No account credentials or private application data are build inputs.

Run the following PowerShell commands from this source directory. Keep dependency, payload and output directories outside the source directory so that the source inventory includes only source files.

```powershell
$sourceDir = (Get-Location).Path
$buildRoot = Join-Path (Split-Path $sourceDir -Parent) 'signal-build'
$builderRoot = Join-Path $buildRoot 'dependencies'
$outputRoot = Join-Path $buildRoot 'output'
New-Item -ItemType Directory -Path $builderRoot -Force | Out-Null
npm --prefix $builderRoot install --save-exact --no-audit --no-fund electron-builder@26.15.3
node (Join-Path $sourceDir 'build-signal.cjs') "--builder=$builderRoot" "--out=$outputRoot"
```

The build downloads the pinned baseline if it is absent, checks its length and SHA-256, extracts it and checks every payload file against `baseline-files.json`. It builds a silent, current-user NSIS engine and embeds that engine in the native Signal executable. It never uploads an artifact or publishes a release.

To reuse an already downloaded baseline and an already extracted payload, supply their paths explicitly. The same complete integrity checks still run; the supplied payload is checked again after packaging.

```powershell
node (Join-Path $sourceDir 'build-signal.cjs') `
  "--builder=$builderRoot" `
  "--baseline=$buildRoot\SYNK-Platform-Preview-0.4.3-win-x64.exe" `
  "--payload=$buildRoot\payload" `
  "--out=$outputRoot"
```

| Input | Meaning |
| --- | --- |
| `--builder=<directory>` | Directory whose `package.json` resolves `electron-builder` 26.15.3 and its dependencies. |
| `--baseline=<file>` | Original public 0.4.3 Windows installer. Defaults to `baseline.exe` inside the output directory. |
| `--payload=<directory>` | Unmodified extracted public 0.4.3 application files. Defaults to `payload` inside the output directory. |
| `--out=<directory>` | Build intermediates, final executable, checksum and package report. |
| `--backend=<file>` | Existing NSIS engine to embed when `--reuse-backend` is set. |
| `--reuse-backend` | Recompile the native shell using an existing `backend/signal-backend.exe`; use only when its inputs have not changed. |

The pinned original is [SYNK Platform Preview 0.4.3 for Windows](https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.3-20261012/SYNK-Platform-Preview-0.4.3-win-x64.exe): **397,415,047 bytes**, SHA-256 `7bdd0b7d88f64b239b4b4eab51839313745835f7411ddfe2285ef67eb7b840c3`. The pinned `resources/app.asar` SHA-256 is `f0d912f1db50af31f0b8b8cb4d0ff0aeab4a328ee5f8296709aca0935ce74103`.

Primary outputs are `SYNK-Platform-Preview-0.4.3-Signal-win-x64.exe`, `SHA256SUMS-signal-win-x64.txt` and `windows-signal-package.json`. Compiler/toolchain differences may change the new installer executable; the build contract requires the installed application payload to remain identical.

## Verify the installation engine

```powershell
node (Join-Path $sourceDir 'tests/test.cjs') "--builder=$builderRoot"
```

The test creates a tiny application with a random fixture identity, builds a real NSIS installer and runs the production `InstallerEngine.cs` against it. The fixture uses its own installation directory, registry identity and shortcuts. The test does not install or uninstall the real SYNK Platform and checks that its existing registration remains unchanged.

The checks cover read-only preflight, damaged-engine rejection, manifest traversal, insufficient disk space, real installation, verified launch, installed-file tampering, running-app protection in both layers, reinstall data preservation and fixture removal. Test receipts identify the fixture and distinguish fixture acceptance from a real Platform installation. A successful fixture run alone does not establish real-account, real-device or public-download acceptance.

## Check the window

The window can be checked without building the full installer or installing anything. Compile the window with the render check and pass the font directory and an output directory; it writes each state (ready, reinstall, preparing, 64 %, 42 s without a percentage, verifying, complete, failure, long failure) at 100 %, 150 % and 200 % and fails on any font fallback.

```powershell
$fw = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319"
& "$fw\csc.exe" /nologo /target:exe /platform:x64 /out:$env:TEMP\signal-ui-check.exe /r:System.Core.dll /r:System.Xaml.dll "/r:$fw\WPF\PresentationFramework.dll" "/r:$fw\WPF\PresentationCore.dll" "/r:$fw\WPF\WindowsBase.dll" "/resource:art\poster-platform.png,art.poster-platform.png" "/resource:art\poster-world.png,art.poster-world.png" "/resource:art\poster-messenger.png,art.poster-messenger.png" SignalWindow.cs tests\ui-check.cs
foreach ($product in 'platform','world','messenger') { & $env:TEMP\signal-ui-check.exe fonts $env:TEMP\signal-ui-render $product }
```

## WORLD and Workspace installers, and the Platform that carries them

The same window and engine also install the two apps the Platform installs for the user. `--product=world` and `--product=messenger` choose the app identity (`im.synk.world.preview` · `SYNKWorldPreview`, `im.synk.messenger.preview` · `SYNKMessengerPreview`), the poster (`art/poster-world.png`: coral with the felt book and dark type; `art/poster-messenger.png`: ink with the felt laptop and light lapis type, the platform web `--face`/`--on-face` values), the big Korean word (월드, 워크/스페이스) and the copy. The completion button opens the app; the Platform recognises it after **설치 상태 확인**, because the engine installs where the original NSIS installer did (`%LOCALAPPDATA%\Programs\<executable name>`, the same NSIS GUID). The apps are the bytes the Platform pins in its `runtime.json` (Windows: WORLD 0.4.1, Workspace 0.4.0): the build checks the source installer, the extracted executable and `app.asar` against those pins and every file against `baseline-files-world.json` / `baseline-files-messenger.json`.

```powershell
node build-signal.cjs --product=world "--builder=$builderRoot" "--baseline=<SYNK-WORLD-Preview-0.4.1-win-x64.exe>" "--out=$outputRoot\world"
node build-signal.cjs --product=messenger "--builder=$builderRoot" "--baseline=<resources\clients\messenger.exe of the 0.4.3 Platform installer>" "--out=$outputRoot\messenger"
```

The WORLD source installer is published in `platform-preview-0.4.1-20261012`. The Workspace one exists only inside the Platform installers; extract `resources\clients\messenger.exe` with 7-Zip and the build checks its pin.

`build-platform-children.cjs` rebuilds the Platform 0.4.3 installer exactly like `../build-platform-performance.cjs` (frozen 0.4.1 sources, the 0.4.3 performance overlay, the same electron-builder configuration) with these two installers as `resources/clients/world.exe` and `messenger.exe`. Compared with the public 0.4.3 payload, only those two files, their `runtime.json` pins, and therefore `app.asar` and the executable (Electron keeps the archive integrity value in it) differ; the other 72 files and 116 archive members are identical. Run it from a synk-policy checkout after `npm ci` in `.github/desktop-preview`, then wrap the result:

```powershell
node build-platform-children.cjs "--world=<Signal WORLD installer>" "--messenger=<Signal Workspace installer>" "--out=<dir>" ["--electron-checksums=<official SHASUMS256.txt>"]
node build-signal.cjs --product=platform "--pin=<dir>\platform-pin.json" "--baseline=<dir>\dist\SYNK-Platform-Preview-0.4.3-win-x64.exe" --inventory=baseline-files-platform-children.json --revision=signal.3 --file-version=0.4.3.3 "--builder=$builderRoot" "--out=<dir>\signal"
```

`--electron-checksums` is for networks where Node cannot verify GitHub's download certificate chain: the cached Electron zip is checked against the official checksum file fetched by another client, and electron-builder does not fetch it again.

## Files and publication

`Program.cs` connects the native window to `InstallerEngine.cs`; `SignalWindow.cs` defines the Signal UI. `signal-safety.nsh` supplies the final NSIS running-process guard. `app.manifest` requests current-user execution and DPI handling. `build-signal.cjs` pins the public payload, assembles the package and writes the inventory. `baseline-files.json` is the public application-file contract.

The `fonts` directory includes SUIT (Medium, ExtraBold, Heavy), Inter Tight and DM Mono with their SIL Open Font License notices. The build embeds the six font files, all three notices and the poster background in the installer. `platform.ico`, the wordmark geometry in the window source and the felt synk logo in `art/poster-platform.png` (from `docs/디자인/SNS키트/assets/logo-synk-paper.webp`) are the SYNK brand assets used by this installer.

signal.1 was published as `platform-preview-0.4.3-signal.1-20261012`. signal.2 was published on 2026-10-13 as the prerelease `platform-preview-0.4.3-signal.2-20261013` (target `9da9282dc1af35a458bfabf6c19d7afdafe41ee3`; `SYNK-Platform-Preview-0.4.3-Signal-win-x64.exe`, 399,801,344 bytes, SHA-256 `929632ea797d7c6babe4a5e9b768cb9430daa123a65df9895003970e0751fc27`). Homepage Windows links point to that asset; the 0.4.3 Mac URLs stay on their existing release. Publish only the final executable, its matching checksum and a reviewed public package report. Do not publish build directories, local fixture manifests, machine paths or private installation records. Source publication belongs in `.github/desktop-preview/signal-installer/` of the existing public repository.
