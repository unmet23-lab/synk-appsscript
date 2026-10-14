# SYNK 플랫폼의 앱 설치·실행 관리

<a id="platform-update-044"></a>

## 2026-10-14 현재 기준 · Platform 자체 업데이트

**Preview 0.4.4 / build 20261014.1부터 Platform 자체 업데이트와 홈페이지 다운로드가 하나의 공통 릴리스를 따른다.** 고정 feed는 `https://synk.im/desktop/releases/preview.json`, 릴리스 ID는 `platform-preview-<version>`이다. Windows x64·Mac arm64·Mac x64 세 설치파일의 URL·바이트 크기·SHA-256·ASAR SHA-256과 공통 `version`·`buildId`·`sourceHash`를 함께 기록한다. OS별 설치파일이 같은 바이트라는 뜻은 아니다. 홈페이지의 Windows/Mac 선택과 다운로드 안내창의 다시 받기도 이 feed를 따른다. feed 오류 또는 오래된 버전이면 홈페이지에 이미 반영한 정상 링크를 유지한다.

이 절은 Platform 자체 갱신을 다룬다. WORLD·Workspace 등 자식 앱의 승인 목록·설치 API는 별도이며 아래 2026-10-02 이력과 구분한다. 0.4.4의 공개 배포·현재 PC 설치·설치된 updater의 공개 feed 확인을 완료했다. [최종 반영 기록](../docs/_ops/qa/platform-unified-20261014/README.md).

### 사용자가 거치는 단계

1. 설치된 Platform이 시작되면 최신 확인을 한 번 실행하고 이후 6시간마다 확인한다. 다운로드 중·설치 준비 완료·설치기 인계 중에는 주기 확인을 건너뛴다. 사용자는 설정 또는 설치·업데이트 화면에서 **최신 확인**을 언제든 요청할 수 있다. 확인만으로 파일을 받거나 설치하지 않는다.
2. **다운로드**를 누르면 현재 OS·CPU의 설치파일을 앱 전용 캐시에 받고 실제 수신량으로 진행률을 표시한다. 고정 GitHub 릴리스 경로, 응답 크기, SHA-256을 검증한다. 실패·취소·공간 부족은 설치 가능 상태로 처리하지 않는다. 연결이 끊겨도 현재 앱은 계속 쓸 수 있다.
3. Windows의 **앱 종료 후 설치 파일 열기**는 기존 작성 중 작업 확인을 먼저 거친다. 사용자가 종료를 취소하거나 초안 보존이 끝나지 않으면 인계하지 않는다. 정상 종료가 허용되면 설치파일을 다시 검증하고 대기 인자 `--wait-pid`로 시그널 설치기를 실행한다. 설치기는 Platform 프로세스의 종료를 기다린 다음 화면을 보여 준다. 사용자가 **설치하기**를 눌러 설치하고, 완료 후 **SYNK 열기**로 실행한다. 설치기를 열었다는 사실은 설치 완료가 아니다.
4. Mac의 **설치 파일 열기**도 같은 작성 중 작업 확인을 거친 뒤 검증한 DMG만 연다. Platform을 자동 종료하거나 Applications를 자동 교체하지 않는다. 사용자가 Platform을 종료한 뒤 DMG의 앱을 Applications로 옮겨 교체하고 다시 실행한다.
5. 실행된 앱의 버전·build와 설치 바이트를 다시 확인한 결과를 실제 반영 기록으로 남긴다. 격리 시험이나 설치기 호출 성공으로 실제 사용자 설치를 대신 판정하지 않는다.

업데이트 API는 Platform의 허용된 창에서만 호출한다. 렌더러가 URL·파일 경로·셸 명령을 정하지 않는다. API가 없는 웹 미리보기에서는 업데이트 카드를 숨긴다. 같은 버전인데 `buildId`가 다르면 `UPDATE_BUILD_MISMATCH`로 거절하며 임의 덮어쓰기를 하지 않는다.

```js
await window.synkDesktop.updateStatus();
await window.synkDesktop.checkForUpdate();
await window.synkDesktop.downloadUpdate();
// 기존 confirmDraftExit로 작성 중 작업을 확인한 뒤에만 호출한다.
await window.synkDesktop.installUpdate();
const unsubscribe = window.synkDesktop.onUpdateChanged(snapshot => {});
```

snapshot은 `{ ok, state, currentVersion, currentBuildId, latestVersion, latestBuildId, progress, code }`다. `state`는 `disabled`, `idle`, `checking`, `current`, `available`, `downloading`, `ready`, `opening`, `error` 중 하나다. 진행률은 0–100이며 `ready`가 되어야 설치 파일 열기를 제공한다. 네트워크·무결성·저장 실패는 사용자에게 안전한 문구로 안내한다. Windows 종료 취소는 `UPDATE_EXIT_CANCELLED`, Mac DMG 열기는 `UPDATE_MANUAL_INSTALL`과 함께 `ready`로 돌아온다.

### 변경하지 않을 배포 기준

- **PC의 설치된 ASAR를 직접 패치하지 않는다.** 홈페이지와 같은 검증된 설치파일로 갱신한다. 기존 PC 패치 기록은 과거 이력이며 신규 배포 절차로 재사용하지 않는다.
- **공개 버전은 불변이다.** 같은 버전·파일명에 다른 바이트를 올리지 않는다. 원문·설치기 변경은 새 버전과 새 build ID로 동결한다. 실패한 게시를 재개할 때만 정확히 같은 manifest와 산출물을 재사용한다.
- **세 대상이 모두 준비되어야 feed를 전진시킨다.** 어느 한 빌드나 QA가 실패하면 기존 공개 feed와 홈페이지 링크를 유지한다. 서로 다른 동결 원문의 빌드 결과를 합치지 않는다.
- Windows 정식 코드 서명과 Mac Developer ID·공증은 사업자 등록 후 재개한다. 현재 Windows는 미서명, Mac은 ad-hoc 서명 Preview다. 해시 검증은 공급 파일 무결성 확인이며 게시자 서명이나 공증을 대신하지 않는다.

<a id="platform-release-reproduction"></a>

### 공통 릴리스 재현 · freeze → 세 빌드와 QA → assemble → publish

아래 명령은 담당 저장소 루트에서 실행하는 형태다. `<새 작업 폴더>`·`<공개 저장소 checkout>`은 실제 새 경로로 바꾼다. 기존 동결 폴더·빌드 출력·조립한 manifest는 덮어쓰지 않는다. 같은 소스로 다시 빌드해도 설치파일의 바이트까지 같다고 가정하지 않으며, 이미 공개한 파일은 재빌드본으로 바꾸지 않는다.

1. **정의와 동결.** 검토한 `release-definition.json`에 `schemaVersion: 1`, `product: platform`, `channel: preview`, 새 `version`, `releaseId`, `buildId`, 고정 `manifestUrl`, 세 대상의 기준 설치파일 URL·크기·해시를 적는다. Windows 기준 설치파일에는 내장 `backendSHA256`도 필요하다. 승인한 자식 앱 구버전 실행을 보존할 때만 검증된 `additionalLegacyPins`를 넣는다. 이번 원본은 [0.4.4 정의](../.tmp/platform-unified-20261014/release-definition.json)다. `freeze-platform-release.cjs`가 `src`·`renderer`·`assets`를 복사하고 파일 목록·해시·공통 `sourceHash`를 기록한다.

```powershell
$releaseWork = '<새 작업 폴더>'
node desktop/tools/freeze-platform-release.cjs --source=desktop "--out=$releaseWork/frozen" "--definition=$releaseWork/release-definition.json"
node --test desktop/tests/platform-update.test.cjs desktop/tests/update-view.test.cjs desktop/tests/release-pipeline.test.cjs desktop/tests/assemble-platform-release.test.cjs desktop/tests/platform-publication.test.cjs
```

2. **세 대상 빌드와 별도 QA.** 하나의 동결 폴더와 그에 맞는 도구·자산을 각 대상 빌드 환경에 바이트 그대로 전달한다. Git을 거치면 동결 `source/**`의 줄바꿈 변환을 막는 `-text` 속성을 둔다. 빌더는 대상과 같은 OS·Node CPU 아키텍처를 요구하고, Electron 44.5.1·electron-builder 26.15.3을 사용한다. 기준 파일과 자식 설치파일의 승인 해시, 전달할 ASAR의 구성·내용·메타데이터를 검증한다. 서명 자격증명을 Preview 빌드에 넣지 않는다.

```powershell
# Windows x64: desktop의 고정 의존성 설치가 끝난 환경. pwsh는 PowerShell 7 실행 경로.
node desktop/tools/build-platform-release.cjs "--release=$releaseWork/frozen" "--out=$releaseWork/win32-x64" --builder=desktop --platform=win32 --arch=x64 --signal=desktop/installer --powershell=pwsh
```

Windows 빌드 후 `dist/win-unpacked/SYNKPlatformPreview.exe --synk-smoke`를 새 격리 `APPDATA`·`LOCALAPPDATA`·`TEMP`·`TMP` 환경에서 실행한다. `SYNK_SMOKE`의 packaged·버전·화면 준비·네트워크/콘솔 오류 0·DPAPI 저장/복원/제거를 확인한다. 빌드 성공만으로 이 smoke가 실행된 것으로 보지 않는다. 이번 실행 원형은 [Windows 격리 시험](../.tmp/platform-unified-20261014/verify-windows-native.cjs)이다.

Mac은 공개 `unmet23-lab/synk-policy`의 `.github/workflows/desktop-platform-unified.yml`을 따른다. arm64는 `macos-15`, x64는 `macos-15-intel`에서 실행하며 Intel 그래픽 로더 준비를 유지한다. 아래 작업 디렉터리는 공개 checkout의 `.github/desktop-preview`이고, `unified`는 동일 동결 원문·도구·DMG 자산이다. `desktop/platform-release.workflow.yml`은 준비 원본이며, draft 업로드까지 포함한 실제 실행은 공개 workflow를 확인한다.

```sh
# 각 runner에서 ARCH=arm64 또는 ARCH=x64. workflow가 고정 의존성과 Electron을 먼저 준비한다.
node unified/tools/build-platform-release.cjs --release=unified --out=unified-out/$ARCH --builder=. --platform=darwin --arch=$ARCH --background=unified/mac-dmg/background.png
node qa/run-macos-qa.cjs --arch=$ARCH --scope=platform --manifest=unified-out/$ARCH/mac-package-$ARCH.json
```

Mac은 ad-hoc 서명·CPU·읽기 전용 DMG의 ASAR·Applications 링크와 네이티브 QA를 확인한다. 각 빌드의 `build-report.json`, `artifact.json`, 설치파일 및 QA 결과를 보존한다. Mac workflow의 검증된 draft 업로드는 공개 feed 전환과 구분한다.

3. **manifest 조립.** 세 보고서와 sidecar의 버전·build·동결 원문 해시, 설치파일의 크기·해시를 다시 대조한다. 예시는 세 설치파일을 `$releaseWork/installers`에 모은 경우다. 로컬에 없는 파일은 `--remote-assets=<GitHub assets JSON>`으로 실제 업로드 크기·digest를 검증할 수 있다. 이 도구는 업로드·설치·공개 feed 교체를 수행하지 않는다.

```powershell
node desktop/tools/assemble-platform-release.cjs "--release=$releaseWork/frozen" "--report=$releaseWork/win32-x64/build-report.json" "--report=$releaseWork/darwin-arm64/build-report.json" "--report=$releaseWork/darwin-x64/build-report.json" "--artifact-root=$releaseWork/installers" "--out=$releaseWork/preview.json"
```

4. **공통 게시.** `publish-platform-release.cjs`만으로 release와 홈페이지·feed를 전진시킨다. 별도 깨끗한 공개 checkout이 `origin/main`과 일치해야 한다. `--apply`가 없으면 사전 검증만 한다. Mac 파일을 검증된 draft에 이미 올렸고 로컬에 두지 않은 경우 `--remote-artifacts`를 함께 쓴다. `--website`는 게시 후 홈페이지 원문 저장소의 `desktop/releases/preview.json`도 동기화한다. `site-v10` 빌드는 이 파일과 같은 `desktop-release.js`를 사용한다.

```powershell
$publicCheckout = '<공개 저장소 checkout>'
$websiteSource = '<SYNK-website 원문 경로>'
node desktop/tools/publish-platform-release.cjs "--manifest=$releaseWork/preview.json" "--artifacts=$releaseWork/installers" "--public=$publicCheckout" "--client=$websiteSource/site-v10/desktop-release.js" "--website=$websiteSource"
# 승인된 공개 범위에서 위와 같은 인자에 --apply를 추가해 게시한다.
```

게시 도구는 draft의 기존 자산을 덮어쓰지 않고 일치 여부를 확인한다. 세 공개 다운로드의 실제 바이트를 검증한 뒤 홈페이지 링크·버전 문구·질문 데이터의 캐시 해시·feed·클라이언트 스크립트를 함께 커밋하고 push한다. 업로드 실패 시 기존 feed를 유지한다. 커밋 뒤 push 실패 시에는 산출물 폴더의 `publication.json`과 동일한 manifest·checkout을 보존하고 같은 명령으로 재개한다. 다른 사람이 공개 원문을 바꿨으면 먼저 대조하며 그 변경을 덮어쓰지 않는다. push 성공 후에도 Pages 배포와 공개 homepage/feed/파일 대조를 별도로 확인하고, 현재 PC는 같은 설치파일로 갱신한 뒤 버전·설치 바이트를 확인한다.

## 2026-10-02 이력 · 자식 앱의 로컬 설치파일 준비

아래 내용의 “현재”와 미연결 항목은 당시 자식 앱 설치 관리의 범위를 뜻한다. Platform 자체의 공통 공개 feed·업데이트·신규 릴리스 정책은 위 2026-10-14 절을 따른다.

2026-10-02. 플랫폼은 WORLD·사내 메신저를 별도 클라이언트로 관리한다. 현재 배포 원천은 **실제로 생성하고 SHA-256을 확인한 로컬 개발 설치 파일**이다. 공개 다운로드·자동 업데이트 서버는 연결하지 않았다.

## 실제 동작

1. 고정 OS 설치 경로에서 각 앱의 메타데이터, 실행 파일, ASAR를 찾는다. 앱 ID·제품·개발/정식 모드·운영체제·CPU·버전과 승인 해시가 모두 일치해야 실행할 수 있다.
2. 설치 파일 준비를 누르면 승인 목록의 로컬 설치 파일을 앱 전용 임시 디렉터리로 복사한다. 실제 읽고 쓴 바이트로 진행률을 표시하고 SHA-256을 확인한다. 이 단계는 네트워크 다운로드가 아니다.
3. 준비 중에는 취소할 수 있다. 취소·실패한 파일은 정리하고 설치 가능 상태로 표시하지 않는다.
4. 사용자가 별도의 **설치 프로그램 열기**를 눌렀을 때 다시 파일 크기·경로·해시를 확인한 다음 OS로 연다. 준비 직후 자동 실행하지 않는다. 설치 프로그램을 열었다는 사실을 설치 완료로 기록하지 않는다.
5. 설치 후 새로 확인하면 고정 설치 경로를 검사한다. 구버전도 승인 해시가 있으면 실행할 수 있고, 더 높은 승인 버전이 있을 때 업데이트 가능 상태를 표시한다. 업데이트 버튼도 같은 준비·명시적 실행 단계를 거친다.

WORLD·메신저는 플랫폼의 실행·설치 API를 사용할 수 없다. 실행과 설치에는 고정 앱 ID만 받으며, 렌더러가 경로·셸 명령·다운로드 URL을 지정할 수 없다.

## 브리지

```js
await window.synkDesktop.getClients();
await window.synkDesktop.launch('world');
await window.synkDesktop.prepareClient('world');
await window.synkDesktop.cancelPreparation('world');
await window.synkDesktop.openInstaller('world');
const unsubscribe = window.synkDesktop.onClientsChanged(clients => {});
```

`getClients()`의 항목은 기존 `id`, `name`, `status`, `canLaunch`, `reason`, `version`과 함께 `latestVersion`, `updateAvailable`, `installer`를 제공한다. `installer`는 다음 정보를 가진다.

| 필드 | 의미 |
| --- | --- |
| `status` | `unavailable`, `idle`, `preparing`, `ready`, `opening`, `installer-opened`, `cancelled`, `error` |
| `source` | 제공된 경우 `local-development`; 공개 서버 다운로드라는 뜻이 아니다 |
| `version` | 현재 제공하는 설치 파일 버전 |
| `progress` | 실제 복사 진행률 0–99, 해시 검사까지 성공하면 100 |
| `transferredBytes`, `totalBytes` | 실제 복사한 바이트와 승인한 파일 크기 |
| `canPrepare`, `canOpen` | 해당 시점에 허용하는 동작 |
| `error` | 파일 없음·변조·경로 이탈·OS 실행 오류 등 구체적인 상태 코드 |

`openInstaller` 성공 응답은 `{ ok: true, installationConfirmed: false }`다. 실제 설치 완료 여부는 운영체제 경로에서 별도로 확인한다.

## 승인 목록과 재현

`tools/build-client-catalog.cjs`는 `artifacts/package-verification.json`에 기록된 WORLD·메신저의 실제 설치 파일·실행 파일·ASAR 해시를 다시 대조해 `artifacts/client-releases.json`을 만든다. 이전에 검증한 버전의 실행 해시는 보존하므로 최신 빌드 때문에 구버전 실행이 막히지 않는다. 정식 다운로드 채널의 서명된 manifest를 구현한 것은 아니다.

```powershell
node tools/build-client-catalog.cjs
node --test tests/lifecycle.test.cjs
node tools/lifecycle-smoke.cjs
```

신규 11개 시험은 실제 임시 파일을 이용한 준비·진행률·취소·변조 거절·두 번 클릭 방지·OS 실패, 버전 비교, 승인된 구버전 실행, 카탈로그 이력 보존을 확인한다. 기존 셸 13개와 함께 24개를 확인했다. 전체 셸·인증·네이티브 화면 검증은 최종 README의 현재 결과를 따른다.

`artifacts/lifecycle-smoke.json`은 실제 개발 설치 파일을 복사·검증하고 다른 앱의 준비를 취소한 결과다. 설치·프로세스 실행 함수는 이 검사에서 호출되면 실패하도록 막았다. OS 설치 위치는 합성 미설치 디렉터리를 사용했다. 따라서 **설치 프로그램의 실제 실행, 설치·제거, 설치된 앱 간 실행, ARM64·Mac 실기기 검증은 이 결과로 주장하지 않는다.**

## 남은 운영 연결

현재 구현은 개발판 설치 파일 준비와 승인 해시 기반 앱 실행을 담당한다. 공개 다운로드 호스팅, 배포 manifest 서명과 교체 정책, 중단된 다운로드 이어받기, 백그라운드 업데이트·롤백, Windows 서명·Mac 공증과 실기기 설치 검증은 별도 단계다. 모바일 앱의 스토어 설치는 PC 런처가 대신하지 않으며 공통 SYNK ID와 각 제품의 모바일 입구를 사용한다.
