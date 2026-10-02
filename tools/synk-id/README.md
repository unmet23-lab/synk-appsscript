# SYNK ID 운영 스크립트

SYNK 계정(synk.im/id/)을 talk 프로젝트(Supabase)에 여는 데 쓴 스크립트다. 2026-10-03 운영 가입을 열 때 쓴 것을 세션 밖에서도 다시 쓰게 옮겼다. 상세 경과는 [트랙](../../docs/_ops/트랙.md) 3절과 [순간 맞춤 문서 10절](../../docs/아틀라스_순간맞춤_20261002.md)에 있다.

- 기본 과녁은 리허설(synk-core-rehearsal)이고, 운영(Synk Core)은 `--운영`을 붙였을 때만이다. 바꾸는 명령은 `--적용`(또는 `--register`·`--products`)이 있어야 나간다.
- Supabase 접근 토큰은 SYNK-talk의 `lib/자격증명.js`로 그 저장소의 `.env`에서 읽는다. 출력하거나 명령줄로 넘기지 않는다. 다른 위치의 talk는 `SYNK_TALK_ROOT`로 준다.
- 비밀이 아닌 공개 값(공개 클라이언트 번호, publishable 키)만 파일에 둔다.

| 스크립트 | 하는 일 |
|---|---|
| `auth-settings.js` | 로그인 설정 보기, `--적용`이면 사이트 주소·허용 주소·OAuth 서버와 동의 화면 경로(`/id/`·`/id-rehearsal/`)·가입 열기. `--메일문구`는 한국어 가입 확인·비밀번호 재설정·이메일 변경 메일(Supabase는 SMTP를 넣은 뒤에만 허용) |
| `oauth-clients.js` | 공개 OAuth 클라이언트 목록, `--register`면 WORLD 앱(운영은 맞춤 도구도) 등록, `--products`면 `SYNK_OAUTH_CLIENT_PRODUCTS` |
| `release-policy.js` | `SYNK_RELEASE_POLICY`를 talk 파서로 검사해 보여 주고 `--적용`으로 넣는다 |
| `prepare-portal.mjs` | `node tools/build-synk-account.js` 뒤에 synk.im에 올릴 SYNK ID 화면 폴더를 만든다(공개 값 config, noindex, 사이트 아이콘) |
| `login-check.cjs` | 실제 WORLD 앱 로그인 요청 → 302 → SYNK ID 화면을 headless Chrome으로 연다(올리기 전 로컬 폴더로도) |
| `lib.js` | 공통: 과녁, 관리 API, 공개 클라이언트 번호 |

## 순서

1. 설정이나 비밀값(`SYNK_OAUTH_CLIENT_PRODUCTS`·`SYNK_RELEASE_POLICY`)을 바꾼 뒤에는 talk의 `synk-account`·`synk-learning`(정책이면 `release-policy`도)을 깨끗한 작업 공간에서 `tools/원격배포.js ... --적용`(운영은 `--운영`)으로 다시 띄워 읽게 한다.
2. 화면: `node tools/build-synk-account.js` → `node tools/synk-id/prepare-portal.mjs production <폴더>` → `login-check.cjs`로 로컬 확인 → synk-policy `origin/main` 기준 임시 작업 공간의 `id/`에 복사해 푸시 → 실제 주소와 바이트 비교.
3. **운영 메일 발송(SMTP)을 유호님이 넣은 뒤** `node tools/synk-id/auth-settings.js --운영 --적용 --메일문구`로 한국어 메일 문구를 넣는다.

계정 지우기 처리는 talk의 `supabase/계정삭제_대기.sql`(읽기)·`supabase/계정삭제_처리.sql`(쓰기)이다.
