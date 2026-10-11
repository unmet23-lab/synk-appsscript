# SYNK Mac Preview 0.4.1 · 2026-10-12

Windows·WORLD 독립 실행에 이어 **macOS 13 이상 Apple Silicon(M 시리즈)·Intel**용 Platform·WORLD·Workspace DMG를 제공한다. [홈페이지](https://synk.im/#platform) · [Preview 릴리스](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.1-20261012).

Intel 공개 원천은 `96e7847f2651cc680cbb00fe237ffd4072ea26e4`, 홈페이지 원문은 `74fe54b`다. 기존 WORLD 공개 변경 `5c79e12`까지 보존했다. [Pages 배포](https://github.com/unmet23-lab/synk-policy/actions/runs/38162775426) · [사이트 점검](https://github.com/unmet23-lab/synk-policy/actions/runs/38162775495). 최종 배포 상태와 실제 화면은 `deployment.json`, `public-site.json`, `public-browser.json`으로 확인한다.

## 다운로드와 설치

- Mac은 Apple Silicon `mac-arm64.dmg`, Intel `mac-x64.dmg`로 구분한다. 두 종류 모두 macOS 13 이상이다. 홈페이지 한영 버튼과 설치 안내·질문 답변·llms.txt를 함께 갱신했다.
- WORLD는 공개 HTTPS 서비스에 연결한다. 인터넷이 필요하며 Node.js나 별도 개발 서버는 필요 없다. Platform은 로컬 renderer와 해당 CPU의 WORLD·Workspace 설치 파일을 포함한다.
- DMG 앱을 Applications에 원래 이름으로 복사하고 Platform에서 설치 상태를 새로고침한다. ad-hoc 서명 Preview로 Developer ID 서명·Apple 공증·자동 업데이트는 없다. 첫 실행 안내는 [Apple 공식 안내](https://support.apple.com/ko-kr/102445)를 따른다.
- Intel 세 파일을 비로그인 상태로 끝까지 내려받아 크기·SHA-256을 대조했다. `x64/fixed/public-downloads.json`, `mac-package-x64.json`, `SHA256SUMS-x64.txt`가 근거다. ARM 세 파일의 기존 전체 다운로드 근거는 `arm64/public-downloads.json`이다.

## Intel 수정과 검증

Electron 44.5.1의 Mac 배포본에 Chromium 151 이상에서 SwiftShader가 필요로 하는 `libvulkan.dylib`가 빠져 있었다. 공식 Khronos SDK 1.4.363.0의 고정 커밋에서 Intel·macOS 13용으로 빌드해 앱 서명 전에 포함했다. 라이선스·원천 커밋·빌드 전 SHA도 앱 안에 동봉한다. 기본 그래픽 선택과 앱 샌드박스, 기존 앱 소스는 유지했다.

- Vulkan-Headers: `6802bb4733b63ed5efd3adb308a6c885ef180ea1`
- Vulkan-Loader: `fa218055ff4948b159f31d43f800c808a13d51df`
- 설치 도구가 Rosetta에서 ARM Electron을 자동 선택하던 별도 진단 오류도 고쳤다. npm 설치 뒤 목표 CPU를 명시하여 Electron을 설치하고 실제 process.arch를 검사한다.

| 실제 설치 파일 검사 | Intel x64 | Apple Silicon arm64 |
| --- | --- | --- |
| DMG 복사·서명·CPU·해시·설치 pin | 41/41 | 38/38 |
| WORLD 시작→기본 학습→게임 진행·이동·일시정지→계정 화면 복귀 | 15/15 | 15/15 |
| 연결 실패 안내→HTTPS 재연결 | 10/10 | 10/10 |
| Platform 로컬 실행·두 앱 인식·동봉 DMG 준비 | 16/16 | 16/16 |
| 공개 DMG 전체 GET·SHA | 3/3 | 3/3 |

[Intel 통과 CI 38160482694](https://github.com/unmet23-lab/synk-policy/actions/runs/38160482694)는 **Intel macOS VM에서 실제 x64 앱**을 실행했다(process.arch=x64, RUNNER_ARCH=X64, translated=false). 실제 DMG를 격리 Applications에 복사하고 코드 서명을 검증한 뒤 새 프로필로 실행했다. 게임의 실제 프레임·시간 진행, 조작과 복귀를 확인했으며 provider 요청·개발 서버 요청·pageErrors는 0이다. `x64/fixed/`에 전체 결과를 보관한다. 화면 캡처는 VM의 그리기 지연이 있을 수 있어 개별 화면 표시 주장은 DOM 검사와 구분한다.

Intel CI에는 하드웨어 GPU가 없어 **검사 프로세스에만 SwiftShader 플래그**를 사용했다. 이 플래그는 앱 소스·설치 파일의 기본 실행 설정에 넣지 않았다. GPU 샌드박스를 끄지 않았다. 물리 Intel GPU의 성능을 증명하는 시험은 아니다. 별도 무디버거 Intel 진단에서도 WebGL2 픽셀과 실제 게임 64프레임·3.11초 진행을 확인했다.

[Apple Silicon 통과 CI 38153512498](https://github.com/unmet23-lab/synk-policy/actions/runs/38153512498)의 기존 설치 파일은 변경하지 않았다. 홈페이지 관련 웹 시험은 29/29 통과했다.

## 지원 조합과 남은 범위

**Intel 설치판은 Intel Mac에서, M 시리즈에서는 Apple Silicon 설치판을 사용한다.** x64 일반 Electron의 Rosetta·기본 Metal 진단은 진행했지만, 실제 패키지 Rosetta 검사38161673838은 frames4·elapsed0.15에서 멈췄다. 디버거 분리 검사38162193973도 시간 초과로 종료됐다. 이 조합을 통과했다고 보고하지 않으며 이번 Preview 지원 조합에서 제외한다. `x64/rosetta-default-failure/`에 근거가 있다. 실패한 디버거 변경은 QA 원천에서 되돌렸다.

CI는 실사용자 MacBook의 Gatekeeper 승인·Keychain 재승인·운영 계정 로그인/재로그인·물리 Intel GPU 성능을 대신하지 않는다. Platform에서 자식 DMG 준비와 설치된 앱 인식까지 확인했으며 Platform을 통한 자식 프로세스 실행은 검사하지 않았다. 실제 사용자 Windows 설치본·프로필은 변경하지 않았다.

## 재현과 이전 실패 기록

[공개 고정 원천·빌더](https://github.com/unmet23-lab/synk-policy/tree/main/.github/desktop-preview)는 기존 공개 Windows Platform·WORLD0.4.1와 Workspace0.4.0에서 추출한321파일을 고정한다. Mac 설치 안내6곳만3renderer파일에 적용하고, Intel 그래픽 라이브러리는 별도로 서명 전에 추가한다. 원천 SHA와 공개 설정·개인정보 패턴 검사를 통과했다. 원천·QA 보관본은 이 폴더의 `build.cjs`, `build-vulkan-loader.sh`, `mac-renderer-overlay.json`, `native-smoke.cjs`, `run-macos-qa.cjs`다.

이전 Intel 기본 GPU 초기화 실패38153512498, Vulkan 초기화 실패38154830885, Rosetta 게임 정지38156112969·38157423326·38158251085는 `x64/` 및 `intel-ci-gpu-failure/`의 과거 근거다. 이때의 후보는 공개하지 않았고 이번에 재빌드한 해시만 공개했다. 초기 Platform 서명 중 동봉 DMG가 재서명되는 문제는 두 동봉 DMG만 재서명에서 제외하여 수정했고 상위 앱 리소스 봉인은 유지했다.

공식 근거(2026-10-12 확인): [CEF Vulkan loader 누락 기록](https://github.com/chromiumembedded/cef/issues/4230), [Electron44 macOS13 요구](https://www.electronjs.org/blog/electron-44-0), [Electron 설치의 CPU 선택](https://github.com/electron/electron/blob/v44.5.1/npm/install.js), [Electron-builder 서명](https://www.electron.build/v26/docs/mac/).
