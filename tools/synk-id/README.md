# SYNK ID 운영 스크립트

SYNK 계정(synk.im/id/)을 talk 프로젝트(Supabase)에 여는 데 쓴 스크립트다. 2026-10-03 운영 가입을 열 때 쓴 것을 세션 밖에서도 다시 쓰게 옮겼다. 상세 경과는 [트랙](../../docs/_ops/트랙.md) 3절과 [순간 맞춤 문서 10절](../../docs/아틀라스_순간맞춤_20261002.md)에 있다.

- 기본 과녁은 리허설(synk-core-rehearsal)이고, 운영(Synk Core)은 `--운영`을 붙였을 때만이다. 기존 도구의 변경은 `--적용`, 공통 등록 도구의 변경은 `--apply`가 있어야 나간다. 옛 OAuth `--register`·`--products` 쓰기는 폐기되어 실행 전에 거부된다.
- Supabase 접근 토큰은 SYNK-talk의 `lib/자격증명.js`로 그 저장소의 `.env`에서 읽는다. 출력하거나 명령줄로 넘기지 않는다. 다른 위치의 talk는 `SYNK_TALK_ROOT`로 준다.
- 비밀이 아닌 공개 값(공개 클라이언트 번호, publishable 키)만 파일에 둔다.

| 스크립트 | 하는 일 |
|---|---|
| `auth-settings.js` | 로그인 설정 보기, `--적용`이면 사이트 주소·허용 주소·OAuth 서버와 동의 화면 경로(`/id/`·`/id-rehearsal/`)·가입 열기. `--메일문구`는 한국어 가입 확인·비밀번호 재설정·이메일 변경 메일(Supabase는 SMTP를 넣은 뒤에만 허용) |
| `oauth-clients.js` | 읽기 전용 공개 OAuth 목록. 등록·매핑 변경은 아래 공통 도구만 사용한다 |
| `provision-apply.cjs` | 기본 읽기 계획, `--apply`에서 기존 원문 지문 대조 후 public 등록·매핑 병합. [입력·복구 절차](UNIFIED-CONFIG.md) |
| `release-policy.js` | `SYNK_RELEASE_POLICY`를 talk 파서로 검사해 보여 주고 `--적용`으로 넣는다 |
| `prepare-portal.mjs` | `--current=현재게시본.json --config=등록후공개설정.json` 필수. `--config-only`면 동의 목록만 병합한 config 하나, 그 외에는 먼저 빌드한 전체 포털 폴더 준비 |
| `login-check.cjs` | 실제 WORLD 앱 로그인 요청 → 302 → SYNK ID 화면을 headless Chrome으로 연다(올리기 전 로컬 폴더로도) |
| `lib.js` | 공통: 과녁, 관리 API, 공개 클라이언트 번호 |

## 순서

1. 설정이나 비밀값(`SYNK_OAUTH_CLIENT_PRODUCTS`·`SYNK_RELEASE_POLICY`)을 바꾼 뒤에는 talk의 `synk-account`·`synk-learning`(정책이면 `release-policy`도)을 깨끗한 작업 공간에서 `tools/원격배포.js ... --적용`(운영은 `--운영`)으로 다시 띄워 읽게 한다.
2. 동의 목록만 추가할 때: 현재 게시 `config.json`을 읽기로 보관 → `node tools/synk-id/prepare-portal.mjs production <새폴더> --current=<현재게시본.json> --config=<등록후공개설정.json> --config-only` → 결과의 기존 항목 보존 확인 → synk-policy 격리 작업본에서 `id/config.json`만 갱신·검수·게시·실제 주소 대조. 이 경우 기존 앱 번들과 공개 자산은 바꾸지 않는다. 화면 자체의 배포가 별도로 승인된 경우에만 `node tools/build-synk-account.js` 후 `--config-only`를 빼서 전체 포털을 준비한다.
3. **운영 메일 발송(SMTP)을 유호님이 넣은 뒤** `node tools/synk-id/auth-settings.js --운영 --적용 --메일문구`로 한국어 메일 문구를 넣는다.

계정 지우기는 요청 뒤 7일 동안 본인이 계정 화면에서 취소할 수 있고, 그 뒤 지체 없이, 늦어도 요청 후 30일 안에 처리한다(유호님 2026-10-03). talk 예약 작업 `synk-account-purge`가 매일 한국 03:17에 유예가 끝난 대기 요청을 처리하고(talk 마이그레이션 20261003005000·20261003006000, 처리 함수는 유예 중이거나 취소된 요청을 돌려보낸다), 학원 소속이 이어진 계정처럼 남은 요청은 talk의 `supabase/계정삭제_대기.sql`(읽기, 요청마다 기한·남은 날)로 보고 `supabase/계정삭제_처리.sql`(쓰기)로 기한 안에 처리한다.
