# 클라우드 전체 시험 · 2026-10-17

> 쓴 AI: Claude Code(클라우드 세션) · 브랜치 `claude/determined-dijkstra-l3ygqn`
> 기준: `origin/master` `1676291ad`(10-17). **유호님 로컬에만 있는 최신 커밋 41개와 미커밋 변경은 이 결과에 없다.** 아래 「로컬에만 있는 자료」로 분류한 실패 상당수는 로컬 작업본에서는 통과할 수 있다. 반대로 로컬의 그 41개 커밋이 이미 고친 것을 여기서 고쳤을 수도 있다(병합할 때 겹침 확인).
> 진행: 1단계(전체 실행·분류·작은 고침 9커밋) 뒤 유호님이 「나머지는 전부 자율주행으로」 맡겨 2단계(16커밋)를 진행했다. 비전 SHIFT 문장만 유호님 답을 기다린다.

## 한눈에

| | 시험 | 통과 | 실패 | 실제 실패 |
|---|---|---|---|---|
| 고치기 전(1차) | 12,135 | 12,003 | 109 | 108 |
| 이 브랜치 고침 뒤(3차) | 12,136 | 12,051 | 62 | 61 |

- 남은 실패는 거의 전부 클라우드에 없는 것 때문이다: 로컬에만 있고 git에 한 번도 들어간 적 없는 파일, gitignore된 큰 자산, 옆 저장소 SYNK-talk, `C:/Users/...` 경로·Windows 전용 동작.
- **유호님 결정이 필요한 것 두 가지:** ① 비전 SHIFT 문장(정본의 새 문장 vs 시험의 옛 문장) ② SNS 지도에 10-02 브라질·멕시코 계정을 넣을지(지금 지도 생성기가 23개국·44자리 규칙에서 멈춤).
- 불안정한 시험(d)은 세 번의 전체 실행에서 하나도 없었다.

## 환경

| 항목 | 값 | 로컬과 다른 점 |
|---|---|---|
| OS | Linux(x64) | 로컬은 Windows 11 · NTFS · CRLF 작업본 |
| Node | 24.22.0(공식 배포본을 scratchpad에 받아 씀) | 로컬 24.20 |
| Python | 3.13 · numpy · pillow · opencv-python-headless(이 세션에서 설치) | |
| ffmpeg | Ubuntu 6.1.1(`liboapv` 인코더 없음) | |
| npm 의존성 | 루트·`desktop`(Electron 바이너리 내려받기 생략)·`experiences/synk-account`는 `npm ci`, `tools/patent-studio`는 `npm install --no-package-lock` | |
| 없는 것 | 옆 저장소 `SYNK-talk`(이 세션 접근 목록에 없음), 실제 키, `C:/Users/q1212/...` 경로, Edge·Chrome 채널, gitignore된 큰 자산 | |

실행 방식: 파일마다 `node --test --test-reporter=tap --test-reporter-destination=<파일>`로 따로 돌렸다(묶음 안에서는 4~6개 병렬, 파일당 10분 제한). `tests/`·`desktop/tests/`는 각 패키지 뿌리에서, 나머지는 가장 가까운 `package.json` 폴더(없으면 시험 파일 폴더)에서 돌렸다. 실패한 파일은 한 번 더 돌려 같은 결과인지 봤고, 원인 커밋은 별도 worktree에서 `git bisect`로 찾았다(「시험을 마지막으로 바꾼 커밋 = 좋음」으로 두고 HEAD까지). `CI` 환경 변수는 주지 않았다(아래 「다시 돌리는 법」 참고).

## 묶음별 결과

1차는 고치기 전, 2차는 1단계 고침 뒤, 3차는 2단계까지 모두 넣은 뒤의 전체 실행이다.

| 묶음 | 파일 | 1차 시험 / 통과 / 실패 / 건너뜀 | 2차 | 3차 |
|---|---|---|---|---|
| 루트 `tests/*.test.{js,mjs,cjs}` | 273 | 3,957 / 3,898 / 47 / 12 | 3,957 / 3,904 / 41 / 12 | 3,957 / 3,920 / 25 / 12 |
| `desktop/tests/*.test.cjs` | 68 | 837 / 826 / 9 / 2 | 837 / 826 / 9 / 2 | 837 / 833 / 2 / 2 |
| `experiences/**`·`tools/**`(company-messenger·patent-studio·synk-id 등)·`docs/디자인` 시험 | 333 | 3,303 / 3,268 / 33 / 2 | 3,303 / 3,269 / 32 / 2 | 3,303 / 3,272 / 29 / 2 |
| `docs/마케팅` SYNK 시험(회사 업무실 282파일 포함) | 298 | 3,913 / 3,900 / 10 / 3 ※ | 3,913 / 3,900 / 10 / 3 ※ | 3,913 / 3,905 / 5 / 3 ※ |
| Python `tests/*.py`(unittest) | 12 | 125 / 111 / 10 / 4 ※※ | (다시 돌리지 않음) | 126 / 121 / 1 / 4 ※※※ |
| **합계** | **984** | **12,135 / 12,003 / 109 / 23** | **12,135 / 12,010 / 102 / 23** | **12,136 / 12,051 / 62 / 23** |

※ docs/마케팅의 `content-engine.test.mjs` 1건은 내 실행 위치 탓이다(저장소 뿌리 기준 상대 경로를 씀). 저장소 뿌리에서 돌리면 25/25 통과하므로 실제 실패에서 뺐다.
※※ `git-storage-restore.test.py`는 이름에 `-`가 있어 `python -m unittest`가 모듈로 못 부른다. `python3 tests/git-storage-restore.test.py`로 돌리면 20/20 통과한다(합계에는 20건 통과로 넣었다).
※※※ 3차 Python은 「기준 문서가 없을 때」 시험 1건을 더해 126건이다. 남은 1건은 이 ffmpeg에 없는 APV 인코더다.

**불안정(d)은 없었다.** 실패한 파일은 모두 한 번 더 돌려 같은 결과였고, 1·2·3차 실패를 시험 이름으로 대조하면 사라진 것은 정확히 이 브랜치에서 고친 시험들뿐이다. 1차와 3차를 대조하면 Node 묶음에서 사라진 실패 38건(루트 22·desktop 7·experiences 4·docs/마케팅 5)과 Python 9건이 정확히 이 브랜치에서 고친 것이고, **새로 생긴 실패는 0건**이다.

## 분류(실제 실패 108건)

2단계에서 원인을 더 파고 세 묶음을 다시 분류했다: desktop insight 5건(b → a, 실제 코드 버그), 지면폰트 ⑦ 1건(a → c, 서체 파일이 git 밖), SNS 지도 2건(c → a, 줄끝 문제에 더해 지도 자체가 낡음).

| 분류 | 건수 | 이 브랜치에서 고침 | 남음 |
|---|---|---|---|
| (a) 코드·산출물 버그 | 24 | 22 | 2(SNS 지도 — 브라질·멕시코 결정 필요) |
| (b) 시험이 낡음 | 19 | 17 | 2(비전 — 유호님 답 대기) |
| (c) 환경 탓(클라우드·리눅스·로컬 전용 자료) | 65 | 8(Windows 전용이던 코드·시험을 이식성 있게) | 57 |
| (d) 불안정 | 0 | | |

실패 시험 밖에서 찾은 문제도 고쳤다: 미니게임 목소리 도구가 화면 생성 실패 때 서버째 죽던 것, 그 시험이 실패하면 도구를 남기고 매달리던 것, 회사 업무실 시험 8개가 이름과 달리 「본문 도중 세션 폐기」를 실제로 시험하지 않던 것.

## 이 브랜치에서 고친 것

### 1단계(9커밋)

| 커밋 | 분류 | 고친 내용 | 확인 |
|---|---|---|---|
| `ffd47b73d` | b | `tests/atlas-computer-runtime.test.mjs` — 고정물에 `request-security.mjs`를 복사한다(`store.mjs`가 10-09 `f12bef709`부터 import). | 7/7 |
| `0e4e65fe8` | a | `tools/미니게임_목소리.cjs` — `GET /`에서 화면을 먼저 만들고 머리를 보낸다. 화면 생성 실패 때 머리를 두 번 써서 `ERR_HTTP_HEADERS_SENT`로 **로컬 서버가 죽었다.** | 직접 띄워 `GET /`=400, 프로세스 유지 |
| `e2e0a0a95` | b | `tests/synk-id-company-public.test.cjs` — 고객 로그인 런타임 확인에 임시 암호화 Store를 준다(10-14 `bfaf6d078`부터 필수). | 22/22 |
| `9414a4e22` | a | `experiences/atlas-lab/dating-account.mjs` — 토큰 갱신 중 자기 오류를 그대로 다시 던진다. 10-10 `7b2318e5c`부터 **갱신 중 로그아웃은 「계정 연결이 바뀌었어요」 대신, 폐기된 갱신 토큰(401)은 `AUTH_REQUIRED` 대신 재시도 가능한 NETWORK 오류로** 나갔다. | 16/16, 고치기 전 코드에서 새 단언 실패 확인 |
| `5994a8503` | b | `tests/sync-atlas.test.js` — Talk 복사 목록에 trail 파일 2개(10-16 `8ab56fb91`). | 12/12 |
| `d617cd65c` | b(+a) | `tools/교원검수시트.js` — learning-hub(「모든 미니게임과 상점」)에 「게임↔상황」 줄을 만들지 않고, 말 랠리까지 9줄을 기대한다. | 12/12 |
| `bba65bd82` | b | 메신저 쪽 기한 겹침 시험 — 「고객 합의 기한」 → 「합의한 전달일」(10-13 `c32ebd1dd`). | 10/10 |
| `d580a6ca9` | b | `tests/지면폰트.test.js` ④ — 10-10에 지운 지면을 목록에서 뺀다(시험 문구의 처방). | ④ 통과 |
| `4c733cc19` | 위생 | `tests/미니게임_목소리_흐름.test.cjs` — 시작 확인이 실패하면 띄운 도구를 끈다(제한 시간까지 매달리던 문제). | 0.5초 안에 끝남, 남는 프로세스 0 |

### 2단계(16커밋, 자율 진행)

| 커밋 | 분류 | 고친 내용 | 확인 |
|---|---|---|---|
| `696fe9afc` | a | `experiences/learning-hub/server.mjs` — 우주선 협동 API를 허브가 쓸 때만 동적 import한다. 10-14 `1e780b442`의 정적 import 때문에 **dating 단독 패키지가 시작하자마자 `ERR_MODULE_NOT_FOUND`로 죽었다**(dating 모드는 그 API를 쓰지도 않음). 패키지 표면은 검토된 32파일 그대로. | atlas-dating-package 5/5, 허브의 `/api/spaceship/health` 정상, dating 모드 404 |
| `abf36a0ec` | a | `tools/prepare-personal-public.mjs` — 공개판에서는 회원 성향(활동·이해) 검사기를 「이 페이지에서는 다루지 않음」 검사기로 바꿔 싣는다. 10-16 `8ab56fb91` 뒤로 **앨범·리허설 공개판을 다시 만들 수 없었다.** 허용 목록에 넣으면 문장 계약 v1~v8(약 870KB)이 공개 페이지마다 실려서 그 길은 버렸다. 한도 값은 실제 모듈에서 읽는다. | 11/11, 산출물에 대체 검사기만 있고 문장 계약 없음 |
| `d53bf7446` | a(부분) | SNS 지도(`build-map.mjs`·`verify-map.test.mjs`·`engagement/server.mjs`) — 원천 해시를 줄끝(CRLF/LF)과 무관하게 잰다. 내용이 같은 두 기록값만 새 방식으로 옮겼다. 이제 어느 OS에서나 「진짜 바뀐 원천 3개」만 보고한다. 지도 재생성은 아래 「남은 실패」. | 검사가 원천 3개만 지목 |
| `55904d69a` | b | `docs/마케팅/맞춤도구/manual/rules.test.js` — `build.mjs`의 manual 줄 앞에 `theme:`이 들어가도 찾는다(10-14 `209d50e8c`). | 27/27 |
| `19e0daf4c` | b | 회사 업무실 시험 3개 — 레일의 `marketing` 탭이 `['social','SNS·마케팅']`이 된 개편(10-14 `bfaf6d078`)을 기대한다. `selectWorkspaceView('marketing')`은 지난 분석 화면으로 가는 별칭으로 남아 있다. | 12/12 · 9/9 · 15/15 |
| `e411ad746` | b | `server-client-startup-templates.test.mjs` — 「본문을 받는 중 폐기된 세션」 시험의 신호를 매크로태스크로. 10-14에 요청 처리 앞에 `await`가 생겨 폐기가 인증보다 먼저 일어나 403이 났다. 서버 동작(본문 뒤 재확인 401)은 그대로. | 8/8, 5회 연속 |
| `8c5f65151` | 시험 강화 | 같은 신호를 쓰던 회사 시험 8개 — 이름과 달리 인증 전 단계(「먼저 로그인해 주세요.」)에서 거절되고 있었다. 이제 본문 뒤 재확인(「로그인 상태를 다시 확인해 주세요.」)을 실제로 거치고, 8개 모두 통과한다. | 각 파일 통과 |
| `ec8a5e7ea` | a | `desktop/renderer/state.mjs` — 화면 안 혜택(내 성향 확인하기·AI 구독 계정판)을 앱 목록에서 뺀다. 10-14 insight가 마지막 분기로 떨어져 **「가족 앨범」이라는 짧은 이름과 앨범 분류로 열 번째 앱이 되어 있었다.** 시험(아홉 앱)이 옳았다. | 시험 5건 통과(desktop 831/837, 이 커밋 시점) |
| `933ceab97` | b | 웹 회원 혜택 — AI 구독 계정판(10-17 `d27596c6c`)을 「PC 앱 전용·발견만 가능」으로 목록에 둔다. 카드 링크 「내 기록 살펴보기」는 insight에만 쓴다. | 6/6 |
| `495687ec3` | b | `shared-server.test.mjs` — PATH만 `connect-src`에 `blob:`(three.js 텍스처·음성 작업자, 10-12 `1e1db9a37`). 리허설·앨범은 그대로 정확히 대조. | 4/4 |
| `5d728a9cf` | b | `strata/topik-i.situation-examples.json` — 주문 폭주 o09 인용을 게임의 현재 문장 「커피 대신 따뜻한 차 한 잔 주세요.」로(10-08 `e05f03ad1`). 게임 음성은 10-10에 이미 새 문장으로 다시 구웠다. | 8/8 |
| `b173b7df7` | b | `atlas-consultation-evaluation.test.mjs` — 10-08 질문 정책(`001d225cf`)으로 요약 수치를 다시 냈다(Atlas 질문 38/53, 품질 유지 비교 1 → 6건). 「질문만 줄여서는 필수 답 검사를 통과 못 한다」와 「작성자 기준과 제품 기준은 따로 본다」는 만든 사례로 계속 시험한다. | 12/12 |
| `3aadac686` | a | DaVinci S26U 두 도구 — 컷 편집 기준 문서가 스크립트 옆에 있을 때만 작업 폴더에 복사한다. 09-18 문서 초기화로 그 문서가 지워진 뒤 **미디어 준비 전체가 멈췄다.** 지운 지침은 되살리지 않았다. | editorial 6/6, free-prepare 14/15 |
| `298964368` | c→고침 | desktop 클라우드 미리보기 시험 2개 — 거절 사례에 `--platform=win32`를 명시(기본값이 실행 OS라 리눅스에서 다른 검사에 먼저 걸림). | 8/8 · 8/8 |
| `9caf14052` | c→고침 | `tools/drive-mascot-archive.py` — Windows에만 있는 `st_file_attributes`를 `getattr`로 읽고 심볼릭 링크도 거절한다. | 7/7 |
| `b45d3666e` | c→고침 | `tools/davinci-s26u-one-video.py` — Resolve의 위치 설정을 어느 OS에서나 Windows 경로로 비교(`ntpath`). | 14/14 |

시험을 지우거나 건너뛰게 바꾼 것은 없다. 낡은 기대값을 바꾼 시험은 원래 지키던 성질을 그대로 단언하는지 하나씩 확인했다.

## 다른 세션과의 조율

10-17 오후, Apps Script 전역 점검 세션(가지 `claude/friendly-newton-6kin0f`)이 「유호님이 docs/마케팅 실패 정리를 맡겼다」며 그 파일들을 이 가지에서 건드리지 말아 달라고 알려 왔다. 그 전에 이 가지가 이미 고쳐 push한 docs/마케팅 커밋(`55904d69a`·`d53bf7446`·`19e0daf4c`·`e411ad746`·`8c5f65151`)의 목록과 근거를 그 세션에 보냈고, 그 뒤로 docs/마케팅은 건드리지 않았다. 두 가지를 합칠 때 같은 파일이 겹치면 이 문서의 근거로 대조한다. 남은 docs/마케팅 실패(회의 키트 zip, 발주서 수신판 산출물, SNS 지도 재생성)는 그 세션과 유호님 결정 몫이다.

## 자율 진행에서 내린 판단(검토용)

유호님이 확인하지 않은 판단이라 따로 적는다. 뒤집으려면 해당 커밋만 되돌리면 된다.

| 항목 | 정한 것 | 근거 |
|---|---|---|
| 개인 공개판 | 회원 성향 검사기를 공개판에서는 거절 검사기로 대체(허용 목록 확장 안 함) | 공개 페이지는 그 문서를 읽거나 쓰지 않고, 확장하면 870KB가 실린다 |
| dating 패키지 | 우주선 API를 동적 import | dating 모드는 그 API를 쓰지 않고, 패키지 검토 표면(32파일)을 지킨다 |
| desktop insight | 앱이 아니라 혜택 화면 안 항목 | 구독 계정판과 같은 성격(`embedded`), 앨범 이름으로 잘못 보이던 버그 |
| 웹 AI 구독 계정판 | 웹 목록에 「PC 앱 · 회원 무료」 안내로 노출 | 시험의 원칙 「설치·권한 없이 발견 가능」과 같다 |
| PATH CSP `blob:` | 허용 | 같은 출처 스크립트가 만든 주소만 가리키고, 배포 패키지도 같은 값 |
| 회사 레일 marketing → social | 의도된 개편으로 보고 시험을 맞춤 | `workspacePrimaryTabs`에 명시, 별칭 유지 |
| 401/403 | 서버는 그대로, 시험의 시점 신호만 고침 | 본문 도중 폐기는 여전히 401·기록 0 |
| Strata o09 | 예문이 게임 문장을 따름 | 미검토 AI 초안이고, 잔 데이터도 「뜨거운 차」 |
| 상담 평가 | 새 정책 수치로 갱신, 성질은 만든 사례로 유지 | 의도된 정책 변경(결정 표 10-08) |
| DaVinci 컷 기준 | 문서는 되살리지 않고 도구가 없어도 동작 | 09-18 지침 초기화를 되돌리지 않기 위해 |
| SNS 지도 | 해시만 줄끝 독립으로, 지도 재생성은 보류 | 브라질·멕시코 자리·우선순위를 지어내지 않기 위해 |

## 남은 실패(3차 기준)

### 유호님 결정이 필요한 것

| 파일 | 건수 | 내용 | 결정하면 할 일 |
|---|---|---|---|
| `tests/비전동기화.test.js` | 2 | SHIFT 전면 문장이 정본 「기업이 AI와 개인화 기술을 자기 업무와 고객 서비스에 활용하도록 돕습니다.」, 시험 「기업과 기관이 AI를 자기 일에 활용하고, 가진 가치를 고객에게 전달하도록 돕습니다.」로 다르다. 정본 문장은 10-14 일괄 커밋 `2a06f31ed`로 들어왔고 근거는 10-06 SHIFT BM 결정(`SYNK_철학.md`도 새 문장). 둘째 실패는 새 서브텍스트가 두 문단인데 읽는 도구가 첫 문단만 써서 생긴 구조 문제다. | 새 문장 확정이면 시험을 새 문장으로 바꾸고, 「서브텍스트 지움」 시험이 두 문단을 다 지우게 고친다. 옛 SHIFT 소개서 3곳(`docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt`, `docs/SHIFT/SYNK_SHIFT_소개서.html`, `docs/소개서_지면.html`)도 새로 굽는다. 옛 문장이면 정본·철학을 되돌린다. |
| `docs/마케팅/온라인마케팅지도/verify-map.test.mjs`, `engagement/server.test.mjs` | 2 | 지도(09-27 생성) 뒤 원천 3개가 바뀌었다(`콘텐츠_운영체계_20260927.md`, `sns-계정.json`, yuhobuilds README). 다시 구우려 하면 `build-map.mjs`가 「확장 확보 원장과 44자리 불일치」로 멈춘다 — 10-02 「브라질·멕시코 추가 계획」(`efdd40678`)으로 원장에 생긴 `lab-mx-youtube`·`lab-br-youtube`가 23개국·44자리 계획 밖이다. | 두 나라를 지도 계획(제안서·국가 목록·자리 수·시험)에 넣을지, 지도를 이 상태로 은퇴시킬지 정한다. 대시보드 `dist`는 vite 빌드가 따로 필요하다. |

### 로컬에만 있는 자료(유호님 PC에서 확인·커밋할 것)

| 자료 | 걸리는 시험(건수) | 비고 |
|---|---|---|
| `experiences/beginner-games/voice-request.json` | `미니게임_목소리`(10), `미니게임_목소리_흐름`(1) | git에 한 번도 없음. 10-14 일괄 커밋이 「바뀐 파일이 import하는 새 파일만」 넣은 탓으로 보인다 |
| `experiences/path-travel/`의 `planner.html`·`planner.css`·`planner-ui.mjs`·`planner-origin.mjs`·`walking-router.mjs`·`planner-account-session.mjs` | `path-travel-server`(2) | 같은 이유, 서버가 공개 목록에 올려 둔 파일 |
| `experiences/word-magic/collection.js`·`kit/` | `play-common/collection`·`kit`(2) | 같은 이유 |
| `experiences/spaceship-coop/starbook.mjs` 등 입문 게임 파일 | `learning-hub/server`(2) | 같은 이유 |
| gitignore된 큰 자산(`*.glb`·`*.mp4`·`*.tar.gz`·`*.zip`) | 레이싱(2), PATH 면접(10), 회의 키트(1) | Git 자산 보관 정책대로 git 밖 |
| `**/_검토/`, `docs/Loom_자산/`, 키트 서체 사본 | `계정컬렉션`(3), `라디오오버레이층`(1), `지면폰트` ⑦(1) | 세 시험 모두 `CI=1`이면 설계대로 건너뛴다 |
| 빌드·작업 산출물(`dist/`, `.tmp/`) | 발주서 수신판(1), 튜터 후보 계약(1) | 앞 단계 빌드가 필요 |
| git 객체 `adc049af2`(교재 원고 보존판) | `교재읽기본`(1) | origin 어느 이력에도 없다. 보존 커밋을 태그로 push하거나 원문을 Git 자산 보관으로 |

### 클라우드·리눅스라서

| 원인 | 걸리는 시험(건수) | 고칠 방법(선택) |
|---|---|---|
| 옆 저장소 SYNK-talk 없음 | dating 백업·중앙 수명주기·대조 내보내기·provision guard(4), WORLD 계정 브라우저·저장 3종(4) | 클라우드 환경에 SYNK-talk 접근을 주면 돈다 |
| `C:/Users/q1212/.cache/codex-runtimes/.../playwright`를 박아 둔 브라우저 시험 | brand-opening·synk-world-app·20260909 등 8개 파일(8) | 박아 둔 파일이 254개다. 환경 변수를 먼저 보는 공용 해석기를 두면 리눅스에서도 뜨지만, msedge 채널·`C:/` 서버 경로·`qa/.tmp` 준비물이 더 필요해 이번에는 손대지 않았다 |
| Windows 경로·산출물 | `desktop/lifecycle`(1, `path.win32` 설치 경로로 실제 파일을 씀 — 리눅스에서는 `desktop/`에 역슬래시 이름 파일을 남긴다), `native-logout-provider`(1, `C:/` 산출물) | lifecycle은 건너뛰게 하지 않는 한 깔끔한 고침이 없어 남겼다 |
| ffmpeg에 `liboapv` 없음 | `test_davinci_s26u_free_prepare`(1) | APV 인코더가 든 ffmpeg |

## 돌리지 않은 것과 이유

| 대상 | 이유 |
|---|---|
| `tests/*-smoke.mjs` 40개 | `node --test` 시험이 아니고, 40개 모두 `C:/Users/q1212/...` Playwright 경로를 박아 둔 브라우저 스모크다. |
| `tests/clasp-guard.check.js` | 머리말에 「옛 행동을 재고 있어 반드시 어긋난다(09-09 게이트 완화)」고 적힌 수동 점검이고, 훅이 `node --test tests/`를 다시 부르는 구조다. |
| `docs/마케팅/.../video-v3/.agents/skills/**` 55개, `.claude/skills/last30days/**` | 외부 skill 사본이다. |
| `npm test`(`tools/test-ci.js`) 자체 | 같은 `tests/*.test.js`를 돈다. 단, `test-ci.js`는 `.test.js`만 돌아서 `tests/`의 `.mjs` 134개·`.cjs` 29개는 `npm test`에 안 들어간다. |
| 각 폴더의 브라우저 QA 스크립트, `tools/patent-studio`의 `test:browser`·`test:live`, 영상(Remotion)·Unity | 서버·실제 브라우저 채널·실제 계정이 필요하거나 시험 묶음이 아니다. |
| 실제 키·네트워크가 드는 흐름 | 요청 범위 밖(키를 읽지 않았다). |

## 현장 노트에 옮길 새 함정

docs 영역이라 [시험·화면 확인 노트](../../../현장노트/시험_화면확인.md)에는 직접 쓰지 않았다. 문서 정리 세션이 끝난 뒤 옮긴다.

- **클라우드·CI에서 돌릴 때는 `CI=1`을 준다.** `tests/_git밖.js`를 쓰는 시험(`지면폰트`·`계정컬렉션`·`라디오오버레이층`·`sns-발행`·`learning-hub-server`)은 git 밖 로컬 자료가 없으면 그때만 건너뛴다. 주지 않으면 개발 PC처럼 빨갛다.
- **docs/마케팅 회사 시험은 저장소 뿌리에서 돌린다.** `content-engine.test.mjs` 등은 뿌리 기준 상대 경로를 쓴다.
- **`desktop/tests/lifecycle.test.cjs`는 리눅스에서 `desktop/`에 역슬래시 이름 파일 3개를 남긴다.** 돌린 뒤 `find desktop -maxdepth 1 -name '*synk-lifecycle*' -delete`.
- **「요청 이벤트 + 마이크로태스크 한 번」은 「서버가 인증을 마쳤다」는 신호가 아니다.** 요청 처리 앞에 `await`가 하나만 늘어도 끼어드는 순서가 바뀐다. 본문 도중 상태를 바꾸는 시험은 `setImmediate`로 기다린다.
- **생성 지도·스냅샷의 원천 해시는 줄끝을 맞춰 잰다.** CRLF 작업본에서 잰 해시는 리눅스·CI에서 늘 「바뀜」이 된다.
- **10-14 「pending changes」 일괄 커밋들이 「바뀐 파일이 import하는 새 파일만」 넣어, 로컬에만 있는 파일을 읽는 시험이 많다.** 위 「로컬에만 있는 자료」 목록을 로컬 작업본의 `git status`와 대조할 것.
- Node 24의 파이프 출력에는 요약이 없다는 기존 함정 그대로였다(tap 보고기 파일로 받음).

## 다시 돌리는 법

```bash
# 저장소 뿌리에서. 결과 폴더는 저장소 밖으로. 클라우드·CI면 CI=1.
OUT=/tmp/synk-tap; mkdir -p "$OUT"
for f in tests/*.test.{js,mjs,cjs}; do CI=1 node --test --test-reporter=tap --test-reporter-destination="$OUT/$(basename "$f").tap" "$f"; done
grep -hE '^# (tests|pass|fail|skipped) ' "$OUT"/*.tap | awk '{s[$2]+=$3} END {for (k in s) print k, s[k]}'
grep -l '^not ok' "$OUT"/*.tap
```

남은 일은 [트랙](../../트랙.md)에 아직 옮기지 않았다(문서 정리 세션과 겹침을 피함). 이 문서의 「남은 실패」가 그 후보다.
