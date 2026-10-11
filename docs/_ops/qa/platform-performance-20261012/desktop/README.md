# Platform 0.4.3 성능 후보 검증

Windows Platform의 설치 앱 확인은 실행 파일·ASAR 약 539 MB를 한 번에 읽던 방식에서 작은 청크로 읽는 방식으로 바꿨다. SHA-256은 매 확인·실행 때 새로 검사하며, 캐시된 성공 결과로 실행을 허용하지 않는다. 설치파일이 없는 더 최신 앱의 실행 허용 핀은 유지하면서 실제 준비할 설치파일을 별도로 선택한다.

## 확인 결과

- 같은 PC의 파일 캐시가 준비된 상태에서 3회 번갈아 측정: 메인 이벤트 루프 최대 지연 63.4–71.1 ms → 14.9–21.9 ms, 임시 외부 메모리 증가 480–499 MiB → 33–41 MiB. 전체 검사 시간은 256–316 ms → 301–319 ms로 줄지 않았다. 반응 정지와 메모리 급증 완화의 근거이며 앱 전체 실행 시간·모든 기기의 체감 개선을 뜻하지 않는다.
- 관련 시험 15/15 통과(`tests.tap`): 실제 Electron ASAR 처리, 파일 교체·변조, 경로 이탈, 설치파일 재검증, 최신 실행 핀과 사용 가능한 설치파일의 분리, 고정된 빌드 오버레이.
- 공개 Windows 후보: NSIS에서 실제로 추출한 프로그램을 격리 프로필로 실행한 검사 16/16. 공개 WORLD 0.4.1과 현재 PC의 WORLD 0.4.2를 각각 인식하는 검사도 통과했다. 사용자의 설치 마법사나 실제 프로필을 실행하지 않았다.
- Mac 빌드·실제 DMG 마운트·네이티브 Platform 검사는 GitHub Actions `38164405927`의 ARM·Intel에서 모두 통과했다. ARM·Intel 모두 실제 Platform 검사 16/16이며, 내려받은 아티팩트 전체 SHA, DMG SHA·길이·manifest 대조도 완료했다(`release-candidates.json`). Intel CI는 소프트웨어 GPU이며 실물 MacBook의 성능 검증은 아니다.
- PC 전용 후보는 `private-pc/independent-verification.json`: 현재 설치본 ASAR 117개 중 114개 byte 동일. `package.json` 버전과 `src/installations.cjs`, `src/client-lifecycle.cjs`만 변경. `runtime.json`, 포함된 WORLD 0.4.2·Workspace 0.4.0 설치파일은 byte 동일하다. Electron의 14개 코드·데이터 섹션과 나머지 런타임 71개 파일도 동일하다. EXE 리소스의 버전 4바이트와 새 ASAR 무결성 해시만 바뀐다. 새 해시는 후보 ASAR 헤더와 일치한다. 기존 설치 EXE의 과거 내장 해시는 현재 설치 ASAR와 이미 달랐으며 후보에서 올바르게 갱신했다.
- PC 전용 후보 격리 네이티브 검사 16/16. 후보 검증 시점 전후의 기존 설치 ASAR SHA는 동일했다. 이후 root 작업이 해당 설치파일로 현재 PC 업데이트를 완료했다(`private-pc/installed-verification.json`). 실제 설치된 EXE·ASAR는 후보와 일치하며 프로필 187개 파일과 포함된 자식 설치파일은 byte 동일하다. 실제 프로필로 앱을 다시 실행하지 않았다.

## 배포·설치 시 구분

공개 대상은 `release-candidates.json`에 적힌 Windows·Apple Silicon·Intel Platform 0.4.3 설치파일 세 개다. WORLD·Workspace의 기존 공개 설치파일은 바꾸지 않는다. 공개 빌드의 원천 커밋은 `86baf807b53070912284d1e1c123267f7ef82d06`이며 Windows 검증 추출 도구 수정은 뒤의 `499d38c`다. 이 폴더를 작성한 검증 작업은 release 업로드나 공개 main 반영을 실행하지 않았다.

`SYNK-Platform-PC-Local-0.4.3-win-x64.exe`는 현재 PC에 있던 WORLD 0.4.2 포함 구성을 보존하는 전용 후보다. 공개 업로드 대상으로 사용하지 않는다. 파일 위치·길이·SHA는 `private-pc/package.json`에 있다.

다른 Windows PC의 설치는 실행 중인 Platform을 트레이에서도 종료한 뒤 공개 설치파일을 열어 같은 사용자 계정의 기본 위치에 설치한다. 기존 앱·데이터를 먼저 지우지 않는다. 설치 후 앱 버전과 WORLD·Workspace 인식을 확인한다. 이 PC의 전용 후보 설치는 이미 완료했으므로 다시 실행할 필요가 없다.

Mac은 기종에 맞는 DMG를 열어 Applications로 복사한다. Intel은 x64, M 시리즈는 arm64이며 macOS 13 이상이다. 기존 Preview와 마찬가지로 Developer ID 서명·공증은 없고, WORLD 공개 기능은 인터넷이 필요하다. 별도 개발 서버를 설치할 필요는 없다.

## 검증 파일

- `release-candidates.json`: 공개 3개 파일의 최종 SHA·길이·아키텍처·검증 결과
- `windows/`, `mac-arm64/`, `mac-x64/`: 각 플랫폼의 패키지·실제 네이티브 검사
- `private-pc/`: PC 전용 설치파일·현재 프로그램 보존 대조·격리 검사
- `source-manifest.json`: 성능 변경 두 파일의 전후 SHA 및 기존 자식 설치파일 핀
- `installations-benchmark.json`, `tests.tap`: 변경 효과와 회귀검사
