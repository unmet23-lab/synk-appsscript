# 데스크톱 SYNK ID 연결 — 0.2.0

## 2026-10-04 소스 후속 — 독립 교사 앱과 WORLD 개인 맞춤 기억

교사 앱은 `clientId: teacher`, OAuth `clients.teacher`, `im.synk.teacher.preview` 보관소·세션을 쓰는 독립 프로세스다. API 헤더의 제품은 `world`로 유지하고 실제 교사·담당 반 권한은 서버가 판정한다. 콜백은 `http://127.0.0.1:43824/synk/oauth/teacher/callback`이며 WORLD 클라이언트 ID·콜백·암호화 저장소를 재사용하지 않는다. 설정 예시는 [auth.example.json](auth.example.json), 동작 범위는 [README](README.md)에 있다.

`synkTeacher`는 최상위의 정확한 `teacher.html`에서만 main IPC를 호출할 수 있다. 반 목록·교사 workspace·과제 생성/변경/취소·관찰 메모가 고정 허용 목록이다. 자식 교사 화면은 반에 한정한 호스트를 사용하고 토큰을 받지 않는다. 학생의 학습 전송·Town·개인 맞춤 기억·임의 URL·회사 및 설치 API는 교사 broker에서 거절한다.

WORLD의 native account broker에는 기존 서버 계약의 `memoryGet`/`memoryPost`와 `atlasSummary`를 연결했다. 반별 공유 revision과 개인 계정 학습 revision을 섞지 않으며 메모리는 계정의 `synk-learning?view=memory` 경로로 전달한다. 학생의 개인 기억이 교사에게 자동 공유되는 경로를 추가하지 않았다.

[실제 Windows native 합성 재검증](artifacts/teacher-account-current-20261004.json) **26/26**은 PKCE loopback·DPAPI·저장 토큰 재복구·IPC·PGlite 과제 결과·네트워크 중단과 복구·권한 철회·로그아웃을 검사한다. 연결 복구 후 담당 수업과 정상 안내를 다시 표시한다. [teacher-main 부팅](artifacts/teacher-entry-current-20261004.json)은 실제 입구의 미설정 상태를 검사한다. 운영 OAuth 등록·실사용자 로그인·서명 패키지 및 설치·Mac/모바일 기기 검증은 아직 하지 않았다. 아래 0.2.0 기록은 과거 패키지 이력이다.

2026-10-02. 소스 구현·합성 서버 검증·Windows 0.2.0 개발판 6종 패키징을 완료했다. 운영 OAuth 설정을 읽거나 변경하지 않았고, 실제 사용자 로그인·공개 배포·Mac 실행을 확인하지 않았다. 0.2.0 패키지에는 공개 설정이 없으므로 로그인은 준비 중으로 표시된다. 보존한 0.1.0 설치 파일에는 이 기능이 없다.

## 인증과 저장

로그인 버튼을 누르면 main 프로세스가 등록된 `127.0.0.1` 콜백 포트를 열고 기본 브라우저를 연다. Supabase OAuth 2.1 서버의 `/auth/v1/oauth/authorize`에 authorization code, 앱별 public client ID, PKCE S256, 32바이트 무작위 state를 전송한다. 기본 브라우저의 SYNK ID 로그인 상태를 재사용할 수 있지만 각 앱은 자신의 토큰을 따로 발급받는다. 브라우저의 세션을 앱끼리 복사하지 않는다.

콜백은 GET, 정확한 Host·경로, 단일 state·code 또는 error, 5분 유효시간, 일회 소비를 검사한다. 수신·취소·만료·브라우저 열기 실패 때 리스너를 닫는다. 검증한 코드를 main이 `/auth/v1/oauth/token`으로 교환한다. `/auth/v1/user`와 공통 계정 서버의 소유권 확인이 끝나야 `signed-in`이 된다. 임의 URL·헤더·비밀 키를 renderer에서 받지 않는다.

Access token은 main 메모리에만 둔다. Refresh token은 `userData/auth-session.enc`에 Electron `safeStorage`의 Windows DPAPI 또는 macOS Keychain 암호화로 저장한다. 앱 scope와 공개 설정 fingerprint가 일치해야 복원한다. OS 암호화를 쓸 수 없거나 plaintext backend이면 로그인을 시작하지 않는다. 평문 대체 저장은 없다. Windows DPAPI는 다른 Windows 사용자로부터 보호하지만 같은 OS 사용자 권한의 악성 프로그램까지 격리하지는 않는다.

새 refresh token을 받으면 먼저 암호화 저장한 뒤 사용자·계정 정보를 검증한다. 이 확인 중 JSON/HTML 503·429 등 일시 오류가 나면 로그인 완료로 표시하지 않고 새 토큰을 보존한다. 다음 요청 또는 재실행에서 검증을 다시 할 수 있다. Invalid grant·계정 불일치·폐기된 세션은 지운다. 동시 갱신은 한 요청으로 합치며, 로그아웃·취소 뒤 도착한 이전 응답은 세션을 복구할 수 없다.

로그아웃은 로컬 세션을 먼저 폐기하고 현재 계정 세션 차단과 공급자의 `scope=local` 종료를 요청한다. 결과의 `serverRevoked`, `serverSessionRevoked`, `refreshRevoked`로 서버 확인 여부를 구분한다. 오프라인 종료를 서버 전체 종료로 표시하지 않는다. 기본 브라우저의 공통 로그인 및 다른 앱 로그인은 그대로 둔다. 자기 세션 종료 응답 `current:true`와 전체 종료 응답을 받으면 main과 암호화 파일도 즉시 폐기한다.

## 공개 설정

[auth.example.json](auth.example.json)은 구조 예시이며 실제 값이 아니다. 운영자가 제공한 공개 Supabase 주소·publishable/anon key·공통 계정 서버 주소·앱별 OAuth public client ID만 사용한다. 비밀 키나 `client_secret`은 거절한다. 정식 모드는 HTTPS를 요구하고 개발 모드에서만 로컬 합성 서버를 허용한다.

기본 예시의 등록 주소는 다음과 같다. 실제 제공자와 중앙 동의 화면에도 동일하게 등록되어야 한다.

| 앱 | 정확한 콜백 예시 |
| --- | --- |
| 플랫폼 | `http://127.0.0.1:43821/synk/oauth/platform/callback` |
| WORLD | `http://127.0.0.1:43822/synk/oauth/world/callback` |
| 메신저 | `http://127.0.0.1:43823/synk/oauth/messenger/callback` |

서로 다른 client ID와 callback을 요구한다. 공개 설정을 개발 실행에 전달하거나 패키지 `runtime.json`에 포함하는 방법은 다음과 같다. 아래 명령은 공개 설정을 자동 생성하거나 운영에 등록하지 않는다.

```powershell
npx electron . --synk-dev --client=platform --auth-config=C:/path/to/operator-public-auth.json
node tools/package.cjs --mode=development --platform=win32 --arch=x64 --auth-config=C:/path/to/operator-public-auth.json
```

패키지 설정이 없으면 로그인은 `unconfigured`로 닫힌다. 현재 0.2.0의 `X-SYNK-App-Version`은 실제 앱 버전을 보내며, 중앙 서버가 등록된 OAuth client ID와 `X-SYNK-Product`의 일치를 검증해야 한다.

## renderer 브리지

`authStatus()`, `authSignIn()`, `authCancelSignIn()`은 아래 snapshot을 반환한다. 로그인은 브라우저를 연 상태에서 먼저 반환하고 결과는 `onAuthChanged(callback)`으로 받는다. 구독 함수는 해제 함수를 반환한다. `authSignOut()`은 `{ok,status,serverRevoked,serverSessionRevoked,refreshRevoked}`를 반환한다.

```js
{
  configured, status, signedIn, secureStorage, sessionGeneration,
  account: { synk_user_id, display_name } || null,
  error: { code, message, retryable } || null
}
```

`sessionGeneration`은 새 로그인·로그아웃·폐기 시 증가하고 토큰 갱신만으로는 증가하지 않는다. 상태 값은 `unconfigured`, `signed-out`, `restoring`, `signing-in`, `signed-in`, `error`다. 토큰·비밀번호·PKCE verifier는 상태에 없다.

`accountRequest(operation, params)`는 기존 계정 서버 JSON을 반환한다. 허용 동작은 `load`, `release`, `setLearning`, `updateProfile`, `revokeSession`, `revokeAll`, `requestDeletion`, `exportPage`, `learningGet`, `learningPost`이며 [매개변수 검사](src/account-requests.cjs)를 따른다. 메신저는 `load`·`revokeSession`만 허용한다. 실패는 `{ok:false,error:{code,message,retryable,status?}}`다. URL·헤더·임의 action을 전달할 수 없다. 학습 업로드는 256개·본문 256 KiB, 이름은 60자 이내다.

플랫폼의 정확한 홈과 `client.html?product=platform`, WORLD의 `client.html?product=world`, 메신저의 자기 입구 최상위 프레임만 IPC를 쓸 수 있다. 중복 product, 다른 제품, 하위 iframe, 중앙 IdP 포털은 거절한다. 인증 상태 이벤트도 해당 입구에만 전달한다.

메신저는 `companyRequest(operation, params)`를 추가로 쓴다. `status`, `challenge`, `exchange`, `renew`, `logout`만 고정 회사 API로 전달한다. 회사 전용 Electron partition의 `session.fetch`가 HttpOnly cookie를 보관한다. `exchange`·`renew`의 SYNK bearer는 main이 붙인다. Link/unlink는 현재 회사 로그인, CSRF, 현재 비밀번호, 명시 확인을 요구하며 서버가 직원을 확인한다. 일반 SYNK 회원을 이메일 등으로 직원에 자동 연결하지 않는다.

## 실제 확인

- `npm test`: 셸 13개 + 인증 18개, 총 **31개 통과**.
- 인증 시험은 합성 OAuth/계정 HTTP 서버와 실제 loopback TCP 리스너를 사용했다. S256 코드 교환, state·Host·경로·중복·재전송·만료·포트 점유·취소 경합, refresh 단일 실행, 파일 복원·삭제, 서버 일시 장애 후 회전 토큰 보존, 자기 세션 폐기를 확인했다. 이 Node 시험의 암호화 공급자는 합성 AES fixture다.
- 별도로 `node tools/smoke.cjs`가 실제 Windows x64 Electron 44.5.1에서 **DPAPI 암호화 파일 저장 → 새 store 객체로 복호화 → 파일 제거**를 세 앱마다 확인했다. 사용자 창은 열지 않았으며 합성 문자열만 사용했다.
- 플랫폼의 실제 `client.html?product=platform`을 숨김 Electron에서 열어 root의 desktop adapter가 `authStatus`와 설정 대기 화면을 표시하는 것을 확인했다. 운영 설정이 없어 실제 브라우저 로그인은 실행하지 않았다.
- [JSON 결과](artifacts/electron-smoke.json), [플랫폼 계정 화면](artifacts/platform-account-hidden-preview.png). Mac Keychain·실제 인증 제공자·기기 간 SSO·메신저 실제 직원 계정 교환은 이 desktop 시험에서 확인하지 않았다.
- 빌드 동시 실행 중 플랫폼 합성 다운로드가 smoke의 2초 대기 안에 끝나지 않은 한 번의 실패는 `artifacts/electron-smoke-0.2.0.log`에 남아 있다. 빌드를 중단한 상태에서 동일 코드로 다시 실행해 세 앱·다운로드·DPAPI·계정 입구가 모두 통과했다. 설치 프로그램 실행을 대신하는 검증은 아니다.

구현 근거는 [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), [PKCE RFC 7636](https://www.rfc-editor.org/rfc/rfc7636), [Supabase OAuth 흐름](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [Supabase 로그아웃 범위](https://supabase.com/docs/guides/auth/signout), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)다.
