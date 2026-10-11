# SYNK Mac Preview 0.4.1 · 2026-10-12

Windows·WORLD 독립 실행에 이어 MacBook 설치판을 추가했다. **공개 대상은 Apple Silicon(M 시리즈), macOS 13 이상**이다. Intel판은 빌드·서명 검사에 통과했지만 3D 게임 실행 검증에 실패하여 배포하지 않는다.

[Pages 배포 성공](https://github.com/unmet23-lab/synk-policy/actions/runs/38159005935) · 공개17파일 SHA17/17 · 실제 한영/390px 브라우저 확인 완료.

공개 원천 커밋: `0e5f32178527ce0c59c2cef7d55c7ddf3d1d6107` · 홈페이지 원문 `bca9d729ec551d1f06b64eebb859fec809119f8d`.

## 공개 결과

- [다운로드 홈페이지](https://synk.im/#platform)와 [Preview 릴리스](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.1-20261012). Mac 세 DMG(Platform·WORLD·Workspace)를 공개했고 각 파일의 익명 전체 다운로드 SHA-256·크기가 manifest와 일치한다. `arm64/public-downloads.json`, `release-final.json` 참고.
- 홈페이지는 Apple Silicon 다운로드·macOS 13 이상·Applications 설치·미공증 첫 실행 안내를 제공한다. Intel 설치 버튼은 제공하지 않는다. 홈페이지의 실제 공개 확인 결과는 `public-site.json`과 `homepage-public*.png`에 보관한다.
- WORLD는 공개 HTTPS 서비스에 연결하므로 Node.js나 별도 개발 서버가 필요 없다. 인터넷은 필요하다. Platform은 로컬 renderer와 해당 CPU의 WORLD·Workspace 설치 파일을 포함한다.

## 검증

| 대상 | 실제 결과 |
| --- | --- |
| Apple Silicon 실제 DMG 복사·서명·CPU·해시·설치 pin | 38/38 |
| 실제 WORLD 시작→기본 학습→3D 게임 이동·일시정지→계정 복귀 | 15/15 |
| 연결 실패 안내→HTTPS 재연결 | 10/10 |
| Platform 로컬 실행·두 앱 인식·동봉 DMG 준비 | 16/16 |
| 홈페이지 한영 빌드·행동 계약 | 29/29 |
| 원천 패키징·보안 / 수명주기·경로·renderer | 30/30 / 31/31 |

- [Apple Silicon 통과 CI 38153512498](https://github.com/unmet23-lab/synk-policy/actions/runs/38153512498). 실제 DMG에서 격리 Applications로 복사한 서명 앱을 새 프로필로 실행했다. WORLD는 16개 음성과 실제 Three.js 프레임 진행·이동을 확인했다. 계정 provider 요청·개발 서버 요청·pageErrors는 0이다.
- 첫 빌드38152987511에서 Platform 서명 도중 동봉 DMG가 재서명되어 pin이 달라지는 문제를 검출했다. 두 DMG 경로만 재서명에서 제외하고 상위 앱 리소스 봉인을 유지하여 수정했다.
- Intel 기본 CI38153512498은 GPU의 GL 초기화 실패, SwiftShader CI38154830885는 Vulkan 초기화 실패였다. Rosetta CI38156112969의 실제 x64 앱은 Three.js를 생성했으나 frames=4·elapsed=0.15에서 진행을 확인하지 못했다. 이 실행의 별도 preflight는 processArch=arm64여서 Intel 증거로 사용하지 않는다. 이후 목표 CPU 일치 검사를 추가했다.
- 표시 창38157423326과 프레임 제한 해제38158251085에서도 같은 x64 설치 파일의 게임 진행 검사가 실패했다. 마지막 실행은 visible=true·focus=true·paused=false·pageErrors=[]이며 52.6초 동안 RAF29회, 게임 frames4·elapsed0.15였다. 정확한 원인은 미확정이다. `x64/`에 후보 manifest와 실패 결과를 보관한다. **이 후보는 공개하지 않았다.**

## 재현 원천과 범위

[공개 고정 원천·빌더](https://github.com/unmet23-lab/synk-policy/tree/main/.github/desktop-preview)는 기존 공개 Windows Platform·WORLD0.4.1와 Workspace0.4.0에서 추출한321파일을 고정하고, Mac 설치 안내6곳만3renderer파일에 적용한다. 각 소스 SHA와 공개 설정을 검증한다. 원천·QA 보관본은 이 폴더의 `build.cjs`, `mac-renderer-overlay.json`, `source-validation.json`, `native-smoke.cjs`, `run-macos-qa.cjs`다. 앱은 ad-hoc 서명이며 Developer ID 서명·Apple 공증·자동 업데이트는 없다.

CI 실행은 실제 사용자 MacBook의 Gatekeeper 승인·Keychain 재승인·운영 계정 로그인/재로그인 인수를 대신하지 않는다. Platform에서 자식 DMG를 준비하고 설치된 앱을 인식한 것까지 확인했으며 Platform을 통한 자식 프로세스 실행은 검사하지 않았다. 현재 Windows 설치본·실사용자 프로필은 변경하지 않았다. 실제 Intel Mac에서 게임 실행을 확인한 후에만 Intel 배포를 재개한다.

## 공식 근거

2026-10-12 확인: [Electron44 macOS13 요구](https://www.electronjs.org/blog/electron-44-0), [Apple 첫 실행 안내](https://support.apple.com/ko-kr/102445), [Electron-builder 서명](https://www.electron.build/v26/docs/mac/), [Chromium 프레임 스위치 정의](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/viz/common/switches.cc). Vulkan loader 관련 [CEF upstream 기록](https://github.com/chromiumembedded/cef/issues/4230)은 참고 근거이며 이번 Intel 실패의 원인으로 확정하지 않는다.
