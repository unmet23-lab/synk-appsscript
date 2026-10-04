# WORLD·교사 연결의 기기 검증

2026-10-04. 이 문서는 학습 기록→교사 과제 연결의 실행 환경을 구분한다. 공개 배포, 계정 제공자 설정, 설치·업데이트·서명은 실행하지 않았다.

| 환경 | 이번에 확인한 근거 | 아직 확인하지 않은 동작 |
| --- | --- | --- |
| Windows 11 x64 개발 앱 | 독립 교사 Electron의 PKCE 로그인 복귀·DPAPI 저장/복구·WORLD와 토큰 격리·교사 권한·과제·결과·로그아웃 | 설치·제거·업데이트, 서명된 정식 패키지, 운영 계정 로그인 |
| Windows Chrome | 390px에서 기록 연결, 뒤로가기 복귀 후 실제 읽기 3문항 제출→교사 결과, 떠난 동안 연결 해제 후 복귀 시 기록 화면 제거 | 다른 브라우저·장시간 절전·성능이 낮은 PC |
| macOS | Windows·Mac의 독립 앱 ID·세션·고정 실행 경로, 허용된 인증 콜백 계약을 자동 검사 | 실제 Mac 빌드·실행·Keychain·공증·설치·업데이트 |
| Android | 이 호스트에 Android SDK 도구는 있으나 `adb devices -l` 연결 기기 0대, `emulator -list-avds` 구성 0개 | 실기기 앱 로그인·복귀·터치·오디오·네트워크 전환·기기 간 동기화 |
| iOS | 기존 모바일 프로젝트 `../SYNK-talk`에 Expo·SecureStore·AuthSession 기반 코드가 존재함을 확인 | iPhone/iPad 및 Safari·WKWebView의 로그인 복귀·오디오·백그라운드·Keychain·설치 |

390px 화면이나 Windows Chrome의 실행은 Android/iOS 실기기 통과로 세지 않는다. 기존 모바일 앱 원문은 `C:/Users/q1212/Documents/SYNK-talk`에 있으며, 이 저장소에 네이티브 폴더가 없는 것을 모바일 구현 부재로 해석하지 않는다.

## 이번에 수정한 복귀 문제

WORLD의 로컬 연결 화면은 `pagehide`에서 학습 호스트와 과제 화면을 정지했지만, 브라우저가 같은 문서를 BFCache에서 복원했을 때 재시작하지 않았다. `src/local-world.mjs`에 `pageshow.persisted` 처리를 추가했다. 복귀 때 저장된 연결을 서버에서 다시 확인한 다음 화면을 만들고, 철회·만료된 연결은 제거한다. 이전 복귀의 지연 응답은 새 연결을 막거나 지우지 못한다.

- [자동 계약 검사](qa/cross-platform-contracts-20261003.txt): **58/58**. 데스크톱 인증·제품 경계·Mac/Windows 경로·로컬 연결 재시도 및 BFCache 복귀·만료·경합을 검사한다. 운영 OAuth 제공자 검증은 아니다.
- [실제 Windows 개발 창](qa/cross-platform-native-20261003.txt): `SYNK_CLASSROOM_SMOKE ok:true`. 두 세션과 창 재개를 확인했다.
- [현재 no-store 서버의 실제 Chrome 뒤로가기](qa/world-history-no-store-20261003.json): **8/8**. Chrome이 새 문서로 복귀하는 경로다.
- [실제 Chrome BFCache 복귀](qa/world-history-resume-20261003.json): **8/8**. 동일한 번들의 HTML 응답 캐시 헤더만 임시 시험 서버에서 허용해 `pageshow.persisted === true`와 동일 문서 인스턴스를 확인했다. 운영·로컬 서버의 캐시 정책은 바꾸지 않았다. 실제 답안 제출과 철회 결과까지 확인했다.

재현 명령은 저장소 루트에서 실행한다. Playwright는 이미 설치된 모듈 경로를 전달하며 새 도구를 설치하지 않는다.

```powershell
node --test desktop/tests/classroom-policy.test.cjs desktop/tests/teacher-preview.test.cjs desktop/tests/auth.test.cjs desktop/tests/desktop.test.cjs experiences/synk-account/tests/local-world-client.test.mjs experiences/synk-account/tests/local-world-session.test.mjs
node experiences/teacher-world/qa-world-resume.mjs <설치된-playwright-모듈-경로> --no-store
node experiences/teacher-world/qa-world-resume.mjs <설치된-playwright-모듈-경로>
```

## 실제 기기를 확보한 뒤의 판정 기준

모든 환경에서 합성 시험 계정으로 같은 순서를 수행한다. 학생 이름·답안·로그인 토큰은 검증 보고서에 넣지 않는다.

1. 학생과 교사가 각 앱에서 로그인하고, 자기 역할·소속 반만 보이는지 확인한다.
2. 교사가 목표 과제를 보내고 학생은 지정 영역·난도의 게임을 끝낸다. 교사에게 같은 목표·실제 답안 수가 보이는지 확인한다.
3. 학생이 앱 전환·절전·뒤로가기 후 돌아와 재접속한다. 연결이 끊긴 동안의 기록은 중복 없이 재전송되고 확인 전에는 완료로 표시되지 않아야 한다.
4. 다른 기기에서 같은 계정으로 들어가 기록과 남은 과제를 확인한다. 계정 전환 뒤 이전 계정 기록은 보여서는 안 된다.
5. 학생 동의 철회·교사의 반 권한 해제 뒤 기존 창과 복귀한 창 모두 즉시 접근을 닫는지 확인한다.
6. 듣기 게임은 실제 스피커·헤드폰과 오디오 중단 후 복귀를 확인한다. 소리를 재생하지 못한 답을 듣기 학습 근거로 기록해서는 안 된다.

설치·업데이트·서명·공개 배포의 검증은 이 기록과 별도로 [데스크톱 수명주기](../../desktop/LIFECYCLE.md)를 따른다.

## 계정 수업 연결의 추가 확인

SYNK ID 기반 `account-linked` 경로를 구현했다. 웹은 부모 로그인 호스트, 데스크톱은 기존 인증 서비스의 고정 classroom IPC 작업을 사용하며 iframe에 토큰을 전달하지 않는다. 계정·수업 선택을 바꾸면 기존 학습 호스트와 교사 프레임을 제거한다. 운영 계정 화면이 BFCache로 복귀하면 세션을 다시 확인하도록 새로 불러온다.

[실제 Chrome UI 검사](qa/account-classroom-ui.json) **18/18**: 합성 계정·메모리 PostgreSQL을 사용하여 교사·학생 320/390/1280px, 390px 교사 과제 작성, WORLD 서버 채점 읽기 제출, 실제 게임 실행·완료, 공유 철회·범위 전환을 확인했다. 실제 운영 OAuth 및 다른 기기 간 동기화를 대신하지 않는다. [데스크톱 자동 검사](qa/account-desktop-regression.txt)는 **144/144**다.

위 2026-10-03 검사의 교사 화면은 WORLD 인증 호스트 안에서 열리는 경로였다. 2026-10-04에는 `desktop/src/teacher-main.cjs`와 `synk-account/teacher.html`을 별도 프로세스·저장소의 SYNK ID 교사 클라이언트로 연결했다. 기존 일회용 코드 체험은 `dev:classroom`, SYNK ID 교사 앱은 `dev:teacher`로 구분한다. 새 서버 함수·DB 변경의 운영 배포와 Mac·모바일 실기기 검증은 아직 수행하지 않았다.

## 개인 기억과 독립 교사 앱 · 2026-10-04

- [개인 기억 실제 UI·DB 재검사](qa/personal-memory-final-20261004/account-classroom-memory.json) **21/21**. 수업 공유판 7과 개인 동의판 2를 분리해 저장했고 실제 빈칸 게임 수행으로 생긴 순간 맞춤 기억을 새 브라우저 환경의 같은 게임에서 복원했다. 최초 응답을 일부러 늦춰도 첫 게임이 저장한 기억으로 시작한다. 공유 끄기·개인 동의 철회·재동의·계정 전환·로그아웃 뒤 지연 응답도 확인했다. 교사에게 개인 설정을 전달하지 않으며 오늘 컨디션은 기기에만 남는다. 새 브라우저 컨텍스트는 독립 저장소를 가진 두 번째 기기 모델이며 실제 휴대폰 왕복을 뜻하지 않는다.
- [독립 교사 네이티브 재검사](../../desktop/artifacts/teacher-account-current-20261004.json) **26/26**, [실제 교사 앱 진입 검사](../../desktop/artifacts/teacher-entry-current-20261004.json). Windows Electron의 실제 암호화 저장과 PKCE 콜백, 별도 로그인 복구, 교사 전용 IPC, 담당 반 접근, 교사 화면 과제 작성과 학생 API 제출 결과, 네트워크 중단/복구, 권한 철회·로그아웃을 확인했다. 합성 OAuth 제공자와 임시 PostgreSQL을 사용했다. 1280·390px 화면은 Electron의 offscreen 렌더러로 확인했으며 모바일 실기기 증거로 세지 않는다.
- [9개 활동 실제 조작·재접속 검사](qa/account-games-verification.json): 모든 배정 가능 활동에서 교사 배정 → 한 문항 수행 → 중단 → 교사 부분 진행 확인 → WORLD 새로고침 → 같은 수행 재개 → 목표 3문항 완료 → 계정 원장·교사 결과를 확인했다. 새 중단/재접속 검사는 **156/156**이며 기존 완료 검사 97/97과 합쳐 기록한다. 오프라인 전송 재시도 소진 뒤 자동 복구는 빈칸 베기로 추가 확인했다.
- [이번 관련 앱 자동 재검사](qa/account-frontend-recheck-20261004.txt) **315/315**, [서버·계정·삭제·교실 마이그레이션 재검사](qa/account-backend-recheck-20261004.txt) **71/71**. 이전 434개 앱 검사와 실행 범위가 다르다. 서버 검사는 운영 postgres 드라이버와 같은 JSONB 직렬화로 DB 왕복을 수행했다.
