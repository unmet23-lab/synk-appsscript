# 업무 백업 Rust 시험판 설계 (solo-backup-rust)

## 범위
- 위치는 experiences/solo-backup-rust. 원본 ../solo-backup은 읽기만 하며 바꾸지 않는다. 2026-11-12부터 엔진은 이 폴더의 `engine/`(0.5.0을 바이트 그대로 갈라 온 것)을 묶고, 상품화 1단계의 고침은 [1단계 설계](STAGE1_DESIGN.md)를 따른다.
- Tauri v2 Rust 네이티브 셸과 기존 Node/restic 호환 워커로 만든 과도기 시험판이다. 엔진 전체를 Rust로 옮긴 것이 아니다.
- 버전 문자열은 백엔드 state.version이 0.6.0-rust-beta.1로 준다.
- RESEARCH.md의 기존 벤치마크 결론(버튼 하나로 보호, 분명한 상태, 검증된 복구)을 그대로 기준으로 쓴다.

## UI
- index.html, style.css, app.js, tray.png를 바이트 그대로 dist/에 복사한다(scripts/stage-ui.cjs). 스타일·배치·문구는 바꾸지 않는다.
- index.html 변경은 CSP meta 교체와 app.js 앞 bridge.js script 한 줄뿐이다. 기대 문자열이 정확히 한 번이 아니면 거부한다. 삭제 없이 소유한 출력 파일 이름만 쓴다.
- CSP: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; base-uri 'none'; form-action 'none'. dist/csp.txt와 tauri.conf의 CSP가 같아야 한다.
- 인라인 JS, 원격 자산, 네트워크 호출은 없다.

## 브리지와 권한
- window.backup은 Object.freeze된 원래 preload 메서드 33개와 onState다. 모두 invoke('backup_call', {method, args})를 쓰며 {ok,value} / {ok:false,error,code?}를 그대로 돌려준다. 예상 밖 오류는 고정 한국어 메시지 하나로만 바꾼다.
- onState는 backup:state 이벤트를 듣고 Promise<cleanup>을 반환한다. 함수만 받으며, 구독 실패는 고정 오류로 거부한다. 기존 app.js의 subscribe가 반환값을 await하고 실패하면 폴링으로 전환한다.
- 메서드 허용 목록, args 배열, 요청 128KiB 제한은 Rust가 직접 검사한다. 렌더러 권한은 backup_call과 이벤트 listen/unlisten뿐이며 fs/shell/opener/dialog 플러그인을 열지 않는다.

## 프로세스
- Rust: 창, 트레이, 로그인 시 시작, DPAPI, 워커 stdio RPC.
- worker/handlers.cjs: Electron main의 핸들러 구간을 복사하고 대화상자·시작 설정 호출만 비동기 host 호출로 바꾼다. electron require나 대체 stub은 없다.
- encrypt/decrypt는 비동기 host 호출이다. 기존 호출부가 모두 await하므로 동작이 같다.
- host 호출은 별도 ID 공간을 쓰고 동시 대기는 최대 8개다. 워커 메시지 최대 2MiB, 렌더러 요청 최대 128KiB. 자동 재전송·자동 재시작은 없다.
- 자식 종료, 충돌, 프로토콜 위반 시 fail closed: 대기 요청을 고정 오류로 끝내고 작업을 멈춘다. OS 상태 잠금으로 중복 실행을 막고, Job 객체 kill-on-close로 워커와 restic을 함께 끝낸다.

## 상태 분리와 이전
- 상태 폴더는 SoloWorkBackupRustBeta이고 Run 항목도 Electron 판과 다른 이름을 쓴다.
- 운영 데이터의 자동 이전·전환은 없다.
- 선택형 1회 읽기 전용 이전 복사: 먼저 정확한 Electron fixture로 v10 AES-GCM+DPAPI 복호화를 검증한다. 새 격리 사본에만 쓰고 복구 전용 모드를 강제하며 자동 실행과 원격 변경을 하지 않는다. 기존 읽기 전용 restic --no-lock 보호를 유지한다.

## 패키징
- node 런타임과 restic을 함께 넣는다. 기존 WebView2 외에 사용자 설치는 필요 없다.

## 테스트
- 네이티브 브리지, DPAPI, 수명 주기(충돌·잠금·종료), 로컬 전체 복구와 골라 복구.
- 원본 엔진 테스트 72개는 Node에서 회귀 검증하고, 별도 네이티브 실행 파일 시험으로 호환 워커를 통한 전체·선택 복구를 검증한다.
- CUA(화면 자동 조작) 시험은 이 단계에 넣지 않으며 별도 허가 뒤에만 진행한다.

## 검토 반영
- 설계 검토 Fable12는 범위를 바꾸지 않는 명확화로 수용해 위 항목에 반영했다. 원문(비공개): .tmp/solo-backup-rust-20261109/design.json

## 단계 경계
- 이번 단계는 셸 교체와 호환 워커까지다. 네이티브 엔진 이식은 후속 단계다.
- 측정된 성능 주장은 하지 않는다.
- Windows 패키지 SemVer는 0.6.1-beta.1이고 화면의 0.6.1-rust-beta.1은 Rust 시험판 계열을 표시한다. 같은 시험판이며 일반 고객 배포 전 버전 표기를 통일한다.

## 0.6.1 추천 자료 연결의 구현 경계

Opus 설계·화면 작성과 Fable 설계 지적 반영에 따라 네이티브 계획기 → 범위 확인 → 독립 저장소 백업 → 검증 완료 태그 → 새 폴더 복구를 연결했다. 원래 백업 설정·자격을 자동으로 가져오지 않으며 원본·기존 저장소를 삭제하거나 덮지 않는다. 복구 시 저장소의 원래 경로와 대상 겹침, 여유 공간, 링크·자리표시자·안전하지 않은 경로를 확인한다. 복원 tar를 디스크에 중복 저장하지 않고 스트리밍 검증한다.

실제 시험은 같은 Windows 계정에서 새 프로세스·빈 앱 상태와 외부 복구 키로 한다. 앱 내 새 폴더 복구와 별개인 검증이며 다른 물리 PC 또는 새 OS의 동작을 증명하지 않는다. 사용자 선택에 따라 이 판의 추천 클라우드 업로드는 쓰기 전 차단한다. 전체 환경 스캔의 상한, 실행 중 DB의 VSS, 프로그램 재설치·로그인, 100개 초과 제외 목록 열기와 자동 개통은 후속이다.

## 참고
- https://v2.tauri.app/start/
- https://v2.tauri.app/develop/calling-rust/
- https://v2.tauri.app/security/csp/
