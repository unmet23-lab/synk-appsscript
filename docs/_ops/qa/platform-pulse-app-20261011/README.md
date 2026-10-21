# Platform의 독립 PULSE 실행 — 2026-10-11

플랫폼의 PULSE 목록·홈·실행 버튼에서 고정 `https://workspace.synk.im/pulse-app/`을 별도 창으로 연다. 웹앱 파일과 서버 배포는 별도 작업이며 이 패키지는 해당 진입 연결만 담는다. **실제 설치·설치 원문·격리 UI·설치 실행파일의 운영 PULSE 확인 완료. 테스트 앱을 정상 종료하고 평소 쓰는 플랫폼을 다시 열었다.**

- 고객 창은 preload·Node 없이 sandbox/contextIsolation으로 실행한다. 플랫폼·직원 쿠키와 분리한 계정별 해시 persist partition을 사용한다.
- 같은 계정의 앱 재시작에는 고객 연결을 보존한다. 계정 변경·로그아웃에는 이전 창을 닫고 쿠키·캐시·저장소를 정리한다. 정리 실패 시 새 고객 창을 열지 않는다.
- 앱 문서·스크립트·API는 고정 출처만 사용한다. 외부 HTTPS 참조는 PULSE referrer/initiator의 image/media 서브리소스만 허용한다. 외부 script/fetch/frame 요청은 차단한다.
- 제작자 진입은 정확한 `/pulse-app/?mode=staff`를 시스템 브라우저에서 열어 기존 직원 로그인을 사용한다. 브라우저/PWA와 앱 고객 로그인은 별도다.
- 설정의 **PULSE 이전 초안 → 이 PC에 저장한 요청 초안 보기**에서 기존 로컬 모델·요청 초안에 접근한다. 해당 원본 파일·저장 방식은 유지했다.

## 보존과 포장

직전 실제 설치본 `853f17d3ae42bde23c015659ec59bd8686cd0a1fe435b521af6787ff31ca1874`를 읽어 새 `.tmp/platform-pulse-app-20261011`에 복사했다. 프로그램 payload 76개, 기존 ASAR 116개를 기준으로 기존 파일 5개 변경·`src/pulse-app.cjs` 1개 추가만 반영했다. main/preload에서 이번 독립창 추가를 제거하면 기존 설치본 원문과 바이트 동일하다. 다른 dirty `package.json`·`runtime.json`, 기존 API broker·계정·메모 소스는 복사하지 않았다.

`overlay.json`의 6개만 `overlay-source-hashes.json`에 동결했다. NSIS 등록·현재 사용자 설치·무승격·자동 실행 안 함·사용자 데이터 보존 설정을 그대로 썼다. 공개 게시나 앱 강제 종료를 하지 않았다.

## 검증과 파일

- `renderer-native-tests.txt`: 관련 회귀 **127/127**.
- 실제 Electron 2회 실행 합성 검사: source **21/21**, 패키징된 ASAR **21/21** (`desktop/artifacts/pulse-app-native-20261011/2026-10-11T12-55-57-518Z/report.json`). 실제 Platform PULSE 클릭으로 별도 renderer 프로세스 생성, 이전 초안 접근, 외부 이미지 렌더·script/fetch/frame 차단, 쿠키 분리·재시작 유지·계정 변경 정리 확인. 정상 사용자 프로필이나 운영 고객 프로젝트를 사용한 시험은 아니다.
- 개발 catalog smoke **52/52**. 독립창 전환으로 예전 기본 내장 페이지 진입 조건을 새 동작에 맞췄다.
- `verification.json`: NSIS 압축 무결성·추출 전체 payload 76개·ASAR 변경 집합·원문 보존 **30/30**.

설치파일: `desktop/artifacts/platform-pulse-app-20261011/SYNK Platform Preview-0.4.0-win-x64.exe` (397,413,689 bytes).

SHA-256: `0d42ef3a888d50415accecc20845a8485ead58e98cae9defd9895194c817a0f8`.

새 ASAR: `5fa7f09ffb7a45c6d6905c387f686ee11dff3c50742555a87c6c3d99b8bb4265` (117 files).

실제 설치 시 root가 현재 종료 확인을 받은 후 `install.ps1`을 1회 실행한다. 이 스크립트는 source 6개 해시·프로세스 0개를 재확인하고 기존 프로그램 전체 백업 뒤 설치한다. 앱이 켜져 있으면 종료하지 않고 중단한다. `complete.cjs`는 설치 원문만 대조하며 앱을 열지 않는다. 이 단계에서는 정상 프로필·vault를 읽지 않는다.

## 실제 설치 결과

이번 사용자의 완전 종료 응답 후 SYNK 3종 프로세스 0개와 소스 해시를 확인했다. 원래 프로그램 전체를 `.tmp/platform-pulse-app-20261011/installed-program-backup`에 보존하고 NSIS를 1회 실행해 종료 코드 0을 받았다. `installed-platform.json`의 파일·등록·바로가기·백업 검사는 **102/102**, `installed-archive-verification.json`의 설치 ASAR 117파일·기존 코드 보존 검사는 **124/124** 통과했다.

실제 설치된 ASAR를 사용한 격리 Electron 합성 시험 **21/21**도 통과했다 (`desktop/artifacts/pulse-app-native-20261011/2026-10-11T13-04-11-097Z/report.json`). 운영 고객 초대·프로젝트·노트는 읽지 않았다. PC 부하 제보 때 추가 작업을 멈추고 테스트 프로세스가 남지 않았음을 확인했으며, 사용자가 괜찮다고 답한 뒤 아래 최종 확인을 진행했다.

실제 설치 `SYNKPlatformPreview.exe`를 main 시작 전 멈춰 새 임시 프로필로 격리한 뒤 기본 플랫폼의 PULSE 버튼을 눌렀다. 공개 HTTPS 초대 화면, Node/native bridge 없음, 별도 renderer PID·부모창 없음 **7/7** 통과 (`installed-live-ui-retry.json`). 첫 시도는 inspector의 빈 `callFrame.url` 때문에 앱 시작 전 중단됐고, scriptId로 실제 URL을 확인하도록 시험 도구만 수정한 뒤 동일 격리프로필에서 재시도했다. 앱 원문은 바뀌지 않았다.

같은 실행파일 세션에서 공개 r4 `views.mjs` 해시 `607509508c20af42d1ab01b184f3b66729c5a91d5f659f6711436470859a4ee5`를 확인하고, 합성 프로젝트·이미지만 임시 응답시켜 외부/업로드 썸네일·확대 이미지, 외부 origin-only referrer·업로드 no-referrer, 외부 fetch/script/frame 차단 **13/13** 통과했다 (`installed-live-image.json`). 실제 고객 프로젝트를 만들거나 변경하지 않았다. 확대 시 이미지를 메모리에서 재사용할 수 있으므로 요청 횟수 대신 실제 렌더와 관찰한 요청 헤더를 확인했다.

임시 응답기를 제거하고 익명 초대 화면으로 돌아온 뒤 `app.quit()`으로 정상 종료했다. 디버그 옵션 없이 일반 플랫폼을 다시 실행해 응답 중인 플랫폼 창 1개를 확인했다 (`normal-launch.json`). 정상 사용자 프로필·노트는 열람하지 않았다. 최종 상태는 `completion.json`의 **COMPLETE**다.
