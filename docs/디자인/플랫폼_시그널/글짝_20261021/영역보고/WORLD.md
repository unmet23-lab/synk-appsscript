# 영역 보고 · world (WORLD 홈·옷장·앱 껍데기 + 튜터 + 게임 셋) — 2026-10-21

작업본: `C:\Users\q1212\Documents\SYNK-appsscript\.claude\worktrees\platform-copy-audit-20261021` (커밋·push 안 함)
맵: `C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\maps\world\` (01-tutor · 02-wardrobe · 03-shell · 04-play · 05-games · 06-home-preview · 후속 07-followup · 08-ws-msg · 09-tests)
전후 짝 전부(파일:줄): `C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\world-work\pairs-lines.txt`

## ⑨ 후속(총괄 지시 10-21 밤 · 맵 07~09) — 맨 아래 「후속 결과」 절을 먼저 보세요

④-1·④-4·④-7·④-8·④-10을 고쳤고 ④-9는 가려지지 않아 그대로 뒀다. 아래 ①~⑧은 첫 보고 그대로이고, 그 뒤 바뀐 것은 맨 아래 절에 모았다.

## 한눈에

- 맡은 파일 67개 · 보이는 글 4,043개 · GPT·들여옴 947개(inventory 기준).
- 바꾼 곳 184곳(원천 183 + 시험 1) · 원천 34파일. 공통 컬렉션 사본 12개는 생성기로 다시 만들었다(그중 9개는 다른 게임 폴더).
- 시험: 기준선과 같음(새 실패 0). 앱 513/518 · 브랜드 133/134 · 게임 229/229 · 뿌리 110/110 · 브라우저 4/6 — 실패는 모두 바꾸기 전과 같은 이름·같은 원인.
- 런처 사진 3장: `scratchpad\shots\world\launcher-runner.png`·`launcher-rhythm.png`·`launcher-hangul.png`(390×844 세로, 2배 해상도 780×1688, 고친 뒤 상태, 실제로 놀고 있는 장면).

**먼저 알아야 할 것 셋**

1. **WORLD 껍데기의 GPT 상태 글 대부분은 내 파일에서 못 고친다.** `app-shell`·`world-account`·`tutor-selection-sync`·`life-progress`·`life-ui`·`device-records`의 GPT 상태 글 약 50개가 `world-strings.mjs`의 `msg.*` 한국어와 **글자까지 똑같아야** `tMessage()`가 영어·몽골어로 바꾼다. 내 파일에서만 고치면 영어·몽골어 사용자에게 한국어가 그대로 뜬다. 그래서 손대지 않고 아래 ④-1에 world-strings 담당용 새 글을 적었다(ko·en·mn 함께 바꾸고 몽골어 검문).
2. **튜터 소개 카드(`tutor-profiles.mjs`, GPT 87로 잡힘)는 GPT 글이 아니다.** 09-05 Claude(Fable)가 쓰고 유호님이 「이대로 가」로 확정한 정본(`docs/캐릭터/소개글_정본.json`)을 GPT 커밋이 생성 파일로 옮긴 것이라 inventory가 GPT로 셌다. 정본과 같아야 하는 시험(`tutor-choice.test.mjs`)과 world-strings(`tutor.card.*`)에 묶여 있어 그대로 뒀다.
3. **`synk-world-home/index.html`·`app.mjs`(GPT 44·48)는 지금 WORLD에서 안 쓰는 옛 「독립 홈 시안」이다.** 공개 WORLD는 `brand-opening/home.html`을 쓰고, 공개 빌드는 이 폴더의 html을 뺀다. 그래도 4295 서버로 열면 GPT 슬로건이 그대로라 글은 고쳤고, 퇴역은 ④에 제안했다.

## ① 범위

| 묶음 | 파일 | 보이는 글 / GPT |
|---|---|---|
| 홈·옷장(synk-world-home) 14파일 | index.html, app.mjs, wardrobe-studio/album/catalog/workbench/stage, graphics.html·.mjs(개발용), scene*.mjs, living-home-scene, songs | 835 / 225 |
| 앱 껍데기(synk-world-app) 9파일 | app-shell, world-account, tutor-selection-sync, life-progress, life-ui, world-town-client, course-writing-entry, device-records, guest-trial | 259 / 69 |
| 튜터(brand-opening) 20파일 | tutor-profiles, game-tutor(+support), tutor-practice(+core), tutor-review, tutor-onboarding, home-tutor-recap, life-tutor, home.html·home.mjs·home-*.mjs, 대사 파일 다섯 | 1,147 / 544(대사 321 · 소개 카드 87 포함) |
| 공통 놀이(play-common) 4파일 | collection.js(사본 원천), collection-adapter.js, account-host, account-client | 689 / 55 |
| 게임 셋 20파일 | korean-runner(8), korean-rhythm(6), hangul-stage(6) | 1,113 / 54 |

## ② 고친 글 — 184곳

맵별: 튜터 34 · 옷장 50 · 껍데기 14 · 공통 놀이 24 · 게임 10(시험 1) · 독립 홈 시안 52.
기준: 그 자리에서 사용자가 할 일·알게 되는 것을 쉬운 말로. 「이번 실행」「전송 대기」「원본 보존」「연결」 같은 개발 말과 「확인해 주세요」 끝맺음을 무엇을 어디서 하라는 문장으로 바꿨고, 옛 이름(마루·홈·나의 공간)을 지금 이름(우리 동네·싱크타운·내 계정)으로 바꿨다.

대표 전후(파일:줄은 지금 파일 기준):

| 파일:줄 | 전 | 후 |
|---|---|---|
| brand-opening/tutor-practice-lines.mjs:40 | 오! 왼쪽 단추로 한 칸 옮겼어! 너도 같이 해 보자! | 오! 왼쪽 단추를 눌렀어! 너도 같이 눌러 보자! (말의 리듬에서도 맞는 말) |
| brand-opening/tutor-practice-lines.mjs:4 | 이동 수칙. 왼쪽 단추 한 번. …너도 한 칸 옮겨라. | 입력 수칙. 왼쪽 단추를 한 번 누른다. …너도 눌러라. |
| brand-opening/tutor-practice-core.mjs:14 | 왼쪽 단추 만나기 | 왼쪽 단추 눌러 보기 |
| brand-opening/home-tutor-lines.mjs:52 | 내가 기록부터 확인할게. 나의 공간에서 연결을 한번 봐 줘. | 이 몸이 기록을 아직 못 읽었어. 「내 계정」을 눌러서 한번 봐 줘. |
| brand-opening/life-tutor-lines.mjs:78 | (몽글) 음료 종류·온도·잔 수를 **함께 같이** 확인해 보자! | 음료 종류·온도·잔 수를 같이 확인해 보자! |
| brand-opening/home-tutor-recap.mjs:7 | 오늘의 한국어, 함께 돌아보기 | 오늘 돌아보기 |
| brand-opening/home-tutor-recap.mjs:7 | 마루로 돌아가기 | 우리 동네로 |
| brand-opening/home-tutor-recap.mjs:20 | 도움과 함께 연습했어요. 다음에는 스스로 확인해 봐요. | 도움을 받고 맞혔어요. 다음엔 혼자 해 봐요. |
| brand-opening/game-tutor-support.mjs:42 | 이 표시선에서는 부탁한 동작이 끝까지 이어지지 않았어요. 들은 부탁과 동작을 같이 확인해 보세요. | 이 표시선에서 부탁과 다른 동작을 했거나 놓쳤어요. 부탁을 끝까지 듣고 그 동작을 해 봐요. |
| brand-opening/game-tutor-support.mjs:55 | O/X 선택과 누른 박자는 따로 확인해요. | 답과 박자는 따로 봐요. 노트가 선에 닿을 때 한 번 더 눌러요. |
| brand-opening/game-tutor.mjs:72 | 힌트와 근거 더 보기 | 자세히 보기 |
| synk-world-home/wardrobe-catalog.mjs:4 | 폭신한 실을 꼬아 만든, 햇살 같은 조끼. | 꼬아 짠 무늬가 있는 버터색 니트 조끼예요. |
| synk-world-home/wardrobe-catalog.mjs:5 | 나만의 것을 만들고 싶은 날의 차림. | 구리 단추를 박은 청색 작업 앞치마예요. |
| synk-world-home/wardrobe-catalog.mjs:7 | 고운 깃과 작은 고름으로 오늘을 차려입어요. | 한복 저고리 위에 입는 조끼예요. 깃과 고름이 달려 있어요. |
| synk-world-home/wardrobe-catalog.mjs:9 | 익숙한 옷에도 새로운 표정이 생겨요. | 짙은 파란색의 짧은 니트 머플러예요. |
| synk-world-home/wardrobe-studio.mjs:132 | 고르던 차림은 이번 실행에만 남아요 | 고르던 차림은 창을 닫으면 사라져요 |
| synk-world-home/wardrobe-studio.mjs:193 | 연결이 끊겼어요. 초안과 같은 저장 요청이 남아 있어요. | 인터넷 연결이 끊겼어요. 고른 차림은 남아 있으니 연결되면 다시 저장해 주세요. |
| synk-world-home/wardrobe-studio.mjs:206 | 새 차림을 입었어요. 홈과 동네에도 같은 색으로 이어져요. | 새 차림을 입었어요. 우리 동네와 싱크타운에서도 이 차림이에요. |
| synk-world-home/wardrobe-studio.mjs:215 | (이름 없이 저장한 차림) `작은 공방의 나` | `버터빛 니트 조끼 차림`(옷 이름 + 차림) |
| synk-world-home/wardrobe-album.mjs:36 | 이 기기의 앨범을 연결했어요. | 이 기기의 앨범이에요. |
| synk-world-home/wardrobe-album.mjs:71 | 임시 사진을 같은 이름과 촬영 정보로 이 기기에 보관했어요. | 창에만 있던 사진을 이 기기의 앨범에 옮겼어요. |
| synk-world-home/wardrobe-stage.mjs:132 | 3D 화면이 잠시 쉬고 있어요. 고른 옷은 남아 있어요. 다시 열어 주세요. | 3D 화면이 멈췄어요. 고른 옷은 남아 있어요. 옷장을 다시 열어 주세요. |
| synk-world-home/living-home-scene.mjs:158 | (3D 방 액자 제목) 우리의 기억 | 기억 액자(누르는 단추 이름과 같게) |
| synk-world-home/living-home-scene.mjs:160 | 함께한 순간 / 첫 표현을 기다려요. | 앨범 사진 / 아직 배운 표현이 없어요. |
| synk-world-app/app-shell.mjs:432 | 내 계정의 입장 권한을 확인한 뒤 다시 열어 주세요. · 내 계정 확인하기 | 둘 다 갖추면 여기서 바로 열려요. · 내 계정 열기 |
| synk-world-app/app-shell.mjs:554 | 차림을 서버에 저장했어요. | 차림을 저장했어요. |
| synk-world-app/app-shell.mjs:628 | 한글 기록 옮기기는 계정 저장 연결을 확인한 뒤 다시 안내할게요. | 한글 기록 옮기기는 계정 저장이 준비되면 다시 물어볼게요. |
| synk-world-app/course-writing-entry.mjs:17 | 과제 연결을 확인하지 못했어요. 계정을 다시 열어 주세요. | 과제 목록을 불러오지 못했어요. 내 계정을 닫았다가 다시 열어 주세요. |
| synk-world-app/world-town-client.mjs:89 | 계정 연결이 바뀌었어요. 홈에서 동네를 다시 열어 주세요. | 로그인한 계정이 바뀌었어요. SYNK WORLD에서 싱크타운을 다시 열어 주세요. |
| play-common/account-host.mjs:18 | 전송 대기 기록을 확인하지 못했어요. 원본을 보존했어요. | 저장을 기다리던 기록을 읽지 못했어요. 그 기록은 지우지 않았어요. |
| play-common/account-host.mjs:36 | 게임 기록과 구매품이 SYNK 계정에 저장됐어요. | 게임 기록과 산 물건이 SYNK 계정에 저장됐어요. |
| play-common/account-client.mjs:11 | 계정에 이어 저장하려면 SYNK ID로 연결해 주세요. 현재는 이 브라우저의 체험 기록이에요. | 기록을 계정에 남기려면 SYNK ID로 로그인해 주세요. 지금 기록은 이 기기에만 있어요. |
| play-common/collection-adapter.js:72 | 오늘의 공통 보상 10회분을 모두 받았어요. 지금은 코인 없이 편하게 놀고, 내일 다시 모을 수 있어요. | 오늘 받을 수 있는 코인 보상 10번을 다 받았어요. 놀이는 계속할 수 있고, 코인은 내일 다시 모여요. |
| korean-rhythm/core.mjs:33 | 음성 문항의 듣기 시간이 부족합니다. (합쇼체·개발 말) | 이 곡의 문제를 준비하지 못했어요. 다른 곡을 골라 주세요. |
| korean-rhythm/audio.mjs:17 | 음원과 노트의 길이가 달라요. 새로고침한 뒤 다시 시작해 주세요. | 곡을 제대로 불러오지 못했어요. 새로고침한 뒤 다시 시작해 주세요. |
| korean-runner/listening-check-ui.mjs:105 | 정답과 해설을 확인하거나 다시 들을 수 있어요. 다음 단추를 누를 때까지 기다릴게요. | 정답과 해설을 읽거나 다시 들어 봐요. 준비되면 아래 단추로 넘어가요. |
| hangul-stage/progress-data.mjs:10 | 한글 진도의 판이나 내용을 확인하지 못했어요. 기존 기록은 그대로 보존했어요. | 한글 진도를 읽지 못했어요. 기존 기록은 지우지 않았어요. |
| synk-world-home/index.html:34·36 | A LITTLE PLAY, A BIG WORLD / 오늘도, 나답게 놀아봐. / 작은 놀이가 나의 세상이 되는 곳. | HOME / 몽글의 테라스 / 몽글과 놀고 옷을 갈아입어요. |
| synk-world-home/index.html:47 | 오늘의 나를 골라봐. 작은 차림 하나로 달라지는 하루. | 몽글의 옷장 · 목도리와 앞치마를 입혀 볼 수 있어요. |
| synk-world-home/app.mjs:90 | 내 집을 꾸미고, 작물을 기르고, 이웃과 이야기를 나누는 곳이에요.(없는 기능) | 내 차림 그대로 동네를 걷고 이웃과 이야기하는 곳이에요. |

캐릭터 대사는 세 줄 규칙(몽글 ?!·까몽 자기·마린 보고)과 지문 교차를 `tools/혼잣말검사.js`와 같은 정규식으로 대사 모듈 전체에 걸어 위반 0을 확인했다(검사기 본체는 `docs/캐릭터/혼잣말_정본.json`만 읽어서 대사 모듈에는 그 식을 빌렸다 — `world-work\three-rules.mjs`).

## ③ 고친 화면·기능 문제

| # | 심각도 | 파일:줄 | 문제 | 근거 | 고침 |
|---|---|---|---|---|---|
| 1 | P2 | brand-opening/tutor-practice-lines.mjs:4·22·40 | 말의 리듬 조작 연습 1·2단계(O·X 단추)에서 튜터가 바람길 말 「왼쪽 단추로 한 칸 옮겼어」를 한다 — 대사 `left`·`right`를 두 게임이 같이 쓴다 | before/14-rhythm-tutor-practice-1440.png → after/14-rhythm-tutor-practice-390.png | 두 게임에 다 맞는 「단추를 눌러」 대사로(세 튜터 말투 유지) |
| 2 | P2 | brand-opening/home-tutor-recap.mjs:7 | 하루 돌아보기 창의 단추 「마루로 돌아가기」 — 옛 홈 이름 | after/05c-home-recap-390.png | 「우리 동네로」 |
| 3 | P2 | brand-opening/home-tutor-lines.mjs:45·52·59 | 기록을 못 읽을 때 튜터가 지금 없는 「나의 공간」으로 보낸다 | 코드 | 「내 계정」(화면 단추 이름) |
| 4 | P2 | brand-opening/life-tutor-lines.mjs:78·83 | 몽글 힌트가 「…를 함께 같이 확인해 보자!」 겹말이 된다(카페 주문·약속 시간) | 코드 | 단서 끝의 「함께」 뺌 |
| 5 | P2 | wardrobe-studio.mjs:206, world-town-client.mjs:19·31·89 | 「홈과 동네」「홈에서 동네를」 옛 이름 — 지금은 우리 동네(홈)·싱크타운(동네)이라 헷갈린다 | 코드 | 지금 이름으로 |
| 6 | P3 | living-home-scene.mjs:158 | 3D 방 액자 제목 「우리의 기억」이 그 액자를 여는 단추·시트 이름 「기억 액자」와 다르다 | 코드 | 「기억 액자」 |
| 7 | P3 | synk-world-home/app.mjs:39 | 시안 캡션 「몽글 · 몽글 기본 차림」 겹침 | after/40-home-preview-1440.png | 「지금 차림 · …」 |
| 8 | P3 | collection-adapter.js(문구 하나) | 「자동 시연은 공통 코인을 지급하지 않아요.」를 바꾸면 레이싱 담당 QA(`korean-racing/qa/flows.cjs:74`)가 깨진다 | grep | 원래 글로 되돌림(④에 제안) |

## ④ 제안(손대지 않음 — 우선순위 순)

1. **[P2 · world-strings 담당] 내 파일의 GPT 상태 글이 묶인 `msg.*` 새 글** — ko를 바꾸면 내 파일의 같은 한국어도 같이 바꿔야 한다(tMessage가 글자로 찾는다). en·mn 함께, 몽골어 검문.
   - 「계정 연결」을 로그인 뜻으로 쓴 것: `msg.accountChanged` 계정 연결이 바뀌었어요. → 로그인한 계정이 바뀌었어요. / `msg.accountChangedChoose` 같은 꼴 + 다시 골라 주세요. / `msg.authEnded` 계정 연결이 끝났어요. 다시 연결해 주세요. → 로그인이 끝났어요. 다시 로그인해 주세요. / `msg.learningChanged` 학습 연결이 바뀌었어요. → 로그인한 계정이 바뀌어 학습을 다시 불러와요. / `msg.tutorAccountFirst` 계정에 연결한 뒤 다시 골라 주세요. … → 로그인한 뒤 다시 골라 주세요. 지금 튜터는 그대로예요. / `msg.tutorAfterConnect` 계정 연결을 다시 확인한 뒤 선택을 저장해요. → 다시 로그인하면 고른 튜터를 저장해요.
   - 「확인해 주세요」로 끝나 할 일이 없는 것: `msg.worldAccount`(PC 앱 다리가 옛 판일 때) → PC 앱을 최신 판으로 업데이트한 뒤 다시 열어 주세요. / `msg.activeId` 활성화된 SYNK ID를 확인해 주세요. → 이 SYNK ID는 지금 쓸 수 없어요. 다른 계정으로 로그인해 주세요. / `msg.idSettings`(설정 누락) → 지금은 로그인을 시작할 수 없어요. 잠시 뒤 다시 시도해 주세요. / `msg.keptFirst`·`msg.checkExistingFirst` → 「저장 확인」에서 남길 진도를 먼저 골라 주세요. / `msg.classroom` 교실 연결을 확인하지 못했어요. → 반 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
   - 「선택은 … 기억해요」(튜터 고르기 바닥에 늘 보임): `msg.tutorDevice` 선택은 이 기기에 기억해요. → 고른 튜터는 이 기기에 저장돼요. / `msg.tutorSynced` → 고른 튜터는 SYNK 계정에 저장돼요. 다른 기기에서도 같은 튜터예요. / `msg.tutorKeptDevice` → 고른 튜터는 이 기기에 두었어요. 인터넷이 연결되면 계정에 저장해요.
   - 같은 표의 화면 글: `account.title` 「계정 연결」(손님 옷장·내 계정 시트 제목) → 「로그인」, 위 띠 「계정 연결하기」 → 「로그인하기」(용어 표). `account.oneIdBody`의 「학원에 공유하는 기록은…」은 학생이 「학원」을 모를 수 있어 「반에 공유하는 기록」 검토.
2. **[P2] 바람길·말의 리듬은 화면 언어를 따르지 않는다.** 두 게임에 `world-lang`·`lang.mjs` 연결이 없어 영어·몽골어를 고른 학습자도 시작·방법·결과·단추가 전부 한국어다(한글 만나기는 `lang.mjs`가 있다). 문항·대사는 한국어 그대로 두고 화면 틀만 세 언어로.
3. **[P2] 표 밖 한국어 화면 글(번역 누락 후보).** 아래는 화면 언어를 바꿔도 한국어로만 나온다(튜터 대사는 2판까지 한국어라 뺐다).
   - 튜터 틀: `game-tutor.mjs`(함께하는 튜터·조작법·힌트·복습·조작 연습하기·이어서 하기·튜터 소리 켜짐), `game-tutor-lines.mjs` GAME_GUIDES의 단계 제목, `tutor-practice.mjs`·`tutor-practice-core.mjs`(조작 연습 창 전부: 시범·내 차례·키보드 안내·단계 제목), `tutor-review.mjs`(다시 풀기 창), `game-tutor-support.mjs`(힌트 제목·설명), `home-tutor-recap.mjs`(하루 돌아보기 창), `life-tutor.mjs`의 표현 도움·다른 장면 연습 창(이름표·역할·도움 단추만 번역됨).
   - 앱 껍데기 `app-shell.mjs`: 첫 문장 놀이 진행·결과(문장을 읽고 어울리는 답을 골라요 · 놀이 마치기 · 첫 산책 목도리를 받았어요 …), 싱크타운 시트(TOWN_LEAD·입장·공유 안내), 노래 시트, 토스트(차림을 저장했어요 · 첫 산책 목도리를 입었어요), 반 과제 확인 창.
   - 옷장 `wardrobe-studio/album/workbench/stage`, 3D 방 액자 `living-home-scene.mjs`, 게임 계정 띠 `account-client.mjs`(한국어/영어 두 줄 — 몽골어 없음).
4. **[P2] 튜터 말풍선이 2줄에서 잘려 힌트 끝이 안 보인다(390).** `brand-opening/game-tutor.css:26` `-webkit-line-clamp:2`. 힌트 대사(예: 「어? 나도… 헷갈리네! 소리와 글자를 다시 확인해 봐. 같이 다시 찾아보자!」)가 「같이…」에서 끊긴다 — 근거 `shots\world\launcher-cand\hangul-08-options-picked.png`. 휴대폰에서 3줄 허용, 말풍선을 누르면 전체 보기, 또는 힌트 대사 틀을 짧게.
5. **[P3] 지금 WORLD에서 안 도는 코드 정리.** `app-shell.mjs`의 `!home.isMaru` 갈래(76~81 「연결 개발판」「로컬 서버 연결」, 96~115 옷걸이, 134~140 상태줄, 408 welcome, 416 개발판 소개, 419~427 옛 사진)는 지금 홈(`isMaru:true`)에서 한 번도 안 불린다. 개발용 글이 남아 있어 지우는 쪽을 권한다.
6. **[P3] 독립 홈 시안 퇴역.** `synk-world-home/index.html`·`app.mjs`·`scene.mjs`·`scene-v2.mjs`·`graphics.html`·`graphics.mjs`는 지금 WORLD가 안 쓴다. 공개 빌드(`tools/build-world-app-public.mjs:92`)는 html만 빼고 .mjs는 synk.im/world에 그대로 복사한다(아무도 부르지 않는 파일). 복사 제외나 폴더 정리. `graphics.html`(개발 비교 화면, 「실시간 3D 미술 검토안이에요. 최종 캐릭터 자산·Unity 앱…」)은 개발용이라 보고만.
7. **[P3 · 의심] 잠긴 옷의 「레슨 보상」 표시.** `wardrobe-studio.mjs:24` giftLabel이 첫 산책 목도리 말고 모든 옷을 「레슨 보상」으로 보인다. 실제로 레슨에서 받는 규칙이 서버에 있는지 확인이 필요하다(없으면 지어낸 약속).
8. **[P3] 옷장 카드 상태 「입어 보는 중」이 390에서 두 줄로 갈린다.** `wardrobe-studio.mjs:147`, 근거 after/34y-wardrobe-item-390.png(「● 입어 보는 / 중」). 카드 아래 줄 폭(··· 단추와 나눠 씀)을 늘리거나 「입어 봄」.
9. **[P3 · 의심] 말의 리듬 결과(1440)의 「새 문장으로 한 번 더」 아래 글이 아래 단추에 가려 보인다.** before/17-rhythm-result-1440.png. 스크롤로 닿는지 확인 필요.
10. **[P3] 리듬 난이도 이름 「리드미컬」.** `korean-rhythm/core.mjs:6`(편하게 · 리드미컬 · 도전). 학습자에게 「보통」이 더 쉽다(시험이 이름을 보는지 확인 뒤).
11. **[레이싱 담당]** `collection-adapter.js`의 「자동 시연은 공통 코인을 지급하지 않아요.」 → 「자동 시연에는 코인을 주지 않아요.」는 `korean-racing/qa/flows.cjs:74`와 함께 바꿔야 한다.

## ⑤ 남긴 것과 이유

- **world-strings에 묶인 글**(①의 약 50개 GPT 상태 글, `home-tutor-lines`의 추천 단추 글 7개 `msg.startTodayReview` 등, `wardrobe-studio`의 `AUTH_REQUIRED` 글): 내 파일만 바꾸면 번역이 끊긴다 → ④-1.
- **튜터 소개 카드 87**(`tutor-profiles.mjs`): 09-05 유호님 확정 정본 + 정본 대조 시험 + world-strings `tutor.card.*`.
- **캐릭터 대사 321**(game/life/practice/home 대사·home-tutor-days): 틀린 정보·어색한 문장 4곳(③ 1·3·4 + 지원 대사 한 줄)만 고쳤다. 나머지는 가이드 정본 말투(몽글 「같이」, 까몽 「이 몸」, 마린 보고체)를 지키고 있어 그대로. 같은 틀 되풀이는 각 캐릭터의 입버릇 범위였다.
- **학습 내용**: `korean-runner/listening-check.mjs` 36~47줄 해설, `korean-rhythm/listening.mjs`, 노래 가사·노래 이름(`songs.mjs`), 한글 만나기 `lang.mjs`·`pack.mjs`, 첫 문장 놀이 문항.
- **listening-check.mjs 안내 글**(같은 듣기 목표를 다른 새 문장으로 확인해요 등): 시험이 뜻까지 정규식으로 본다(listening-feedback·recheck). 글이 문제없어 그대로.
- **한글 만나기 힌트 문장 `hangulSupport`**(고른 ‘빈’과 알맞은 ‘빌’을 다시 비교해 보세요): josa 시험이 그 문장째 본다. 문장이 바르고 쉬워 그대로.
- **옷 이름·모음 이름**(작은 공방·포근한 오후·산책의 순간·우리의 하루): `synk-account/src/wardrobe-view.mjs`(다른 영역)와 계정 포털 묶음에도 같은 이름이 있어 그대로. gift 값 「옷장 첫 선물」은 코드가 견주는 값이다.
- **graphics.html·graphics.mjs·scene*.mjs**: 개발 비교 화면·옛 시안의 3D 장면 — 보고만.
- **home.html·home.mjs·home-*.mjs**: 화면 글이 거의 다 `data-i18n`·`t()`로 world-strings에서 온다(Claude 글) — 바꿀 것 없음.
- **runner·rhythm·hangul의 Claude 글**: 원칙에 맞아 그대로(「공통 차고」 링크는 WORLD에서 이미 숨김).

## ⑥ 시험(기준선 → 지금, `world-work\run-tests.sh`, 탭 출력은 `world-work\baseline`·`after`·`after2`)

| 묶음 | 기준선 | 지금 | 실패(둘 다 같음) |
|---|---|---|---|
| WORLD qa 비브라우저 56파일 | 513/518 (건너뜀 1) | 513/518 (건너뜀 1) | frozen /world 정적 QA 4 — 워크트리에 `.tmp` 고정 판이 없다(현장 노트 알려진 실패) |
| brand-opening qa 19파일 | 133/134 | 133/134 | 소개 카드 정본 대조 — 이 워크트리는 「가볍게」로 `docs/캐릭터`가 빠져 있다 |
| play-common·runner·rhythm·hangul 26파일 | 229/229 | 229/229 | — |
| 뿌리 tests 9파일 | 110/110 | 110/110 | — |
| WORLD 브라우저 6파일 | 4/6 | 4/6 | account-browser `[data-position-done]` 20초 시간 초과, classroom-lessons `.ws-class` 두 개(엄격 모드) — 둘 다 바꾸기 전과 같은 줄·같은 원인 |

- 시험 짝: `korean-rhythm/audio.test.mjs:8` `/나레이션/` → `/소리 파일/`(뜻 그대로).
- 바꾼 .mjs/.js 42개 `node --check` 통과. 세 줄 규칙·지문 교차 위반 0.
- 맵의 옛 글이 시험·QA 스크립트 1,258개에 남아 있는지 훑었다 — 시안의 옛 사본(`qa/graphics-v8/before-sources`)과 남의 글 둘뿐.

## ⑦ 바꾼 파일

- 원천 34: brand-opening/{game-tutor-lines, game-tutor-support, game-tutor, home-tutor-lines, home-tutor-recap, life-tutor-lines, life-tutor, tutor-practice-core, tutor-practice-lines, tutor-practice}.mjs · synk-world-home/{app.mjs, index.html, living-home-scene, wardrobe-album, wardrobe-catalog, wardrobe-stage, wardrobe-studio, wardrobe-workbench}.mjs · synk-world-app/{app-shell, course-writing-entry, world-account, world-town-client}.mjs · play-common/{account-client.mjs, account-host.mjs, collection-adapter.js} · korean-rhythm/{app, audio, core}.mjs · korean-runner/listening-check-ui.mjs · hangul-stage/progress-data.mjs · 시험 korean-rhythm/audio.test.mjs
- 생성기로 다시 만든 사본 12(돌렸음: `NODE_PATH=<공용 작업본>\node_modules node experiences/play-common/build-collection.mjs`, 줄 끝은 작업본처럼 CRLF로 맞춤 — 바뀐 줄은 위 원천의 글뿐): play-common · korean-runner · korean-rhythm · korean-racing · blank-slice · entry-check · story-classroom · talk-rally · order-rush · word-magic · spaceship-coop · learning-hub 의 collection.js
- **총괄이 다시 만들어야 할 생성물**(돌리지 않음):
  - `node tools/build-world-account.mjs` → `synk-world-app/world-account.bundle.mjs`(course-writing-entry·world-account·play-common/account-host·hangul-stage/progress-data가 들어 있다 — 지금 공개 WORLD는 이 묶음을 쓰므로 묶음을 안 만들면 이 글들이 안 바뀐다).
  - `node tools/check-account-bundles.js --build` → 계정 포털 `synk-account/dist`(account-host가 account-view를 거쳐 app.js·client.js·local-world.js·preview.js에 들어 있다). 안 돌리면 CI 「verify account library and portal bundles」가 멈춘다.
  - 공개 빌드는 돌리지 않았다.

## ⑧ 캡처(`C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\shots\world\`)

- before 69장 · after 90장(같은 이름, 1440·390). 계정 모드 손님 흐름 01~20(언어 → 한글 질문 → 튜터 고르기 셋 → 홈 → 놀이 → 옷장(손님은 로그인 시트) → 내 계정 → 설정 → 바람길 연습·대기실·진행·결과 → 리듬 연습·대기실·진행·결과 → 한글 만나기 → 배우기), 리허설 시험 계정 흐름 30~37(로그인 → 내 계정 → 옷장 세 탭 → 첫 문장 놀이 → 싱크타운). after에만: 05c 하루 돌아보기, 34y 옷 고른 상태, 40 독립 홈 시안. before의 리허설 흐름은 1440만 있다.
- 가로 넘침 0(모든 캡처에서 scrollWidth = clientWidth, 게임 틀 안도 같음), 페이지 오류 0.
- 런처용: `launcher-runner.png`(바람길 4초 — 울타리 앞, 「들은 대로 움직여요」), `launcher-rhythm.png`(말의 리듬 첫 문제 답 고르기 — O·X 노트가 내려옴), `launcher-hangul.png`(한글 만나기 2/10 — 「아」 소리 고르기 맞힘). 후보 55장은 `launcher-cand\`.
- 찍은 스크립트: `world-work\shots.cjs`(손님) · `shots-wardrobe.cjs`(리허설) · `shots-launcher.cjs` · `shots-preview.cjs` — 서버는 임의 포트·임시 폴더, 계정 API는 합성 응답(운영·실제 SYNK ID에 닿지 않음).

## 후속 결과(⑨ — 총괄 지시 10-21 밤 · 맵 07~09)

맵: `maps\world\07-followup.json`(옷장 둘·리듬 둘) · `08-ws-msg.json`(world-strings 31줄 + 원천의 같은 한국어) · `09-tests.json`(시험 짝 하나). 튜터 말풍선(`game-tutor.css`·`game-tutor.mjs`)은 맵 없이 직접 고쳤다.

### ④-1 상태 글·「로그인」 용어 — 고침

world-strings.mjs 31줄의 ko·en·mn을 함께 바꾸고, `tMessage`가 글자로 찾는 원천의 같은 한국어도 바꿨다(app-shell · world-account · device-records · tutor-selection-sync · life-progress · life-progress-port · life-ui · wardrobe-studio `AUTH_REQUIRED`).

| 키 | 옛 글 | 새 글 |
|---|---|---|
| msg.accountChanged | 계정 연결이 바뀌었어요. | 로그인한 계정이 바뀌었어요. |
| msg.accountChangedChoose | 계정 연결이 바뀌었어요. 다시 골라 주세요. | 로그인한 계정이 바뀌었어요. 다시 골라 주세요. |
| msg.authEnded | 계정 연결이 끝났어요. 다시 연결해 주세요. | 로그인이 끝났어요. 다시 로그인해 주세요. |
| msg.learningChanged | 학습 연결이 바뀌었어요. | 로그인한 계정이 바뀌어 저장하지 못했어요. 다시 시도해 주세요. |
| msg.lifeAccountChanged | 생활 한국어 계정 연결이 바뀌었어요. | 로그인한 계정이 바뀌었어요. 생활 한국어를 다시 열어 주세요. |
| msg.lifeEnded | 이 계정의 생활 한국어 연결이 끝났어요. | 로그인이 끝나 생활 한국어 진도를 저장할 수 없어요. |
| msg.entryAccount | 계정 연결을 확인하지 못했어요. 다시 연결해 주세요. | 로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요. |
| msg.worldAccount | WORLD 앱의 계정 연결을 확인해 주세요. | PC 앱을 최신 판으로 업데이트한 뒤 다시 열어 주세요. |
| msg.activeId | 활성화된 SYNK ID를 확인해 주세요. | 이 SYNK ID는 지금 쓸 수 없어요. 다른 계정으로 로그인해 주세요. |
| msg.idSettings | 이 WORLD의 SYNK ID 공개 연결 설정을 확인해 주세요. | 지금은 로그인을 시작할 수 없어요. 잠시 뒤 다시 시도해 주세요. |
| msg.otherAccount | 다른 계정의 응답을 적용하지 않았어요. | 다른 계정의 정보라서 반영하지 않았어요. |
| msg.classroom | 교실 연결을 확인하지 못했어요. | 반 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요. |
| msg.tutorAccountFirst | 계정에 연결한 뒤 다시 골라 주세요. 기존 튜터는 그대로 두었어요. | 계정 저장이 준비된 뒤 다시 골라 주세요. 지금 튜터는 그대로예요. |
| msg.tutorAfterConnect | 계정 연결을 다시 확인한 뒤 선택을 저장해요. | 계정 저장이 준비되면 고른 튜터를 저장해요. |
| msg.tutorDevice · tutor.status.device | 선택은 이 기기에 기억해요. | 고른 튜터는 이 기기에 저장돼요. |
| msg.tutorSynced | 선택은 SYNK 계정에 기억해요. 다른 기기에서도 함께해요. | 고른 튜터는 SYNK 계정에 저장돼요. 다른 기기에서도 같은 튜터예요. |
| msg.tutorKeptDevice | 선택은 이 기기에 보관했어요. 다시 연결되면 계정에 저장해요. | 고른 튜터는 이 기기에 두었어요. 인터넷이 연결되면 계정에 저장해요. |
| msg.tutorNotSynced | 선택을 아직 계정에 저장하지 못했어요. 연결되면 다시 시도해요. | 고른 튜터를 아직 계정에 저장하지 못했어요. 인터넷이 연결되면 다시 저장해요. |
| msg.tutorSaving | 선택과 학습 기록을 계정에 저장하고 있어요. | 고른 튜터와 학습 기록을 계정에 저장하고 있어요. |
| msg.recordsChanged | 다른 화면에서도 기록이 바뀌었어요. 저장 확인에서 사용할 기록을 골라 주세요. | 다른 화면에서 기록이 바뀌었어요. 이어 갈 기록을 먼저 골라 주세요. |
| msg.recordsCheckFirst | 기록을 확인한 뒤 다시 골라 주세요. | 기록을 읽지 못해 튜터를 저장하지 못했어요. 잠시 뒤 다시 골라 주세요. |
| msg.chooseInSaveCheck | 저장 확인에서 사용할 기록을 골라 주세요. | 이어 갈 기록을 먼저 골라 주세요. |
| msg.keptFirst | 보관된 진도를 먼저 확인해 주세요. | 저장하지 못한 진도가 있어요. 이어 갈 기록을 먼저 골라 주세요. |
| msg.chooseProgressFirst | 사용할 진도를 먼저 선택해 주세요. | 진도가 두 곳에서 달라요. 이어 갈 기록을 먼저 골라 주세요. |
| msg.checkExistingFirst | 기존 진도를 먼저 확인해 주세요. | 기존 진도를 읽지 못해 지금은 저장할 수 없어요. 잠시 뒤 다시 열어 주세요. |
| account.title | 계정 연결 | 로그인 |
| home.account.connect · connected · test | 계정 연결하기 · 계정 연결됨 · 시험 계정 연결됨 | 로그인하기 · 로그인됨 · 시험 계정 로그인됨 |
| account.oneIdBody | 학원에 공유하는 기록은… | 반에 공유하는 기록은… (뒤는 같음) |

- **첫 제안(④-1)과 달라진 곳은 던지는 조건을 보고 고쳤다.** `msg.learningChanged`는 로그인이 끝난 뒤의 저장 동작(life-ui의 연습 기록·하루 마침·한글 읽기)에서 던져서 「저장하지 못했어요」로 했다. `msg.tutorAccountFirst`·`tutorAfterConnect`는 조건이 「로그인 안 함」이 아니라 「진도가 아직 계정 범위로 묶이지 않음(scoped 아님)」이라 「계정 저장이 준비된 뒤/되면」으로 했다. 「저장 확인에서…」 계열은 실제로 고르는 창의 제목(`account.recoveryChoose` 「이어 갈 기록을 골라 주세요」 · `account.conflictTitle` 「이어 갈 진도를 골라 주세요」)과 같은 말로 맞췄다.
- **옛 글 별칭 `msg.accountChangedLegacy`(새 키 하나):** 「계정 연결이 바뀌었어요.」는 `synk-account/src`(client · local-world · platform-account · product-account 등)와 `desktop/renderer/platform-continuity.mjs`가 아직 던진다. 표의 ko만 바꾸면 WORLD에서 그 글이 번역되지 않아, 옛 한국어를 같은 en·mn으로 잇는 줄을 남겼다(주석: 그 모듈의 글을 바꾸면 지운다).
- **번역 대조**(`world-work\check-tmessage.mjs`): 원천이 던지는 새 글 25개와 옛 글 1개가 모두 영어·몽골어로 바뀐다(끊김 0). world-lang 시험(ko 겹침·몽골어 키릴 문자)도 통과 — 몽골어 칸에 「PC」를 쓸 수 없어 `Компьютерын`으로 썼다.
- **몽골어 검문**: `node tools/몽골어대조.js --파일 <묶음> --구독`을 7번 돌렸다(check-01~03 → 어색 4곳·맞춤법 1곳 고침 → recheck-01~02 → final-01·02로 고친 표 전체를 다시). 최종 두 묶음 모두 문법 「정상」. 맞춤법은 들어온 말·이름 꼴(аппыг · ID-г · Таун — 기존 줄의 `WORLD аппын`·`SYNK ID-гаар`·`SYNK Таун`과 같은 꼴)만 걸렸다. 종합 「공식 앱 뜻 검토 대기」(종료 2)는 이 도구가 늘 내는 끝이라(현장노트 AI_CLI 「몽골어 검문이 문제없이 끝나도 종료 코드가 2다」) 역번역을 줄마다 원문과 견줬다 — 32줄 모두 뜻이 같다. 기록: `experiences\brand-opening\qa\mn-check-20261021-copy-audit\README.md`(새 파일 · 묶음·결과 txt는 gitignore), `world-strings-check.json` 32줄과 요약(1158 · 정상 794 · 어색 묶음 364 · 이름 문제 3 · 깨끗 794), `docs\_ops\몽골어검문.jsonl` 7줄(도구가 붙임 · 작업본에 LF로 붙어 git이 줄 끝 경고를 내지만 diff는 +7/-0).
- 화면: `after2\08-account-panel-390.png`(제목 「로그인」 · 「반에 공유하는 기록은…」), `after2\05-home-390.png`(위 띠 「로그인하기」), `after2\03-tutor-choose-mongle-1440.png`(바닥 「고른 튜터는 이 기기에 저장돼요.」).
- 남긴 것: `app-shell.mjs:432` 「테스트 계정 연결하기」(리허설 모드 `connection.mode!=='account'`에서만 나오는 개발 단추), `teacher-world/app.mjs` 「계정 연결됨」(다른 영역), `desktop/renderer/member-settings.mjs`·`synk-account/dist/platform.js`의 「학습 연결이 바뀌었어요.」(WORLD tMessage를 거치지 않는 PC 앱·플랫폼 글).

### ④-4 튜터 말풍선 — 고침(첫 판에서 한 번 더 고침)

- `game-tutor.css` 휴대폰 세로(폭 599 이하 · 높이 501 이상): 말풍선 세 줄. 놀이 판(아래가 iframe)에서는 튜터 띠 높이를 두 줄 말풍선 높이로 고정하고, 셋째 줄은 말풍선이 위(머리 띠의 빈자리)로 자란다. 세 줄을 넘는 말은 끝이 「…」로 잘리고, 누르면 전체가 아래로 펼쳐져 놀이 위에 잠깐 겹친다(다시 누르거나 새 말이 오면 접힘). 폭 359 이하는 말풍선 안쪽이 작아 같은 식으로 높이만 따로 적었다.
- `game-tutor.mjs`: 잘린 말풍선을 누르면 `data-expanded`(줄이 넘칠 때만), 새 말이 오면 지운다.
- **왜 한 번 더 고쳤나:** 처음 판(세 줄만 허용)은 세 줄 힌트가 오면 놀이 iframe이 22px 밀리고 줄었다(위치 163→185). 대사 전부를 390에서 재 보니 반응 대사 54개는 모두 두 줄 이하, 힌트 대사 105개 중 46개가 세 줄이다(대부분 몽글·까몽의 문장 뜻 힌트, 넷 이상은 없음). 리듬 노래 도중(O·X 오답)과 바람길 달리는 중(타이밍)에도 오는 말이라 놀이 화면이 들썩였다. 띠 높이를 고정한 지금은 390·360·340에서 세 게임 모두 1·2·3줄·펼침 어느 때나 iframe 위치가 그대로(163, 340은 161)이고, 머리 띠 제목·닫기와 겹치지 않고, 화면 위로 잘리지 않는다. 1440은 바뀐 것이 없다. 첫 문장 놀이 시트(놀이 판이 아님)는 고정 규칙 밖이라 띠가 자연스럽게 늘어난다(잘림 없음).
- 캡처(`scratchpad\shots\world\`): `after-bubble\bubble-2-hint-390.png`(실제 힌트 세 줄 — 「같이 다시 찾아보자!」까지 보임), `after-bubble\bubble-long-clipped-390.png` → `bubble-long-tapped-390.png`(네 줄 말을 넣어 잘림 → 누르면 전체), `after-bubble2\{runner,rhythm,hangul}-{390,360,340}-{one,two,three,four,four-tapped}.png`, `after-bubble2\first-play-390-three.png`. 잰 값 `after-bubble2\verify.json`, 대사 줄 수 `bubble-lines\result.json`.

### ④-7 「레슨 보상」 — 사실이 아니어서 고침

- SYNK-talk `lib/world-v1-catalog.js`의 `STARTER_ITEMS`는 첫 산책 목도리를 뺀 전부이고, `lib/world-v1-domain.js`가 로그인한 계정의 옷장에 시작 옷을 채운다(`source:'starter'`). 목도리는 첫 문장 놀이를 처음 끝낼 때 한 번 받는다. 레슨에서 옷을 주는 규칙은 서버·원천 어디에도 없다.
- `wardrobe-studio.mjs` giftLabel 기본값 「레슨 보상」 → 「로그인하면 받아요」. 이 글은 gift가 「옷장 첫 선물」인 시작 옷이 아직 없을 때만 보인다(로그인 전 미리 보기 등). 목도리는 자기 gift 글 그대로.

### ④-8 · ④-10 — 고침

- `wardrobe-studio.mjs` 카드 상태 「입어 보는 중」 → 「입어 봄」: 390에서 한 줄(`after2\34y-wardrobe-item-390.png`, 로그 「trying card label 입어 봄 (1줄)」).
- `korean-rhythm/core.mjs` `LEVELS.normal.label`·`index.html` 칩 「리드미컬」 → 「보통」: 시험·QA에 「리드미컬」을 보는 곳이 없다(grep). `after2\15-rhythm-lobby-1440.png`·`-390.png`.

### ④-9 — 확인만(가려지지 않음)

- 말의 리듬 결과를 끝까지 내리면 「새 문장으로 한 번 더」 아래 글과 체험 카드가 아래 고정 띠 위로 다 보인다(가려진 요소 0, 1440·390). `check\17c-rhythm-result-scrolled-1440.png`·`-390.png`. 고치지 않았다.

### 바꾼 파일(후속)

- brand-opening: `world-strings.mjs`, `world-strings-check.json`, `game-tutor.css`, `game-tutor.mjs`, `qa\mn-check-20261021-copy-audit\README.md`(새)
- synk-world-app: `app-shell.mjs`, `world-account.mjs`, `device-records.mjs`, `tutor-selection-sync.mjs`, `life-progress.mjs`, `life-progress-port.mjs`, `life-ui.mjs`, 시험 `qa\tutor-selection-sync.test.mjs`(`/이 기기에 보관/` → `/이 기기에 두었/`, 뜻 그대로)
- synk-world-home: `wardrobe-studio.mjs` · korean-rhythm: `core.mjs`, `index.html` · 장부 `docs\_ops\몽골어검문.jsonl`(+7줄)

### 시험(기준선 → 지금)

| 묶음 | 기준선 | 후속 뒤(after3) | 말풍선 마지막 판 뒤(after5) |
|---|---|---|---|
| WORLD qa 비브라우저 | 513/518 | 513/518 | (CSS만 바뀜 — 다시 안 돌림) |
| brand-opening qa | 133/134 | 133/134 | 133/134 |
| 놀이 공통·게임 셋 | 229/229 | 229/229 | (다시 안 돌림) |
| 뿌리 tests | 110/110 | 110/110 | (다시 안 돌림) |
| WORLD 브라우저 | 4/6 | 4/6 | 4/6 |

실패 이름·원인은 모두 기준선과 같다(frozen /world 4 · 소개 카드 정본 1 · 브라우저 2). 바꾼 .mjs `node --check` 통과.

### 총괄이 마지막에 꼭 돌릴 것

- `node tools/build-world-account.mjs` — 지금 `world-account.bundle.mjs`에는 옛 글(「활성화된 SYNK ID를 확인해 주세요.」 · 「교실 연결을 확인하지 못했어요.」 등)이 들어 있다. 표의 ko가 바뀌어서 **묶음을 다시 만들기 전에는 이 옛 글이 영어·몽골어로 번역되지 않는다**(「계정 연결이 바뀌었어요.」만 별칭으로 번역됨). 반드시 다시 만든 뒤 올린다.
- `node tools/check-account-bundles.js --build` — 첫 단계의 account-host 변경 몫(이번 후속에서 account-host는 건드리지 않았다).

## 아르곤 처리(10-22 · 맵 10-argon)

반영 3 · 일부 2 · 안 함 2. 지적마다의 처리와 이유, 시험(전후 같음), 캡처(`shots\world\after-argon\`)는 `C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\argon\world-handling.md`에 있다.
