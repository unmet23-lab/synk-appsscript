# Fable 최종 검수 — SYNK Platform PC 앱 (2026-10-22)

**판정: 고친 뒤 공개** — P0 0 · P1 2 · P2 11 · P3 7

P1 두 건은 모두 글 한 줄(또는 한 줄 + 조건 하나)로 고칠 수 있어요. 고친 뒤 다시 찍지 않아도 되는 범위예요(배치·동작 변경 없음).

경로 약어: `final/` = `scratchpad\shots\desktop\final\`, `extra/` = `scratchpad\fable\pc-extra\`(이번에 추가로 찍은 45상황 104장, 상태 글 모음은 `extra/_texts.json`·`_texts-rel2.json`, 찍는 스크립트 `scratchpad\fable\pc-extra-capture.mjs`). 파일:줄은 작업본 기준.

## P1

[P1] `desktop/renderer/update-view.mjs:25` 업데이트 카드 — 설치 파일 열기 실패 글이 **화면에 없는 단추**를 누르라고 해요. — 근거: 같은 파일 `:48` `row.install.hidden=state!=='ready'||automatic`라 `state==='error'`에서는 설치 단추가 숨고 「최신 버전 확인」만 남는데, 글은 「설치 파일을 열지 못했어요. 설치 단추를 다시 눌러 주세요.」. 본체는 실제로 이 갈래를 내요: `desktop/src/platform-update.cjs:156·158·166` `fail('UPDATE_OPEN_FAILED')` → `:84 errorResult` → `publish('error', code)`. 캡처 `extra/upd-01-error-install-downloads.png`, `extra/upd-02-error-open-downloads.png`(단추는 「최신 버전 확인」 하나). — 고칠 방향: 「설치 파일을 열지 못했어요. 「최신 버전 확인」을 누른 뒤 「앱 끄고 설치 파일 열기」(Mac은 「설치 파일 열기」)를 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있어요.」 — `errorResult`가 `automaticInstall=false`로 바꾸니 다시 확인하면 수동 단추가 나와요. (아르곤 B의 「여는 실패는 설치 단추」 반영이 이 갈래를 놓친 것.)

[P1] `desktop/renderer/benefits.mjs:56` 플레저 혜택 「웹에서 무료」 상자 — 「창을 닫은 뒤에도 알림을 받으려면 설정의 「플레저 PC 알림」을 켜 주세요.」인데 **Mac에는 그 설정 구획이 없어요.** — 근거: `desktop/src/care-notifications.cjs:15` `available()`이 `platform==='win32'` 한정, `desktop/renderer/care-notifications.mjs` `render()`가 `available!==true`면 구획을 숨김. 캡처: 글은 `final/in-03-benefit-03-care-1440-full.png`, 구획이 없는 설정은 `final/in-05-settings-1440-full.png`(available 아님), 있는 경우는 `extra/care-01-settings-available-settings-full.png`(Windows). 이 앱은 Windows·Mac 공개 대상(의뢰서)이고 같은 화면의 설치 안내도 Mac을 다뤄요. — 고칠 방향: 문장을 「Windows에서는 설정의 「플레저 PC 알림」을 켜면 창을 닫은 뒤에도 알림을 받아요.」로 바꾸거나, 혜택 상세를 그릴 때 `bridge.careNotifications.status().available`로 문장을 붙였다 뗐다 하기. (Mac 공개판이 아직 없다면 P2로 봐도 돼요.)

## P2

[P2] `desktop/renderer/state.mjs:67` `installerLabel` / `launcher.mjs` `renderDownloads` — 설치·업데이트 목록이 **설치된 앱도 「설치 가능」**이라고 해요(상태 글이 설치 여부·업데이트를 안 봄). 업데이트가 있을 때는 옆 목록 「업데이트 가능」 ↔ 설치 관리 「설치 가능 · v0.4.12」로 같은 상태를 다르게 불러요. — 근거: `extra/inst-07-installed-idle-downloads.png`(설치됨 WORLD·Workspace가 「설치 가능 · v0.4.11」+「설치 파일 준비」), `extra/inst-06-update-available-downloads.png`(「설치 가능 · v0.4.12」+「업데이트 준비」, 옆 목록은 「업데이트 가능」), `final/in-04-downloads-1440.png`. 시험판(개발 모드)에서는 설치된 앱도 `canPrepare`가 참이라(`desktop/src/client-lifecycle.cjs:20`) 실제로 이렇게 보여요. — 고칠 방향: `row.canLaunch`면 「설치됨 · v…」, `row.updateAvailable`이면 「업데이트 있음 · v…」, 그 밖에만 `installerLabel`.

[P2] `desktop/renderer/launcher.mjs:227` 설치 파일을 연 뒤 토스트 — 「설치 창에서 설치를 마친 뒤 「다시 확인」을 눌러 주세요.」인데, 라이브러리에서 「설치 시작」을 눌렀을 때 그 화면의 단추는 「설치 상태 확인」이에요(`state.mjs` `primaryAction` 'installer-opened' → '설치 상태 확인', 안내문 `launcher.mjs:142`도 「설치 상태 확인」). 「다시 확인」은 설치·업데이트 화면 머리의 단추 이름. — 근거: `extra/inst-03-opened-library-world.png`(단추 「설치 상태 확인」 + 안내 「…「설치 상태 확인」을 눌러 주세요」) vs 토스트 글. — 고칠 방향: 토스트도 「설치 상태 확인」으로(또는 「라이브러리의 「설치 상태 확인」이나 설치·업데이트의 「다시 확인」」).

[P2] `desktop/renderer/index.html:73` 옆 목록 빈 상태 — 즐겨찾기 필터(별표)를 켰는데 즐겨찾기가 없으면 「찾는 앱이 없어요. 다른 낱말로 찾아보세요.」가 떠요(검색을 안 했는데 낱말을 바꾸라고 함). 바꾸기 전 「표시할 앱이 없어요. 검색어나 필터를 바꿔 보세요.」는 필터 경우를 덮었으니 **더 나빠진 곳**. — 근거: `extra/dlg-06-filters-filter-fav.png`. — 고칠 방향: 필터별로 나누기 — 즐겨찾기: 「즐겨찾기한 앱이 없어요. 앱 화면의 별표를 누르면 여기에 모여요.」, 설치됨: 「설치한 앱이 없어요.」, 검색: 지금 글.

[P2] `desktop/renderer/update-view.mjs:36` 업데이트 카드 눈썹 「SYNK PLATFORM · PREVIEW」가 모드와 상관없이 고정 — 정식 모드에서는 버전 줄에서 「시험판」을 뺐고 설정 연결 상태도 「정식판」인데 눈썹만 PREVIEW. — 근거: `extra/upd-14-release-current-downloads.png`, `final/out-04-downloads-1440.png`(정식 모드). — 고칠 방향: `env.mode==='release'?'SYNK PLATFORM':'SYNK PLATFORM · PREVIEW'`. (지금 공개판은 시험판 모드라 당장 보이지는 않아요.)

[P2] `desktop/renderer/subscriptions.mjs:497` AI 구독 계정판 머리 — 「흩어진 AI 구독,<br>이번 주 얼마나 썼는지 한 번에.」가 글 원칙이 금한 쉼표 끊은 슬로건이고, 카드(benefits.mjs)는 「남은 양」을 말하는데 여기는 「얼마나 썼는지」라 서로 달라요. — 근거: `final/in-03-benefit-02-subscriptions-1440-full.png`, `final/out-03-benefit-02-subscriptions-1440.png`. — 고칠 방향: 「연결한 AI 구독마다 이번 주에 남은 양과 결제일을 보여 줘요.」

[P2] `desktop/renderer/pulse-client.mjs:60` PULSE 이전 초안 화면(설정 → 「이 PC에 저장한 요청 초안 보기」) 머리 — 「브랜드의 다음 장면, 여기서 시작해요. / 사진에서 분위기를 고르고, 원하는 작업을 담아 보세요.」 옛 슬로건 꼴이 남았어요(같은 파일의 다른 글은 다 고침). — 근거: `extra/dlg-05-pulse-legacy-pulse-legacy.png`. — 고칠 방향: 「이 PC에 저장한 제작 요청 초안 / 모델과 참고 작업을 골라 요청문을 쓰고 복사해요.」

[P2] `desktop/renderer/member-insight.mjs:87` + `member-insight-view.mjs:285` 내 성향 불러오기 실패 — 눈썹 「다시 확인」, 제목 「기록을 불러오지 못했어요.」, 본문 「내 기록을 불러오지 못했어요. 계정 연결을 확인하거나 다시 불러와 주세요.」 — 같은 말 두 번에, 「계정 연결을 확인」은 어디서 무엇을 하라는지 없어요(바꾸기 전과 같은 글). — 근거: `final/in-03-benefit-01-insight-1440.png`(before 동일). — 고칠 방향: 눈썹 「불러오기 실패」, 본문 「인터넷 연결을 보고 「다시 불러오기」를 눌러 주세요. 계속 안 되면 로그아웃했다 다시 로그인해 주세요.」

[P2] `desktop/renderer/platform-continuity.mjs`(생성물, 원천 `experiences/synk-account/src/`) 홈 「계정 라이브러리」 상자 — ① 로그인돼 있는데 서버가 안 되면 「로그인하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.」(묶음 `:2469` 마지막 갈래)가 떠서 로그아웃된 것처럼 읽혀요. ② 「연결을 기다리고 있어요」가 한 상자에 두 번(띠 상태 + 절 제목). ③ 메모 되살리기 이름이 「초안 복구」·「보관한 초안 버리기」·「기기의 초안 복구 상태…」(`platform-library-view.mjs:202·244·431`, `platform-library-recovery.mjs:45·90`)인데 같은 홈의 내 메모·설정은 「쓰던 메모 되살리기」·「임시 저장본」이에요. — 근거: `final/in-01-home-1440.png`. — 고칠 방향: 포털 원천에서 고치고 `node tools/check-account-bundles.js --build`로 묶음 재생성(포털 검수와 겹치면 그쪽 처리로 갈음).

[P2] `desktop/renderer/index.html:153` 게임 창 단추 「WORLD로 돌아가기」 — 실제 동작은 창을 닫고 이미 보고 있던 라이브러리 WORLD 쪽 실행/설치 단추에 초점을 두는 것(`launcher.mjs:259`). 「WORLD 앱의 「놀이」에서 할 수 있어요」 바로 아래라 WORLD 앱이 열리는 것처럼 읽혀요. — 근거: `final/in-02-library-01-world-game-hangul-1440.png`. — 고칠 방향: 「닫기」 또는 「WORLD 열기·설치로」(설치 상태에 따라 라벨).

[P2] `desktop/renderer/index.html:152` 계정 창 도움말 「가입한 뒤 여기서 「로그인」을 눌러 주세요.」 — 저장된 로그인 재확인 상태에서는 단추가 「새로 로그인」이라(`launcher.mjs renderAuth`: `retryable?'새로 로그인':'로그인'`) 이름이 어긋나요. — 근거: `extra/auth-02-retry-account.png`. — 고칠 방향: retryable이면 도움말을 숨기거나 「새로 로그인」으로.

[P2] `desktop/renderer/index.html:161` + `launcher.mjs:58` 나가기 창 — 제목 「작성 중인 메모가 있어요」 바로 밑 본문이 「아직 저장하지 않은 메모가 있어요. …」로 같은 말 되풀이. — 근거: `extra/dlg-02-leave-leave-dialog.png`. — 고칠 방향: 본문을 「돌아가서 저장하거나, 메모를 버리고 창을 닫을 수 있어요.」만.

## P3

[P3] 설치 파일 준비 실패 뒤 라이브러리 — 단추 「다시 준비」와 일반 안내 「v0.4.11 · 설치 파일 150.0 MB · 이 PC에 따로 설치해요.」만 있고 실패 원인은 설치·업데이트 화면에만 있어요(`extra/inst-04-error-library-world.png` vs `extra/inst-04-error-downloads.png`). 라이브러리 안내에도 `row.installer.error` 한 줄을 붙이면 좋겠어요.

[P3] 홈 옆 목록 「모든 앱 04」 vs 홈 「내 앱 06」(플레저·운세는 선반에만) — `final/in-01-home-1440-full.png`. 전부터 같고 설계상 의도일 수 있어 확인만.

[P3] 정식 모드 — 영웅 배지 「따로 설치하는 PC 앱」·설치 관리 머리 「WORLD와 Workspace를 이 PC에 설치하거나 업데이트해요.」인데 실제로는 「준비 중 / 이 기기에 맞는 설치 파일이 아직 없어요 / 설치 파일 없음」(`client-lifecycle.cjs:18` 개발 모드에서만 설치 파일 제공) — `extra/rel-01-real-library-world.png`, `extra/rel-01-real-downloads.png`. 정식 모드 공개 때 글을 맞춰야 해요.

[P3] 성향 상세 큰 글자 둘레의 테두리(초록/산호 초점 고리) — `final/in-03-benefit-01-insight-1440.png`(before도 같음). 스크립트 클릭 뒤 `focus()` 때문으로 보이며 실제 마우스 클릭에서도 보이는지만 확인.

[P3] 맞춤 순서 창 「저장한 설정 지우기」가 저장한 것이 없어도 보이고, 누르면 「저장한 설정을 지웠어요. 기본 순서로 돌아왔어요.」 — `final/out-07-personal-dialog-1440-full.png`. 비활성 처리하면 좋겠어요.

[P3] PATH 요약 「요양보호사 지원 면접을 세 면접관 앞에서 연습해요.」(`state.mjs` path.summary)는 사실(`experiences/path-vr/interview/content.mjs:22`)이지만, 같은 화면 「쓰는 사람: 한국 유학·진로·취업을 준비하는 학습자」보다 범위가 좁아 보여요 — `final/in-02-library-03-path-1440-full.png`. 대상 줄에 「(지금은 요양보호사 지원 면접 한 가지)」를 붙일지 판단만.

[P3] PULSE 이전 초안 화면의 모델 카드 그림은 미리보기에서 안 떠 대체 글만 보였어요(`extra/dlg-05-pulse-legacy-pulse-legacy.png`). 원격 그림이라 못 본 범위.

## 확인해서 이상 없던 것(의뢰서 「특히 볼 것」)

- WORLD 게임 창 3종: 원본 540×1169, 1440×940·960×680·1440×720 어디서도 세로 화면이 안 잘리고(`extra/_texts.json`의 `*-image` 항목, `extra/game-01-960-game-hangul.png`, `extra/game-02-short-game-hangul.png`), 설명이 실제 게임과 맞아요 — 바람길 「들은 말대로 90초 동안 달려요」(`experiences/korean-runner/app.mjs:512`), 말의 리듬 두 단추·O/X·박자 점수 따로(`korean-rhythm/app.mjs:289·361·567·579`), 한글 만나기 「글자를 보고 맞는 소리를 골라요」 단계 + 따라 쓰기(`hangul-stage/app.mjs:235·351·465`), 「놀이」 탭(`world-strings.mjs:136 nav.play`). 부가 항목도 원문과 맞음(첫 문장 놀이 `game-tutor-lines.mjs:18`, 싱크타운 `play.town.detail`, 옷장 `wardrobe.lead`, 노래 듣기 `play.songs.detail`).
- 상태 글·단추: 설치 7상태(설치 가능·준비 중·준비됨·창 열림·취소됨·실패·없음)와 그때의 라이브러리 단추(설치 준비·취소·설치 시작·설치 상태 확인·다시 준비·준비 중), 업데이트 13상태(available·downloading·ready 자동/수동/Mac·opening·checking·disabled·exit-cancelled·error 4종) — 위 P1·P2 둘 말고는 상황과 맞음(`extra/_texts.json`). 판 번호·「시험판」: 개발 모드 「지금 v0.4.36 · 시험판」, 정식 모드 「지금 v0.4.36」, 설정 연결 상태 「시험판(Preview)/정식판」, 아래 줄 「시험판/SYNK Platform」 모두 일치.
- 회원 혜택 네 카드·소개 머리(「회원이면 모두 무료.」·「네 가지 회원 혜택」·WHERE TO OPEN), 상세 4종(로그인 전·후), 계정 창(로그인 전·중·됨·재확인·설정 없음·오류), 맞춤 순서 창과 저장 뒤 요약(「한국어 공부 · 이 PC에 저장됨」·「먼저 볼 앱」), 메모 폼, 알림·단축키 창, 이 창에서만 목적 안내, 960 폭 홈·라이브러리·혜택·설치·구독판 — 잘림·겹침·빈 칸 없음.
- 이름 통일: PC 앱 자체 글은 「쓰던 메모 되살리기」(설정·홈·본체 draft-exit)·「학습 기록 연결」(insight)·「내 성향」으로 맞음(어긋난 곳은 위 계정 라이브러리 묶음뿐). renderer 사용자 글에 합쇼체·내부 말(MVP·로컬·개발판·클라이언트·배포·복구본·동기화) 없음(`index.html:82` aria-label 「PULSE 클라이언트 공간」만 숨은 라벨).
- 본체 글(`desktop/src`): auth-service 브라우저 끝 화면 넷·care-notification-model 오류·문구 초안·tray 이름·draft-exit·mac-application-location — 해요체·원인+다음 행동 꼴 유지, 조사 오류 없음.

본 범위: `final/` 전체(1440·960, 로그인 전·후), `before/` 대조(홈·성향·설치·설정·계정·맞춤), `desktop/renderer`·`desktop/src`·`desktop/tools` diff 전부, 생성물 `platform-continuity.mjs`의 이름·갈래, 게임·WORLD 사실 대조(`experiences/korean-runner`·`korean-rhythm`·`hangul-stage`·`brand-opening`·`path-vr`), 추가 45상황 104장(`extra/`), 시험 로그 `desktop-tests-after8.txt`(967 중 964 통과·2 실패·1 건너뜀 — 실패 2건은 `installations-asar`·Electron Builder 이름 계약 시험으로 바꾸기 전 로그 `desktop-tests-before.txt`에서도 같은 2건이 같은 자리에서 실패함, 이 작업본에 없는 모듈 때문(MODULE_NOT_FOUND)이라 이번 변경과 무관).
못 본 범위: 실제 설치본 실행(의뢰 조건), 트레이 메뉴와 Windows 알림 실물, Mac 실물, 계정 서버가 정상일 때의 계정 라이브러리·내 성향 요약 화면(가짜 다리는 요청 실패만 냄), AI 구독 계정판에 계정이 연결된 뒤 화면, PULSE 이전 초안의 원격 그림, Windows 설치 창(C#, 범위 밖), `platform-continuity.mjs` 본문 전체(포털 검수 몫).
