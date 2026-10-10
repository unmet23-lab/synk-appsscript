# SYNK ID · 브라우저 계정과 제품 연결

중앙 이메일 로그인·일반 가입·비밀번호 복구·OAuth 동의 화면과 플랫폼/WORLD의 브라우저 소비처를 준비했다. **실제 Supabase OAuth 서버 설정, 실제 로그인, 메일 발송, 운영 배포는 아직 검증하지 않았다.** `config.json`이 없으면 준비 전 안내와 기본 학습 링크만 보인다.

## 화면

- `index.html`: 중앙 계정. 이메일 인증은 공식 `@supabase/supabase-js` 2.117.2를 사용한다. `authorization_id`가 있으면 같은 SDK의 `auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`로 동의를 처리한다.
- `client.html?product=platform`: 공개 클라이언트의 authorization code + PKCE S256. 계정·소속·이용 권한을 보여 준다.
- `client.html?product=world`: 같은 인증 방식과 SYNK ID. 학습 동의를 확인한 뒤 같은 출처의 네 게임을 iframe으로 연다. 부모 `SYNKLearningHost`만 계정 저장소·전송기를 가진다. URL로 토큰을 넘기지 않는다.
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
| `clients.platform / clients.world` | 각 브라우저 public OAuth client의 `clientId`, 정확한 `redirectUri` |
| `authorizationClients` | 같은 제품의 추가 실행 환경. `{product,clientId,redirectUris}` 목록. Native 예시는 `synktalk://oauth/callback`이며 실제 앱 빌드에서 별도 확인 필요 |
| `learningUrl` | 준비 전에도 열 수 있는 기본 학습 입구 |

두 제품과 실행 환경마다 등록된 client ID와 redirect URI를 채운다. 브라우저 예시의 callback은 해당 출처의 `client.html?product=platform` 또는 `client.html?product=world`다. 제품·origin·path·등록 query·state·10분 만료를 확인하고, 일회용 PKCE verifier는 같은 탭의 sessionStorage에만 둔다. 브라우저 제품 토큰도 제품별 sessionStorage에 두며 중앙 SDK 세션과 합치지 않는다. HTTPS가 기본이며 loopback HTTP만 개발용으로 허용한다.

Supabase에서 OAuth 2.1 서버(beta)를 활성화하고 Authorization Path를 중앙 동의 화면으로 지정해야 한다. 이 설정 변경은 이 구현에 포함하지 않았다. 이메일 확인/복구 허용 도착 주소도 중앙 `portalUrl`에 맞춰 등록한다. 제품 서버의 release-policy가 기능을 열어야 학습 동기화 등도 운영할 수 있다. 서버의 거절은 사용자에게 표시한다.

WORLD는 계정 API에서 검증한 `synk_user_id`와 학습 동의 revision마다 `synk.account.{id}.r{revision}.` 저장소를 분리한다. 계정 전환·로그아웃·동의 철회에서는 기존 host를 중단한다. 동기화가 꺼진 경우 `local:{synk_user_id}` 전용 저장소와 `connected:false` host로 기기 안에서 연습한다. 이때도 예전 비회원 기록을 읽지 않는다. `capabilities.learningSync`가 꺼져 있거나 계정이 `deletion-requested`이면 새 학습 연결을 켤 수 없고, 기존 동의를 끄는 것은 허용한다.

현재 제품 로그아웃은 서버에서 확인한 현재 session을 해제한 뒤 제품 토큰을 지운다. 현재 session을 특정하지 못하면 기기 내 로그아웃의 한계를 안내한다. 모든 제품 종료 결과에서 `refreshRevoked` 또는 `legacyAccessGuard`를 확인하지 못하면 일부 기존 앱의 종료가 확인되지 않았다고 남긴다. 삭제 요청에는 화면 내 재시도에서도 같은 UUID를 쓰고, 요청이 접수되면 계정 상태를 다시 읽어 표시한다.

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

도구는 최신 `SYNK-talk/lib/synk-account-client.js`와 `account/world-learning-host.js`를 `src/generated`로 복사한다. `dist/app.js`, `dist/client.js`, `dist/preview.js`, 승인 자산, `preview.html`, SHA-256 `build-manifest.json`을 만든다. `--check`는 원문과 생성물의 바이트 일치를 확인한다. 상위 학습 서버에서 `/synk-account/` 경로를 열어 확인한다. 단독 정적 배포 시 이 폴더의 HTML/CSS/dist/assets와 공개 config가 필요하며, WORLD 게임 경로·학습 허브도 같은 출처에서 제공해야 한다.

선택적 신규 브라우저 context 검증은 `node tests/browser-smoke.mjs <playwright-module-directory>`로 실행한다. 테스트는 로컬 파일을 가상 loopback 경로로 제공하며 원격 인증을 호출하지 않는다. 캡처는 `qa/`에 남긴다. 실제 로그인/메일/운영 데이터 검증을 대체하지 않는다.

## 공식 근거

- [Supabase OAuth 서버 시작](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [OAuth 인가 흐름과 공개 클라이언트 PKCE](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [비밀번호 재설정](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)

## 로컬 확인 기록

2026-10-02: PKCE/state/만료/일회 소비, 공개 설정 제한, 브라우저·Native redirect allowlist, 계정/revision 격리, token POST 계약의 core 회귀 7개 통과. 실제 계정 설정은 만들지 않았고 비밀 키를 불러오지 않았다. 상세 화면 검증 결과는 `qa/RESULT.md`에 둔다.
