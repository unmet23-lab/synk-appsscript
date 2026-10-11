SYNK Platform과 WORLD의 Preview 0.4.1입니다. Windows x64와 macOS 13 이상의 Apple Silicon(M 시리즈) Mac을 지원합니다.

- WORLD는 공개 HTTPS 서비스에 연결됩니다. Node.js나 별도 개발 서버 설치가 필요 없으며, 인터넷 연결이 필요합니다.
- WORLD 첫 화면에서 SYNK ID로 연결하거나 기본 학습을 바로 열 수 있습니다. 연결이 끊기면 앱 안에서 다시 연결할 수 있습니다.
- Platform 설치판에 해당 운영체제·칩에 맞는 WORLD와 Workspace 설치 파일이 포함됩니다. Platform의 라이브러리에서 설치 파일을 준비해 각각 설치합니다.
- WORLD만 필요하면 `SYNK-WORLD-Preview-0.4.1-...` 파일을 받으세요.

## 다운로드 선택

| 기기 | 파일 끝부분 |
| --- | --- |
| Windows 64비트 | `win-x64.exe` |
| MacBook·Mac의 Apple M 시리즈 칩 | `mac-arm64.dmg` |
| Intel 프로세서 Mac | 게임 실행 검증 중 · 아직 배포하지 않음 |

## Mac 설치

1. Apple 메뉴 → 이 Mac에 관하여에서 Apple M 시리즈 칩인지 확인하고 `mac-arm64.dmg`를 받습니다. macOS 13 Ventura 이상이 필요합니다. Intel Mac에는 이 파일을 설치하지 마세요.
2. DMG를 열고 앱을 Applications 폴더로 끌어다 놓습니다. 앱 이름을 바꾸지 말고 응용 프로그램에서 실행합니다. WORLD·Workspace도 각각 동일하게 설치합니다.
3. 아직 Developer ID 서명과 Apple 공증을 받지 않은 Preview입니다. 개발자 확인 알림이 나오면 SYNK에서 받은 파일인지 확인한 후 시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기를 이용할 수 있습니다. [Apple 공식 안내](https://support.apple.com/ko-kr/102445).
4. 플랫폼으로 돌아와 설치 상태를 새로고침하면 설치된 WORLD·Workspace를 실행할 수 있습니다.

Windows 설치판도 게시자 코드 서명이 없는 개발판으로 보안 알림이 표시될 수 있습니다. 자동 업데이트는 제공하지 않습니다.

Apple Silicon 패키지는 macOS CI에서 실제 DMG 복사·첫 실행·공개 WORLD 학습과 연결 복구·Platform 앱 인식을 검증했습니다(패키지38/38, WORLD15/15, 재연결10/10, Platform16/16). 실제 사용자 MacBook의 Gatekeeper 확인과 운영 계정 로그인 인수는 이 CI 검증에 포함되지 않습니다.

Intel판은 빌드·서명 검증을 마쳤지만 가상 Mac 실행 검사에서 3D 게임 진행을 확인하지 못해 공개를 보류했습니다. ARM용 파일의 이름만 바꾸거나 Intel Mac에서 사용하는 방식은 지원하지 않습니다.

[홈페이지 다운로드](https://synk.im/#platform). 파일 무결성은 Windows `SHA256SUMS.txt`, Mac `SHA256SUMS-arm64.txt`에서 확인할 수 있습니다.
