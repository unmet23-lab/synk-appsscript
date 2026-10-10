# Platform 재설치 파일·재설치 · WORLD 펠트 책 (2026-10-10)

유호님 「웅 재설치 파일 만들어서 재설치해줘」에 따라, WORLD 대표 그림을 펠트 책으로 바꾼 변경(appsscript `6974907b5`)을 Platform 재설치 파일에 넣고 이 PC에 다시 설치했다.

**쓸 폴더: `desktop/artifacts/platform-reinstall-worldbook-20261010/`** (git 밖, 이 PC 전용). 앞선 [시그널 2 재설치 파일](../platform-reinstall-signal2-20261010/README.md)은 WORLD가 장면 그림인 판이라 이제 쓰지 않는다.

| 제품 | 설치 파일 | 바이트 | SHA-256 | 앞 판과 |
| --- | --- | ---: | --- | --- |
| Platform | SYNK Platform Preview-0.4.0-win-x64.exe | 397290468 | `2991c11edf2232d832a98a2c21a386729451dc2d6bef7506bce2144e51d7f0f9` | 새로 만듦 |
| WORLD | SYNK WORLD Preview-0.4.0-win-x64.exe | 132343097 | `537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4` | 같은 파일(하드 링크) |
| Workspace | SYNK Workspace Preview-0.4.0-win-x64.exe | 132289230 | `b1028c0891ba7dfe69c0958c41eb3fc2b2b5569104682906b03da794f298f16b` | 같은 파일(하드 링크) |

## 만든 방법

- 바탕은 시그널 2 재설치의 빌드 재료(`.tmp/platform-reinstall-signal2-20261010/platform`)다. 그 앱 묶음은 이번 설치 직전의 PC 설치본과 같은 판이다.
- 앱 묶음 안에서 WORLD 변경만 얹었다([build.cjs](build.cjs)).
  - 화면 파일 네 개(`renderer/state.mjs`·`member-home.mjs`·`index.html`·`launcher.css`)의 해당 줄. 결과는 커밋 `6974907b5`의 파일과 바이트까지 같다.
  - `assets/launcher/world-book.avif` 추가: 원본 `docs/Loom_자산/구움/공방_책.avif` 그대로.
  - 그림 목록 `assets/launcher/sources.json` 두 군데: 교사 그림의 새 해시(C2PA 뺀 판)와 책 한 줄. 실행 중에는 읽지 않는 기록이다.
- 실행 파일·`synk-install.json`·`runtime.json`(인증·자식 설치 파일 pin)·`package.json`·자식 설치 파일 두 개, 버전 0.4.0, appId, 설치 폴더, NSIS 설정은 그대로다.

## 확인

- **설치 파일을 실행하지 않고 읽어서 26/26**([verification.json](verification.json)): CRC, payload 76개 = 빌드 폴더, 앞 재설치 payload와 비교해 `resources/app.asar`만 다름. 앱 묶음 안에서 바뀐 것은 위 다섯 파일이고, 더해진 것은 책 그림 하나다. 책은 원본과 같고 제작 도구 표시가 없다. 화면 파일은 커밋과 같고, 나머지 묶음 정보·실행 파일·자식 설치 파일 pin·NSIS GUID `c4ee183e-…`·빌더 설정(경로 말고)도 같다.
- 새 앱 묶음을 숨김 Electron(합성 계정, 바깥 요청 차단)으로 열었다: 34개 화면, 오류 0, 바깥 요청 0. 내 홈 「다음 할 일」 포스터와 앱 상세에 펠트 책이 뜬다.

## 이 PC 재설치 (11:30~11:31)

- 절차([install.ps1](install.ps1)): SYNK 세 앱 꺼짐 확인(끄지 않음) → 설치본이 시그널 2 재설치 판인지 해시 확인 → 프로그램 폴더 전체를 `.tmp/platform-reinstall-worldbook-20261010/installed-program-backup`(643MB)에 백업·대조 → NSIS `/S`.
- 종료 코드 0. **확인 95/95**([installed-platform.json](installed-platform.json)): payload 76개 바이트·해시, 폴더 파일 목록, 연결 지점 없음, 등록(「SYNK Platform Preview 0.4.0」, 0.4.0, 제거 명령, 앱 키 설치 위치), HKLM 안 씀, 시작 메뉴·바탕화면 바로가기, 자동 실행 없음. 시그널 2 때 멈췄던 등록 확인은 이번엔 바로잡은 기준으로 한 번에 통과했다.
- 설치된 app.asar는 `a17239235adb…`(새 묶음)다. WORLD·Workspace는 건드리지 않았다.
- 실제 계정 로그인·앱 실행 화면은 보지 않았다.
- 되돌리기: 앱을 끈 뒤 백업 폴더를 프로그램 폴더로 되돌린다.

## 작업 폴더 정리 (2026-10-10 20:25)

유호님 「재설치 작업 파일 정리해줘」에 따라 `.tmp/platform-reinstall-signal2-20261010`(3.8GB)와 `.tmp/platform-reinstall-worldbook-20261010`(2.3GB)를 지웠다. 빌드 재료·풀어 낸 payload·설치 전 프로그램 폴더 백업이 함께 지워졌으므로 **위의 백업 폴더로 되돌리기는 더 이상 할 수 없다.** 재설치 파일은 `desktop/artifacts/`의 두 폴더에 그대로 있다(하드 링크였던 원본을 지워도 남음, SHA 확인). C 드라이브 여유 17.3GB → 22.6GB.
