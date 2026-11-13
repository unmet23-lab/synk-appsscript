# 업무 백업 (Rust/Tauri)

> **2026-11-11 살림 확정** ([결정](../../docs/_ops/결정.md)). 0.5.0 정기 백업과 이 시험판을 이어 간다. 상품으로 팔기 전에 세 가지를 먼저 푼다. ① 연 99달러 개인 백업보다 높게 받을 근거 ② 유호님이 아닌 둘째 사용자가 말해 주는, 무료 동기화 도구와 다른 점 ③ 남의 업무 자료를 맡을 때의 책임(보안 사고·복구 실패).
>
> **2026-11-12:** 유호님 요청으로 0.5.0 정기 백업과 Windows 시작 등록을 껐다. B2 사본과 Google 복구 정보는 그대로 있다. 상품화 순서와 단계마다 넘을 관문은 [상품화 로드맵](ROADMAP.md)에 있다.

Windows 앱의 창·트레이·시작 등록·암호 보관·프로세스 관리를 Rust/Tauri로 옮긴 판이다. 11-13부터 상품화 1단계의 이름표 **0.7.0**(식별자 `im.synk.workbackup`, 화면 앱 `WorkBackup.exe`)으로 0.6.1-rust-beta.1의 뒤를 잇되, 상태는 따로 둔다. 백업 엔진은 검증된 [0.5.0](../solo-backup/README.md)의 Node 모듈과 restic을 함께 넣는다. 엔진 전체를 Rust로 다시 쓴 버전은 아니다. 11-12부터 그 엔진은 이 폴더의 [`engine/`](engine/README.md)으로 갈라 와 묶고(0.5.0은 동결), 상품화 1단계의 고침은 거기에만 한다.

기존 화면과 폴더 선택 → 보호 시작 → 상태 확인 → 전체/선택 복구 흐름을 유지한다. 사용자가 Node나 Rust를 설치할 필요는 없다. 실행에 필요한 Microsoft Edge WebView2는 별도 시스템 구성 요소다.

**2026-11-10 추가:** [작업 환경 자동 진단](inventory/README.md)을 앱의 추천 자료 카드에 연결했다. 설치 프로그램·AI 작업 자료·설정 위치를 읽기 전용으로 찾고, 첫 설정과 범위 확인 뒤 한 번의 시작으로 별도 로컬 저장소에 백업한다. 이번 버전은 사용자 요청에 따라 추천 자료의 클라우드 확장을 보류한다.

## 추천 자료 로컬 백업

1. **자료 찾기**를 누르면 네이티브 진단기가 추천 원본과 제외 경로를 찾고 실제 파일 용량을 확인한다. 끝나지 않은 스캔이나 읽지 못한 경로가 있으면 시작을 막는다.
2. 포함·제외 범위를 확인하고 백업을 시작한다. 첫 회에는 원본과 떨어진 저장 위치와 복구 키 파일 위치를 고른다. 로컬 사본과 키를 같은 노트북에만 두면 노트북 분실에 대비할 수 없다.
3. 별도 저장소의 첫 백업과 구조·내용 확인을 마친다. 시작 등록이 실제로 확인된 경우에만 추천 자료를 하루마다 백업하며, 작업량·제외 규칙이 승인 범위를 벗어나면 멈추고 재확인을 받는다. 기존 백업은 삭제하지 않는다.
4. **새 폴더로 복구 확인**은 새 폴더에 파일을 복원하고 전부 SHA-256으로 대조한다. 새 앱 상태에서는 기존 **복구 키 가져오기**로 이 저장소를 열고 같은 복구 경로를 사용할 수 있다.

프로그램 이름·버전·제작사, 원래 자료 위치, 수동 내보내기 대상은 새 `새-PC-준비.json`으로 만들어 함께 백업한다. 프로그램 자동 설치, 로그인, 라이선스, 실행 중인 데이터베이스의 일관성, Windows 전체 이미지 복구는 제공하지 않는다. 전체 제외 경로는 내부 계획에 보존하지만 화면은 처음 100개만 보여 주며 전체 목록 열기는 후속이다.

추천 클라우드는 화면과 실행부 모두 비활성화했다. 참고 비용은 미래 확장용 추정이며 현재 청구액이 아니다. 제공사 전체 객체·이전 버전·중단된 업로드를 포함한 저장량 집계와 별도 과금 승인을 갖춘 뒤 확장한다. 로컬의 표시 용량은 restic이 참조하는 데이터 크기이며 전체 디스크 할당량과 다르다.

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

0.7.0의 상태 폴더는 `%APPDATA%\SynkWorkBackup`(설정 · 자격 · 기록), restic 캐시 · 임시는 `%LOCALAPPDATA%\SynkWorkBackup`이다([1단계 설계](STAGE1_DESIGN.md) 4.1 · 5.1). 0.5.0(`%APPDATA%\SoloWorkBackup`) · 0.6.1 시험판(`%APPDATA%\SoloWorkBackupRustBeta`)의 상태와 시험판의 Windows 시작 등록은 읽지도 쓰지도 않는다. 자동 백업은 작업 스케줄러의 회차 작업 넷(매시간 · 로그온 · 깨어남 · 잠금 해제 → `WorkBackupRun.exe`)이 돌린다. 복구 전용 모드는 네이티브와 워커 양쪽에서 백업·자격 변경을 차단한다. 워커가 죽으면 작업을 실패로 알리고 자동 재실행·재전송하지 않는다.

로컬 DPAPI만으로 다른 PC에서 복구할 수 있는 것은 아니다. 별도 복구 키 또는 기존 Google 계정 복구가 필요하다. 이번 복구 전용 사본은 기존 원격 복구 보관을 대체하지 않는다. Google 서비스 코드와 화면은 포함되어 있으나, Rust 앱에서의 새 Google 로그인은 이번 실제 계정 시험 범위에 포함되지 않는다.

## 빌드

Windows x64, MSVC 빌드 도구, Rust MSVC 도구 모음, Node, WebView2가 필요하다. 이 시험판은 Rust 1.99.1·Node 26.13.0으로 빌드했다. Cargo.lock을 사용한다.

```powershell
npm ci --ignore-scripts --prefix experiences/solo-backup-rust          # 고정한 Tauri CLI 2.12.4
npm ci --ignore-scripts --prefix experiences/solo-backup-rust/engine
./experiences/solo-backup-rust/scripts/build.ps1 `
  -ResticPath C:\build-input\restic.exe `
  -OutputDirectory C:\build-output\work-backup-rust `
  -InventoryBinDirectory C:\build-output\inventory\release `
  -PublicOAuthClient C:\build-input\recovery-client.json
```

출력 폴더는 새 경로여야 한다. restic은 기존 엔진이 고정한 SHA-256과 일치해야 한다. `PublicOAuthClient`에는 배포 가능한 데스크톱 OAuth 클라이언트 설정만 넣으며 개인 토큰은 넣지 않는다. 빌드 스크립트가 Node·restic·워커·의존성을 묶고 리소스 목록 해시를 실행 파일에 고정한 뒤, `tauri build`로 두 실행 파일과 컴퓨터 전체 NSIS 설치기(`SynkWorkBackup-0.7.0-setup.exe`, 11-13부터 — [설계 4.2 「컴퓨터 전체 설치」](STAGE1_DESIGN.md#컴퓨터-전체-설치))를 만든다. 설치기의 틀은 Tauri 원본(`src-tauri/nsis/upstream-installer.nsi`, 해시 고정)에 `scripts/nsis-template.cjs`의 여섯 곳만 바꾼 것이고, 설치 · 지우기 때 `src-tauri/nsis/hooks.nsh`가 `WorkBackupRun.exe --install` · `--uninstall`을 부른다. 영수증(`build-receipt.json`)에 실행 파일 둘 · 설치기 · 자원 목록 해시가 남는다. 설치 · 지우기 끝까지는 CI `workbackup-clean-windows`가 깨끗한 Windows에서 본다. 산출물과 자격 파일은 Git에 넣지 않는다.

`InventoryBinDirectory`는 절대 경로의 `release` 폴더로 지정한다. 스크립트가 해당 target에 현재 진단기·계획기 소스를 `--locked`로 빌드한 뒤 묶는다. 상대 빌드 경로는 이번 판의 검증 범위 밖이다.

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

# 디버그 빌드 EXE로 합성 파일 백업·전체/선택 복구와 SHA-256을 확인한다(0.7.0 배포 판은 --test-mode · --smoke를 받지 않는다).
node experiences/solo-backup-rust/test-support/native-smoke.cjs `
  C:\build-target\debug\WorkBackup.exe C:\test-output

# 회차 실행기(디버그 빌드): 꺼짐 · 지금 백업 · 잠금 보유 · 옮기기 중단 · 잘못된 인자와 기록에 경로가 없는지.
$env:SWB_RUN_EXE = 'C:\build-target\debug\WorkBackupRun.exe'
node --test experiences/solo-backup-rust/tests/run-exe.test.cjs

# T7(1단계 설계 4.3): 배포용 실행기로 합성 자료 300MB의 회차 시작 · 메모리를 재고 restic 단독과 견준다.
node experiences/solo-backup-rust/test-support/t7-runner.cjs `
  C:\build-output\work-backup-rust\WorkBackupRun.exe C:\test-output 300 5
```

합성 자료가 없으면 암호 호환 시험을 건너뛰지 않고 실패한다. `--test-mode`는 별도 `SOLO_BACKUP_TEST_STATE`가 필요하며 운영 상태 폴더·시작 등록·외부 URL 열기를 거부한다. 실제 B2 시험은 운영자가 준비한 읽기 전용 사본에서만 수행했다. 상세 결과와 확인하지 않은 범위는 [QA](QA.md), 채택한 기존 제품 기능은 [조사](../solo-backup/RESEARCH.md)에 있다.

## 운영자용 읽기 전용 이전(0.6.1 시험판 · 디버그 빌드만)

```powershell
WorkBackup.exe --migration-preview C:\test-output\new-cloud-copy   # 디버그 빌드에만 있다 — 0.7.0은 0.5.0 저장소를 읽지 않는다
```

기존 앱의 암호·복구 자료를 읽고, 확인된 B2 읽기 키로 새 사본을 만든다. 출력은 260자 미만의 일반 절대 경로를 사용한다. 입력 파일 전후 해시가 다르거나 출력이 이미 있으면 거부한다. 임시 형제 폴더를 완성한 뒤 덮어쓰기 없는 이름 변경으로 공개한다. 실패한 임시 자료는 진단을 위해 남기며 자동 삭제하지 않는다. 이 명령은 운영 백업의 담당 앱을 전환하지 않는다.
