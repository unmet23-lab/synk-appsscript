SYNK Platform과 WORLD의 Preview 0.4.1입니다. Windows x64, macOS 13 이상의 Apple Silicon(M 시리즈)·Intel Mac용 설치 파일을 제공합니다.

- WORLD는 인터넷에 연결하면 Node.js나 별도 개발 서버 설치 없이 사용할 수 있습니다.
- WORLD 첫 화면에서 SYNK ID로 연결하거나 기본 학습을 바로 열 수 있습니다. 연결이 끊기면 앱 안에서 다시 연결할 수 있습니다.
- Platform 설치판에는 해당 운영체제·칩에 맞는 WORLD와 Workspace 설치 파일이 포함됩니다. Platform의 라이브러리에서 설치 파일을 준비해 각각 설치합니다.
- WORLD만 필요하면 `SYNK-WORLD-Preview-0.4.1-...` 파일을 받으세요.

## 다운로드 선택

| 기기 | 파일 끝부분 |
| --- | --- |
| Windows 64비트 | `win-x64.exe` |
| MacBook·Mac의 Apple M 시리즈 칩 | `mac-arm64.dmg` |
| Intel 프로세서 Mac | `mac-x64.dmg` |

## Mac 설치

1. Apple 메뉴 → 이 Mac에 관하여에서 칩이나 프로세서를 확인해 파일을 고릅니다. 두 Mac 버전 모두 macOS 13 Ventura 이상이 필요합니다.
2. DMG를 열고 앱을 Applications 폴더로 끌어다 놓습니다. 앱 이름을 바꾸지 말고 응용 프로그램에서 실행합니다. WORLD·Workspace도 각각 동일하게 설치합니다.
3. 아직 Developer ID 서명과 Apple 공증을 받지 않은 Preview입니다. 개발자 확인 알림이 나오면 SYNK에서 받은 파일인지 확인한 후 시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기를 이용할 수 있습니다. [Apple 공식 안내](https://support.apple.com/ko-kr/102445).
4. 플랫폼으로 돌아와 설치 상태를 새로고침하면 설치된 WORLD·Workspace를 실행할 수 있습니다.

Windows 설치판도 게시자 코드 서명이 없는 개발판으로 보안 알림이 표시될 수 있습니다. 자동 업데이트는 제공하지 않습니다.

## Intel판 수정과 검증 범위

Intel 그래픽 실행 검사에서 누락된 Vulkan loader를 확인해 공식 Khronos 원천에서 빌드하고 앱 서명 전에 포함했습니다. 기본 그래픽 설정과 앱의 샌드박스는 유지합니다.

실제 Intel macOS CI에서 DMG 복사·CPU·서명·동봉 파일 검사 41/41, WORLD 시작→학습→3D 게임 이동·일시정지→계정 화면 복귀 15/15, 연결 복구 10/10, Platform 앱 인식·설치 파일 준비 16/16을 통과했습니다. GPU가 없는 Intel CI는 검사 프로세스에만 소프트웨어 그래픽을 사용합니다. 실물 Intel MacBook의 GPU 성능이나 Gatekeeper 승인, 운영 계정 로그인 인수를 확인한 결과는 아닙니다. [Intel 설치 파일 검증](https://github.com/unmet23-lab/synk-policy/actions/runs/38160482694).

Apple Silicon 패키지는 macOS CI에서 실제 DMG 복사·첫 실행·WORLD 학습·연결 복구·Platform 앱 인식을 검증했습니다(패키지38/38, WORLD15/15, 재연결10/10, Platform16/16).

**Apple M 시리즈에서는 Apple Silicon 파일을 사용하세요.** Intel 파일을 M 시리즈에서 Rosetta로 실행한 추가 검사는 게임 진행을 확인하지 못했으므로 이 조합은 지원하지 않습니다. Intel용 네이티브 검사와 구분한 제한입니다. [Rosetta 검사 기록](https://github.com/unmet23-lab/synk-policy/actions/runs/38161673838).

[홈페이지 다운로드](https://synk.im/#platform). 파일 무결성은 Windows `SHA256SUMS.txt`, Mac `SHA256SUMS-arm64.txt` 또는 `SHA256SUMS-x64.txt`에서 확인할 수 있습니다.
