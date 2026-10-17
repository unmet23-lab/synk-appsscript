# Apps Script 전역 이름 충돌·죽은 코드 점검 (2026-10-17, 클라우드)

> 기준: `origin/master` `1676291a`. 클라우드 세션이라 **유호님 PC의 미푸시·미커밋 변경은 범위 밖**이다. 라이브 Apps Script 판과 실제 설치된 트리거도 읽지 못했다.
> 코드는 고치지 않았다. 정리는 유호님 PC에서 시험·`deploy` 절차와 함께 따로 한다.

## 요약

| 항목 | 결과 |
|---|---|
| 배포 파일 사이 전역 충돌 | **0건** (전역 52개, 중복 선언 없음) |
| 다른 파일 전역을 가리는 지역 이름 | **0건** (인자·지역 변수·catch·내부 함수 전수) |
| 선언 없는 전역 대입·참조(암묵 전역) | **0건** |
| 배포 제외 파일과의 잠재 충돌 | **1건** — `parentSweep` (`엔진_콘텐츠AI.js`) |
| 죽은 코드 후보 | **15개** — 옛 트리거 받이 14개(조건부) + `SYNK_VERSION`(지우면 안 됨) |
| 익명 웹앱 `doGet`/`doPost`의 HtmlService 경로 | **없음** |

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

## 범위 밖에서 본 것 (P3, 판단 보류)

- **관리자 확인이 사실상 「로그인했는가」다.** `synkbrief_관리자확인_`(`엔진_synkbrief.js:134-137`)은 `getActiveUser`와 `getEffectiveUser`의 메일이 같은지 본다. 시트 메뉴·대화상자에서 실행되는 함수는 실행한 사람 권한으로 돌므로 둘은 늘 같다. 관리 시트의 다른 편집자도 통과한다. 그 시트에 유호님 말고 편집자가 있는지는 확인하지 못했다.
- **낡은 주석 2곳.** `엔진_synkbrief.js:211` 「기존 morningJobs를 사용하므로 별도 트리거를 중복 생성하지 않는다」 — 지금은 `트리거정리`가 `morningJobs` 트리거를 지우고 `synkbrief정기점검` 15분 트리거가 따로 돈다. `:313` 「기존 일일 트리거도」도 같은 흔적이다.
- **`tests/clasp-guard.check.js:191`이 「배포 대상 ≥5종」을 요구한다.** 지금 `.claspignore`가 여는 파일은 3개라 코드상 이 검사는 실패한다. 클라우드에서 실행은 60초 안에 끝나지 않아 결과를 직접 보지 못했다.

## 권하는 정리 순서 (유호님 PC)

1. **라이브 트리거 화면 확인.** Apps Script 편집기 → 트리거에서 핸들러가 `synkbrief정기점검` 말고 남아 있는지 본다. 0개면 `Code.js:75-91`의 받이 14개를 지우고, `트리거정리`·`남길트리거`를 남길지 정한다(트리거가 정기점검 하나뿐이면 `트리거정리`도 필요 없어진다). 남아 있으면 지우지 말고 한 번 깨어날 때까지 둔다. → D1
2. **`엔진_콘텐츠AI.js`를 지우기 전까지 C1을 막는 시험 추가.** 「`.claspignore`가 여는 파일들의 전역 이름이 겹치지 않는다」와 「`엔진_콘텐츠AI.js`는 배포 집합에 없다」를 `tests/배포표면.test.js` 쪽에 둔다. 문법 뱅크를 `strata/`로 옮기고 파일을 지우면 C1은 저절로 사라진다(정리 목록 10행에 이미 남은 일로 있다).
3. **`safety.test.js`의 HtmlService 시험을 호출 그래프 기준으로 넓힌다.** `doGet`·`doPost`에서 닿는 함수 전부에 `HtmlService`가 없는지 본다. 이 폴더의 `호출그래프.js` 방식(정규식 대신 AST가 필요하면 acorn을 개발 의존성으로)이다.
4. **낡은 주석 2곳과 `clasp-guard`의 ≥5 기준(→ ≥3 또는 `.claspignore` 개수와 같음)을 고친다.** 코드 동작은 그대로다.
5. `SYNK_VERSION`은 남긴다. 이력 문자열을 줄일지는 `tools/bump-version.js`가 그 줄을 어떻게 다시 쓰는지 확인한 뒤 정한다.

배포가 필요한 것은 1번(받이 삭제)뿐이고, 2~4는 시험·주석이라 라이브 반영이 없다.
