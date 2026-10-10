# Platform 재설치 파일 · 싱ㅋ 시그널 2 (2026-10-10)

유호님 「재설치 파일 만들어줘」에 따라 현재 PC에 설치된 Platform(싱ㅋ 시그널 2 화면)과 같은 내용의 재설치 파일을 새로 만들었다. 10-10 새벽 재설치 파일([기록](../platform-reinstall-20261010/README.md))의 Platform 설치 파일에는 바꾸기 전 화면이 들어 있어서, 그걸로 다시 설치하면 새 화면이 사라지기 때문이다.

**쓸 폴더: `desktop/artifacts/platform-reinstall-signal2-20261010/`** (git 밖, 이 PC 전용) → 같은 날 WORLD 펠트 책을 넣은 [다음 판](../platform-reinstall-worldbook-20261010/README.md)으로 바뀌었다.

| 제품 | 설치 파일 | 바이트 | SHA-256 | 이전 재설치 파일과 |
| --- | --- | ---: | --- | --- |
| Platform | SYNK Platform Preview-0.4.0-win-x64.exe | 396534313 | `8c5630161f451d46a99c1d0c5f715a931b9875ec3968c1ec887db94c73fc7634` | 새로 만듦 |
| WORLD | SYNK WORLD Preview-0.4.0-win-x64.exe | 132343097 | `537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4` | 같은 파일(하드 링크) |
| Workspace | SYNK Workspace Preview-0.4.0-win-x64.exe | 132289230 | `b1028c0891ba7dfe69c0958c41eb3fc2b2b5569104682906b03da794f298f16b` | 같은 파일(하드 링크) |

## 만든 방법

- 바탕은 10-10 재설치의 Platform 빌드 재료(`.tmp/platform-reinstall-20261010/attempt2/platform`, app.asar `eaa006fe…`)다. 공용 작업본의 `desktop/`으로 다시 빌드하지 않았다(다른 세션의 커밋 전 수정이 섞이지 않게).
- 앱 묶음(app.asar) 안에서 여섯 파일만 바꿨다.
  - 화면 파일 다섯 개(`renderer/launcher.css`·`member-home.css`·`convenience.css`·`member-home.mjs`·`index.html`): 현재 PC 설치본(app.asar `c715de9e…`)에서 그대로 꺼냈다.
  - `assets/launcher/teacher-cover.png`: 생성 도구 표시(C2PA)를 뺀 판(appsscript `e6f55504a`). 픽셀은 같다.
- 실행 파일, `synk-install.json`, `runtime.json`(인증·WORLD/Workspace 자식 설치 파일 pin), `package.json`, 자식 설치 파일 두 개는 그대로다. 버전 0.4.0, appId, 설치 폴더, NSIS 설정(사용자 자료 보존, 설치 뒤 자동 실행 없음)도 이전과 같다. 빌더는 같은 electron-builder 26.15.3이다.
- 스크립트: [build.cjs](build.cjs) → [verify.cjs](verify.cjs) → [deliver.cjs](deliver.cjs). 결과: [package-result.json](package-result.json), [verification.json](verification.json), [delivery-manifest.json](delivery-manifest.json).

## 확인

- **설치 파일을 실행하지 않고 읽어서 19/19**([verification.json](verification.json)): 7-Zip CRC, 내장 payload 76개가 빌드 폴더와 바이트까지 같음, 이전 재설치 payload와 비교해 `resources/app.asar`만 다름, 앱 묶음 안에서는 위 여섯 파일만 다르고 현재 설치본과는 교사 그림 하나만 다름, 교사 그림에 제작 도구 표시 없음, runtime·package·metadata·실행 파일·자식 설치 파일 pin 그대로, NSIS GUID `c4ee183e-…`와 설치 폴더가 지금 등록된 Platform과 같음, 빌더 설정이 경로 말고는 이전과 같음.
- 새 앱 묶음을 풀어 숨김 Electron(합성 계정, 바깥 요청 차단)으로 열었다: 17개 화면, 오류 0, 바깥 요청 0. 내 홈 포스터·회원 혜택 「마음」 포스터·앱 상세·설정 스위치가 새 디자인으로 뜬다.
- 만든 직후에는 설치하지 않았고, 이어서 유호님 요청으로 11:01에 이 PC에 재설치했다(아래).

## 이 PC 재설치 (2026-10-10 11:01)

유호님 「그걸로 지금 재설치해줘」에 따라 위 Platform 설치 파일로 현재 PC의 Platform을 다시 설치했다. WORLD·Workspace는 건드리지 않았다.

- 절차는 10-10 `install-platform-v2.ps1`과 같다([install.ps1](install.ps1)): SYNK 앱 세 개가 꺼져 있는지 확인(끄지 않고, 켜져 있으면 거절) → 설치 파일·설치본 해시 확인 → 프로그램 폴더 전체를 `.tmp/platform-reinstall-signal2-20261010/installed-program-backup`(643MB)에 복사하고 파일마다 해시 대조 → NSIS `/S` → 설치된 payload 76개 바이트·해시, 폴더 파일 목록 정확히 76개 + 제거 프로그램, 연결 지점 없음.
- 설치 프로그램 종료 코드 0, 11:01:01~11:01:43. 위 확인 89개 통과.
- `install.ps1`은 다음 단계에서 멈췄다. 제거 키의 `InstallLocation`을 읽게 짰는데, 이 빌더는 그 칸을 쓰지 않는다(설치 위치는 앱 키에 있다). 영수증 [installed-platform.json](installed-platform.json)은 `installed:false`로 그대로 두었다. 설치를 다시 하지 않고 [postcheck.ps1](postcheck.ps1)로 남은 확인을 마쳤다: **7/7**([installed-postcheck.json](installed-postcheck.json)). 등록(이름 「SYNK Platform Preview 0.4.0」, 버전 0.4.0, 제거 명령 `/currentuser`, 앱 키 설치 위치), HKLM 안 씀, 시작 메뉴·바탕화면 바로가기가 새 실행 파일을 가리킴, 설치 뒤 자동 실행 없음, 설치된 app.asar = 새 묶음.
- **설치 전에 Windows 설치 등록이 빠져 있었다.** 06:17 기록에는 SYNK 세 앱(Platform `c4ee183e…`, WORLD `26232ff5…`, Messenger `953c4764…`)이 HKCU 제거 목록에 있었다. 이번 설치 직전에는 셋 다 없었다(프로그램 폴더·바로가기는 그대로). 샌드박스 밖에서 읽어도 같았다. 이번 설치로 Platform 등록이 다시 생겼고, WORLD·Workspace는 바로 아래처럼 이어서 다시 설치해 되살렸다. 언제 왜 빠졌는지는 찾지 못했다.
- 되돌리기: 앱을 끈 뒤 백업 폴더를 프로그램 폴더로 되돌린다. 원래 v4 app.asar는 `%LOCALAPPDATA%\SYNK\platform-signal2-backup-20261010\app.asar`에도 있다.
- 실제 계정 로그인·실행 화면은 보지 않았다(앱을 켜지 않음).

## WORLD·Workspace 재설치 (2026-10-10 11:06~11:07)

유호님 「웅 둘 다 재설치해줘」에 따라 같은 폴더의 WORLD·Workspace 설치 파일(10-10 새벽 파일 그대로)로 두 앱을 다시 설치했다. 목적은 빠진 Windows 설치 등록을 되살리는 것이다.

- 설치 전 대조([children-before.json](children-before.json)): 두 설치 파일 모두 7-Zip CRC 통과. 설치된 폴더의 파일은 payload와 하나도 다르지 않았다(WORLD 74개, Workspace 75개 + 각 제거 프로그램). 그래서 바뀐 것은 등록과 바로가기뿐이다.
- 절차는 Platform과 같다([install-children.ps1](install-children.ps1)): 세 앱 꺼짐 확인 → 프로그램 폴더 전체 백업(`.tmp/platform-reinstall-signal2-20261010/SYNKWorldPreview-backup`·`SYNKMessengerPreview-backup`, 각 391MB)·해시 대조 → NSIS `/S` → payload·파일 목록·등록·HKLM 안 씀·시작 메뉴 바로가기·자동 실행 없음 확인. 영수증 [WORLD](installed-world.json) **90/90**(11:06:14~11:06:59, 종료 0), [Workspace](installed-messenger.json) **91/91**(11:06:59~11:07:22, 종료 0).
- 이제 SYNK 세 앱이 모두 「설치된 앱」 목록에 있다: 「SYNK Platform Preview 0.4.0」, 「SYNK WORLD Preview 0.4.0」, 「SYNK Workspace Preview 0.4.0」.
- Platform의 자식 앱 확인값(runtime.json의 asar·실행 파일 SHA·버전)이 설치된 WORLD·Workspace와 맞는다. Platform 화면에서 두 앱이 「설치됨」으로 잡힌다.
- 바로가기: Workspace는 새 이름 「SYNK Workspace Preview」 바로가기가 시작 메뉴와 바탕화면에 생겼다. 10-08에 만든 옛 이름 「SYNK Messenger Preview」 바로가기도 두 곳에 남아 있다. 둘 다 같은 실행 파일을 연다. 유호님 「웅 옛 바로가기 지워줘」로 옛 바로가기 두 개를 휴지통으로 옮겼다(되살리려면 휴지통에서 복원). 새 바로가기 두 개는 그대로다.

## 주의

- 이 PC 개인 재설치용이다. 서명 없는 Preview이고, 공개 다운로드로 쓰지 않는다(10-10 재설치 판정과 같음: Workspace 설치 파일에 진단 로그가 들어 있다).
- WORLD·Workspace 설치 파일은 10-10 파일 그대로라 안의 교사 그림에는 아직 C2PA 표시가 있다. 이 PC 안에서만 쓰는 파일이라 그대로 두었다.
- 예전 폴더 `desktop/artifacts/platform-reinstall-20261010/`의 Platform 설치 파일은 쓰지 않는다(바꾸기 전 화면).

## 작업 폴더 정리 (2026-10-10 20:25)

유호님 「재설치 작업 파일 정리해줘」에 따라 `.tmp/platform-reinstall-signal2-20261010`(3.8GB)와 `.tmp/platform-reinstall-worldbook-20261010`(2.3GB)를 지웠다. 빌드 재료·풀어 낸 payload·설치 전 프로그램 폴더 백업이 함께 지워졌으므로 **위의 백업 폴더로 되돌리기는 더 이상 할 수 없다.** 재설치 파일은 `desktop/artifacts/`의 두 폴더에 그대로 있다(하드 링크였던 원본을 지워도 남음, SHA 확인). C 드라이브 여유 17.3GB → 22.6GB.
