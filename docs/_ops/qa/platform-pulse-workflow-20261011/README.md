# Platform PULSE 제작 진행·수정 의견·시안 승인 — 2026-10-11

사용자 요청으로 플랫폼 PULSE에 **제작 진행·승인** 탭을 추가하고 현재 PC에 재설치했다. 기존 운영 고객 라운지와 같은 서버 기록을 사용하며 서버·DB·직원 계정 배포는 변경하지 않았다. 실제 설치된 파일의 격리 화면 검사까지 마치고 플랫폼을 다시 열어 정상 창 1개를 확인했다.

## 이용 흐름

1. 담당자가 SYNK Workspace의 **고객 관리**에서 프로젝트·진행 단계·일정·시안을 등록하고 초대 링크를 발급한다.
2. 클라이언트가 플랫폼의 **SYNK PULSE → 제작 진행·승인**에서 받은 링크를 연결한다. 현재 단계, 예정일, 다음 할 일, 시안·최종 파일과 공개 의견이 표시된다.
3. **시안·파일 열기**로 격리된 기존 PULSE 검토 창을 연다. 원본 자료 감상·최종 파일 저장은 이 창에서 제공한다. 돌아와 **진행 상황 새로고침**을 누르면 최신 기록을 확인한다.
4. 수정 의견은 최신 시안 버전·선택한 영상 시간(초)에 연결된다. 일정·후속 문의는 구분한다. **보내기**를 누르면 서버에 저장돼 담당자가 읽을 수 있다. 실패하면 작성 내용을 유지한다.
5. **이 시안 최종 승인 → 확인했고 승인합니다**로 현재 버전의 내용과 표현을 확인하고 최종 제작 진행에 동의한다. 승인 버전·일시는 기존 서버에 남는다. 최종 납품 파일의 별도 인수 승인 액션은 아니다.

현재 버전에 직접 남긴 미해결 수정 의견이 있거나 작성 중 의견이 있으면 플랫폼 승인 버튼을 막는다. 이전 시안의 미해결 기록은 새 수정본을 확인해야 완료될 수 있어 최신 시안 승인을 일괄 차단하지 않는다. 새 버전에는 이전 승인을 승계하지 않는다. 오래된 revision은 서버가 거절하며, 새로고침 후 내용을 다시 확인한다. 웹 고객 라운지 자체의 정책을 이번 PC 변경으로 바꾼 것은 아니다.

## 연결과 데이터 경계

- 고정 `https://workspace.synk.im/pulse/api/`만 main에서 호출한다. 초대는 담당자가 발급한 URL 또는 동일 토큰 형식만 받는다.
- SYNK ID·직원 쿠키와 다른 메모리 세션을 사용한다. 고객 cookie·CSRF는 renderer와 localStorage에 전달하지 않는다. 로컬 초안 기능은 기존 방식 그대로다.
- 계정 상태 전환 시 진행 중 응답과 검토 창을 분리·정리한다. 이 10-11 초기 구현은 앱 완전 종료 후 초대 링크 재연결이 필요했다. 이후 설치 앱 연결 유지·로그아웃 경계는 [독립 PULSE 후속](../pulse-independent-20261011/README.md)을, 브라우저의 30일 저장·만료 범위는 [지속 연결 후속](../pulse-persistent-20261012/README.md)을 따른다. 공유된 서버 기록은 유지된다.
- 임의 고객 프로젝트·의견·승인을 운영 서버에 만들지 않는다. 실제 운영 고객의 종단 사용은 합성 검증과 구분한다.
- renderer의 네트워크 금지 CSP와 고정 IPC 발신자 검사를 유지한다. 웹 검토 창은 preload·Node·카메라/마이크 권한 없이 열며 파일 저장은 명시적 동작으로만 제공한다.

## 구현 위치

- `desktop/renderer/pulse-workflow.mjs`·`pulse-workflow.css`, 기존 PULSE 모듈·런처 통합.
- `desktop/src/pulse-requests.cjs`, main·preload의 PULSE 전용 요청 연결.
- 벤치마킹과 서비스 근거: [PULSE 원문](../../../마케팅/PULSE.md#5-5-플랫폼의-광고-클라이언트-공간--2026-10-11).
- 기존 앱 보존·overlay·빌드: 이 폴더의 preparation·overlay·source-boundary·build·verify·install 기록.

## 검증과 설치 상태

- [관련 renderer·native 경계·기존 company 요청 회귀](renderer-regression.txt) 86/86.
- 모델·포트폴리오 네이티브 34/34, 카탈로그 네이티브 53/53: 기존 탐색·후보·기기별 초안과 목록을 유지한다.
- [새 제작 진행 네이티브 화면](../../../../desktop/artifacts/pulse-workflow-20261011/2026-10-11T12-11-27-826Z/report.json) 32/32: 1280·390·320, 연결/의견/승인/최종본 표시, 실패·중복·409·계정 전환 후 늦은 응답, 초안 종료 보호. 콘솔 오류·외부 요청 0. 화면과 확인 대화상자를 직접 확인했다.
- [브로커와 기존 연결 경계](pulse-broker-tests.txt) 18/18. 실제 Electron `session.fetch`와 격리된 기존 company 서버 fixture에서 open→refresh→support→approve→logout, 서버 승인 기록·토큰 삭제·후속 401, SameSite=Strict·HttpOnly·고객 경로 쿠키를 확인했다. 원래 실패는 합성 서버의 Origin port 0과 실제 할당 port 불일치로 발생한 CORS 검사였으며 fixture만 수정해 재검증했다.
- [실제 운영 서버 읽기 확인](pulse-live-readonly.json)은 임시 Electron 세션에서 익명 GET `/pulse/api/project`의 401·JSON·쿠키 0개만 확인했다. 운영 고객의 실제 의견·승인을 전송한 증거는 아니다.

## 실제 설치 완료

[재설치 파일](<../../../../desktop/artifacts/platform-pulse-workflow-20261011/SYNK Platform Preview-0.4.0-win-x64.exe>)은 397,412,433바이트이며 SHA-256은 `bfdc44363d8280ccd104f10b76b47c00132749546e4bfd25f89a92b6aa9b38d3`다. 설치된 app.asar SHA-256은 `853f17d3ae42bde23c015659ec59bd8686cd0a1fe435b521af6787ff31ca1874`다.

사용자가 완전히 종료했음을 확인한 뒤 실제 SYNK 프로세스 0개를 확인하고 기존 프로그램 전체를 `.tmp/platform-pulse-workflow-20261011/installed-program-backup`에 보존했다. NSIS는 1회 실행·종료 코드 0이며 설치·등록·바로가기·백업 95/95, 설치된 ASAR 116파일 직접 대조 123/123을 통과했다. 패키지 검사 33/33과 전체 payload 76개도 일치한다. 기존 파일 6개 변경·3개 추가만 반영했고 main/preload의 PULSE 추가 외 바이트는 기존 설치본과 같다. 다른 인증/runtime/package·계정/메모 저장소·WORLD/Workspace 설치본은 보존했다.

실제 설치된 app.asar에서 [제작 진행 UI 32/32](../../../../desktop/artifacts/pulse-workflow-20261011/2026-10-11T12-17-06-292Z/report.json)와 [모델·포트폴리오 UI 34/34](../../../../desktop/artifacts/pulse-client-20261011/2026-10-11T12-17-06-348Z/report.json)를 통과했다. 새 격리 프로필·합성 프로젝트로 확인했고 외부 요청·콘솔 오류는 0이다. 정상 플랫폼을 다시 실행해 프로세스 4개·응답 중·플랫폼 창 1개를 확인했다. 정상 프로필을 에이전트가 열람하거나 실제 고객 프로젝트를 생성·승인하지 않았다. 최종 상태는 [completion.json](completion.json)에 기록했다.
