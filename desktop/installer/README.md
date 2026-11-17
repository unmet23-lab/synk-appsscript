# SYNK Platform Preview — Signal Windows installer

> This document preserves the Signal engine contract and dated package baselines. Current shared release inputs and publication steps are in [LIFECYCLE](../LIFECYCLE.md#platform-release-reproduction); current publication and PC receipts are in the [platform source](../../docs/SYNK_플랫폼_계정과_연결_설계.md). The 0.4.3 URLs and homepage statements below describe their recorded release, not the latest download or a new laptop verification.

## 2026-11-17 Platform window: the black orb (검정 구 1-가 ③)

The Platform installer no longer uses the Signal poster window. `OrbWindow.cs` draws the same black window as the app's start window (`desktop/renderer/startup-update.*`): one orb comes closer than the window, and the text sits at the lower left. The look and timing follow the approved design (`docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html`, the large version chosen on 2026-11-17). WORLD and Workspace keep `SignalWindow.cs` unchanged.

- **Shader record.** `orb/orb.ps.json` records the SHA-256 of `orb.hlsl` (hashed with LF line endings, so every checkout agrees) and `orb.ps` and the fxc version that compiled them. `checkShader` stops on any PC when either hash differs from the record (the source changed without recompiling). It recompiles and compares bytes only when the local fxc has the recorded version, because another fxc version can emit different bytes from the same source.
- **The orb.** `orb/orb.hlsl` is the app's orb shader (`desktop/renderer/orb-stage.mjs`) moved to HLSL ps_3_0, without the places on the orb. Every value is passed at run time. The compiled bytes `orb/orb.ps` are committed, because user PCs cannot run fxc; `build-signal.cjs` recompiles and compares them when the build PC has the Windows SDK, and embeds them as `shader.orb.ps`. `OrbStage.cs` draws the shader through `BitmapCache.RenderAtScale`, so the canvas is finer than the screen, as in the app. When the GPU path is unavailable (rendering tier below 2, no ps_3_0, fewer than 1024 instruction slots, software rendering, or a remote session) it draws the same calculation in C# (`OrbCpu`) on a background thread. On this PC the GPU path matched the design within a mean difference of 0.002 levels and drew 45 frames per second at a 2880×1884 canvas. The CPU path matched the design scenes within a mean of 0.10 levels and at most 4 levels (`desktop/tools/orb-parity.cjs --installer-cpu=<orb-render.exe>`).
- **Fonts.** The sentence uses weight 300 like the start window. SUIT has no static 300 file, so `fonts/SYNKText-Light.ttf` is the 300 instance of the app's SUIT variable font. Its family is renamed to SYNK Text, because the SIL OFL reserves the name SUIT for unmodified fonts. Weight 400 is the official `SUIT-Regular.otf`.
- **Progress.** The engine's stages fill the carving as in the implementation design, section 3. A fresh install uses 0 to 100 %, a reinstall puts the backup first, and an automatic update continues from the half-carved orb at 50 %. Stages without a percentage approach their share over time. The carving never goes backwards and follows at most 16 % per second, like the start window.
- **Failures.** The engine messages are unchanged, because WORLD and Workspace show them as they are. Each throw site that the window needs to tell apart now carries a kind in the exception's `Data` (`FailureKind` in `BackendProcess.cs`; `pending` marks an earlier unfinished install), and the window chooses its sentence from that kind. The small record box under the buttons is written by the window too, in the same polite form as its sentences: blocked states put the contact address first, and the box then lists only values copied from the engine message (`FailureValues`): the backup folder (`되돌릴 원본`), the recovery note (`되돌리기 안내`), a file that failed verification, the backend exit code, and wrapped Windows messages. The engine's own sentences never appear in the box (review F4 of PC 0.4.96). `tests/ui-check.cs` fails when a rendered state mixes them in.
- **Opening.** After a successful Platform install the installer opens the app without asking; the ready screen says so before the user presses 설치. The executable is still checked by `Launch` before it starts. Before waiting for the app's first visible window (up to 20 seconds) the installer releases its mutex once. It stops waiting when no process of the app's executable has existed for a second, because an app that already ended has no window to wait for. After an automatic update the installer also waits for the new app's window, and it closes without a window when the update fails before READY unless a blocked state must stay visible.
- **Curtain and notes (2026-11-17, second piece).** Before an automatic update quits, the app writes a handoff note (`Handoff.cs`, `%LOCALAPPDATA%\SYNK\Installer\Handoff\<appId>.handoff.json`) and starts the downloaded installer with `--curtain --handoff-token=<token>`. In curtain mode the installer installs nothing and takes no mutex: it draws the same half-carved orb just below the app window, never activates, stays out of the taskbar, and prints `SYNK_CURTAIN_READY` after its first frame. It ends on `cancel` from the app, on the named event the automatic installer sets after READY and its own first frame, 60 seconds after the app window is gone, or 10 seconds after its input closes without `closing`. Its fonts live in a private `Cache\curtain-<pid>-<random>` folder, and both modes remove such folders whose owner process is gone. The automatic installer reads the note only when the token, the waiting app process and the version all match, opens at the note's place just below the curtain, and writes an arrival note before it opens the new or restored app. Notes only change the look; failing to write or read them never changes an update.
- **Quiet update and the updating marker (2026-11-17, fourth piece).** When every app window was hidden or minimized and the main window reported no unsaved draft, the handoff note says `quiet`. The installer then creates its window without showing it, updates, and opens the new app hidden; it shows the window only for ends a person must see. After READY every automatic installer holds `Handoff\<appId>.updating.json` and touches its time every two seconds; it releases the marker right before the engine starts an app and whenever the engine reaches an end. An app started while the marker is fresh writes `Handoff\<appId>.show-request` and exits without a window, and the installer shows its window. A second Platform installer writes the same request instead of the old message box; an automatic installer started by the app does not, and ends with code 1 and no dialog when it cannot take the installer lock within 10 seconds (review B2 of PC 0.4.96). A request taken before the engine starts an app shows the installer window and makes the arrival note visible; a request taken after that point, when the arrival note already says hidden, makes the installer start the app once more just before it ends, so the app's own single-instance path shows its window (`ShowRequestGate`, review GA1 of PC 0.4.96). That last start happens only when a launch went through; when the launch fails and the window stays on 「열기」 or 「쓰던 판 열기」, the gate goes back to its state before the launch, so later requests bring that window forward again (review B2). The app ignores a marker whose time is more than two seconds in the future.
- **Order at the end of an automatic update (review B1 of PC 0.4.96).** As in a manual install, the installer finishes carving (at most 3 seconds) before it writes the arrival note and the engine opens the new app, so the note's last frame is fully carved and the installer window does not stay over the new app's window. The updating marker is held while it carves and released right before the launch.
- `tests/orb-preview.cs` shows the real window on the screen with fake progress and captures it. It is for the GPU check when a release is cut, because it puts a window over whatever the user is doing. Day-to-day checks use the render check below, which never shows a window.

## 2026-10-31 automatic update failure record

Every failed automatic update now writes `%LOCALAPPDATA%\SYNK\Installer\Diagnostics\<appId>.last-update-failure.json` before recovery starts: stage, outcome, error type and message, a bounded exception detail, and the id, start time and path of each process with the app's executable name. Earlier the reason was lost, because the app consumes the recovery marker and the installer window closes right after a restore. The file is kept after a later success, and a failure to write it never changes the update outcome.

After the main process exits, the update now waits up to 20 seconds for other processes of that name before it verifies and preflights. It never stops a process. If one remains, Preflight refuses as before and the record names it. On 2026-10-31 an update returned to the previous version before any file changed; removing this wait in the isolated test reproduces that behaviour, but the original cause was not recorded and stays unconfirmed.

## 2026-10-14 common installer update

The Platform, WORLD and Workspace wrappers all compile the same engine. The NSIS stage now has a **10-minute wall-clock limit**. `BackendProcess.cs` starts the verified backend suspended, attaches it to a private Windows Job with kill-on-close and no breakaway permission, and resumes it only after attachment. Success means every process in the job has exited. A deadline stops the job and waits up to 15 seconds for all descendants to leave before restoring files. This follows [Microsoft's Job Objects contract](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects), checked 2026-10-14.

Manual installs now preserve the application files, product registry entries and two known shortcuts using the same transaction as automatic updates. A confirmed stop restores the prior version, or removes the known partial payload of a fresh installation, then shows **다시 시도 · 닫기** and the resulting state. Account/userData directories are never transaction inputs. If backend exit or restoration cannot be verified, the backup and journal remain, retry is disabled, and a pending marker blocks later installers too. Failure details and the recovery location can be scrolled instead of being truncated. The progress window states the time limit without claiming that an unresponsive process is still progressing.

`tests/test.cjs` exercises real NSIS installation and automatic recovery with independent fixture identities, plus partial-write deadlines, descendant termination, fresh-install cleanup, preserved external profile canaries and the unresolved-transaction barrier. `tests/measure.cjs --payload=<reviewed win-unpacked>` measures the production engine with a full real payload under an isolated identity, without launching the application. The common release QA records the timing sample and final package checks; a fixture does not establish a real-user update result.

The 2026-10-14 sample used a 679,291,638-byte, 75-file payload. Two isolated reinstalls took **147.630 s and 63.733 s for the backend plus its first verification**, with total backup/install/verification times of 550.619 s and 219.700 s. The 600 s backend limit is over four times the slower measured upper bound. Backup and verified recovery are separate stages; this is not a ten-minute limit on the whole window. Stop confirmation adds at most 15 s before safe recovery can begin. This small sample does not establish timings on all supported hardware. See the [common release evidence](../../docs/_ops/qa/platform-auto-update-20261014/README.md#mac-install-0411).

The remaining sections describe the original 0.4.3 Signal package and its reproducible baseline.

This directory builds the Signal installation window for the existing Windows x64 Platform Preview **0.4.3**. The installer revision is **signal.2** (2026-10-13 redesign; signal.1 was published on 2026-10-12); its Windows file version is **0.4.3.2**. The installed application and bundled child installers remain byte-for-byte identical to the pinned public 0.4.3 payload.

The entry screen, installation progress, failure guidance and completion screen are native WPF UI. The executable contains the NSIS installation engine, application payload, approved SYNK artwork and fonts. The installer does not need a browser, WebView or a development server.

signal.2 follows the platform launcher's Signal 2 grammar (`docs/디자인/플랫폼_시그널/README.md#installer-download-20261013`): a title bar with the 싱ㅋ wordmark and a `PLATFORM` pill, a floating panel, and a lapis "플랫폼" poster (studio light, grain, the approved white felt synk logo, a tilted status sticker) beside a mono eyebrow, a large headline, readouts (installation location, required and available space, no administrator rights), a three-step progress indicator with a segmented bar, and white-pill actions. Steps without a percentage show the elapsed time. Mono labels and large Korean type are drawn with per-glyph tracking (`TrackedText`), because WPF text blocks have no letter spacing. The poster background `art/poster-platform.png` is rendered from `art/poster.html` with `art/make-poster.mjs`; the text on the poster is drawn by the window. The installation location shown before installing comes from the engine's read-only `Preflight`; if that check is blocked, the default location is shown and the engine reports the reason when installation starts. Downloading the build dependencies and original payload requires internet access; the packaged installer contains its installation files.

## Installation behavior

- Windows x64 with .NET Framework 4.8 is required. The installer runs as the current user without requesting elevation; it does not offer an all-users installation.
- An existing current-user installation location is reused. A fresh install uses `%LOCALAPPDATA%\Programs\SYNKPlatformPreview`. An existing all-users installation or a newer registered application version blocks this installer.
- WORLD and Workspace are never started automatically. After successful installation, **SYNK 열기** opens it; **나중에 열기** closes the installer. Since 2026-11-17 the Platform installer opens the app by itself when installation succeeds (see the section above).
- A running Platform process blocks installation. The WPF preflight and the NSIS process check both preserve the running application. NSIS exits with code 20 if its final process check cannot establish that the application is closed.
- The installer does not delete account or application data. NSIS is configured with `deleteAppDataOnUninstall: false`; the installer does not log in, log out or change account settings.
- Installation requires approximately 3 GiB of available space on the destination, local application-data and temporary drives. Linked installation directories are rejected. The embedded engine is extracted into a private, randomly named cache directory and verified before execution.
- The final application files are checked against the pinned size and SHA-256 inventory before the completion screen appears. Application registration, uninstaller registration and an existing Start-menu shortcut target are also checked. The executable is checked again when **SYNK 열기** is pressed.
- Closing is disabled while files are being installed, stopped or verified. The common engine now restores the previous installation before offering retry; unresolved recovery keeps its backup and blocks retry as described above.

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

The window can be checked without building the full installer or installing anything. For the Platform the check draws the black-orb window (`OrbWindow`) instead: fifteen states from section 5 of the implementation design at 100 %, 150 % and 200 %, with the orb drawn by the CPU path because `RenderTargetBitmap` cannot capture the GPU effect. It also checks that the carving never goes backwards in any stage order, that only the three window fonts are used, and that the install, retry and open buttons raise their events. Before the states it runs the checks for the review of PC 0.4.96 (record box wording, eyes left closed, a CPU frame held by the throttle, the arrival note of a never-shown window at the system scale, the resize border while maximized, the window-button focus ring) and prints PASS or FAIL for each; they use only public members and reflection, so the same file also compiles against older window sources. For WORLD and Workspace it works as before. Compile the window with the render check and pass the font directory and an output directory; it writes each state (ready, reinstall, preparing, 64 %, 42 s without a percentage, verifying, complete, failure, long failure, timeout restored, timeout recovery required, restoring, automatic-update failure before any file changed, automatic-update recovery required) at 100 %, 150 % and 200 % and fails on any font fallback. The public CI runs the same check for all three products before building. The window picks its three progress steps from the engine's `InstallStage`, not from the title text, so the check compiles the engine sources that define `InstallProgress`. The progress and failure texts it renders are the engine's own texts; change them here when the engine copy changes, and run `tests/test.cjs` locally as well — `Tests.cs` asserts parts of the engine's failure texts (`Message.Contains`), and only the public CI runs it.

```powershell
$fw = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319"
& "$fw\csc.exe" /nologo /target:exe /platform:x64 /out:$env:TEMP\signal-ui-check.exe /r:System.Core.dll /r:System.Runtime.Serialization.dll /r:System.Xaml.dll "/r:$fw\WPF\PresentationFramework.dll" "/r:$fw\WPF\PresentationCore.dll" "/r:$fw\WPF\WindowsBase.dll" "/resource:art\poster-platform.png,art.poster-platform.png" "/resource:art\poster-world.png,art.poster-world.png" "/resource:art\poster-messenger.png,art.poster-messenger.png" InstallerEngine.cs AutoUpdateEngine.cs BackendProcess.cs InstallTransaction.cs SignalWindow.cs OrbStage.cs OrbWindow.cs Handoff.cs tests\ui-check.cs
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
