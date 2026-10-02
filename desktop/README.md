# SYNK 데스크톱 클라이언트

## 2026-10-02 현재 소스 — 내 작업실 통합

현재 **소스 개발 플랫폼**의 제품 목록은 WORLD·메신저·교사·PATH·PULSE·외부 창작자/파트너(Partners) 6개다. 실제 라이브러리는 계정 권한에 해당하는 항목만 표시한다. 교사·PATH는 별도 로컬 MVP, PULSE·Partners는 준비 중 상세다. 설치·실행·최근 이용 시간은 실제 확인된 상태만 표시한다.

**Studio의 제작·검토와 SHIFT의 AI 업무 연습은 SYNK Messenger → 내 작업실로 통합했다.** 플랫폼의 독립 Studio/SHIFT 항목, SHIFT 네이티브 미리보기와 `dev:shift` 명령을 종료했다. 제작 데스크·제작 도구·게시 전 점검은 기존 회사 작업 흐름을 사용하며 AI 업무 연습은 같은 작업실 안에서 이어간다. [회사 작업실 구현 범위](../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md), [재사용하는 실습 모듈](../experiences/shift-workbench/README.md)을 따른다. 별도 외부 기업 교육 고객 공간은 만들지 않는다. SHIFT 사업 브랜드와 기존 실습 원본·개인 저장 데이터는 삭제하지 않았다.

메신저 네이티브 저장은 회사의 고정 문서에서 발생한 자기 출처 blob, `synk-shift-practice.txt`, `text/plain`, 최대 64 KiB만 허용한다. 같은 Electron 쿠키 세션의 `/api/me`로 회사 로그인을 재확인하고, 비로그인·세션 철회·문서 이탈이면 다운로드를 취소한다. 기존 WORLD·플랫폼 JSON 규칙은 그대로다. 실제 숨김 Electron에서 같은 운영 핸들러로 합성 TXT의 저장 완료와 본문 일치, 철회 후 취소, CSP 아래 모듈 import를 확인했다([다운로드 검증 4항목](artifacts/workroom-download-smoke-20261002.json)). 실제 운영 직원 자료나 기존 설치 패키지를 사용한 검증은 아니다.

통합은 접근 권한의 승격이 아니다. 서버가 확인한 `library.messenger` 메뉴 권한과 실제 회사 구성원 권한이 각각 필요하다. 이전 `library.studio`·`library.shift` 권한은 무시하며 Messenger로 바꾸지 않는다. 이전 즐겨찾기·선택·실행 기록의 퇴역 앱 키는 제거해 읽고, 현재 계정에서 허용된 첫 앱을 표시한다. 관심사에 ‘AI 업무 연습’이나 ‘콘텐츠 제작’을 골라도 권한이 없는 Messenger가 나타나지 않는다.

개발 플랫폼의 **교사 앱 미리보기**는 이제 `classroom-main.cjs`를 실행해 로컬 수업 연결 서버(4295)와 별도 세션의 WORLD·교사 창을 함께 연다. `desktop`에서 `npm run dev:classroom`으로도 실행한다. 닫은 창을 다시 열 수 있고 계정·회사·설치 IPC는 제공하지 않는다. [현재 연결 범위와 검증](../experiences/teacher-world/README.md)을 따른다. 기존 합성 데모는 `node experiences/teacher-world/server.mjs`(4290) + `npm run dev:teacher`로 보존했다. 정식 SSO·운영 학생·배포 패키지를 새로 연결한 것은 아니다.

## PATH VR 로컬 MVP

[PATH 구현·검증](../experiences/path-vr/README.md)을 따른다. 저장소 루트에서 서버를 시작한다.

```powershell
node experiences/path-vr/server.mjs --port 4292
```

소스 플랫폼에서는 서버가 확인한 `library.path` 메뉴 권한이 있는 계정에만 **PATH MVP 열기**가 나타난다. 운영 SSO가 아직 연결되지 않은 개발 환경에서 직접 검토하려면 `desktop`에서 `npm run dev:path`를 실행한다. 테스트 역할을 운영 화면에 추가하거나 게스트에게 모든 앱을 노출하지 않는다.

PATH는 `im.synk.path.preview` 프로필과 세션을 사용한다. `synkProduct` 브리지는 환경·미연결 인증 상태와 PATH의 고정된 VR 브라우저 입구만 제공한다. 회사·WORLD 인증 토큰, 설치 API, 임의 URL 열기를 전달하지 않으며 다운로드도 허용하지 않는다. SHIFT의 이전 네이티브 실행 인자는 거부한다.

PATH의 네이티브 창은 PC 3D 모드다. 사용자가 **VR 지원 브라우저로 열기**를 선택하면 이 PC의 고정된 `http://127.0.0.1:4292/`를 연다. 실제 몰입형 VR은 WebXR 지원 브라우저·장비에서 확인해야 한다. 다른 기기의 헤드셋이나 휴대전화에서 이 PC의 loopback 주소에 접속할 수 있다고 안내하지 않는다. HTTPS 호스팅·기기 간 접근은 후속 범위다.

이 연결은 미패키징 개발 플랫폼에서만 활성화된다. 기존 설치 파일과 정식 업데이트 채널은 바꾸지 않았다. 운영 SYNK ID 동기화·서명된 설치본·실제 macOS/모바일·헤드셋 설치와 동작 검증은 MVP 이후다.

통합 후 검증: desktop 전체 **132개 시험**, 합성 계정의 1280/390/320px 실제 렌더러 **87항목** 통과. 계정별 메뉴·퇴역 권한 거절·선택/즐겨찾기 정리·메신저 작업실 설명·PATH 실행 경계를 확인했다. 넘침·콘솔 오류·외부 네트워크 요청은 없었다. 최신 화면 결과는 [라이브러리 화면 검증](artifacts/renderer-account-library-responsive-20261002.json)에 있다. 과거 [초기 확장 화면 검사](artifacts/renderer-expansion-responsive-20261002.json)와 [제품 클라이언트 검증](artifacts/product-native-smoke-20261002.json)의 독립 Studio/SHIFT 화면은 현재 메뉴가 아닌 이전 이력이다.

**2026-10-02 저녁 0.4.0 Windows 개발판 6개를 새로 묶었다.** 사용자 「남은 일 전부 최신화」(펠트 부품 흰 띠 정리 후속)에 따라 그때의 소스(작업실 통합·계정별 라이브러리·제품 확장·흰 띠를 걷은 런처 펠트, 소스 해시 `bd3430c784be…`)를 그대로 담았다. 정식 로그인·공개 업데이트·실제 설치 검증은 사용자 결정대로 MVP 이후다. 묶은 뒤에 바뀐 소스는 다시 묶기 전까지 소스 개발 플랫폼으로 확인한다.

> 이전 패키지 이력: 0.3.0 설치 파일 6개는 독립 PC 런처를 포함한 작업실 통합 이전 개발판이다. 플랫폼 화면은 앱에 번들되며 웹 개발 서버 없이 열린다. 운영자 공개 설정은 포함하지 않아 실제 로그인은 준비 중으로 표시된다. 기존 0.1.0·0.2.0·0.3.0 파일은 보존했다.

2026-10-02 기준. 플랫폼, WORLD, 사내 메신저는 **별도 설치·실행·저장 공간**을 갖는다. 0.4.0 플랫폼은 `synk-desktop://platform/index.html`에서 번들 화면·승인 자산을 열고, PC 창 제어와 앱 설치·실행 관리를 맡는다. 플랫폼 화면은 4280 서버에 의존하지 않는다. WORLD·메신저의 개발 서비스 연결은 그대로 분리해 둔다. 계정은 [로그인 구현·검증 기록](AUTH.md), 설치·실행은 [앱 수명주기 계약](LIFECYCLE.md)을 따른다. Mac 빌드 설정은 있지만 이 Windows 호스트에서 실제 Mac 설치 파일을 생성·실행한 것은 아니다.

## 생성한 Windows 설치 파일

아래 파일은 **서명되지 않은 개발판(0.4.0)**이다. 공개 배포판이 아니다. 플랫폼은 자체 번들 화면으로 부팅하며 WORLD·메신저의 개발 서비스는 각 로컬 서버가 필요하다. 설치 프로그램은 실행하지 않았고 설치·제거·설치 후 앱 간 실행은 아직 실제 기기에서 검증하지 않았다. 설치 완료 시 앱은 자동으로 열리지 않는다.

| 앱 | 일반 Windows PC — x64 | Windows ARM64 |
| --- | --- | --- |
| SYNK Platform Preview | [설치 파일](<dist/preview/win32/x64/platform/SYNK Platform Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/platform/SYNK Platform Preview-0.4.0-win-arm64.exe>) |
| SYNK WORLD Preview | [설치 파일](<dist/preview/win32/x64/world/SYNK WORLD Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/world/SYNK WORLD Preview-0.4.0-win-arm64.exe>) |
| SYNK Messenger Preview | [설치 파일](<dist/preview/win32/x64/messenger/SYNK Messenger Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/messenger/SYNK Messenger Preview-0.4.0-win-arm64.exe>) |

플랫폼 설치 파일에는 WORLD·메신저의 개발 설치 파일 두 개를 포함한다. 포함했다는 이유로 두 앱을 자동 설치하지 않으며, 라이브러리에서 각 앱의 설치 준비와 설치 시작을 따로 누른다.

설치 파일·실행 파일·ASAR의 절대 경로와 SHA-256, CPU 형식, 소스·번들 자산 일치는 [패키지 검사 결과](artifacts/package-verification.json)에 있다. [서명 검사 결과](artifacts/package-signatures.json)는 0.4.0 6개 모두 NotSigned다. dist, .stage, artifacts는 로컬 생성물로 Git에 포함하지 않는다.

| 0.4.0 설치 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| 플랫폼 x64 | 395811266 | `697e015392833792ab2dcfd8154786aef21057f9d6168c36d099b8ccd5a947b1` |
| WORLD x64 | 132194294 | `c576a12bfc8c995ab78c38183519ca5562dbbab148d846accaa5f015b4e9efe2` |
| 메신저 x64 | 132140267 | `1b470951bed9af48ec3594109d040ab12d86ea2b1ddc912e0f41a9994ca3e0b4` |
| 플랫폼 ARM64 | 377485857 | `ce542833ff2ececc3a0f67b53e773674cdb223eb8a47e311571f1147404e376f` |
| WORLD ARM64 | 126086171 | `1e6b7f7f62bb3b59c83f5871b7425c119cca8e3ec897d5f8d4cb14f5eac45b28` |
| 메신저 ARM64 | 126033730 | `c18939e2f5f033ab96d202e52e3fd3edd6216d46869dd2d894d0deba1480aef2` |

이전 0.3.0 설치 파일(보존):

| 0.3.0 설치 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| 플랫폼 x64 | 358702733 | `567e40ebedc29437d758b91c8433fba51eb85b988c7d8f7eb104357c95d2e781` |
| WORLD x64 | 119743754 | `655af3811ccb85be4582b2c45a3bc8fcf1fdc3618836eaa1009b56979b80a064` |
| 메신저 x64 | 119689645 | `261ddeca4c7768140f478325e2e864a04ac666a939db349c7c67dc2790c84474` |
| 플랫폼 ARM64 | 340378202 | `aad928129e59102365a832d5460401e3124a771bf34dd5807c24f3f8dbaad650` |
| WORLD ARM64 | 113635682 | `504017afb0a83ec97b9cde579ca5b922b1956e96003e21be11597b5825b18a94` |
| 메신저 ARM64 | 113583196 | `1ee0b614addd8c92427a9ddbb6e64b20e68fb0ebecd0b0b22d75d5efa27797f8` |

| 앱 | 현재 입구 |
| --- | --- |
| 플랫폼 | synk-desktop://platform/index.html — 앱 내부 번들 |
| WORLD | http://127.0.0.1:4280/synk-account/client.html?product=world |
| 메신저 | http://127.0.0.1:4191/?tab=messenger |

WORLD·메신저의 실행 파일에 서비스와 데이터베이스를 포함한 것은 아니다. 플랫폼 화면은 4280 없이 열리지만, 개발 WORLD의 학습 기능과 메신저 서비스에는 각각의 서버가 필요하다.

## 앱 구분과 실행 계약

| 앱 | 정식 appId | 정식 실행 이름 | 개발판 appId / 실행 이름 |
| --- | --- | --- | --- |
| 플랫폼 | `im.synk.platform` | `SYNKPlatform` | `im.synk.platform.preview` / `SYNKPlatformPreview` |
| WORLD | `im.synk.world` | `SYNKWorld` | `im.synk.world.preview` / `SYNKWorldPreview` |
| 메신저 | `im.synk.messenger` | `SYNKMessenger` | `im.synk.messenger.preview` / `SYNKMessengerPreview` |

Electron `userData`는 OS의 `appData/SYNK Desktop/<appId>`에, Chromium 세션은 그 안에 둔다. 세 앱과 개발판·정식판은 저장 공간을 공유하지 않는다. SYNK ID를 공통 계정으로 쓰는 것과 각 앱의 토큰·기록을 자동 복사하는 것은 별개다. 이번 셸은 인증 토큰을 앱 간 전달하지 않는다.

Windows 설치 위치는 `%LOCALAPPDATA%/Programs/<실행 이름>/`, Mac 빌드의 앱 이름은 `<실행 이름>.app`이다. 실제 Electron Builder의 `productFilename`과 NSIS 설치 경로를 회귀시험으로 대조했다. 런처는 Windows의 해당 고정 위치와 Mac의 `/Applications/`만 찾는다.

앱 관리용 브리지는 다음과 같다. 계정용 제한된 브리지는 [AUTH.md](AUTH.md)에 따로 정의했다.

```js
await window.synkDesktop.getEnvironment(); // clientId, mode, platform, arch, version, sessionScope
await window.synkDesktop.getClients();     // id, name, status, canLaunch, reason, version?
await window.synkDesktop.launch('world');   // { ok: true } 또는 { ok: false, code }
await window.synkDesktop.prepareClient('world'); // 로컬 설치 파일 복사·SHA 확인
await window.synkDesktop.cancelPreparation('world');
await window.synkDesktop.openInstaller('world'); // 명시적 클릭에서만 OS로 열기
const unsubscribe = window.synkDesktop.onClientsChanged(clients => {});
```

실행·설치는 플랫폼에서만 허용된다. `world`·`messenger` 등 고정 ID로 해당 앱의 설치 메타데이터와 실행 파일·ASAR 해시를 확인한 뒤 `shell:false`로 실행한다. 임의 경로·명령·다운로드 URL은 받지 않는다. 설치 정보나 승인한 해시가 없으면 실행하지 않는다. 개발판은 WORLD → 메신저 → 플랫폼 순서로 빌드하고, 플랫폼에 최신 두 앱의 검증된 설치 파일과 실행 해시를 넣는다. 승인된 구버전 실행 해시는 보존한다. 직접 실행하는 개발 런처는 `tools/build-client-catalog.cjs`로 생성한 고정 카탈로그를 읽는다. 공개 다운로드·자동 업데이트 서버는 연결하지 않았다.

설치 파일 준비 진행률은 실제 로컬 복사 바이트다. 준비를 취소할 수 있고, 준비 완료 후 별도의 설치 버튼으로 열기 직전에 다시 해시를 검사한다. 설치 프로그램 열기를 설치 완료로 표시하지 않는다. 실제 설치 확인과 버전 비교·업데이트 상태는 고정 OS 경로의 파일 검사 결과를 사용한다. 자세한 상태와 검증은 [LIFECYCLE.md](LIFECYCLE.md)에 있다.

## 확인한 범위

- 전체 데스크톱 시험 **58개 통과**. 기존 셸·인증 경계, 설치 파일 준비·취소·변조 거절, 구버전 실행과 업데이트 비교, 번들 프로토콜, 렌더러 상태와 실제 문서 연결을 검사했다.
- [실제 Electron 플랫폼 검사](artifacts/platform-native-smoke.json): Windows x64 Electron 44.5.1의 숨김 창에서 라이브러리·설치 관리·설정·검색·즐겨찾기와 설정 유지·상세/계정 대화상자·키보드·폰트·창 제어 허용 목록 **14항목**을 통과했다. HTTP/HTTPS/WS/WSS 요청을 차단해도 번들 화면이 열렸고 네트워크 요청·콘솔 오류는 0이었다. 설치 프로그램·WORLD·메신저 실행과 실제 로그인은 이 검사에서 시작하지 않았다.
- [실제 0.4.0 패키지 부팅 검사](artifacts/package-native-smoke.json): x64 패키지의 SYNKPlatformPreview.exe를 직접 실행해 내부 번들 입구, 네트워크 없는 부팅, IPC 경계, DPAPI 암호화 보관을 확인했다. **설치 프로그램 실행이나 설치 완료 증거는 아니다.** 초기 compositor 프레임인 platform-packaged-hidden-preview.png는 시각 검증 근거로 쓰지 않는다.
- [반응형 화면 검사](artifacts/renderer-responsive-20261002.json): 번들 렌더러의 960·390·320px에서 페이지와 본문 가로 넘침 0, 앱 선택·설치 관리·설정과 접근 가능한 계정 입구를 확인했다. 브라우저의 표시 검사이며 Android/iOS 네이티브 패키지·기기 검증이 아니다. 실제 PC 창의 접근성 입구도 확인했지만 GUI 도구의 좌표·캡처 불일치로 해당 방식의 클릭 검증은 주장하지 않는다. 후속 실제 패키지의 보이는 독립 창에서 0.3.0 메신저 라이브러리·설치 상태·114.1 MB 표시와 완성 렌더를 확인했다. 사용자가 Escape로 컴퓨터 제어를 중단한 뒤 추가 입력하지 않았다.
- [패키지 검사](artifacts/package-verification.json): 0.4.0 설치 파일 6개, x64/ARM64 실행 형식, 소스·렌더러·승인 자산의 ASAR 바이트, 앱 ID·버전·실행 해시, 플랫폼 안의 WORLD·메신저 설치 파일 두 개를 대조했다. 운영 인증 공개 설정은 미제공으로 authConfigured:false다.
- [설치 파일 수명주기 검사](artifacts/lifecycle-smoke.json): 실제 WORLD 0.4.0 파일 **132,194,294바이트** 복사·SHA 검증과 메신저 준비 취소를 통과했다. OS 설치 위치는 합성 미설치 경로를 썼으며 설치·앱 실행 함수 호출은 0이다. [상태·회귀 계약](LIFECYCLE.md).
- Windows 설치 파일 6개는 모두 서명되지 않았다. **미실시**: NSIS 설치·제거, 설치한 앱 간 실제 실행, Windows ARM64 실행, Mac 설치 파일·실기기 실행·서명·공증, 운영 SYNK ID 연결, 공개 배포·자동 업데이트.

아래는 실제 Electron 소스 실행에서 위 14항목을 검사한 뒤 캡처한 완성 화면이다. 웹 브라우저 화면이나 설치 완료 증거로 대체하지 않는다. [WORLD 라이브러리](artifacts/platform-hidden-preview.png) · [메신저](artifacts/platform-messenger-hidden-preview.png) · [설치 관리](artifacts/platform-downloads-hidden-preview.png) · [설정](artifacts/platform-settings-hidden-preview.png).

![SYNK 플랫폼 — 실제 Electron 라이브러리](artifacts/platform-hidden-preview.png)

## 보안 경계와 현재 기능 제한

`sandbox`, `contextIsolation`, `webSecurity`를 켜고 Node·webview·임의 팝업·임의 외부 실행은 끈다. IPC는 해당 창의 최상위 프레임과 정확한 입구 경로를 확인한다. 클라이언트끼리 같은 origin을 쓰더라도 상대 입구를 같은 창에서 열 수 없다. 허용한 웹 체험 링크만 기본 브라우저로 연다. 자식 게임 문서의 `frame-ancestors`는 `'self'`, 최상위는 `'none'`이다.

플랫폼 렌더러는 외부 네트워크 연결과 iframe을 허용하지 않으며 계정·설치 기능은 허용된 main-process 브리지를 사용한다. WORLD의 연결된 학습 기록은 같은 origin의 `application/json` Blob 및 정해진 파일 이름으로 **최대 32 MiB**까지 저장할 수 있다. 메신저 첨부파일 저장과 마이크·카메라 권한은 아직 별도 허용 흐름을 구현하지 않았다. OAuth는 기본 브라우저와 일회성 loopback 콜백을 사용하며 운영자 공개 설정·클라이언트 등록이 필요하다.

아이콘은 기존 승인 자산을 색·모양 변경 없이 흰 바탕에 배치해 PNG·ICO·ICNS로 변환했다. [원본 경로·해시 기록](assets/sources.json), [변환 도구](tools/icons.cjs)에 재현 방법이 있다. 플랫폼은 SYNK 로고, WORLD는 책, 메신저는 노트북 자산을 사용한다.

## 재현과 Mac 빌드

`desktop`에서 Node 24와 잠금 파일을 사용한다.

```powershell
npm ci
npm test
node tools/smoke.cjs
node tools/package.cjs --mode=development --platform=win32 --arch=x64
node tools/package.cjs --mode=development --platform=win32 --arch=arm64
node tools/verify-packages.cjs
node tools/build-client-catalog.cjs
node tools/lifecycle-smoke.cjs
```

전체 세 앱의 `smoke`에는 WORLD·메신저 로컬 서버가 필요하다. 플랫폼 자체는 서버 없이 열린다. 직접 화면을 열려면 `npm run dev:platform`, `npm run dev:world`, `npm run dev:messenger`를 사용한다.

Mac에서는 다음 명령이 DMG와 ZIP을 만드는 빌드 경로다. 이 호스트에서 실제 성공을 확인한 명령은 아니다.

```sh
npm ci
npm test
CSC_IDENTITY_AUTO_DISCOVERY=false node tools/package.cjs --mode=development --platform=darwin --arch=x64
CSC_IDENTITY_AUTO_DISCOVERY=false node tools/package.cjs --mode=development --platform=darwin --arch=arm64
```

[macOS 빌드 workflow](macos-build.workflow.yml)는 `macos-latest`의 x64/ARM64 작업과 artifact 업로드를 준비한 **비활성 템플릿**이다. `.github/workflows/`에 등록하거나 CI를 실행하지 않았다. 서명·공증과 실제 Mac 기기 확인은 남아 있다.

Windows의 Electron Builder는 Mac 빌드를 거절했다. 공식 `@electron/packager` 20.3.0으로 WORLD ARM64 `.app` 생성도 시도했지만 아래 메시지로 종료됐다. [실행 로그](artifacts/mac-cross.log)에 남겼으며, 권한을 높이거나 심볼릭 링크를 손실하는 압축으로 우회하지 않았다. x64 Mac 교차 패키징은 별도 실행하지 않았다.

```text
Cannot create symlinks (on Windows hosts, it requires admin privileges); skipping darwin platform
No Mac artifact created: this Windows host cannot create the required symbolic links. Build on macOS; no privilege escalation was attempted.
```

## 정식 배포 전 남은 일

공개 서버와 다운로드·업데이트 채널, 승인한 패키지 해시, 코드 서명, Mac 공증·기기 검증을 준비해야 한다. `--mode=release`는 별도 `--release-config`의 `version:1`, `approved:true`, WORLD·메신저의 HTTPS `entries` 및 `releases` 해시 목록을 요구하고 코드 서명을 강제한다. 로컬 주소는 개발 모드에만 허용하며 정식 서버 URL을 임의로 정하지 않았다. 이번 작업에서 운영 설정·배포·결제·인증 제공자 설정을 바꾸지 않았다.

기반 버전은 Electron **44.5.1**(공식 2026-09-29 안정판), Electron Builder 26.15.3, Electron Packager 20.3.0이다. [Electron 보안 지침](https://www.electronjs.org/docs/latest/tutorial/security), [44.5.1 공식 릴리스](https://releases.electronjs.org/release/v44.5.1), [Electron Packager 공식 문서](https://electron.github.io/packager/main/)를 확인했다.


## 전사용자 맞춤 입구·브랜드 색 — 2026-10-02

앱 상세·라이브러리는 승인 사업색과 실제 펠트 자산을 사용한다. 현재 독립 앱은 LAB 코럴·PATH 초록·PULSE 베리를 사용하며 메신저 작업실을 포함한 공통 도구는 SYNK Paper/Black을 바탕으로 한다. 자산 원본은 `assets/launcher/sources.json`의 실제 파일을 따른다.

처음 맞춤 설정에서 사용 맥락·목적·글자·설명량·움직임을 자발적으로 고르면 `renderer/personalization.mjs`가 Core의 `atlas/personalization.js`를 통해 추천과 라이브러리 순서를 바꾼다. 후속 계정별 표시 변경으로 추천 후보는 **현재 계정에 허용된 앱**으로 제한한다. 명시 동의 후 이 기기의 `SYNK ID / platform / launcher / SYNK` 범위에 저장하며 비로그인 설정만 `anonymous-local`을 쓴다. 변경·건너뛰기·삭제를 제공하고 계정 사이에 복사하지 않는다. 학습·회사 기록을 읽지 않고 서버 프로필·다른 기기 동기화로 표시하지 않는다. 준비된 앱의 설치·권한을 이 선택으로 부여하지 않는다.

- 아래 80개·32항목은 계정별 노출 변경 전의 검증 이력이다. 최신 검증은 다음 절을 따른다.
- 이전 확장판 이력 — 전체 `node --test desktop/tests/*.test.cjs`: 80개 통과. 이 중 renderer 개인화·표현 관련 28개.
- 이전 확장판 이력 — `node desktop/tools/renderer-responsive-smoke.cjs`: 숨김 Electron의 실제 렌더러에서 8개 앱×1280/390/320px와 설정 적용·복원·삭제, 32항목 통과. 넘침·JS 오류·외부 네트워크 요청 0.
- 결과: `artifacts/renderer-personalization-responsive-20261002.json`, `artifacts/platform-branded-{id}-{width}.png`, `artifacts/platform-personal-dialog-320.png`.

이 변경은 개발 소스와 그 검증에 반영되었다. 기존 배포용 설치 파일을 재생성하지 않았으며 운영 로그인·업데이트·실제 설치 검증의 MVP 이후 유예를 유지한다. [전사용자 개인화 방향과 역할별 적용](../docs/SYNK_전사용자_개인화_기반_20261002.md).

## 계정별 라이브러리 — 2026-10-02 후속

현재 6개 앱을 모든 계정에 펼치지 않는다. 인증된 계정 조회 결과를 `src/library-access.cjs`가 최소한의 `library:{status:'ready'|'unavailable',appIds:[]}`로 바꾸고, 렌더러는 그 목록만 사용한다.

- 활성 학생 소속 → WORLD. 교사·원장 소속 → 교사 앱. 학원 직원과 회사 직원을 같은 역할로 취급하지 않는다.
- 기존 WORLD `practice.plus` 이용권 → WORLD. 명시적 `platform / library.{앱ID}` 이용권 → 그 앱의 메뉴. 회사 데이터나 학생 데이터의 실제 접근은 각 서비스가 별도로 검사한다. 신규 이용권 발급·DB 변경은 하지 않았다.
- 여러 소속·이용권은 합집합, 확인 실패·복원 중에는 0개, 확인됐지만 연결된 앱이 없으면 빈 목록. 완전 비로그인 상태만 공개 WORLD 소개 1개를 표시한다.
- 사이드바·상세·검색·추천·즐겨찾기·설치 목록·다운로드 수를 함께 제한한다. 관심사 자기신고는 허용 앱의 순서만 바꾼다.
- 보기 설정 `synk-launcher-view-v1:account:{ID}`, 맞춤 설정 `synk.platform.launcher.personalization.v1:account:{ID}`는 이 기기의 계정별 저장이다. 기존 키는 비로그인 전용이다. 계정 전환·로그아웃 때 열린 앱/콘텐츠 상세를 닫으며 이전 명령의 늦은 결과를 새 계정에 기록하지 않는다.
- 창 포커스 복귀 시 `accountRequest('load')`로 소속·권한을 재확인한다. 만료·철회·계정 전환·응답 순서 역전은 실패 시 닫는 정책으로 처리한다.

정식 SSO 설정과 실제 사용자 계정 연결은 MVP 이후다. 검증은 합성 인증 서버와 합성 계정을 사용하며 새 패키지·공개 배포·실기기 설치를 뜻하지 않는다.

계정별 노출 초기 검증 이력: `node --test desktop/tests/*.test.cjs` 109개 통과. 현재 작업실 통합 검증은 문서 위의 132개 결과를 따른다. 같은 계정 갱신 중 선택·검색 보존, 이전 로그인·로그아웃 요청의 늦은 결과 무시, 실제 signed-out 이벤트 뒤에도 로컬 저장 삭제/서버 세션 종료 실패를 정확히 안내하는 회귀 시험을 포함한다. 병행 작업에서 갱신된 Atlas 원문은 `node desktop/tools/build-renderer-assets.cjs`로 소비 사본에 동기화했다.

당시 동기화된 사본으로 실제 숨김 Electron의 학생·교사·직원·고객·미연결·오류 상태와 1280/390/320px **69항목**, 실제 네이티브 브리지 **16항목**을 통과했다. 콘솔 오류·외부 네트워크 요청은 0개다. 테스트 전용 `tools/renderer-account-fixture.cjs`는 운영 화면의 역할 선택 기능이 아니며 인증·설치·클라이언트 실행을 하지 않는다. [최신 계정별 UI 결과(통합 후 87항목)](artifacts/renderer-account-library-responsive-20261002.json), [네이티브 결과](artifacts/platform-native-smoke.json), [학생 화면](artifacts/platform-account-student-1280.png), [교사 작은 화면](artifacts/platform-account-teacher-320.png).
