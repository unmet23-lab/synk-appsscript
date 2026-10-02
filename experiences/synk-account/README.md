# SYNK ID · 브라우저 계정과 제품 연결

중앙 이메일 로그인·일반 가입·비밀번호 복구·OAuth 동의 화면과 플랫폼/WORLD의 브라우저 소비처를 준비했다. **실제 Supabase OAuth 서버 설정, 실제 로그인, 메일 발송, 운영 배포는 아직 검증하지 않았다.** `config.json`이 없으면 준비 전 안내와 기본 학습 링크만 보인다.

## WORLD와 교사 앱의 로컬 연결 · 2026-10-02

`local-world.html`은 기존 WORLD 계정 화면과 여섯 실제 게임 호스트를 재사용하면서 교사 과제함, 서버 채점 읽기, 학생별 Town을 연결한다. [교사 앱의 로컬 연결 서버](../teacher-world/linked-server.mjs)를 실행하면 교사 창은 `http://127.0.0.1:4295/`, WORLD 창은 `http://127.0.0.1:4295/synk-account/local-world.html`에서 따로 연다. 시작 명령은 저장소 루트의 `node experiences/teacher-world/linked-server.mjs`다. 운영 SYNK ID·SYNK-talk 학생 자료와는 별도의 개발 연결이다.

- 교사에게 받은 일회용 코드와 명시적 동의로 들어온다. 현재 연결의 토큰은 탭의 sessionStorage에 보관하며 URL이나 게임 iframe으로 전달하지 않는다.
- 실제 읽기 응답과 게임의 언어 문항 기록이 교사 화면의 근거로 전달된다. 서버 채점 읽기와 게임이 보고한 결과를 구분하고, 게임 조작 점수는 언어 실력으로 바꾸지 않는다.
- 교사가 배정·수정·취소한 읽기·게임 과제는 수동 새로고침 또는 보이는 화면의 5초 주기로 반영한다. 레이싱 듣기/읽기, 리듬, 바람길 듣기 확인, 주문, 입장 검사, 스토리, Town 읽기 확인의 8개 활동을 지원한다. 실제 콘텐츠의 영역·난도·응답 형식·문항군을 Core 후보로 사용한다.
- 게임 과제는 서로 다른 유효 언어 문항 3개 응답으로 완료한다. 정답률 합격이 아니라 수행 완료이며, 혼자 풀기·도움·반복을 구분한다. 시작 때 수행 ID를 받고 사건 발생 즉시 계정/공유판에 귀속해 늦게 전송된 기록이 다른 과제에 붙지 않도록 한다. 중단한 과제는 진행을 이어 쓸 수 있다.
- 서버 채점 읽기도 공통 Atlas 사건으로 동기화하므로 다음 게임의 추천이 같은 기록을 사용한다. ‘오늘의 학습 안내’에는 현재 공유된 근거와 다음 연습을 표시하며 외부 AI 대화·음성/쓰기 평가로 표시하지 않는다. Town 생활 행동·취향은 언어 점수로 집계하지 않는다.
- 제출 응답을 잃으면 답과 제출 키를 그대로 보관하여 동일 요청으로 확인한다. 과제 revision이 바뀌면 이전 초안을 폐기한다. 연결·공유 revision이 바뀌거나 창을 종료하면 이전 화면과 응답을 차단한다.
- 처음 연결한 뒤 일시적인 계정/교실 읽기 실패가 생겨도 받은 토큰은 보관하고 명시적으로 다시 불러올 수 있다. 서버가 401로 연결 종료를 확인한 경우에는 기기 연결을 지운다.
- 이 개발 환경의 공유 스위치는 동기화와 교사에게 보여주기를 함께 제어한다. 기존 비회원 기록을 가져오지 않는다. 정식 서비스의 로그인·동의 분리·운영 배포는 별도 작업이다.

계정·교사·공통 호스트·게임 통합 회귀 525/525와 실제 교사/WORLD 왕복 31/31, 6게임+Town 실제 입력 전달 14/14를 확인했다. 명령·검증 범위·증거는 [교사 앱](../teacher-world/README.md)에 기록한다. 정식 SSO·운영 DB·기존 일일 숙제/AI API·실기기 검증은 별도다.

## 설치형 플랫폼과 웹 개발 화면 · 2026-10-02 후속

사용자가 확정한 개발 대상은 **Android·iOS·Windows·macOS·웹**이다. 플랫폼 런처, WORLD, 사내 메신저는 별도 설치·실행·업데이트·앱 데이터·세션을 가진다. 설치형 구현과 빌드 범위는 [desktop/README.md](../../desktop/README.md)를 따른다. 여기의 `platform.html`은 런처 화면의 웹 개발 미리보기이며 앱 두 개를 iframe으로 합치는 제품이 아니다. WORLD 안의 미니게임 호스트는 기존 계정 계약을 유지한다. 플랫폼·WORLD의 web manifest와 iOS 홈 화면 아이콘을 연결했으며, 모바일 웹 화면 검증과 실제 네이티브 패키지·스토어 배포는 구분한다. 서비스 워커나 인증·회사 데이터의 오프라인 캐시는 만들지 않는다.

- 시작: `http://127.0.0.1:4280/` → `platform.html`. 기존 미니게임 허브는 `/learning-hub/`에서 계속 사용한다.
- 둘러보기: 정확히 WORLD와 사내 메신저 두 앱, 제목·콘텐츠 검색, 학습/업무 분류, 이름·최근 순 정렬.
- 라이브러리: 담기/빼기, 즐겨찾기, 배움·업무 컬렉션, 간결한 카드 보기. 담기는 설치·구매·회사 직원 권한 부여가 아니다.
- 앱 상세: 소개·설치 안내·개발 소식, 각 앱의 제공 범위와 웹 체험 경로. Town 등 데스크톱 미제공 기능은 준비 상태를 표시한다.
- 다운로드: Windows / Mac Apple Silicon / Mac Intel 선택, 실행 환경이 확인한 설치 상태, 별도 클라이언트 실행. 공개 배포 파일·서명·업데이트 채널이 없어 가짜 다운로드 진행률/설치 완료를 만들지 않는다.
- 기기 설정: 최근 열기 보관 선택, 목록 초기화·JSON 내보내기. `synk.platform.device-library.v1` 키 하나에 저장하고 계정·학습·회사 자료는 건드리지 않는다. **공통 계정에 동기화되는 라이브러리가 아니다.** 최근 목록은 앱 실행 요청/웹 링크 열기 이력이며 게임 플레이 시간·성취로 해석하지 않는다.
- 데스크톱 연결: 고정된 `getEnvironment / getClients / launch`와 `authStatus / authSignIn / authSignOut / accountRequest` 등의 bridge만 사용한다. 외부 기본 브라우저의 PKCE 로그인과 토큰 갱신·OS 암호화 저장은 main 프로세스가 맡으며 렌더러에 자격을 주지 않는다. 공개 설정이 없는 설치 파일은 연결 준비 상태로 남는다.
- `messengerUrl`은 회사 웹 미리보기의 공개 주소다. HTTPS 또는 loopback 개발 HTTP만, query는 `tab=home|messenger`만 허용한다. 미설정 시 **loopback 개발 페이지에서만** 기존 `http://127.0.0.1:4191/?tab=messenger`를 사용하고 공개 호스트에서는 숨긴다. 기존 회사 초대·로그인이 진입 권한을 판단하며 SYNK ID SSO와 자동 연결되지 않는다.
- 브랜드: 승인 `SYNK-Ink-정밀.svg`, SUIT·Inter Tight·DM Mono 실파일, 기존 펠트 책·노트북·배지·칩·판·질감. 사진형 로고/마스코트는 임의 재생성하지 않는다.

참고한 기능 구조: [Steam 라이브러리](https://store.steampowered.com/libraryupdate), [PURPLE 설치/실행](https://purple.plaync.com/download?country=KR&installerCode=gpg), [Epic 런처](https://store.epicgames.com/download). 시각 탐색은 [Awwwards Zentry](https://www.awwwards.com/sites/zentry)의 제품별 큰 시각 요소와 정보 위계를 참고했으며 외부 이미지·로고·코드는 복사하지 않았다.

## 화면

- `platform.html`: 설치형 런처를 위한 웹 개발 화면. 계정 설정과 별도로 사용할 수 있다.
- `index.html`: 중앙 계정. 이메일 인증은 공식 `@supabase/supabase-js` 2.117.2를 사용한다. `authorization_id`가 있으면 같은 SDK의 `auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`로 동의를 처리한다.
- `client.html?product=platform`: 공개 클라이언트의 authorization code + PKCE S256. 계정·소속·이용 권한을 보여 준다.
- `client.html?product=world`: 같은 인증 방식과 SYNK ID. 학습 동의를 확인한 뒤 같은 출처의 여섯 콘텐츠를 iframe으로 연다. 부모 `SYNKLearningHost`만 계정 저장소·전송기를 가진다. URL로 토큰을 넘기지 않는다.
- `preview.html`: **별도 빌드한 합성 화면**. 이메일/비밀번호를 입력해도 네트워크 인증을 하지 않는다. `?account=world`는 WORLD 계정 예시, `?authorization_id=synthetic`은 동의 예시다. 실제 사용자 정보나 로그인 성공의 증거로 쓰면 안 된다.

계정 화면에는 학습 연결 동의, 소속/권한, 연결된 로그인 종료, 연결된 연습 기록 내보내기, 삭제 요청을 둔다. 내보내기는 서버의 고정 `until`과 커서를 따르며 기존 과제·AI 기록 전체를 포함한다고 표시하지 않는다. 삭제 요청 접수와 실제 삭제 완료를 구분한다. 비회원 학습을 계정에 자동 귀속하지 않는다.

## 공개 설정

`config.example.json`을 운영자가 `config.json`으로 복사한 뒤 공개 값만 넣는다. 이 빌드는 `.env`, 기기 로그인 정보, 서버 비밀 키를 읽지 않는다. `config.json`은 저장소에서 제외한다.

| 키 | 내용 |
|---|---|
| `supabaseUrl` | Supabase 공개 프로젝트 URL |
| `supabasePublishableKey` | 브라우저용 publishable 또는 legacy anon 키. secret/service_role 금지 |
| `accountApiUrl` | SYNK Edge 함수가 있는 URL. 생략하면 Supabase URL |
| `portalUrl` | 중앙 `index.html`의 정확한 HTTPS 주소 |
| `clients.platform / clients.world / clients.messenger` | 각 브라우저 public OAuth client의 `clientId`, 정확한 `redirectUri`. 메신저의 callback은 회사 서버의 `/api/synk-id/callback` |
| `authorizationClients` | 같은 제품의 추가 실행 환경. `{product,clientId,redirectUris}` 목록. Native 예시는 `synktalk://oauth/callback`이며 실제 앱 빌드에서 별도 확인 필요 |
| `messengerUrl` | 회사 웹 개발 미리보기 입구. 토큰·권한 전달 경로가 아니다 |
| `learningUrl` | 준비 전에도 열 수 있는 기본 학습 입구 |

세 클라이언트와 실행 환경마다 등록된 client ID와 redirect URI를 채운다. 브라우저 예시의 callback은 해당 출처의 `client.html?product=platform` 또는 `client.html?product=world`다. 제품·origin·path·등록 query·state·10분 만료를 확인하고, 일회용 PKCE verifier는 같은 탭의 sessionStorage에만 둔다. 브라우저 제품 토큰도 제품별 sessionStorage에 두며 중앙 SDK 세션과 합치지 않는다. HTTPS가 기본이며 loopback HTTP만 개발용으로 허용한다.

중앙 Edge 함수의 `SYNK_OAUTH_CLIENT_PRODUCTS`에도 각 OAuth client ID와 제품을 등록한다. 인증 제공자가 확인한 토큰의 client ID로 제품을 결정하므로 브라우저의 헤더 변경만으로 다른 제품이 될 수 없다. 메신저에는 활성 계정의 ID·표시 이름·현재 세션만 반환하고 학습·학원 소속·이용권은 반환하지 않는다. 직원 연결은 [회사 서버 계약](../../docs/마케팅/온라인마케팅지도/engagement/company/SYNK_ID.md)을 따르며 이메일 일치로 자동 연결하지 않는다.

Supabase에서 OAuth 2.1 서버(beta)를 활성화하고 Authorization Path를 중앙 동의 화면으로 지정해야 한다. 이 설정 변경은 이 구현에 포함하지 않았다. 이메일 확인/복구 허용 도착 주소도 중앙 `portalUrl`에 맞춰 등록한다. 제품 서버의 release-policy가 기능을 열어야 학습 동기화 등도 운영할 수 있다. 서버의 거절은 사용자에게 표시한다.

WORLD는 계정 API에서 검증한 `synk_user_id`와 학습 동의 revision마다 `synk.account.{id}.r{revision}.` 저장소를 분리한다. 계정 전환·로그아웃·동의 철회에서는 기존 host를 중단한다. 동기화가 꺼진 경우 `local:{synk_user_id}` 전용 저장소와 `connected:false` host로 기기 안에서 연습한다. 이때도 예전 비회원 기록을 읽지 않는다. `capabilities.learningSync`가 꺼져 있거나 계정이 `deletion-requested`이면 새 학습 연결을 켤 수 없고, 기존 동의를 끄는 것은 허용한다.

현재 제품 로그아웃은 서버 세션 종료를 요청하고 기기 자격을 지운다. 서버 장애가 기기 로그아웃을 막지 않으며, 저장 제거 실패와 서버의 종료 미확인은 각각 안내한다. 현재 session을 특정하지 못하거나 `refreshRevoked`를 확인하지 못하면 서버 종료 완료로 표시하지 않는다. 모든 제품 종료 결과에서는 `legacyAccessGuard`도 확인한다. 삭제 요청에는 화면 내 재시도에서도 같은 UUID를 쓰고, 요청이 접수되면 계정 상태를 다시 읽어 표시한다.

## 빌드와 확인

```powershell
cd experiences/synk-account
npm ci --ignore-scripts
npm test
cd ../..
node tools/build-synk-account.js
node tools/build-synk-account.js --check
```

기본 source root는 이 저장소, talk root는 형제 `../SYNK-talk`다. 별도 worktree에서 원본 최신 사본을 읽을 때:

```powershell
node tools/build-synk-account.js --source-root C:/Users/q1212/Documents/SYNK-appsscript --talk-root C:/Users/q1212/Documents/SYNK-talk
```

도구는 최신 `SYNK-talk/lib/synk-account-client.js`와 `account/world-learning-host.js`를 `src/generated`로 복사한다. `dist/app.js`, `dist/client.js`, `dist/preview.js`, `dist/platform.js`, `dist/local-world.js`, 승인 자산, `preview.html`, SHA-256 `build-manifest.json`을 만든다. `--check`는 원문과 생성물의 바이트 일치를 확인한다. 상위 학습 서버에서 `/synk-account/` 경로를 열어 확인한다. 단독 정적 배포 시 이 폴더의 HTML/CSS/dist/assets와 공개 config가 필요하며, WORLD 게임 경로·학습 허브도 같은 출처에서 제공해야 한다.

선택적 신규 브라우저 context 검증은 `node tests/browser-smoke.mjs <playwright-module-directory>`로 실행한다. 테스트는 로컬 파일을 가상 loopback 경로로 제공하며 원격 인증을 호출하지 않는다. 캡처는 `qa/`에 남긴다. 실제 로그인/메일/운영 데이터 검증을 대체하지 않는다.

## 공식 근거

- [Supabase OAuth 서버 시작](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [OAuth 인가 흐름과 공개 클라이언트 PKCE](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [비밀번호 재설정](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)

## 로컬 확인 기록

2026-10-02: PKCE/state/만료/일회 소비, 공개 설정 제한, 브라우저·Native redirect allowlist, 계정/revision 격리, token POST 계약의 core 회귀 7개 통과. 실제 계정 설정은 만들지 않았고 비밀 키를 불러오지 않았다. 상세 화면 검증 결과는 `qa/RESULT.md`에 둔다.
