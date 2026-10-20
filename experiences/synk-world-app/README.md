# SYNK WORLD 앱 · 한강 마루와 계정 연결

> **검수 이미지 보관(2026-10-17):** 이 폴더의 과거 `qa/` 캡처는 [Git 자산 보관](../../docs/_ops/github-storage/README.md)의 파일별 해시와 Release ZIP으로 보존한다. 코드·검수 JSON·문서는 유지하며, 로컬 이미지도 삭제하지 않는다. 새 체크아웃에서 예전 이미지 링크를 볼 때는 저장소 루트에서 `python tools/git-storage-restore.py --path "experiences/synk-world-app/qa/<필요한 파일>"`로 해당 원본을 복원한다.

<a id="classroom-lessons-20261019"></a>

## 2026-10-19 우리 반 수업 · TOPIK 4급 온라인 반 학생 입구(synk.im/world · PC 설치본 Platform 0.4.32 공개)

10-19 TOPIK 4급 온라인 반 재개 결정(결정 표 맨 위)에 따라, 반 학생이 WORLD에서 실시간·예정·복습 수업을 여는 칸을 붙였다.

- **자리:** 내 계정 시트의 「내 반 연결」 카드 바로 위(`#world-classroom-lessons`). 반 연결이 같은 시트에 있어, 연결하면 시트를 다시 그려 같은 자리에 수업이 이어진다. 시트가 열려 있는 동안만 30초마다 묻는다. 홈(동네·3D 방)은 손님과 반 없는 계정이 대부분이라 수업을 매번 묻지 않게 두었다. 라이브 중 홈 알림은 실제 학생·방송이 생긴 뒤 따로 정한다.
- **뜻:** 학생 앱 「우리 반 수업 · 실시간 / 복습」(SYNK-talk `src/수업영상화면.js`)과 같은 상태 이름·안내, 같은 묶는 차례(실시간 → 확인이 필요한 수업 → 예정 → 복습), 30초 확인, 돌아오면 다시 묻기, 실패하면 링크 비우기. 「지금 수업 중」은 서버가 150초 안에 동기화된 live로 줄 때만 보인다. 반이 없거나 불러오는 중·실패일 때는 제목과 그 안내만 보인다.
- **통로:** `classroom-client.mjs`가 학생 앱과 같은 classroom 함수를 같은 머리(apikey · Bearer · `X-Contract-Ver: c16`)로 부른다. 게이트웨이 401만 한 번 갱신해 다시 묻는다. 함수가 낸 `AUTH_REQUIRED`(학생 명부에 없는 계정)는 빈 목록으로 보고, WORLD의 다른 요청처럼 로그아웃시키지 않는다. 토큰은 `world-account.mjs`의 `readClassrooms()` 안에만 있다(묶음은 `node tools/build-world-account.mjs`). 서버 함수·DB·반/학생 권한·비밀값은 바꾸지 않았다.
- **화면:** `classroom-lessons.mjs`와 `app-shell.css`의 「우리 반 수업」. 흰 알약은 「실시간 수업 보기」 하나, 수업 줄은 1px 선이다. 링크는 새 탭으로 열고 유튜브 영상·재생목록과 Meet·Zoom 주소만 받는다. 개발 서버(`server.mjs`)와 공개 빌드(`tools/build-world-app-public.mjs`) 목록에 새 파일을 더했다.
- **PC 앱(native):** 토큰은 본체에만 있어 본체가 대신 묻는다. `desktop/src/world-requests.cjs`의 `classroom` 경로(GET, 본문·쿼리·classId 없음)에 `X-Contract-Ver: c16`을 싣고, `desktop/src/auth-service.cjs`가 401 두 갈래를 웹과 같은 뜻으로 다룬다. 함수의 `AUTH_REQUIRED`는 빈 목록(`empty_reason:'NO_LEARNER'`)이고, 게이트웨이 401만 한 번 갱신하며, 그 밖의 수업 실패는 이 조회만 실패한다. 어느 경우도 로그아웃하지 않는다. 본체가 환경(`getEnvironment().worldRoutes`)에 `classroom`을 알릴 때만 `supportsClassroom`이 참이라, 그 경로가 없는 옛 PC 앱은 지금처럼 칸을 숨긴다. PC 창은 새 탭 링크를 `desktop/src/security.cjs`의 `externalDestination`으로만 내보내므로, 수업 링크(유튜브 영상·재생목록, Meet 코드, Zoom `/j/숫자`)를 웹 판 `safeClassroomLink`와 같은 규칙으로 WORLD 클라이언트에만 열었다(10-19 0.4.32 검수 P1 — 그 전에는 PC 학생이 목록만 보고 수업을 못 열었다). 10-19 Platform 0.4.32(synk-policy `a972c19`, 피드 20261019.5, 통합 빌드 39262918326 세 판 통과)로 공개했다. 태그 `platform-preview-0.4.32`의 동결 원천에서 `world-requests.cjs`·`security.cjs`는 master와 같은 판이고, `auth-service.cjs`의 수업 조각과 `main.cjs` 두 조각(`WORLD_ROUTE_NAMES` 불러오기, 환경 응답의 `worldRoutes`)이 들어 있음을 확인했다.
- **확인:** `node --test experiences/synk-world-app/qa/classroom-lessons.test.mjs`(19개 — 학생 앱 원문·계약판·회의 주소·presentClass 대조, 옛·새 PC 앱 포함), `desktop/tests/world-requests·auth·public-apps.test.cjs`(본체 경로·머리·401 두 갈래·환경 알림), `qa/classroom-lessons-browser.test.mjs`(계정 모드 Edge, 합성 계정·합성 수업 10상태 × 390·1280에서 가로 넘침·13px 밑 한글·44px 밑 단추 0, 새로고침·실패 뒤 다시 불러오기·탭 복귀·시트 닫기·로그인 유지). `qa/account-browser.test.mjs`에는 반 연결 전 401과 연결 뒤 재조회를 더했다. 캡처는 `qa/classroom-lessons-20261019/`(그림은 git 밖), 측정은 같은 폴더 `result.json`.
- **공개(10-19):** synk.im/world에 synk-policy `b424778`로 올렸다. 바탕 `c8dc69a0f`와 이번 판 `afb587f9a`를 같은 조건(구운 마을 세트·메뉴 영상을 두 빌드에 똑같이)으로 공개 빌드하고, 「공개본 + (바탕 → 이번 판)」 3방향으로 바뀐 것만 얹었다(`tools/공개.js --기준폴더`). 바뀐 것은 앱 셸 JS·CSS, 새 `classroom-lessons.mjs`, 계정 묶음, 진입 페이지 셋의 `?v=`다. 계정 묶음은 공개본에만 있던 다른 세션의 변경 49줄을 보존했고, 「후보 − 공개본」이 「이번 판 − 바탕」 96줄과 같다. 앱 셸이 묶음에서 가져오는 이름이 바탕과 같아 한 번에 올렸다(새 앱 셸에 캐시된 옛 묶음이 붙으면 이 칸만 잠깐 숨는다). 공개 주소 바이트 7/7, 배포 점검 통과(39255679243). 실제 주소를 손님과 합성 계정(운영 API 주소는 route로 통째로 막음)으로 390·1280에서 열어 페이지 오류·실패 요청 0과 「우리 반 수업」의 실시간·확인 필요·예정·복습을 확인했다.
- **운영 확인(10-20):** WORLD 계정 주소와 운영 classroom 함수는 같은 talk 프로젝트에 있다.
  - synk.im 출처의 사전 요청은 204(`Access-Control-Allow-Origin: *`, 요청 머리 되받기)로 통했다.
  - 토큰 없이 공개 키만 실은 요청에는 함수가 `AUTH_REQUIRED` 봉투(c16)로 답했다. 학생 명부에 없는 계정이 받는 것과 같은 갈래다.
  - 이 PC의 설치본은 0.4.32이고, `app.asar` 안에 수업 경로·401 처리·환경 알림·링크 허용 코드가 모두 있다.
  - 실제 학생 계정의 목록 조회는 아직이다. 운영 반·이용권이 0행이고, 크롬의 WORLD는 손님 상태다.
- **남은 일:**
  - 반·이용권을 설정한 뒤 실제 학생 계정으로 웹·PC에서 조회한다. 2026-11 현장 송출 시험의 [7번 항목](../../tools/classroom-media/교실세팅.md#실제-운영-전-통과할-시험)이 그 확인이다.
  - 수업 영상은 10-20 유호님 결정대로 일부공개다. 이 칸에서는 초대 안내 없이 「실시간 수업 보기」·「복습하기」가 바로 열리고, 「다른 사람에게 공유하지 말아 주세요」 안내만 보인다. 기수가 끝나면 업로더의 `close-cohort`로 그 반 영상을 비공개로 닫는다([기수 마치기](../../tools/classroom-media/README.md#close-cohort)). 이용권이 끝난 뒤에 닫으므로 학생 화면에 열리지 않는 링크가 남지 않는다.
  - TOPIK II 4급 연습·쓰기 첨삭 자료는 [온라인 반 자료 v1](../../docs/온라인반_TOPIK4급/README.md)로 만들었다. WORLD에서 과제를 보이고 내고 돌려받는 칸은 서버 저장이 필요한 다음 작업이다.

## 2026-10-19 화면 언어 1판 · 영어·몽골어(10-20 synk.im/world 공개, synk-policy `c3bb1ab`)

기능 글과 안내를 학습자가 고른 **화면 언어**(한국어 · English · Монгол)로 보인다([공개판 설계 §6](../../docs/공개판_설계.md), 결정 표 10-19 「WORLD 화면 언어」). 첫 실행은 오프닝 → 언어 고르기(`../brand-opening/lang-picker.mjs`, 기기 언어를 미리 고르고 지원하지 않는 언어를 영어로 치지 않는다) → 「한글을 읽을 수 있어요?」(`../brand-opening/first-run.mjs`, 이 화면 글도 고른 언어로) → 튜터 고르기 순서이고(첫 실행 단계 `language`), 설정 맨 위 「화면 언어」에서 언제든 바꾼다. 글은 `../brand-opening/world-strings.mjs`(키 → ko · en · mn)에서 `world-lang.mjs`의 `t()`로 고른다. 번역이 없으면 한국어로 보이고 `window.__synkWorldLang.missing()`에 남는다. 다른 모듈이 던진 한국어 상태 글은 `tMessage()`가 화면에서만 바꾼다. 한글 만나기는 `../hangul-stage/lang.mjs`, 인사 팩의 문제 지시 · 해설과 답한 뒤 여는 「뜻 보기」는 `life-content-lang.mjs`가 맡는다. 체험 판을 마친 뒤의 계정 연결 안내(`account.trial*`)와 로그인 뒤 「한글 기록 이어 가기」 판(`device-records.mjs`, 띄우는 쪽이 `text()`로 고른 언어의 글을 넘기고 없으면 한국어 기본 글)도 표의 `records.*`로 보인다. 고른 언어는 손님이면 이 기기(`synk.world.lang`), 계정이면 생활 진도 기록의 `display`(`{version:1,language}`)에 두고, 다시 열 때는 튜터 선택과 같이 계정 값이 이긴다(`display-language-sync.mjs`). 학습 내용(표현 · 보기 · 이야기 대사 · 포스터의 큰 한글 · 레슨 제목)과 튜터 대사는 늘 한국어다. SUIT에 키릴 글자가 없어 Inter Tight에서 잘라 낸 `SYNKCyrillic-*.woff2`(`tools/build-world-cyrillic-font.py`)를 unicode-range로 붙였다. 몽골어 검문 결과는 줄마다 `../brand-opening/world-strings-check.json`에 있다.

1판에서 한국어로 남은 화면(2판): 튜터 말풍선과 「표현 도움」 시트, 게임 화면(바람길 · 말의 리듬 · 첫 문장 놀이 · 한글 노래, 체험 판 결과의 로그인 안내 포함)과 그 위의 게임 튜터 막대(이름표 · 「함께하는 튜터」 · 「조작법」), 카페와 다른 생활 팩의 문제 글, 이야기 장면과 이름표, 동네 · 노래 시트, 옷장 · 옷걸이 · 사진 · 기억 액자, 홈 튜터의 하루 정리, 내 계정 시트의 「우리 반 수업」(`classroom-lessons.mjs`). 2판에는 한글 졸업 뒤 안내를 한국어로 옮겨 가기도 들어간다. 시험: `qa/display-language.test.mjs` · `qa/life-content-lang.test.mjs` · `../brand-opening/qa/world-lang.test.mjs` · `../hangul-stage/lang.test.mjs`.

## 2026-10-14 화면 전면 리디자인 · 공용 작업본 반영(공개 전)

처음 화면부터 모든 2D 화면을 「월드 시그널」로 다시 짰다. 디자인 규칙·토큰(`../brand-opening/world-ui.css`)·화면별 구조·전후 비교·시험 결과는 [월드 시그널 가이드](../../docs/디자인/월드_시그널/README.md)에 있다. 홈의 아래 탭은 **우리 방·배우기·놀이·옷장**이고 「나」(`data-view="me"`)는 왼쪽 위 캡슐이다. 3D 방에서 다음 학습의 주 행동은 튜터 카드의 흰 알약, 생활 팩의 「지금 할 일」은 배우기 탭 맨 위 포스터다(숨은 `#life-next-button`은 상태 글을 위해 남아 있다). 바람길·말의 리듬은 WORLD의 `.game-frame` 안에서만 `world-skin.css`가 걸린다. 학습·채점·저장·계정 계약과 `data-*` 고리는 바꾸지 않았다.

## 2026-10-13 목표에서 게임·복습까지 이어지는 맞춤 학습 · 공개 반영

홈의 **학습 목표 · 도움 방식**에서 이유(여행·생활·직장·TOPIK 등), 도움·설명 선호와 오늘의 시간·소리 조건을 선택한다. 기억 동의를 받고 건너뛰기·정정·사용 끄기·삭제를 제공한다. 시간과 소리는 한국 날짜가 바뀌면 만료되고, 설정을 지워도 기존 첫답·진도·튜터·복습 기록은 유지한다. 기기/계정 저장과 충돌 해결은 기존 생활 진도의 CAS/outbox를 사용한다.

**10-19 사용자 입장 검수 후속 · 고장 묶음(synk.im/world 공개 10-19, synk-policy `7839c6b`):** [검수 페이지](https://claude.ai/artifact/9eLPyUxuU1JSsvfJ6eyghf)의 고장 묶음이다. ① 「한 단계씩 도움받기」가 스스로 연 도움은 출처(`helpSource:'setting'`)를 남기고 복습 간격을 되돌리지 않는다 — 8일·하루 3번 합성 실행에서 레슨 1개·같은 복습 23번이던 것이 레슨 8개·간격 1→3→7일([실행](qa/review-loop-20261019/scenario.mjs)). ② 10-19 결정 「WORLD 손님」대로 계정 모드 손님에게 한글 만나기를 로그인 없이 연다(`app-shell.mjs`의 `GUEST_GAMES`). 손님의 한글 진도(`synk.hangul-stage.v1`)·생활 진도(`…progress.v1:guest`)·Atlas 기록(`synk.atlas.learning.v1.device`)은 기기에 남고, 로그인할 때 계정으로 옮기는 흐름은 WORLD에 아직 없다([확인](qa/review-loop-20261019/browser/check-guest-storage.json)). 바람길·리듬은 손님 한 판 체험 전까지 로그인부터라, 추천에는 `available:false`로 넘겨 로그인 창을 맴돌지 않는다(`createWorldLearningPlan({openGames})`). ③ 첫 실행 단계 `language → hangul → tutor`(`../brand-opening/first-run.mjs`, 언어 고르기는 자리만)에서 그림·「안녕」 녹음으로 한글을 읽는지 묻고, 「아직 못 읽어요」면 한글 만나기를 선행 단계로 먼저 추천하며(목표 창보다 먼저), 한글 졸업·건너뛰기가 그 답을 바꾸고 졸업 화면은 생활 첫 레슨으로 잇는다. ④ 답한 문항이 있는 레슨만 이어 하기, 이어 하기 옆에 돌아온 복습 단추. ⑤ 결과는 혼자 맞힘 / 다시 볼 것 n개, 오답이 있으면 새 장면 복습. ⑥ Core가 새 문항이 바닥난 활동(`practice.spent`)을 급함 층에서 빼고 홈은 코치의 `recommendActivities`로 이미 낸 문항을 넘긴다 — 30일 합성 실행에서 TOPIK 학습자의 생활 복습이 바람길에 밀려 끝내 못 하던 것(최대 17일+)이 모두 처리됐다([실행](qa/review-loop-20261019/topik-runner.mjs)). 시험: `qa/learning-plan.test.mjs`·`qa/life-help-source.test.mjs`·`../../tests/atlas-learning-activities.test.js`.

**10-19 손님 한 판 체험 · 한글 기기 기록 옮기기(위 ②의 남은 일, synk.im/world 공개 10-19 — synk-policy `0a60581` 계정 묶음 먼저, 10분 뒤 `5653ea9` 화면·게임):** 위 ②의 「옮기는 흐름은 아직 없다」·「한 판 체험 전까지 로그인부터」는 이것으로 바뀌었다. 계정 모드 손님은 바람길·말의 리듬을 이 기기에서 게임마다 한 판 해 볼 수 있다(`guest-trial.mjs`). 체험 판의 틀은 메모리 놀이 호스트(`SYNKPlayHost`, `trial`)를 받아 진도·코인을 계정에도 기기에도 저장하지 않고, 판이 끝나며 오는 보상 요청을 「한 판 마침」으로 받아 그 게임의 체험을 닫는다(`synk.world.guest-trial.v1`). 결과 화면은 다시 하기 대신 「기록을 남기려면 로그인해 주세요」 한 장과 흰 알약 「SYNK ID로 로그인하기」를 내고, 체험을 마친 게임은 체험 이유가 적힌 계정 연결 판으로 연다. 추천은 같은 목록(`openGames` = 한글 + 남은 체험)이라 TOPIK 목표 손님은 바람길 → 리듬 체험 → 생활 레슨 순으로 가고 로그인 창을 맴돌지 않는다. 로그인하면 입장 관문의 `offer` 단계가 튜터 고르기 앞에서 이 기기의 손님 한글 기록 — 한글 만나기 글자 진도(`synk.hangul-stage.v1` → `synk.account.<accountKey>.r<revision>.hangul-stage.v1`)와 첫 실행 답(`…progress.v1:guest`의 `hangul`) — 을 계정으로 옮길지 한 번 묻는다(`device-records.mjs`). 지금 상태를 바이트 그대로 옮기고, 계정에 이미 있으면 합치지 않으며, 손님 기록은 지우지 않는다. 고른 답(옮김·처음부터)은 계정마다 이 기기에 남겨 다시 묻지 않고, 판을 닫으면 다음 로그인 때 다시 묻는다. 생활 레슨 진도·튜터 선택·Atlas 기기 기록은 옮기지 않는다. 시험: `qa/guest-trial.test.mjs`(실제 `collection.js` 다리·Core 추천)·`qa/device-records.test.mjs`·`qa/entry-gate-offer.test.mjs`·`qa/account-browser.test.mjs`, 헤드리스 390·1440 [확인](qa/guest-trial-20261019/check-guest-trial.json).

기존 Core `recommendActivities`가 실제 제공 가능한 생활 팩·게임·예정 복습을 같은 후보로 비교한다. 관측된 연습 필요와 예정 복습을 목표보다 먼저 보고, 현재 시간·소리 조건을 만족하는 활동 안에서 목표를 반영한다. WORLD는 제품 경로와 중단 위치만 연결한다. 예를 들어 새 학생의 여행 목표는 카페 표현, 직장 목표는 약속 표현, TOPIK 목표는 바람길로 이어진다. 중단한 레슨·복습을 다른 추천으로 지우지 않고 놀이 메뉴에서 자유롭게 다른 활동을 고를 수 있다.

추천 이유와 실제 시작 활동을 홈 튜터에 같이 표시한다. 생활·복습의 단계별 도움은 **답을 고르기 전에 도움 기록을 저장**하고, 짧은/자세한 설명은 접기/펼치기로 반영한다. 소리를 끈 날에는 듣기가 필수인 게임을 추천하지 않고 카페는 읽기로 연다. 게임 튜터도 혼자 시작/단계별 조작 연습과 설명 선호를 받는다. 홈의 헷갈린 표현 즉시 연습은 별도 버튼으로 유지한다. 완료와 복습 뒤 다음 활동을 다시 고른다.

공통 능력은 [Core·Vellum 담당 원문](../../docs/미니게임_TOPIK_I_학습기준.md#world-activities-20261013)에 기록한다. 생활 기록의 도움·복습 일정은 출처를 구분한 제품 근거이며, 검증되지 않은 TOPIK 능력이나 독립 성공 사건으로 바꾸지 않는다. 실제 게임의 Trail 관측은 기존 능력×난도×응답 형식과 첫 노출·도움·음성 전달 구분을 그대로 사용한다. 성격 판정, 공식 급수 진단, 학생 효과 입증은 아니다.

초기 로컬 검증: [관련 자동 시험](qa/world-personalization-20261013/unit-tests.txt), [실제 화면 52항목·19장](qa/world-personalization-20261013/acceptance/browser-result.json). 목표→실제 실행, 새 상황 복습→다음 추천, 320/390/1280 화면, 합성 계정 A/B 분리, 새 브라우저의 계정 복원을 확인했다. 추가로 [홈 튜터·320px 실제 클릭](qa/home-tutor-20261011/personalization-r4-320/report.json), [생활 튜터 계정 저장](qa/life-tutor-20261011/personalization-r3-menu/report.json), [카페 5방문과 복원](qa/cafe-pack-20261010/personalization-r4/report.json)을 고정된 `/world/` 계정 모드 빌드에서 확인했다. 신규 설정 회귀와 기존 계정 계약은 [37개](qa/world-personalization-20261013/account-ui-tests.txt), 홈·게임 튜터는 [25개](qa/world-personalization-20261013/tutor-tests.txt)가 통과했다. 초기 로컬 검증 묶음은 `.tmp/world-personalization-public-20261013-r5/world`(1,939파일, 누락·변경 중인 소스·비공개 파일 0)이며 기존 빌드는 보존했다. 게임 선호의 [별도 실제 화면 검사](qa/world-personalization-20261013/game-help/browser-result.json)에서는 혼자 시작·수동 도움/취소·일시정지/이어하기와 단계별 안내의 첫 4동작을 확인했다. 이 시점에는 마지막 듣기 안내의 완료→게임 시작을 미디어 재생 정지로 확인하지 못했다. 동일 MP3를 단독 재생해도 [Edge](qa/world-personalization-20261013/game-help/audio-probe.json)·[Chrome](qa/world-personalization-20261013/game-help/audio-probe-chrome.json) 모두 정상 206·디코드 뒤 약 0.023초에서 멈췄다. 완료를 우회하지 않았으며, 미완료/재시도와 원래 학습 기록을 유지했다. **이 문단은 로컬 검증 기록이며 공개 반영·실계정 후속은 아래를 따른다.** 유료 AI 호출·서버 정책 변경은 없다.

**10-13 공개 후속:** 기존 공개 마루를 보존한 교육 변경 19파일을 `a36a46f0545bfff985f9ebd14b11f9e2f235ec99`로 반영했다. HTTPS 19/19 원본 일치, 같은 커밋의 Pages·공개 CI 성공, 320/390/1280 화면의 대비·버튼과 홈/생활 계정 시험을 확인했다. [배포·설치 호환성](qa/world-personalization-20261013/release/README.md). 정상 SYNK ID 로그인으로 목표·도움 선호 저장→새로고침 복원→바람길 실제 시작/조작/일시정지→홈의 기존 복습 3문항 완료·서버 저장→TOPIK 목표의 바람길 재추천을 확인했다. 로그아웃하면 빈 게스트로 분리되고 재로그인하면 설정이 복원됐다. 여행+소리 끄기는 카페 표현을 추천했다. 검증용 목표·선호는 정상 삭제 UI로 정리했으며 기존 까몽·학습 1/22와 실제로 푼 복습 결과·다음 복습 일정을 보존했다. [실제 계정 관찰·화면](qa/world-personalization-20261013/release/real-account.json).

**10-13 비관리자 음성 후속:** 당시 기본 출력이던 Bluetooth에서 실제 위치 0·미완료를 재확인했다. 검사 중 16:50:05에 Bluetooth가 연결 해제되고 기본 출력이 내장 스피커로 전환됐다. 이 전환은 에이전트가 수행하지 않아 원인은 단정하지 않는다. 새 장치 목록 기준 내장 스피커의 기본/직접 출력·44.1/48 kHz 4회 모두 실제 위치와 완료가 정상이다. 무음 옵션을 제거한 Edge의 HTMLAudio·WebAudio 3경로에서 실제 `ended`, 전체 조작 연습 22/22, 공개 실계정의 5단계(마지막 듣기 포함) 완료→‘바람길 시작’→게임 실행·일시정지를 확인했다. 제품 코드·서비스·드라이버·기본 출력 설정을 바꾸거나 완료를 합성하지 않았다. [이전 진단과 현재 결론](qa/world-personalization-20261013/game-help/audio-diagnosis.json) · [장치별 결과와 공개 화면](qa/world-personalization-20261013/game-help/nonadmin/outcome.json).

**10-14 PC 설치본 후속:** 설치된 WORLD 0.4.2를 직접 실행해 정상 SYNK ID 재로그인→까몽·1/22 복원→추천 카페 학습 완료(도움 없이 2/3)→도움받은 표현의 새 상황 복습 1개 완료·계정 저장을 확인했다. TOPIK 시험 목표 저장 시 홈이 바람길을 추천했고, 5단계 실제 조작·음성 종료→게임 시작→일시정지/재개→382m 조기 종료까지 진행했다. 재실행 시 학습 2/22와 목표가 복원됐고 어려웠던 조작을 다시 안내했다. 시험 목표는 정상 UI로 정리했으며 이 검증 당시 웹·PC 홈은 까몽·2/22·‘계산대 앞 세 마디’였다. 다음 복습은 10-14 오후 4:21로 복원됐다. [PC 실제 계정 결과와 화면](qa/world-personalization-20261013/pc-installed/result.json).

공개 runner 최고 거리가 공용 localStorage에만 저장되는 누락을 발견해 기존 계정 어댑터를 연결한 2파일을 `4dddedd8`로 반영했다. 회귀 46/46, Pages·공개 CI 성공, HTTPS 2/2 일치. 실제 PC에서 만든 최고 거리 382m가 앱 재실행과 독립 웹 화면 모두에 복원됐다. [수정·배포 근거](qa/world-personalization-20261013/runner-account-save-20261014/README.md). 같은 공개 주소를 읽으므로 설치 파일 교체는 필요 없었다.

**10-14 바람길 완주·보상·복습 후속:** 공개 WORLD의 정상 로그인 계정에서 실제 화면 버튼으로 90초를 완주했다. 결과는 **990m·부탁 8개 중 8개·최대 연속 8·별 3개·공통 코인 +25**였고 계정 저장 안내를 확인했다. ‘글로 보기’를 8번 사용한 동작 수행 기록이며, 별도 듣기 능력의 독립 정답으로 취급하지 않는다. [완주·보상 화면](qa/world-personalization-20261013/runner-flow-20261014/web-90s-completed-25coins.png) · [실제 입력 기록](qa/world-personalization-20261013/runner-flow-20261014/public-completed-input-trace.json).

결과에서 듣기 확인 3문항을 모두 다시 들은 뒤 **도움받은 응답 2/3**으로 마쳤다. 음성이 끝나야 선택지가 활성화됐고, 3번 문항의 첫 음성 실패 안내는 다시 듣기로 복구했다. 확인을 마친 뒤 코인은 25개로 유지됐다. 홈은 ‘계산대 앞 세 마디’에서 ‘바람길 · 짧은 지시 듣기’로 바뀌었고, ‘부정·변경 이해를 도움과 함께 해냈어요’라는 추천 이유와 버튼을 통한 실제 바람길 진입을 확인했다. [듣기 확인 결과](qa/world-personalization-20261013/runner-flow-20261014/web-assisted-review-2of3.png) · [다음 추천](qa/world-personalization-20261013/runner-flow-20261014/web-next-recommendation.png).

설치된 PC 홈에서도 같은 추천·이유와 바람길의 **최고 거리 990m·코인 25개**를 확인했다. 앱을 정상 종료한 뒤 새 프로세스로 다시 실행해 로그인·까몽·학습 2/22·새 추천·990m·25코인이 그대로 복원되는 것도 확인했다([재실행 화면](qa/world-personalization-20261013/runner-flow-20261014/pc-relaunch-990m-25coins.png), [검증 결과](qa/world-personalization-20261013/runner-flow-20261014/result.json)). 이때의 PC 자체 조작 시도는 502m에서 끝났으며, 이 문단의 90초 완주는 공개 웹에서 수행한 결과다. [PC 추천](qa/world-personalization-20261013/runner-flow-20261014/pc-next-recommendation.png) · [PC의 계정 기록](qa/world-personalization-20261013/runner-flow-20261014/pc-restored-990m-25coins.png). 최고 거리 저장 수정(`4dddedd8`)에 이어 최대 콤보의 보상 요청 전달(`26a36647`), 듣기 확인 종료 후 결과 학습 기록·다음 추천만 갱신하는 수정(`ec7b38fe`)을 공개 반영했다. 결과 갱신은 보상을 다시 지급하지 않으며 관련 13검사·공개 후보 회귀·Pages·HTTPS 2/2를 확인했다. [결과 갱신 배포](qa/world-personalization-20261013/runner-results-refresh-20261014/README.md). 도움받은 기록과 혼자 답한 기록을 구분하는 안내 문구도 `be77072c`의 3파일로 공개 반영했다. 관련 회귀 17/17·Pages 성공·공개 HTTPS 3/3 원본 일치를 확인했다. 전체 사이트 CI의 최초 실행은 별도 `/try/racing/seascape-boats.js`의 503으로 실패했다. **10-14 08:52 KST 같은 공개 커밋의 전체 CI 재실행은 8분 15초 만에 성공**했다. 회귀 69/69·공개 변경 23파일 일치·32쪽과 8게임의 PC/모바일·질문창을 통과했고, 문제와 자동 재시도 복구는 모두 0건이다. 제품 수정·추가 배포 없이 마쳤다. [CI 재실행 근거](qa/world-personalization-20261013/runner-listening-scope-20261014/ci-rerun.json) · [문구 보완 배포](qa/world-personalization-20261013/runner-listening-scope-20261014/README.md).

**10-14 PC 설치본 자체 90초 완주 후속:** 설치된 WORLD 0.4.2의 동일 EXE를 기존 계정으로 실행하고, 임시 loopback CDP 연결로 화면에 보이는 글·진행바를 읽어 정상 버튼만 눌렀다. 일시정지 없이 실제 **92.657초 동안 게임의 90초를 완주**해 **990m·부탁 7/7·최대 연속 7·바람막 2번·보호 1번·코인 +25, 보유 50개**를 확인했다. 결과에 집계된 7개 부탁 모두 글 도움을 사용했으며, 입력 기록의 글로 보기 클릭은 마지막 미집계 부탁까지 8회다. 모델·시간·보호·보상·저장·계정 조작이나 데모 모드 없이 진행했다. [설치본 완주·보상 화면](qa/world-personalization-20261013/runner-pc-cdp-20261014/pc-90s-completed-50coins.png) · [실제 입력·시간 기록](qa/world-personalization-20261013/runner-pc-cdp-20261014/run.json).

같은 PC 결과 화면에서 듣기 확인 3문항을 다시 듣기 도움을 받아 **2/3**으로 마쳤고, 음성 종료 후에만 답이 활성화됐다. 종료 즉시 결과의 방향·동작 듣기 기록이 ‘도움을 받아 해냈어요’로 갱신됐으며 코인 50개를 유지했다. 홈은 ‘듣고 세부 정보 찾기를 도움과 함께 해냈어요’라는 이유로 바람길을 추천했고, 추천 버튼으로 실제 게임에 다시 들어가 최고 990m·코인 50개를 확인했다. [완주→복습→다음 추천 결과](qa/world-personalization-20261013/runner-pc-cdp-20261014/flow.json). 설치 ASAR 해시는 원본과 같고 제품 코드·공개 배포 변경은 없었다. 정상 창 닫기로 임시 CDP 실행을 종료한 뒤 프로세스와 포트가 모두 닫혔다. 이어 디버깅 인수 없이 설치본을 일반 실행해 로그인·까몽·학습 2/22·갱신된 추천 이유·틀린 문항의 복습 안내·최고 990m·코인 50개가 복원되는 것을 실제 PC 화면에서 확인했다([일반 재실행 저장 기록](qa/world-personalization-20261013/runner-pc-cdp-20261014/pc-normal-relaunch-990m-50coins.png), [복습 안내 복원](qa/world-personalization-20261013/runner-pc-cdp-20261014/pc-normal-relaunch-review-hint.png)). 이 검증은 PC 실제 게임·저장·추천 흐름 확인이며 독립 듣기 숙달이나 사람의 실제 청취를 입증하지 않는다.

**남은 확인:** Bluetooth 재연결 후의 복구·사람의 실제 청취, 실제 학생의 학습 효과는 미검증이다.

## 2026-10-12 실제 계정 저장 · PC WORLD 0.4.2

실제 SYNK ID로 까몽 선택·첫 인사 완료·로그아웃/재로그인 복원을 확인했다. 운영 생활 기록 허용 키를 보완하고, PC WORLD 0.4.2와 플랫폼의 실행 등록을 이 PC에 반영했다. [PC 설치와 실제 계정 검증](qa/account-desktop-20261012/README.md). 후속 구현은 튜터 선택도 기존 생활 계정 기록에 함께 저장한다. 독립 브라우저의 변경·복원 44항목을 통과했으며, 공개 반영과 실제 웹·PC 양방향 확인 상태는 [튜터 선택 동기화 검증](qa/tutor-selection-20261012/README.md)을 따른다.

2026-10-10. 실제 앱의 `/`, `/mobile.html`, `/desktop.html` 기본 홈을 [한강 마루](../brand-opening/HOME.md)로 연결했다. 오프닝 → 마루 → 게임 → 마루를 한 문서에서 이어가고, 플레이 중 회전은 iframe을 다시 만들지 않는다. 오프닝과 마루는 승인된 v9 영상을 재사용한다.

계정별 첫 문장 놀이·선물·옷장·룩북·타운 연결은 기존 서버 계약을 유지한다. 계정 모드의 미니게임은 기존 공식 게임/학습 host를 앱 안에 설치한 뒤 연다. 인증 정보는 iframe에 전달하지 않는다. 로그인하지 않은 경우 계정 연결 화면으로 안내한다. 다른 기기와 진도가 충돌하면 마루 안에서 사용할 진도를 직접 고른 뒤 다시 게임에 들어간다. [통합 검수와 범위](qa/maru-integration-20261010/README.md).

기존 3D 홈의 자산과 옷장·타운 렌더러는 보존한다. 아래 그래픽 v3~v8 기록은 해당 시점의 결과다. 위 2026-10-10 기록은 앱 소스와 브라우저 실행 경로의 통합 범위다. 이후 공개 반영은 다음 기록을 따른다.

## 생활 한국어와 세 친구 이야기

**첫 만남과 게임 동행(2026-10-10, 선택 저장 2026-10-12 보완):** 첫 시작에서 마린·까몽·몽글 중 함께할 AI 튜터를 고르는 [튜토리얼](../brand-opening/HOME.md#첫-시작--함께할-ai-튜터-고르기)을 연결했다. 고른 튜터가 세 미니게임·첫 문장 놀이까지 따라와 자기 말투로 조작법을 알려 주고 실제 성공·오답·재도전에 표정과 대사로 반응한다. 조작법 다시 보기는 바람길/리듬의 실제 시간을 멈추며 한글 문항을 유지한다. 첫 문장 정오답은 서버가 확인한 종료 결과에서 반응한다. 로그인한 사용자의 선택은 기존 생활 계정 기록에 저장하고 비회원 선택은 해당 기기에 둔다. 게임 조작 연습·최근 도움은 계속 기기 안 계정·튜터·게임별로 나눈다. AI 대화 호출은 추가하지 않았다. [현재 선택 저장 검증](qa/tutor-selection-20261012/README.md) · [첫 만남 검수](../brand-opening/qa/tutor-onboarding-20261010/README.md) · [게임 동행 검수](../brand-opening/qa/game-tutors-20261010/README.md).

**직접 하는 조작 연습(2026-10-10):** 게임을 처음 열면 고른 튜터가 시범을 보이고, 실제 키/터치로 따라 한 단계만 성공으로 확인한다. 전부 해낸 뒤 본 게임을 시작하며 완료는 기기의 계정/튜터/게임별로 기억한다. 조작법에서 다시 연습하면 진행 중인 판과 소리를 멈췄다가 같은 자리를 이어간다. [구현 계약](../brand-opening/HOME.md#튜터와-직접-하는-조작-연습) · [검수와 화면](../brand-opening/qa/tutor-practice-20261010/README.md).

**실수 구분과 해당 부분 재연습(2026-10-10):** 고른 튜터가 실제 조작/타이밍 실패와 문장·소리·글자 오답을 나눠 자기 말투로 힌트를 준다. 맞은 O/X 답의 박자 놓침은 별도로 표시하고, 무응답/소리 미확인을 문장 오해로 만들지 않는다. ‘힌트’에서 해당 동작이나 이미 답한 문항만 다시 연습하고 같은 판/문항으로 돌아간다. 재연습 성공은 첫 답·점수·서버 종료 결과를 바꾸지 않는다. 기기 안 최근 도움은 비회원/계정·튜터·게임별로 나눈다. [구현 경계](../brand-opening/HOME.md#게임-관찰에-따른-힌트와-어려웠던-곳-다시-연습) · [검수 기록](../brand-opening/qa/tutor-hints-20261010/README.md).

2026-10-10. [생활 한국어 콘텐츠](LIFE-CONTENT.md)를 실제 앱 홈에 연결했다. 인사·카페·편의점·길 찾기·교통·약속의 6팩은 표현 만나기 → 세 친구 이야기 → 생활 적용으로 이어진다. 현재 22레슨(기존 읽는 이야기 6편·새 카페 방문 3편·직접 주문 1편 포함)이며 본학습 66문항·새 상황 복습 66문항이다. 카페의 음료·온도·수량은 직접 구성하고 직원 질문 15개를 동봉 음성으로 듣는다. 카페의 친구 취향·품절·주문 변경은 실제 컵/직원 반응/수령과 홈의 다음 방문으로 이어진다. [카페 방문 검수](qa/cafe-visits-20261010/README.md)·[직접 주문/듣기 검수](qa/cafe-complete-20261010/README.md). 기초 생활 한국어의 읽기·주문 구성·직원 질문에 대한 응답 선택을 제공한다.

홈은 다음 학습·완료한 단계·돌아온 복습과 팩/이야기 입구를 표시한다. 이야기 장면과 질문의 중간 위치, 첫 답, 도움 사용은 새로고침 뒤에도 복원된다. 정답은 다음 날, 오답·도움 사용은 1분 뒤부터 변형 복습으로 돌아온다. 간격은 변형 복습 성공에서만 1·3·7·14·30일로 늘어나며 일반 레슨을 다시 하는 것으로 예정된 복습을 뒤로 미루지 않는다.

진도는 전용 synk.life-korean.progress.v1 기록을 사용한다. 비회원은 해당 기기, 로컬 확인 계정은 실제 PGlite synk-play 서버에 저장한다. 계정 모드 소스는 검증된 SYNK ID 전용 port와 공식 CAS/outbox를 재사용한다. 계정 저장이 거절되거나 충돌하면 원본을 보존하고 상태를 표시하며 사용할 기록을 직접 선택한다. 새 허용 키의 원격 배포와 실제 운영 로그인 왕복은 별도다.

- [통합 앱](http://127.0.0.1:4312/mobile.html?opening=off) · [독립 마루](http://127.0.0.1:4307/brand-opening/home.html)
- [콘텐츠 원고·교육 범위](LIFE-CONTENT.md) · [실제 UI 검수](qa/life-content-20261010/README.md)
- 독립 마루 번들은 node tools/build-world-life.mjs, 계정 번들은 node tools/build-world-account.mjs로 갱신한다. 각각 --check로 최신성을 확인한다.

**생활·카페 튜터 동행(2026-10-11):** 고른 튜터가 생활 팩·이야기·문제·카페 다섯 방문·복습을 자기 말투와 표정으로 안내한다. 헷갈린 표현은 `표현 도움`에서 기존 새 상황 원고로 함께 연습한 뒤 같은 자리로 돌아간다. 첫 답·도움·카페 수령·정규 복습 기록과 간격을 유지하며, 직원 질문을 듣는 동안 튜터 소리를 쉬게 한다. [내용·비교 근거와 기록 경계](LIFE-CONTENT.md#고른-튜터와-생활카페-안내--2026-10-11) · [검증과 화면](qa/life-tutor-20261011/README.md).

## 실행

**코스튬 후속(2026-10-09):** [실시간 3D 피팅룸·룩북·촬영실](qa/costume-studio-20261009/README.md)을 연결했다. 옷 5벌·목도리/스카프 3개, 미착용을 포함한 24조합, 서버 룩북·착용·복원·PNG를 구현했다. [바로 열기](http://127.0.0.1:4296/desktop.html?wardrobe=1&opening=off). 로컬 합성 계정의 발전본이며 운영 옷장·네이티브 설치·최종 모델 승인을 뜻하지 않는다.

**그래픽 v6 후속:** [옷 조형·입체 뜨개·직물·접촉 그림자](qa/costume-graphics-20261009/README.md)를 보강했다. 사용자 긍정 평가 뒤 더 높은 그래픽을 요청한 결과이며, 24조합의 3방향 렌더·촬영·복구·모바일 정책 21조건을 확인했다. 본체와 눈의 형상은 보존하고 최종 미술/실기기/네이티브 검증은 별도로 남긴다.

저장소 루트에서 `node experiences/synk-world-app/server.mjs`를 실행한다. Node 24와 형제 저장소 `SYNK-talk`의 의존성 및 WORLD v1 파일이 필요하다.

- 휴대폰 배치: http://127.0.0.1:4296/mobile.html
- PC 배치: http://127.0.0.1:4296/desktop.html
- 그래픽 세 버전 비교: http://127.0.0.1:4296/graphics.html
- 독립 홈 미리보기: http://127.0.0.1:4295/mobile.html (별도 서버 실행 필요)

처음에는 회사 오프닝 뒤 마루가 열리고, 계정은 `나` 또는 옷장·첫 문장 놀이에서 연결한다. `나의 테스트 계정`은 player-a, `다른 테스트 계정`은 player-b다. 실제 SYNK 계정·개인정보·운영 서버를 사용하지 않는다. 새 브라우저에서도 같은 시험 계정을 선택하면 동일한 서버 상태를 읽는다.

로컬 PostgreSQL 호환 PGlite의 데이터는 `.local/db-v1`에 남는다. 기존 중간 버전 `.local/db`는 그대로 보존했다. `SYNK_WORLD_PORT`, `SYNK_WORLD_DATA_DIR`로 시험 포트·데이터 경로를 지정할 수 있다. 서버는 127.0.0.1에만 바인딩한다. 휴대폰용 링크는 PC 브라우저의 화면 배치이며 실제 휴대폰으로 접근 가능한 공개 주소가 아니다.

## 구현한 흐름

1. 오프닝 → 한강 마루 → 놀이 선택 → 게임 → 닫기 → 마루. 방향 변경은 진행 중 문서를 유지한다.
2. 서버가 발급한 초급 한국어 3문항 → 중단·이어하기 → 서버 채점.
3. 첫 참여 완료 시 `첫 산책 목도리` 한 번 지급. 틀린 답도 복습할 수 있다.
4. 초기 보유품 `나의 첫 앞치마`와 목도리를 함께 착용. 서버 확정 뒤 실제 3D 메시를 바꾼다.
5. 다른 브라우저에서 동일 계정의 보유품·차림 복원.
6. 통신 실패 시 같은 저장 요청 재전송. 동시 변경 충돌은 최신 차림 확인 후 다시 선택.
7. 옷장은 현재 3D 몽글을 표시하고, 사진은 서버가 확인한 차림과 현재 시간대의 실제 PNG를 저장한다. 비회원은 미리보기로 구분한다.
8. 타운 안내의 `타운 연결 미리보기`에서 같은 서버의 타운을 연다. 타운의 상태·진행은 인증된 시험 계정별 파일에 저장하며, 차림은 같은 서버 소유품을 확인하고 공통 몽글 factory에 적용한다. 운영 TOPIK 입장 조건을 통과한 것처럼 표시하지 않는다.

**학습 범위:** 인사·요청·위치의 짧은 문장 읽기 연습으로 TOPIK I 기초 어휘·문장 이해를 보조한다. TOPIK 문항 전체, 듣기 평가, 학습 효과 측정은 구현하지 않았다. 보상은 첫 참여 선물이며 점수·랭킹·결제 재화와 연결하지 않는다. 기존 바람길·리듬·한글·노래는 별도 기존 콘텐츠로 연결하며 그 플레이를 새 보상으로 자동 인정하지 않는다.

## 소스와 데이터 책임

**Workspace 운영 연결(2026-10-10):** 최초 [검수](../../docs/_ops/qa/workspace-data-audit-20261009/README.md)의 첫 3문항 공통 학습 원장 누락과 3D TOWN 별도 저장을 수정했다. 공개 WORLD의 실제 SYNK ID·수업 명부·학습 채점·TOWN 계정 상태와 별도 선택 공유 활동을 공통 서버에 연결하고 DB·API·기능 설정·교사 Workspace·공개 화면을 운영 반영했다. [현재 배포와 증거](../../docs/_ops/qa/workspace-connect-20261009/README.md)를 따른다. 아래 합성 계정 리허설의 로컬 JSON 설명은 개발 모드의 기록이며, 운영 학생의 본인 연결·공유·활동 왕복과 16명 실시간 동시접속은 아직 검증된 것으로 보지 않는다.

| 위치 | 책임 |
|---|---|
| `app-shell.mjs`, `app-shell.css` | 첫 진입·놀이·보상·옷장·계정 UI |
| `cafe-activity.mjs`, `cafe-ui.mjs`, `life-ui.css` | 생활 카페 팩의 실제 주문·수정·자리·음료 수령, 첫 응답/도움을 유지하는 재개 |
| `world-client.mjs` | 서버 상태·판본·재시도·탭별 세션 |
| `server.mjs` | localhost 정적 파일, 합성 시험 세션, 기존 서버 호출 연결 |
| `../synk-world-home/app.mjs`, `scene-v3.mjs`, `avatar-v3.mjs` | 기본 홈, 공통 몽글·두 슬롯의 실제 3D 표시 |
| `world-town-client.mjs`, `town-host.mjs` | 같은 출처 타운 연결, 차림 재확인, 시험 계정별 타운 저장 |
| `SYNK-talk/lib/world-v1-*.js` | 인증된 계정의 플레이·소유품·장착·내보내기 |
| `SYNK-talk/supabase/migrations/20261009180000_synk_world_v1_c16.sql` | WORLD 상태·실행·요청 기록, 계정 삭제 연결·접근 차단 |

서버는 기존 SYNK ID의 계정 잠금·세션 철회·삭제 계약을 사용한다. 클라이언트가 소유자·점수·지급 결과를 지정하지 않는다. 중복 요청·다른 답 재제출·미소유품 장착·이전 revision 덮어쓰기를 검사한다. 계정 내보내기 첫 페이지와 별도 후속 페이지에도 WORLD 기록을 포함했다. 기존 완성 차림 카탈로그·계정 자료는 유지하며 이번 개발용 3D 두 아이템으로 자동 변환하지 않는다.

시험 인증은 운영 OAuth와 별도다. 브라우저 토큰은 메모리에만 있고, 탭별 HttpOnly 쿠키로 복원한다. 탭 식별자와 로그아웃 표시는 sessionStorage, 비밀이 아닌 화면 설정·계정별 미전송 요청은 localStorage에 둔다. 다른 탭의 로그인·설정이 현재 탭의 계정·3D 차림을 덮어쓰지 않도록 분리했다. 타운은 부모 홈의 세션으로 동작하며 토큰을 URL에 싣지 않는다. 탭 알림은 재조회 신호만 보내고 보유품·차림은 다시 서버에서 확인한다. 로그아웃·계정 변경·401은 타운 차림과 연결을 즉시 해제한다. 타운 파일은 `SYNK_WORLD_DATA_DIR` 뒤에 `-town`을 붙인 폴더에 계정별로 저장한다. Unity도 같은 합성 API와 아이템 ID를 사용한다.

## 검증과 남은 일

[v8 그래픽 검수](qa/V8.md)가 최신 기록이다. 한강을 지나는 배·물살·근사 반사와 러그/화분·표면 요철의 마감을 보완했다. [v7 물/빛 검수](qa/V7.md), [v6 재질·접촉 음영 검수](qa/V6.md), [v5 그래픽·보상 계약 검수](qa/V5.md)는 이전 이력이다. [v4 그래픽·사용성 검수](qa/V4.md), 아래 [v3 통합 검수](qa/V3.md)와 [최초 통합 기록](qa/verification.json)의 수치는 각 작업의 이력으로 보존하며 새 실행 수치로 합산하지 않는다.

- 브라우저 실제 조작 35항목: `node experiences/synk-world-app/qa/browser.cjs`. 첫 진입·중단/이어하기·중복 보상 방지·동시 착용·PC 복원·통신 재시도·충돌·계정 분리·사진 PNG·320/390/1440px 점검. [결과](qa/browser-result.json), [현재 휴대폰](qa/v3-final-phone.png), [현재 PC](qa/v3-final-pc.png).
- 기본 그래픽 및 비교 29항목: [결과](qa/graphics-default.json). v3 기본 표시, 네 코스튬, 낮/노을, 움직임 감소, 연속 버전 전환, 실제 캔버스 색·불투명도 확인.
- 브라우저 클라이언트: `node --test experiences/synk-world-app/qa/client.test.mjs`. 늦은 응답·계정 변경·오프라인 로그아웃·중복 요청 회귀. 실제 두 탭 검사까지 포함하려면 실행 전에 `$env:SYNK_WORLD_QA_URL='http://127.0.0.1:4296'`를 설정한다.
- 실제 SQL 및 공유 계정 영향: [백엔드 105개 검증](../../../SYNK-talk/qa/world-v1-20261009/backend-verification.json).
- 타운 연결 API·브라우저 bridge 21항목: [결과](qa/town-connection-api.json). 계정별 상태 분리·실제 서버 종료/재시작 후 복원·소유품 확인·동시 수정·로그아웃과 계정 변경을 확인했다. 타운 실제 화면 검증은 통합 검수에 별도로 기록한다.
- 실제 타운 12항목: [결과](qa/town-connection-scene.json). 같은 몽글·동시 착용·열린 화면의 차림 갱신·A/B 분리·로그아웃·PC 복원·근접시점의 조이스틱/키보드 입력을 확인했다. [휴대폰](qa/town-connected-mobile390.png), [PC](qa/town-connected-desktop.png).
- Unity: C# 핵심 흐름·문법 34항목 및 준비 검사 5항목. 종료 후 미전송 결과 복원·동일 요청 재시도·계정 격리·손상 파일 보존·공통 캐릭터 계약을 검사했다. [핵심 결과](../../unity/SynkWorld/qa/core-tests.json), [준비 결과](../../unity/SynkWorld/qa/preflight-checks.json).

**아직 검증하지 않은 범위:** Unity Editor 가져오기·의미 컴파일·APK/EXE·네이티브 화면, 실제 Google/Apple 로그인과 OS 보안 저장, S25/iPhone 15의 지속 성능, iOS/macOS 서명·빌드, 원격 DB 마이그레이션·배포. 공통 GLB와 Blender 파일은 정적 원본 후보이며 Unity 장면에 이식된 결과가 아니다. Unity CLI는 준비했지만 이 PC의 Unity 로그인·라이선스·Editor가 없어 네이티브 빌드를 실행하지 못했다. `.NET` 검증은 Unity 빌드 성공을 뜻하지 않는다. 사용자는 이번에는 코드·브라우저까지만 진행하도록 선택했다.

다음은 Unity 환경 준비 → Editor 오류 수정·Windows 실행 → Android 기기 연결 → 실제 SYNK ID 인증 → 휴대폰 획득·PC 복원의 실물 두 기기 검증 순서다. 승인 홈의 비주얼 기준을 유지하며 최종 캐릭터·코스튬 마스터 제작과 성능 검증을 병행한다.

**튜터 공개 반영(2026-10-12):** [공개 WORLD 앱](https://synk.im/world/)에 세 튜터 선택·게임 연습·생활 한국어·카페·홈 기억과 표정 교정을 반영했다. 공개 파일 852개 일치, 기본 진입17·교체141·홈 표정206·독립 게임 구성요소214 검사를 통과했다. 실제 계정 로그인·서버 저장·새 PC 설치본 검증은 포함하지 않는다. [공개 커밋·화면·검증 범위](qa/tutor-release-20261011/README.md).
