# Apps Script 전역 이름 충돌·죽은 코드 점검 (2026-10-17, 클라우드)

> 기준: `origin/master` `1676291a`. 클라우드 세션이라 **유호님 PC의 미푸시·미커밋 변경은 범위 밖**이다. 라이브 Apps Script 판과 실제 설치된 트리거도 읽지 못했다.
> 아래 「요약」부터 「범위 밖에서 본 것」까지는 그 기준의 점검 결과다. 그 뒤 유호님 「1,2,3,4 전부 자율주행으로 이어서 해」로 같은 가지에서 정리했고([처리 결과](#처리-결과-10-17-후속)), 병합·배포는 하지 않았다.

## 요약

| 항목 | 결과 |
|---|---|
| 배포 파일 사이 전역 충돌 | **0건** (전역 52개, 중복 선언 없음) |
| 다른 파일 전역을 가리는 지역 이름 | **0건** (인자·지역 변수·catch·내부 함수 전수) |
| 선언 없는 전역 대입·참조(암묵 전역) | **0건** |
| 배포 제외 파일과의 잠재 충돌 | **1건** — `parentSweep` (`엔진_콘텐츠AI.js`) |
| 죽은 코드 후보 | **15개** — 옛 트리거 받이 14개(조건부) + `SYNK_VERSION`(지우면 안 됨) |
| 익명 웹앱 `doGet`/`doPost`의 HtmlService 경로 | **없음** |

## 처리 결과 (10-17 후속)

가지 `claude/friendly-newton-6kin0f`에만 올렸다. master 병합·clasp 배포는 하지 않았다.

| 단계 | 한 일 | 확인 | 남은 일 |
|---|---|---|---|
| 1. 옛 트리거 받이 | `Code.js`에서 받이 14개와 `트리거정리`·`남길트리거`를 지웠다(91→55줄). 머리말에 `[vNEXT]` 한 단락. `safety.test.js`의 받이 시험 5개는 지우고 「메뉴·트리거·대화상자가 이름으로 부르는 함수는 모두 있다」로 바꿨다 | 라이브는 **못 봤다**: 클라우드에 clasp·자격증명이 없고, 연결된 Drive 계정에서는 이 스크립트 파일이 보이지 않는다(`Requested entity was not found`). 근거는 코드뿐이다 — v9.346 판에서는 10분 트리거 `parentSweep`이 깨어나면 실행한 사람의 트리거를 `synkbrief정기점검` 말고 모두 지운다. 옛 14개는 `엔진_셋업확장.js`의 설치 함수가 함께 만들었다([정리 목록](../../옛시스템_정리목록_20261002.md) 18행, `1676291a`의 `tests/safety.test.js:131` 주석 `resetAllTriggers`). 10-02 배포는 정리 목록 10절에 「스스로 지우는 판(@57)을 배포했다」로 남아 있다 | PC: Apps Script 편집기의 실행 기록에서 10-03 이후 옛 함수(`parentSweep` 등) 실행이 없는지, 트리거 화면에 `synkbrief정기점검` 말고 남은 것이 없는지 본다. 없으면 병합 → `deploy`. 있으면 그 트리거를 지운 뒤 배포한다 |
| 2. 전역 충돌 시험 | `safety.test.js`에 「라이브 파일을 올리는 순서대로 한 전역에 읽어도 전역 이름이 겹치지 않는다」와 탐지력 픽스처, 「`.claspignore`는 전부 막은 뒤 허용목록만 연다」를 더했다. 처음 적은 `배포표면.test.js`가 아니라 라이브 파일 읽기 시험이 모인 `safety.test.js`에 두었다 | `filePushOrder` 순서로 `vm` 한 전역에 읽는다. function·var는 파일별 전역 키가 겹치는지, const·let·class는 함께 읽을 때 `SyntaxError`가 나는지 본다(Node 22의 V8에서 실측: 함수는 뒤 것이 이기고 어휘 선언 충돌은 SyntaxError. Apps Script에서 직접 재지는 않았다). C1은 1번으로 `parentSweep`이 배포 집합에서 빠져 사라졌다 | — |
| 3. HtmlService 시험 | 옛 「doGet은 HtmlService를 돌려주지 않는다」(doGet 본문 문자열만 봄)를 「웹 입구(doGet·doPost)에서 닿는 함수 어디에도 HtmlService가 없다」로 바꿨다 | 전역 함수 원문(`typeof`로 물어 const 함수도 잡음)에 다른 전역 함수 이름이 낱말로 나오면 부른 것으로 센다. 그래프가 `synkbrief_웹훅_`·`synkbrief_자료발송_`·`웹응답_`까지 가는지 먼저 확인한다 | — |
| 4. 주석·가드 기준 | `엔진_synkbrief.js:211`·`:313` 낡은 주석, `tests/clasp-guard.check.js:191` 「≥5종」 → 「Code.js·appsscript.json 포함」 | `.claspignore` 파싱 재현: 찾은 대상 3개, 옛 기준 거짓·새 기준 참. 점검 파일 전체는 돌리지 않았다(아래 「범위 밖」) | — |
| 같이 고친 것 | `tools/deploy-security-check.js`의 `topLevelFunctions`가 ASCII 이름만 함수 경계로 봤다. `doGet` 뒤 한글 이름 함수(`웹응답_`)가 `doGet` 본문에 붙어, 그 함수에 `deleteRow`가 있으면 「doGet 안에서 파괴적 연산」 거짓 적색이 난다(재현함). 유니코드 식별자로 넓히고 `배포표면.test.js`에 회귀 시험 하나 **P3** | 옛 정규식으로 새 시험 실패, 새 정규식으로 통과. 실제 `checkCode()` 문제 0 | — |

### 탐지력 — 일부러 망가뜨린 사본으로 잰 것

저장소 사본(작업본 아님)에 하나씩 심어 `safety.test.js`를 돌렸다. 원본 사본은 실패 0이다.

| 변이 | 잡은 시험 |
|---|---|
| M1 `엔진_synkbrief.js`에 `function 웹응답_` 하나 더 | 전역 이름 충돌 |
| M2 `엔진_synkbrief.js`에 `const SYNK_VERSION` 하나 더 | 전역 이름 충돌(함께 읽는 시험 둘도 실패) |
| M3 `synkbrief_발송로그_`(doPost가 닿음)에 `HtmlService` | 웹 입구 HtmlService — **옛 시험은 통과시켰다** |
| M4 `doGet`이 `synkbrief연결창()`을 돌려줌 | 웹 입구 HtmlService — **옛 시험은 통과시켰다** |
| M5 메뉴가 부르는 `synkbrief운영중지` 이름 바뀜 | 이름으로 부르는 함수 |
| M6 `newTrigger('synkbrief정기점검')` 오타 | 이름으로 부르는 함수 |
| M7 대화상자가 부르는 `synkbrief인증저장` 이름 바뀜 | 이름으로 부르는 함수 |
| M8 `.claspignore` 첫 줄 `**/*` 빠짐 | `.claspignore` 전부 막기 |
| M9 허용목록 뒤에 `Code.js` 막기 줄 | `.claspignore` 전부 막기 |

### 시험

- 관련 4개 파일(`safety`·`배포표면`·`synkbrief_운영알림`·`synkbrief_자료전달`): 92/92 통과(`배포표면` 회귀 하나 더함).
- 전체(`node --test tests/*.test.js`, 클라우드 리눅스·Node 22·`TZ=UTC`, node_modules 없음): 전 `1676291a` 1722개 중 실패 20, 후 1723개 중 실패 20. 실패 20개는 이름까지 같다(새 실패 0, 아틀라스·서체·glob 등 Apps Script와 무관한 기존 실패). 늘어난 1개는 `배포표면` 회귀 시험이다.
- `node tools/bump-version.js --check`는 `[vNEXT] 자리표가 남아 있다: Code.js`로 실패한다 — 의도한 상태다. 클라우드는 채번 태그를 origin에 못 올리므로 헤더를 `[vNEXT]`로 두고 PC 세션이 반입 때 채번한다(`tools/bump-version.js` F196 안내). 배포 때: `node tools/bump-version.js --desc "옛 학원 트리거 받이 14개와 트리거정리를 지웠다" --종류 수리` → `docs/버전_이력.md`에 같은 번호로 한 줄 → `--check`.

## 전체 시험 실패 중 `docs/마케팅` 몫 (10-17)

유호님 「1번은 이 세션에서 진행해」. 실패 정리 전체는 이미 다른 클라우드 세션(가지 `claude/determined-dijkstra-l3ygqn`, 보고서 `docs/_ops/qa/cloud-full-tests-20261017/README.md`)이 하고 있어서, 그 세션이 「문서 정리 세션과 겹칠 수 있어 고치지 않았다」고 남긴 `docs/마케팅` 9건만 맡았다. 맡은 파일 목록은 그 세션에 먼저 알렸다.

| 시험 | 원인 | 한 일 |
|---|---|---|
| `맞춤도구/manual/rules.test.js` | 10-14 `build.mjs`의 manual 줄 앞에 `theme`가 들어와 시험이 그 줄을 못 찾았다 | 키 순서와 무관하게 줄을 찾고, 못 찾으면 바로 그렇게 알린다 |
| `맞춤도구/meeting/rules.test.js` | 연습 자료 ZIP은 `*.zip` 무시 규칙으로 git 밖이다 | CI에서만 그 파일 확인을 건너뛴다(`tests/_git밖.js` 규칙). 로컬에서 없으면 그대로 빨갛다 |
| `클라이언트_발주서_20260930/tests/receiver-build.test.cjs` | `dist/`는 `build.cjs` 산출물이고, 빌드도 git 밖 서체(`맞춤도구/dist/brief/computer/assets/InterTight-500.woff2`)를 읽어 깨끗한 체크아웃에서는 만들 수 없다 | CI에서만 건너뛴다. dist가 있을 때 통과하는지는 클라우드에서 보지 못했다 |
| `engagement/company/growth-home-client`·`marin-home-client`·`demo-messenger-navigation` | 10-14 SNS 작업 공간 개편으로 레일의 「마케팅」이 「SNS·마케팅」(`data-tab="social"`)으로 합쳐졌다(`workspacePrimaryTabs`·`workspacePrimaryView`) | 기대값을 `social`로. 휴대폰 메뉴가 분석에 들어갈 때 닫히는지 보는 시험 하나를 더했다(닫는 줄을 사본에서 지우면 실패함을 확인) |
| `verify-map.test.mjs`·`engagement/server.test.mjs` | 지도 지문 14개 중 5개가 안 맞는다. 2개(`inputs/content-lines.json`·`video-v12/README.md`)는 CRLF 작업본에서 잰 값이라 줄끝 탓이고, 3개(`콘텐츠_운영체계_20260927.md`·`sns-계정.json`·`yuhobuilds_1편_쇼츠수정_20260922/README.md`)는 지도를 만든 뒤 내용이 실제로 바뀌었다. 다시 만들려 하자 `build-map.mjs`가 자체 대조 「확장 확보 원장과 44자리 불일치」에서 멈췄다(아무것도 쓰지 않음) | **고치지 않음** — 원장 정리는 SNS 담당 몫이다. 대신 다음 재빌드부터 줄끝 탓이 없도록 `build-map.mjs`가 지문을 LF로 접어 재고(`hashFormat: sha256-utf8-lf`), 시험과 회사 서버(`engagement/server.mjs`)는 그 형식을 보고 고른다(옛 지도는 예전처럼 바이트로 잰다). 시험은 낡은 원천을 첫 하나가 아니라 전부 보여 준다. 지도를 다시 만들기 전까지 서버 동작은 그대로다 |
| `engagement/company/server-client-startup-templates.test.mjs` | 본문을 받는 중 폐기된 세션이 401(다시 로그인) 대신 403(권한 없음)으로 나간다 | **고치지 않음** — 보안 응답 판단이라 보고만 한다 |

- 관찰(P3): `engagement/company/public/app.js:258`의 `['marketing','messenger']`에서 `'marketing'`은 개편 뒤 나올 수 없는 값이다. 탭 전환은 모두 `selectWorkspaceView`를 거치고 거기서 메뉴를 닫으므로(`workspace.js:136`) 지금 동작에는 영향이 없어 고치지 않았다.
- 시험(`docs/마케팅` 시험 파일 298개, 저장소 뿌리에서, `CI=true TZ=UTC`, Node 22): 고친 뒤 3,914개 중 실패 3·건너뜀 4. 실패 3은 위 「고치지 않음」 셋이다.
- 고치기 전과 대조(같은 9개 파일, 고치기 전 커밋 `1d72063c`의 깨끗한 사본, 같은 조건): 전에는 9개 파일이 모두 실패 1씩(합 9), 고친 뒤 실패 3·건너뜀 1(발주서 dist)이다. 데모 메신저 시험은 새 시험 하나로 15→16개.

## 범위 — 실제로 올라가는 파일

- `.claspignore`가 `**/*`로 모두 막고 `appsscript.json`·`Code.js`·`엔진_synkbrief.js`만 연다. 저장소에 `.html` 배포 파일은 없다.
- `.clasp.json` `filePushOrder`: `Code.js` → `엔진_synkbrief.js`. `rootDir`은 저장소 루트.
- `appsscript.json` 웹앱: `ANYONE_ANONYMOUS` · `USER_DEPLOYING`. 실행 API: `MYSELF`.
- `엔진_콘텐츠AI.js`(Strata 원천)는 배포 제외라 본 점검 대상이 아니다. 다만 다시 포함될 때의 충돌만 따로 봤다(아래 C1).

## 방법

acorn 8로 세 스크립트를 돌렸다(이 폴더에 둠, acorn은 저장소 의존성이 아니라 임시 폴더에 설치해 실행).

```
npm i acorn@8 acorn-walk@8      # 임시 폴더에서
node 전역목록.js <저장소> Code.js 엔진_synkbrief.js      # 전역 선언·참조·문자열 참조·가림
node 암묵전역.js <저장소> Code.js 엔진_synkbrief.js      # 선언 없는 식별자
node 호출그래프.js <저장소> Code.js 엔진_synkbrief.js    # doGet/doPost 도달 함수와 HtmlService
node 전역목록.js <저장소> Code.js 엔진_synkbrief.js 엔진_콘텐츠AI.js   # 배포 제외 파일과의 충돌
```

- 「참조」는 선언 자리·멤버 속성·객체 키를 뺀 `Identifier`다. 메뉴(`addItem`)·트리거(`newTrigger`)·HTML의 `google.script.run.<이름>`은 **문자열 안에서** 부르므로 문자열 리터럴도 따로 대조했다.
- 두 배포 파일은 처음부터 끝까지 읽었다. `엔진_콘텐츠AI.js`(4천 줄대)는 AST로 전역만 뽑았고 본문은 `parentSweep` 주변만 읽었다.
- 관련 시험 `node --test tests/safety.test.js tests/배포표면.test.js tests/synkbrief_운영알림.test.js tests/synkbrief_자료전달.test.js` → 91/91 통과(클라우드, Node 22).

## (a)(b) 충돌과 가림

배포 두 파일 사이에는 같은 이름의 함수·`const`·`let`·`var`가 없다. V8 런타임에서 `const` 중복은 프로젝트 전체 로드 실패라 특히 봤지만 없다. 지역 이름이 프로젝트 전역이나 Apps Script 서비스(`SpreadsheetApp`·`PropertiesService` 등)를 가리는 자리도 없다.

같은 이름의 **지역** 도우미가 두 함수에 따로 있는 것은 충돌이 아니지만 적어 둔다(고칠 일 아님).

| 지역 이름 | 자리 | 비고 |
|---|---|---|
| `hash` | `엔진_synkbrief.js:72`(함수), `:320`(변수) | 같은 SHA-256 16진 변환을 두 번 씀 |
| `safeTime` | `엔진_synkbrief.js:369`, `:501` | 실패 값이 `null` / `'-'`로 다름. 각자 쓰임에 맞음 |

### C1. `parentSweep` — 배포 제외 파일과의 잠재 충돌 · **P2**

| | 파일:줄 | 내용 |
|---|---|---|
| 현재 배포 | `Code.js:78` | `function parentSweep() { 트리거정리(); }` — 옛 10분 트리거가 깨면 트리거를 정리하고 끝난다 |
| 배포 제외 | `엔진_콘텐츠AI.js:3966` | 옛 학원 10분 배치(`배치실행_`·`sweepAttendanceForm_` 등을 부름) |

- 지금 동작 영향: **없다.** `.claspignore`가 `엔진_콘텐츠AI.js`를 막고 있다.
- 깨지는 조건: `.claspignore`에서 `엔진_콘텐츠AI.js`를 열거나(예: Strata 정리 중 실수), `**/*` 줄이 빠지면. Apps Script는 파일을 순서대로 한 전역에 올리고 같은 이름의 함수 선언은 **나중 것이 이긴다.** `filePushOrder` 밖 파일은 뒤에 붙으므로 `엔진_콘텐츠AI.js`의 `parentSweep`이 이긴다.
- 그때 결과: 남아 있는 옛 10분 트리거가 `트리거정리()` 대신 옛 학원 배치를 부른다. 지운 함수들을 찾다가 `ReferenceError`로 10분마다 실패하고, 옛 트리거는 스스로 지워지지 않는다. 같은 파일이 배포 전역 `SYNK_VERSION`도 읽는다(`엔진_콘텐츠AI.js:1329`) — 이쪽은 정의돼 있어 오류는 아니다.
- 근거: AST 충돌 목록에 이 한 건만 나왔다. 151개의 나머지 `엔진_콘텐츠AI.js` 전역은 배포 전역과 이름이 겹치지 않는다.

## (c) 어디서도 부르지 않는 함수

AST 참조 0개인 전역은 32개다. 진입점을 빼고 남는 것이 후보다.

### 진입점이라 제외 (17개)

| 이름 | 파일:줄 | 진입 근거 |
|---|---|---|
| `onOpen` | `Code.js:24` | 단순 트리거(시트 열기) |
| `doGet`, `doPost` | `Code.js:40`, `:29` | 웹앱 |
| `synkbrief연결창`, `synkbrief등록표열기`, `synkbrief등록적용`, `synkbrief상태보기`, `synkbrief운영알림연결창`, `synkbrief운영시작`, `synkbrief운영중지` | `엔진_synkbrief.js:139·215·242·297·406·282·291` | 메뉴 `addItem` 문자열 `엔진_synkbrief.js:176-182` |
| `synkbrief인증저장` | `엔진_synkbrief.js:145` | HTML `google.script.run.synkbrief인증저장` (`:141`) |
| `synkbrief운영알림키저장` | `엔진_synkbrief.js:412` | HTML `google.script.run.synkbrief운영알림키저장` (`:408`) |
| `synkbrief운영설치` | `엔진_synkbrief.js:185` | 편집기 실행. 오류 문구 `:170`과 [운영가이드](../../../마케팅/synkbrief_회의메모_20260921/instagram-delivery/운영가이드.md) 63행이 안내 |
| `synkbrief운영알림설정`, `synkbrief운영알림시험`, `synkbrief운영알림상태` | `엔진_synkbrief.js:432·451·354` | 편집기 실행. 함수 위 주석(`:353`·`:430`·`:450`)이 「편집기에서 실행」이라 밝히고 `tests/synkbrief_운영알림.test.js`가 직접 부른다 |

`synkbrief정기점검`(`:311`)은 `morningJobs`가 부르고 트리거 문자열(`Code.js:54·68`, `엔진_synkbrief.js:443`)로 걸리는 진입점이다. 밑줄 끝 함수(비공개)는 전부 1회 이상 참조된다.

### 죽은 코드 후보 (15개)

| # | 이름 | 파일:줄 | 확신 | 판단 |
|---|---|---|---|---|
| D1 | `parentSweep` `dailyBackupJob` `morningJobs` `sendMorningDigestJob` `calcAllJob` `momentSweepJob` `nightJobs` `weeklyJobs` `monthlyJobs` `monthlyReportCardsJob` `monthlyReportJob` `교재연동Nightly` `onConsultEdit` `onHwFeedbackEdit` (14개) | `Code.js:78-91` | 중간 — **조건부** | 옛 학원 트리거 받이. 코드 어디서도 안 부르고 메뉴·HTML에도 없다. 남은 옛 트리거가 깨어날 때만 쓰인다. 주석(`Code.js:75-77`)이 「라이브에서 옛 트리거가 모두 사라진 것을 확인하면 지운다」고 정해 두었고 [정리 목록 10절](../../옛시스템_정리목록_20261002.md) 233행은 「트리거 화면 확인이 남았다」. 라이브 확인 없이 지우면 남은 트리거가 「함수 없음」으로 계속 실패한다. **P3** |
| D2 | `SYNK_VERSION` | `Code.js:22` | 낮음 — **지우면 안 됨** | 런타임 참조 0이지만 `tests/safety.test.js:178`, `tools/bump-version.js`, `tools/이해대장.js:505`가 이 줄을 정규식으로 읽는다. 버전 도장으로 남긴다. 다만 줄 하나가 약 3만 자의 변경 이력이라 라이브 편집기에서 읽기 어렵다(정리 대상은 이력 문자열이지 상수가 아니다). **P3** |

`D1` 중 `morningJobs`만 `synkbrief정기점검()`도 함께 부른다. 지울 때 이 점을 같이 본다(정기점검은 이제 15분 트리거가 직접 부른다).

## (d) 익명 웹앱이 HtmlService를 돌려주는 경로

**없다.**

- 호출 그래프: `doGet`은 다른 함수를 부르지 않고 `ContentService`만 돌려준다(`Code.js:40-47`). `doPost` → `synkbrief_웹훅_`·`웹응답_`·`synkbrief_캠페인읽기_`·`synkbrief_키워드_`·`synkbrief_자료발송_`·`synkbrief_발송로그_`·`synkbrief_관리문서_` 어디에도 `HtmlService`나 `google.script.run` 문자열이 없다.
- `HtmlService`를 쓰는 함수는 `synkbrief연결창`(`엔진_synkbrief.js:142`)과 `synkbrief운영알림연결창`(`:409`) 둘뿐이다. 둘 다 `SpreadsheetApp.getUi().showModalDialog`로 시트 안 대화상자를 띄우므로 웹앱 요청에서는 열리지 않는다.
- 이 불변식은 `tests/safety.test.js:66`(「doGet은 HtmlService를 돌려주지 않는다」)이 지키고 있고 통과한다. 다만 그 시험은 `doGet` 본문 문자열만 본다. `doGet`이 앞으로 다른 함수를 거쳐 HTML을 돌려주게 바뀌면 못 잡는다 — 정리 때 호출 그래프 기준으로 넓히는 것을 권한다(아래 3번).

## 범위 밖에서 본 것 (P3)

- **관리자 확인이 사실상 「로그인했는가」다.** `synkbrief_관리자확인_`(`엔진_synkbrief.js:134-137`)은 `getActiveUser`와 `getEffectiveUser`의 메일이 같은지 본다. 시트 메뉴·대화상자에서 실행되는 함수는 실행한 사람 권한으로 돌므로 둘은 늘 같다. 관리 시트의 다른 편집자도 통과한다. 그 시트에 유호님 말고 편집자가 있는지는 확인하지 못했다. → 10-17 판단: 코드는 고치지 않는다. 메뉴가 `onOpen`으로 시트에 붙는 컨테이너 바인딩 스크립트라 시트 편집자는 스크립트도 열어 고칠 수 있고, 이 확인을 더 좁혀도 막는 것이 없다. 실제 경계는 관리 시트의 편집 권한이다 — 편집자를 유호님 계정만으로 두면 된다. 이 확인은 실행 사용자를 알 수 없는 실행(트리거 등)에서 관리 함수가 도는 것을 막는 몫으로 남긴다. 클라우드에 연결된 Drive 계정으로는 관리표(운영가이드의 링크)가 보이지 않아 편집자 목록은 못 봤다.
- **낡은 주석 2곳.** `엔진_synkbrief.js:211` 「기존 morningJobs를 사용하므로 별도 트리거를 중복 생성하지 않는다」 — 지금은 `트리거정리`가 `morningJobs` 트리거를 지우고 `synkbrief정기점검` 15분 트리거가 따로 돈다. `:313` 「기존 일일 트리거도」도 같은 흔적이다. → 4번에서 고침.
- **`tests/clasp-guard.check.js:191`이 「배포 대상 ≥5종」을 요구한다.** 지금 `.claspignore`가 여는 파일은 3개라 코드상 이 검사는 실패한다. → 4번에서 고침. 이 점검 파일은 머리말대로 09-09 게이트 완화 뒤 옛 행동을 재는 항목 셋이 그대로이고, 깨끗한 저장소에서는 훅이 전체 시험을 인라인으로 돌려 몇 분 걸린다([현장 노트](../../../현장노트/시험_화면확인.md)). 그래서 파일 전체는 돌리지 않았다. 남은 세 항목은 고치지 않는다 — `.claude/settings.json`이 `{}`라 이 훅은 등록돼 있지 않고(`.claude/hooks/README.md`), [AI 운영 원칙](../../../AI_운영원칙.md)이 자체 훅을 새 작업의 선행 조건으로 되살리지 않는다고 정했다. 훅을 다시 쓰기로 할 때 함께 고친다.
- **(10-17 후속에서 봄) 운영가이드가 옛 아침 작업을 현재처럼 적는다.** [운영가이드](../../../마케팅/synkbrief_회의메모_20260921/instagram-delivery/운영가이드.md) 44·61행은 계정 확인이 `morningJobs`에 연결돼 있고 7일마다 Apps Script가 장기 토큰을 갱신한다고 적는다. 10-02부터 `morningJobs`는 받이였고 토큰 갱신은 Supabase가 맡는다(`Code.js` 머리말). → 10-17 「남은거 전부」로 고침: 머리에 09-26 기준 문서라는 덧붙임, 44행(토큰 갱신 주체)·61행(지워진 `상담AI.js`·`엔진_셋업확장.js` 대신 지금 배포 파일 둘)을 지금 사실로.

## 정리 순서와 상태

1. **옛 트리거 받이** — 가지에서 지움. 남은 일은 라이브가 닿는 곳에서: 실행 기록·트리거 화면 확인 → 병합 → `deploy`(채번·버전 이력) → 배포 뒤 `synkbrief운영알림상태`의 `timers.count`로 15분 운영 점검 트리거 수를 본다. 받이가 없어진 뒤로 15분 트리거가 빠지면 저절로 되살아나지 않는다 — `synkbrief운영알림설정`을 다시 실행한다.
   - 10-17 「남은거 전부」 때 클라우드에서 더 찾은 것: 연결된 Gmail에는 Apps Script 실패 알림(`apps-scripts-notifications@google.com`)도 운영 점검 메일(`[SYNK DM]`, 받는 곳은 `엔진_synkbrief.js`에 적힌 운영 메일 계정)도 한 통도 없어 트리거 소유 계정이 아니다. 관리표도 Drive에서 보이지 않는다. 다른 Claude 세션(PC)도 닿지 않았다. 그래서 확인과 배포는 하지 못했다.
   - 병합도 하지 않았다. 순서가 「확인 → 병합 → 배포」인데 확인을 못 했고, 배포가 뒤따를 수 없는 상태에서 master에 먼저 올리면 PC의 다른 배포가 확인 없이 이 삭제를 함께 싣는다. `origin/master`는 `1676291a`에서 움직이지 않아 이 가지는 그대로 앞으로 감기만 하면 합쳐진다(겹치는 파일 0).
2. **전역 충돌 시험** — 끝남(`safety.test.js`). `엔진_콘텐츠AI.js`가 배포 집합에 다시 들어오면 「라이브에 올라가는 파일은 … 둘이고」가 먼저 실패하고, 이름이 겹치면 이 시험이 실패한다.
3. **HtmlService 시험** — 끝남(`safety.test.js`, 호출 그래프). AST 대신 `vm`에 읽은 함수 원문으로 그래프를 그려 acorn 의존성을 늘리지 않았다.
4. **주석·가드 기준** — 끝남. 같이 `topLevelFunctions` 한글 이름 경계도 고침.
5. `SYNK_VERSION`은 남긴다. 이력 문자열도 이번에는 줄이지 않는다 — `tools/bump-version.js`의 `replaceVersionLine`은 채번 때 `origin/master` 줄에만 있는 항목을 `mergeChain`으로 다시 끼워 넣고 빼지는 않는다(108~151행). 가지에서 줄여도 긴 줄이 master에 남아 있는 동안의 다음 채번이 되살린다. 줄이려면 채번 도구에 상한을 두는 변경과 함께 master에서 한 번에 한다. `docs/버전_이력.md`는 이미 최근 두 판만 두고 「이전 변경은 Git 이력에서 확인한다」로 바뀌어 있다.

배포가 필요한 것은 1번과 4번의 `엔진_synkbrief.js` 주석이다(함께 한 번). 나머지는 시험·도구라 라이브 반영이 없다.
