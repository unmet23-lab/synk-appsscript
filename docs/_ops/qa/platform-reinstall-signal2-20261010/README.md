# Platform 재설치 파일 · 싱ㅋ 시그널 2 (2026-10-10)

유호님 「재설치 파일 만들어줘」에 따라 현재 PC에 설치된 Platform(싱ㅋ 시그널 2 화면)과 같은 내용의 재설치 파일을 새로 만들었다. 10-10 새벽 재설치 파일([기록](../platform-reinstall-20261010/README.md))의 Platform 설치 파일에는 바꾸기 전 화면이 들어 있어서, 그걸로 다시 설치하면 새 화면이 사라지기 때문이다.

**쓸 폴더: `desktop/artifacts/platform-reinstall-signal2-20261010/`** (git 밖, 이 PC 전용)

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
- 실제로 설치하지는 않았다. 지금 PC의 Platform은 이미 같은 화면이다(다른 것은 교사 그림의 표시 조각뿐).

## 주의

- 이 PC 개인 재설치용이다. 서명 없는 Preview이고, 공개 다운로드로 쓰지 않는다(10-10 재설치 판정과 같음: Workspace 설치 파일에 진단 로그가 들어 있다).
- WORLD·Workspace 설치 파일은 10-10 파일 그대로라 안의 교사 그림에는 아직 C2PA 표시가 있다. 이 PC 안에서만 쓰는 파일이라 그대로 두었다.
- 예전 폴더 `desktop/artifacts/platform-reinstall-20261010/`의 Platform 설치 파일은 쓰지 않는다(바꾸기 전 화면).
