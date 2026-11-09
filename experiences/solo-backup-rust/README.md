# 업무 백업 Rust 시험판

Windows 앱의 창·트레이·시작 등록·암호 보관·프로세스 관리를 Rust/Tauri로 옮긴 **0.6.0-rust-beta.1**이다. 백업 엔진은 검증된 [0.5.0](../solo-backup/README.md)의 Node 모듈과 restic을 함께 넣는다. 엔진 전체를 Rust로 다시 쓴 버전은 아니다.

기존 화면과 폴더 선택 → 보호 시작 → 상태 확인 → 전체/선택 복구 흐름을 유지한다. 사용자가 Node나 Rust를 설치할 필요는 없다. 실행에 필요한 Microsoft Edge WebView2는 별도 시스템 구성 요소다.

## 이번 배포

- 기존 0.5.0의 자동 백업을 유지하고 Rust 시험판을 별도 폴더에 둔다.
- 기존 B2 백업은 새 시험판에 **복구 전용**으로 연결할 수 있다. 읽기 전용 키만 복사하며 기존 쓰기 키·Google 로그인 토큰은 이전하지 않는다. 이 PC의 연결 적용 여부는 [QA](QA.md)의 배포 상태를 따른다.
- 연결된 시험판에서는 클라우드 탭에서 파일을 검색하고 새 폴더로 복구할 수 있다. 원본이나 기존 앱 설정을 덮어쓰지 않는다.
- 새 로컬 백업은 별도 폴더를 선택해 설정할 수 있다. Rust 시험판의 자동 시작을 켜도 기존 앱과 다른 등록 이름을 쓴다.
- 고객별 자동 개통·결제·서명 설치 프로그램·자동 업데이트와 운영 백업의 Rust 전환은 이후 단계다. 현재 상태에서 판매용 완제품으로 배포하지 않는다.

## 구조와 안전 경계

| 부분 | 구현 |
|---|---|
| 창·트레이·Windows 시작 등록 | Tauri 2.12.5 / Rust |
| 로컬 암호 보관 | Windows DPAPI CurrentUser, 새 `SWBR1` 형식 |
| 백업·복구·B2·Google 복구 | 기존 Node 호환 워커 + restic 0.19.1 |
| 화면 | 기존 HTML/CSS/app.js와 Claude 작성 Tauri 브리지 |
| 통신 | 상속된 표준 입출력, 메서드 허용 목록, 메시지·대기 수 제한 |
| 중복 실행·프로세스 종료 | Windows 파일 잠금과 Job Object |

기본 상태 폴더는 `%APPDATA%\SoloWorkBackupRustBeta`, 시작 등록 이름은 `SoloWorkBackupRustBeta`다. 기존 `%APPDATA%\SoloWorkBackup`과 분리한다. 복구 전용 모드는 네이티브와 워커 양쪽에서 백업·자격 변경을 차단한다. 워커가 죽으면 작업을 실패로 알리고 자동 재실행·재전송하지 않는다.

로컬 DPAPI만으로 다른 PC에서 복구할 수 있는 것은 아니다. 별도 복구 키 또는 기존 Google 계정 복구가 필요하다. 이번 복구 전용 사본은 기존 원격 복구 보관을 대체하지 않는다. Google 서비스 코드와 화면은 포함되어 있으나, Rust 앱에서의 새 Google 로그인은 이번 실제 계정 시험 범위에 포함되지 않는다.

## 빌드

Windows x64, MSVC 빌드 도구, Rust MSVC 도구 모음, Node, WebView2가 필요하다. 이 시험판은 Rust 1.99.1·Node 26.13.0으로 빌드했다. Cargo.lock을 사용한다.

```powershell
npm ci --ignore-scripts --prefix experiences/solo-backup
./experiences/solo-backup-rust/scripts/build.ps1 `
  -ResticPath C:\build-input\restic.exe `
  -OutputDirectory C:\build-output\work-backup-rust `
  -PublicOAuthClient C:\build-input\recovery-client.json
```

출력 폴더는 새 경로여야 한다. restic은 기존 엔진이 고정한 SHA-256과 일치해야 한다. `PublicOAuthClient`에는 배포 가능한 데스크톱 OAuth 클라이언트 설정만 넣으며 개인 토큰은 넣지 않는다. 빌드 스크립트가 Node·restic·워커·의존성을 묶고 리소스 목록 해시를 실행 파일에 고정한다. `WorkBackupRust.exe`와 `resources` 폴더를 함께 옮긴다. 산출물과 자격 파일은 Git에 넣지 않는다.

## 시험

```powershell
$env:SOLO_BACKUP_RESTIC = 'C:\build-input\restic.exe'
node --test experiences/solo-backup-rust/tests/*.test.cjs
node --test experiences/solo-backup-rust/test-support/startup-read.check.cjs

# 새 임시 폴더에 기존 Electron 암호 형식의 합성 자료를 만든다.
$env:SWB_FIXTURE_OUTPUT = 'C:\test-output\new-electron-fixture'
& C:\build-input\electron.exe experiences/solo-backup-rust/test-support/electron-fixture.cjs
$env:SWB_LEGACY_FIXTURE = $env:SWB_FIXTURE_OUTPUT
$env:SWB_NODE_EXE = (Get-Command node.exe).Source
cargo test --locked --manifest-path experiences/solo-backup-rust/src-tauri/Cargo.toml

# 실제 배포용 EXE로 합성 파일 백업·전체/선택 복구와 SHA-256을 확인한다.
node experiences/solo-backup-rust/test-support/native-smoke.cjs `
  C:\build-output\work-backup-rust\WorkBackupRust.exe C:\test-output
```

합성 자료가 없으면 암호 호환 시험을 건너뛰지 않고 실패한다. `--test-mode`는 별도 `SOLO_BACKUP_TEST_STATE`가 필요하며 운영 상태 폴더·시작 등록·외부 URL 열기를 거부한다. 실제 B2 시험은 운영자가 준비한 읽기 전용 사본에서만 수행했다. 상세 결과와 확인하지 않은 범위는 [QA](QA.md), 채택한 기존 제품 기능은 [조사](../solo-backup/RESEARCH.md)에 있다.

## 운영자용 읽기 전용 이전

```powershell
WorkBackupRust.exe --migration-preview C:\test-output\new-cloud-copy
```

기존 앱의 암호·복구 자료를 읽고, 확인된 B2 읽기 키로 새 사본을 만든다. 출력은 260자 미만의 일반 절대 경로를 사용한다. 입력 파일 전후 해시가 다르거나 출력이 이미 있으면 거부한다. 임시 형제 폴더를 완성한 뒤 덮어쓰기 없는 이름 변경으로 공개한다. 실패한 임시 자료는 진단을 위해 남기며 자동 삭제하지 않는다. 이 명령은 운영 백업의 담당 앱을 전환하지 않는다.
