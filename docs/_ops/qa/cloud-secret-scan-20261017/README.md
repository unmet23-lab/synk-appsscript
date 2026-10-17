# 저장소 비밀값·개인정보 노출 점검 (클라우드 · 2026-10-17)

> 읽기·보고만 했다. 파일 수정·이력 재작성·키 호출 시험은 하지 않았다. 이 문서에는 비밀값·개인 연락처 원문을 쓰지 않는다(앞 3~4자와 길이만).

## 범위와 방법

- 기준: `origin/master` HEAD `1676291a`와 GitHub 원격의 **모든 가지 33개·커밋 12,624개**(2026-07-08 첫 커밋부터). 로컬 미푸시 커밋은 범위 밖.
- 저장소 공개 범위: GitHub **비공개(private)** 저장소다. 아래 노출은 저장소 접근 권한이 있는 사람·도구(협업자, 연결된 AI 세션, 클론본)에게 보이는 범위다.
- 이력: 1MB 이하 blob만 받아(`--filter=blob:limit=1m`) 고유 텍스트 blob **60,139개**를 전부 정규식으로 훑었다. 1MB 넘는 blob 1,787개(그림·영상·큰 JSON)는 읽지 않았다.
- 형식 탐지: OpenAI·Anthropic·Google(API 키·OAuth secret·토큰·refresh)·GitHub·Slack·Meta(EAA·IGAA)·Supabase·AWS·Stripe·HF·Telegram·JWT·PEM 비밀키·서비스 계정 JSON·URL 안 계정정보·`key/secret/token/password = "…"` 대입·Bearer, 그리고 이름이 키 관련인 줄의 고엔트로피 문자열(Typecast·Higgsfield처럼 형식을 모르는 키 대비). 커밋 메시지 전체도 같은 기준으로 훑었다.
- 개인정보: 메일, 휴대폰·유선 번호, 한국 도로명 주소, 주민번호 형식, 공인 IP, SSH 접속 문자열.
- 보조로 gitleaks 8.21.2(현재 파일)를 돌렸으나 결과 2,826건이 전부 `generic-api-key` 오탐이라 판정에는 쓰지 않았다.
- 키를 실제로 호출해 유효성을 확인하지 않았다. 「유효해 보임」은 형식·맥락 판단이다.

위험도: **P0** 실제 유효해 보이는 키 · **P1** 개인정보·인프라 접속 정보 · **P2** 예시·가짜·공개용 값.

## 요약

| 등급 | 건수 | 내용 |
|---|---|---|
| P0 | **0** (저장소 안) | 이력 전체에서 실제로 쓸 수 있어 보이는 API 키·토큰·비밀키·서비스 계정 JSON은 찾지 못했다. |
| (저장소 밖) | 1 | Typecast 키 — 10-07 시험 **실행 출력**에 찍혔으나 커밋·커밋 메시지에는 없다. 폐기·재발급은 아직 남아 있다(트랙). |
| P1 | **11** | 창업자 휴대폰 번호, 개인 메일 6종, 학생 추정 메일, 실명+번호 시험값, 사무실 공인 IP, 라디오 서버 SSH 접속 정보 |
| P2 | 16묶음 | 공개용 키, 외부 벤더 코드의 공개 키, 시험용 가짜 값, 폐기된 임시 토큰, 기관 연락처 등 |

## P0 · 비밀값

| # | 종류 | 위치 | HEAD에 남음 | 판정 | 권하는 조치 |
|---|---|---|---|---|---|
| 0-1 | Typecast API 키 | **저장소에 없음.** 10-07 흐름 시험(`tests/미니게임_목소리_흐름.test.cjs`)이 보안 폴더의 실제 키 파일을 읽어 가짜 서버로 보내고 실패 문구에 찍었다(커밋 `6d8bb0838` 본문에 경위 기록). 10-07~10-09 사이 바뀐 파일 6,972개와 전체 커밋 메시지를 고엔트로피 문자열로 훑었지만 키 값은 없다. | 아니오 | 저장소 밖(터미널·AI 세션 기록) 노출 | **키 폐기·재발급**(트랙 30행에 미완으로 남아 있음). 당시 세션 기록이 클라우드 대화에 남았을 수 있으니 재발급이 유일한 확실한 조치다. 이력 정리 불필요. |

## P1 · 개인정보·인프라 정보

| # | 종류 | 파일·줄 / 처음 들어온 커밋 | HEAD에 남음 | 권하는 조치 |
|---|---|---|---|---|
| 1-1 | 창업자 휴대폰 번호 `010-…`(13자, 이름·개인 메일과 같은 줄) | `docs/_ops/트랙.md` 이력판 · 처음 `b84385978`(09-01) | **아니오**(이력만) | 이력 정리 대상. 비공개 저장소라 급하지 않지만 저장소를 공유·공개할 일이 생기기 전에 정리. |
| 1-2 | 창업자 개인 Gmail `unm…@gmail.com` | HEAD 31개 파일(아래 목록) · 이력 65개 파일 · 처음 `57942040f`(07-08, 첫 커밋) | **예** — 배포 대상 `엔진_synkbrief.js` 3곳, `tools/company-messenger/QA.md:232·235·248`, `docs/AI_운영원칙.md:11`, `docs/_ops/결정.md`, `docs/_ops/돈장부.json`, `.claude/hooks/credential-guard.js`, `tools/geminilm-export.js` 등 | 계정 지정용으로 쓰이는 곳이 많아 지우기보다 **Apps Script 배포 코드(`엔진_synkbrief.js`)에서는 스크립트 속성으로 빼기**를 권한다. 문서는 그대로 두거나 `unm…`처럼 줄여 적는 규칙을 세운다. 이력 정리는 선택. |
| 1-3 | 개인 Google AI Ultra 계정 `77y…@gmail.com` | HEAD 12개 파일(`docs/AI_운영원칙.md:12`, `docs/_ops/결정.md`, `docs/_ops/돈장부.json`, `tools/돈장부.js`, `tools/geminilm-export.js`, 마케팅 계정 문서 등) · 처음 `9aafdaa07`(08-04) | **예** | 1-2와 같음(운영 원칙 문서의 계정 지정은 의도된 기재). |
| 1-4 | 개인 네이버 메일 `yuh…@naver.com` | `docs/_ops/결정.md:199`, `docs/마케팅/댓글DM_자동화_GPT인계_20261007.md:25` · 이력 8개 파일(GLIDE 조립가이드 등) · 처음 `0f0be54f1`(07-18) | **예**(2줄) | 개인 메일이 업무 문서에 필요 없으면 「개인 네이버」로 바꿔 적기. |
| 1-5 | 개인 Gmail(14자 계정) `unm…@gmail.com` | `docs/마케팅/온라인마케팅지도/intl-social/execution-20260920.json:994·1880`, 같은 폴더 `최종점검_20260920.md:46` · 처음 `116bc4ff4`(09-21) | **예**(3줄) | 1-2와 같음. |
| 1-6 | K-Startup 가입 메일 `lal…@naver.com` | `docs/정부지원금_실행지.md`, `docs/GLIDE_조립가이드_v940·v947.md` 이력판 · 처음 `771be88cf`(07-19) | 아니오 | 이력 정리 대상(선택). |
| 1-7 | 개인 OneDrive 메일 `q12…@outlook.com` | `docs/_ops/결정.md`, `tools/이어하기꾸러미.js` 이력판 · 처음 `0a96e3e73`(09-05) | 아니오 | 이력 정리 대상(선택). |
| 1-8 | 학생 계정으로 적힌 메일 `wit…@naver.com`(「SYNK-001 (student) 학생」) | `docs/GLIDE_조립가이드_v939·v940·v947.md`, `docs/_archive/GLIDE_조립가이드_v939.md` 이력판 · 처음 `0f0be54f1`(07-18) | 아니오 | 실제 학생 메일인지 확인. 실제라면 **학생 식별정보**라 이력 정리 우선순위를 올린다. |
| 1-9 | 실명 + 실제처럼 보이는 휴대폰 번호 2개(시험값, 「김…」 3자 이름) | `tests/크루카드.test.js` 이력판 · 처음 `ea37018fa`(08-04) | 아니오 | 실제 인물·번호인지 확인. 실제라면 이력 정리. 이후 시험값은 `010-0000-0000`류 합성값만 쓴다. |
| 1-10 | 사무실(작업 PC) 공인 IP `175.…`(15자) — 방화벽 허용 IP로 기재 | `docs/_ops/qa/workspace-signal-20261010/README.md:55` · 처음 `90dd2a1db`(10-11) | **예** | 문서에서 IP 값을 빼고 「허용 IP 목록에 있음」만 남기기. 이력 정리는 선택. |
| 1-11 | 라디오 서버 SSH 접속 정보(사용자 `syn…`@`34.…`(12자), 키 파일 경로 `~/.ssh/synk_radio`, 일부 스크립트 `StrictHostKeyChecking=no`) | HEAD 53개 파일 — `docs/라디오/…/deploy.cjs:3`, `…/finalize.cjs:7`, `docs/_ops/라디오생동_20260909/**` 등 · 처음 `3b26e2d00`(09-06) | **예** | 비밀키 자체는 저장소에 없다(확인). 서버 주소·계정을 환경변수나 로컬 설정 한 곳으로 모으고, 서버에서 비밀번호 로그인 꺼짐·SSH 허용 IP 제한을 확인. `StrictHostKeyChecking=no`는 `accept-new`로. 이력 정리는 불필요. |

## P2 · 예시·가짜·공개용 값

| # | 종류 | 위치 | HEAD | 판정·조치 |
|---|---|---|---|---|
| 2-1 | 08-02 임시 doGet 러너 고정 토큰 `2Kn1…(32자)` + 임시 배포 ID `AKfy…(32자)` | `tests/배포표면.test.js:16-17` 이력판 · 처음 `f8f2cf18b`(08-02) | 아니오(합성값으로 교체됨) | 그 러너·임시 배포 4개는 v9.133(`52c0e44`)에서 철거·404 확인으로 기록됨. 조치 불필요. 철거 여부가 의심되면 `clasp deployments`로 그 배포 ID가 없는지만 확인. |
| 2-2 | Supabase **publishable** 키 `sb_p…`(46자) | `docs/마케팅/맞춤도구/core/account.js:13`, `docs/_ops/qa/atlas-dating-provider-20261008/portal-config.*.json:4`, `desktop/auth.example.json:5`(38자) | 예 | 브라우저에 공개하도록 만든 키. RLS가 켜져 있는 한 문제 없음. `sb_secret_`·`service_role`은 이력 전체에 없음(시험의 가짜 `sb_s…(31자)` 1건 제외). |
| 2-3 | PostHog 프로젝트 키 `phc_…(47자)` | `docs/마케팅/synkbrief_회의메모_20260921/video-v3/.agents/skills/media-use/scripts/lib/telemetry.mjs:19` | 예 | 외부 스킬 벤더 코드의 공개 수집 키(SYNK 것 아님). 조치 불필요. |
| 2-4 | X(트위터) 웹 공개 Bearer `AAAA…(59자)` | `.claude/skills/last30days/scripts/lib/vendor/bird-search/lib/twitter-client-base.js:88` | 예 | 트위터 웹앱에 공개 내장된 값을 벤더 코드가 씀. 조치 불필요. |
| 2-5 | 시험용 가짜 `sk-a…(35자)`·`AIza…(39자)`·주민번호 형식 `9901…(14자)` | `tests/노트북LM묶음.test.js:37-41` 이력판 · `9aafdaa07` | 아니오 | 탐지기 시험 값. 같은 파일 휴대폰 번호(`…22`)도 합성값으로 보임. |
| 2-6 | `-----BEGIN … PRIVATE KEY-----` 머리글만 | `tests/자격증명가드.test.js:151`, `tests/코덱스실행.test.js` 이력판 | 예 | 실제 키 본문 없음(탐지기 시험). |
| 2-7 | Instagram 토큰 형식 `IGAA…` | `tests/synkbrief_자료전달.test.js:8·31·36·41`, `tests/상담AI_meta.test.js:8` 이력판 | 예(앞 파일) | 값에 `test`·`abcde`·`valid` 등이 들어간 가짜. |
| 2-8 | 그 밖의 시험 고정값(`refresh_token`·`csrfToken`·`password` 대입 약 970건) | `docs/마케팅/온라인마케팅지도/engagement/company/*.test.mjs`, `desktop/tests/*`, `tools/company-messenger/qa/*` 등 | 예 | 전부 `fixture`·`synthetic`·`browser-refresh-1`류 가짜. |
| 2-9 | 앱 내부 추천 토큰 `JZPw…`·`XCCb…`(43자) | `docs/_ops/qa/atlas-dating-controls-20261008/browser-first.log:51` | 예 | 시험 브라우저 세션의 일회성 값. 조치 불필요. |
| 2-10 | Cloudflare 분석 비컨 토큰 `4edd…(32자)` | `docs/_archive/브랜드_색상키트_원본_CrewDossier_2026-08-01.html:626` | 예 | 외부 페이지를 저장한 사본의 공개 값. |
| 2-11 | 사업장 주소(용산구 도로명, 「2층」) | `docs/개인정보처리방침_게시용.html`, `docs/개인정보처리방침_초안_v1.md`, `docs/상담AI_개통_지금할일.md`, `docs/_ops/홈페이지챗봇_평가_20260911.md` 이력판 · `a30188af2`(08-04) | 아니오 | 개인정보처리방침에 공개한 사업장 주소. **자택을 겸하는 주소라면 P1**로 올려 이력 정리. |
| 2-12 | GCP 서비스 계정 이메일 `syn…@synk-radio24.iam.gserviceaccount.com` | `docs/_ops/결정.md` 이력판 · `766dc0786`(09-03) | 아니오 | 계정 이름만. 키 JSON(`"type": "service_account"`·`private_key`)은 이력 전체에 없음. |
| 2-13 | 공개 서비스 IP `34.…`(VIP), `118.…`(이전 A 레코드) | `docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md:476·604`(HEAD), `docs/상담AI_개통_지금할일.md` 이력판 | 일부 | DNS로 누구나 아는 공개 주소. 조치 불필요. |
| 2-14 | 회사 SNS 로그인 메일 `syn…@gmail.com` | `docs/마케팅/sns-계정.json`, `docs/마케팅/온라인마케팅지도/account-setup-proposal.json` 등 HEAD 39줄 | 예 | 회사 계정. 피싱 표적이 될 수 있으니 2단계 인증 확인만 권함. |
| 2-15 | 기관·외부 업무 연락처(담당자 실명+직통번호 일부, 경쟁 학원·법률사무소·정부기관 메일) | `docs/정부지원금_실행지.md`, `docs/통화카드_2026-09.md`, `docs/몽골상표_대리인_견적비교.md`, `docs/경쟁실사_UB한국어학원_2026-08-28.md`(`ub2…@gmail.com`, 이력만) 등 | 일부 | 공개 업무 연락처. 조치 불필요. |
| 2-16 | Google Drive 폴더 ID·Apps Script 웹앱 주소(`AKfycbzz…`) | `tools/company-messenger/QA.md:236`, HEAD 2개 파일 | 예 | 비밀값은 아니지만 「링크가 있는 모든 사용자」 공유가 아닌지 확인. |

### 찾지 않은 것(없음 확인)

- `.env`·`*.pem`·`*.key`·`id_rsa`·`credentials*.json`·`client_secret*`·`token*.json`·`.clasprc.json`·`.npmrc` 같은 자격증명 파일은 이력 전체에 없다(이름이 비슷한 `production-secrets.json`·`token-boundary-*.json`은 상태 기록뿐).
- OpenAI·Anthropic 실키, Google API 실키·OAuth client secret(`GOCSPX-`)·refresh token, GitHub PAT, Meta/Facebook 페이지 토큰, Telegram 봇 토큰, AWS 키, 주민등록번호(실제 값)는 이력 전체에서 나오지 않았다.

## 읽지 못한 범위

- 1MB 넘는 blob 1,787개(주로 그림·영상·큰 산출 JSON·HTML 묶음). 큰 HTML/JSON 안에 비밀값이 박혔을 가능성은 남는다.
- 로컬 미푸시 커밋, 유호님 PC의 `.git`에만 있는 가지·stash, Git LFS·외부 저장소(Drive·synk-vendor).
- GitHub 이슈·PR 본문·댓글, Actions 로그.

## 권하는 순서

1. **Typecast 키 폐기·재발급**(0-1). 저장소 정리와 무관하게 유일한 확실한 조치.
2. **배포 코드에서 개인 메일 빼기**: `엔진_synkbrief.js`의 `unm…@gmail.com` 3곳을 스크립트 속성으로(1-2). 그리고 사무실 IP(1-10)·라디오 서버 주소(1-11)를 문서·스크립트에서 설정 한 곳으로 모으기.
3. **이력 정리 여부 결정**: 대상은 창업자 휴대폰 번호(1-1), 학생 추정 메일(1-8), 실명+번호 시험값(1-9), 그 밖의 개인 메일(1-6·1-7). 저장소가 비공개라 급하지 않지만, 공유·공개 전에는 `git filter-repo --replace-text`로 한 번에 지우고 모든 클론을 새로 받아야 한다(force push가 필요한 작업이라 유호님 PC에서 별도 결정).
