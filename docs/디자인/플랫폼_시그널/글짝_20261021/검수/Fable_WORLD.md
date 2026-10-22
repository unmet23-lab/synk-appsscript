# Fable 최종 검수 — SYNK WORLD (2026-10-22)

**판정: 그대로 공개** — P0 0 · P1 0 · P2 7 · P3 6

바탕: 작업본 HEAD 8a2d7bea0 대비 바뀐 47개 파일(원천 34 + 시험 2 + 번역 표·검문 기록 + 생성물 `world-account.bundle.mjs`·`collection.js` 12). 공통 안내의 네 가지(화면·글·동작·전후 비교)를 보았고, 의뢰서의 「특히 볼 것」 넷은 아래 「확인한 것」에 결과를 적었다.

## 확인한 것(문제 없음)

- **해요체·「로그인」 용어·「확인해 주세요」 끝맺음(바꾼 글 기준)**: diff의 더한 줄에 합쇼체 0, 바꾼 글 184곳+후속 31줄+아르곤 8곳 모두 원인+다음 행동 꼴. 바꾼 글 안에서는 「계정 연결」(로그인 뜻) 0. 남은 옛 꼴은 아래 P2-4.
- **영어·몽골어 번역**: `world-work\check-tmessage.mjs` 재실행 — 원천이 던지는 새 글 25 + 옛 별칭 1 모두 en·mn으로 바뀜(끊김 0). 내가 손님 흐름을 영어·몽골어로 다시 찍었다(`fable\world-extra\lang\{en,mn}-390-*.png`, en-1440). 튜터 고르기 바닥 「Your tutor is saved on this device.」/「Сонгосон багш энэ төхөөрөмжид хадгалагдана.」, 홈 띠 「Sign in · My account」/「Нэвтрэх · Миний бүртгэл」, 설정·놀이 판 모두 그 언어. 뜻은 한국어와 같다(32줄 역번역 대조는 검문 기록대로 믿음).
  - 단, **로컬 서버에서만** app-shell이 그리는 시트(로그인·내 계정·싱크타운·알림 설정 칸)가 처음 언어를 고른 그 세션에서 한국어로 남는다 — 원인과 라이브 확인은 P3-1. 공개본(synk.im/world)은 정상.
- **튜터 말풍선(390·360·340)**: `after-bubble2\verify.json` 측정값 + 캡처 — 1·2·3줄·펼침 어느 때나 iframe 위치 163(340은 161) 그대로, 겹침 0, 세 줄 힌트 끝(「같이 다시 찾아보자!」)까지 보임(`after-bubble\bubble-2-hint-390.png`, `after-bubble2\{runner,rhythm,hangul}-390-three.png`), 넘치는 말은 「…」 → 누르면 전체(`*-four.png` → `*-four-tapped.png`). 첫 문장 놀이 시트는 띠가 자연스럽게 늘어남(`first-play-390-three.png`). 1440 변화 없음.
- **옷장 카드 상태**: 최종은 「고르는 중」(아르곤 처리, 의뢰서의 「입어 봄」은 그 전 판) — 390·1440 한 줄(`after-argon\wardrobe-trying-390.png`·`-1440.png`), 아래 띠 「미리 입어 보는 차림 · 고르던 차림은 이 기기에 남아요」와 뜻이 맞음. 잠긴 옷 「로그인하면 받아요」는 코드(`wardrobe-studio.mjs:24`)로 확인(로그인 전 미리 보기에서만 보이는 글이라 캡처 없음).
- **리듬 난이도 「보통」**: `after2\15-rhythm-lobby-1440.png` 편하게 · 보통 · 도전. 시험·QA에 「리드미컬」 없음(README·옛 QA json만).
- **하루 돌아보기 「우리 동네로」**: `after2\05c-home-recap-390.png`·`-1440.png` — 제목 「오늘 돌아보기」, 빈 글 「레슨에서 표현을 만나면 여기에 모여요.」, 「이 기기에 저장돼요.」, 단추 「오늘 마무리하기」(기록 없어 비활성)·「우리 동네로」, 아래 「마무리해도 하던 레슨과 카페는 이어서 할 수 있어요.」
- **기억 액자**: 3D 액자 「오늘 배운 표현이 / 아직 없어요.」 두 줄 깔끔(`after-argon\room-memory-frame-zoom-390.png`), 창 「2026-10-22 · 오늘 배운 표현이 아직 없어요 · 레슨을 하나 끝내면…」(`memory-panel-390.png`).
- **조작 연습 대사**: 말의 리듬 1단계가 「왼쪽 단추 눌러 보기 / 오! 왼쪽 단추를 눌렀어! 너도 같이 눌러 보자!」(`after2\14-rhythm-tutor-practice-390.png`) — 전(`before\14-…`)의 「왼쪽 단추 만나기 / 왼쪽 단추로 한 칸 옮겼어!」가 고쳐짐. 바람길은 「왼쪽으로 한 칸」 제목 그대로(바람길에선 맞는 말).
- **생성물**: `world-account.bundle.mjs`(09:41 재생성, 한글은 `\uXXXX`)를 풀어 센 결과 WORLD 원천의 새 글 16종 모두 들어 있고 옛 글 0(`fable\world-extra\bundle-check.cjs`). `tutor-selection-sync`·`life-progress`는 묶음 밖 개별 파일이라 0이 맞다. `collection.js` 사본 12개는 play-common과 바이트 동일, 모두 CRLF. 계정 포털 `synk-account/dist` 4파일(app·client·local-world·preview)에 account-host의 새 글 「게임 기록과 산 물건이…」 포함, 옛 글 없음.
- **시험**: `node --test` world-lang · tutor-choice-sync · tutor-selection-sync · rhythm audio · tutor-support · game-tutor · home-tutor · tutor-practice · life-tutor = 88/88.
- **전후 비교로 나빠진 곳**: 없음. 가로 넘침·페이지 오류 0(캡처 로그), 내 en·mn 캡처도 `errors []`.

## 지적

[P2] `experiences/synk-world-app/app-shell.mjs:444`(싱크타운 시트 MY TOWN·SHARING) ↔ `experiences/brand-opening/world-strings.mjs:816`(`account.oneIdBody`) — 같은 「반에 보여 주는 활동 공유」를 로그인 시트는 「반에 공유하는 기록은…」, 타운 시트는 「학원에 보여 줄 활동은 아래에서 따로 골라요」·「학원 공유는 소속 반이 연결되면…」·「타운 활동을 학원에 공유하기」로 부른다(표 858·865의 `account.*`도 「학원」). 아르곤 지적으로 한 줄만 「반」으로 바꿔 용어가 갈렸다 — 근거: `after2\07-wardrobe-390.png`(반에 공유하는 기록은…) · app-shell.mjs:444 원문(operating 모드 로그인 뒤 town/state 응답에 binding이 있을 때 보임) — 고칠 방향: 한 낱말로 통일(학습자가 아는 말은 「반」. 타운 시트 세 곳과 표 858·865를 「반」으로, en·mn 짝도 함께).

[P2] `experiences/synk-world-app/tutor-selection-sync.mjs:84` `msg.entryAccount` 「로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.」 — 이 catch는 입장 준비(restore·prepare·read) 중 **모든** 오류를 받는다(인터넷 끊김·서버 오류·손님의 로컬 저장 오류 포함). 그 자리에 같이 뜨는 복구 시트(`app-shell.mjs:181-183` `showEntryRecovery`)는 제목 「연결을 다시 확인해 주세요」(표 830), 본문 「…연결을 확인한 뒤 다시 시작해 주세요」(832), 단추 「다시 연결하기」(833)라 상태 줄(`home.mjs:127`)은 「다시 로그인」을, 단추는 「다시 연결」을 말한다. 로그인한 적 없는 손님이나 인터넷이 잠깐 끊긴 사람에게 「다시 로그인해 주세요」는 틀린 안내다(옛 글 「…다시 연결해 주세요」는 단추와 맞았다) — 근거: 위 파일:줄, 상태를 웹에서 만들 수 없어 캡처 없음 — 고칠 방향: 원인을 모르는 catch-all이므로 「입장 준비를 마치지 못했어요. 「다시 연결하기」를 눌러 주세요.」처럼 시트 단추 이름으로 맞추고, 인증 오류(`authErrors`)일 때만 로그인 안내를 쓴다. en·mn 함께.

[P2] `experiences/synk-world-home/wardrobe-studio.mjs:142` ↔ `:193` — 차림 저장이 REVISION_CONFLICT로 막히면 피드백 줄은 「다른 화면에서 차림이 바뀌었어요. **옷장을 다시 열어** 최신 차림에서 골라 주세요.」(193), 같은 화면의 대기 상자는 「다른 화면에서 차림이 바뀌었어요. **「계정의 최신 기록 보기」를 누른 뒤** 다시 입어 주세요.」(142)를 보인다. `adopt()`(196-201)가 같은 상태 갱신에서 `pending`·`serverStatus='conflict'`를 함께 넣으므로 둘이 동시에 뜬다 — 한 상황에 다음 행동이 둘 — 근거: 위 줄, 충돌 상태는 합성 서버로 못 만들어 캡처 없음 — 고칠 방향: 193을 상자와 같은 말(단추 이름)로 맞추거나, 상자가 보일 때는 피드백 줄을 비운다.

[P2] 같은 꼴의 옛 글이 WORLD 화면에 남아 있다(이번에 손대지 않은 줄 — 「확인해 주세요」로 끝나 할 일이 없거나 「연결」이 로그인·저장을 뜻함). 사용자가 실제로 만나는 순서로:
- `world-strings.mjs:872-875` `account.gameStopped*` 「놀이 연결이 끊겼어요 / 놀이 기록 연결이 멈췄어요 / 내 계정의 연결 상태를 확인한 뒤 다시 들어와 주세요. / 내 계정 확인하기」 — `app-shell.mjs:541`에서 게임 중 로그아웃·계정 바뀜으로 호스트가 멈출 때. 호스트 글은 「로그인이 끝났어요.」로 바뀌었는데 시트는 옛 말이고, 같은 `data-world="profile"` 단추가 타운 시트에선 「내 계정 열기」, 여기선 「내 계정 확인하기」다. `877-878` `account.gameCheck*`(`app-shell.mjs:542`)도 같다.
- `world-strings.mjs:49` `home.entryError` 「연결을 다시 확인해 주세요.」, `830-833` 입장 복구 시트(위 P2-2와 한 묶음).
- `world-strings.mjs:712` `life.checkProgress.note` 「기록은 지우지 않았어요. 내 계정에서 연결 상태를 확인해 주세요.」 — `life-ui.mjs:189`에서 새 글 「기존 진도를 읽지 못해 지금은 저장할 수 없어요. 잠시 뒤 다시 열어 주세요.」 바로 아래에 붙어 한 창에 다음 행동이 둘.
- `synk-world-app/app-shell.mjs:140` 옷장 상태 「다른 화면에서 바뀐 내용을 확인해 주세요.」(`client.status==='conflict'`), `:546`·`world-learning-ui.mjs:218·296` 「도움 방식 저장을 다시 확인해 주세요.」, `world-account.mjs:128` 「계정의 게임 저장과 학습 설정을 다시 확인해 주세요.」, `:161`(`msg.lifeSaveConnection`, 표 974) 「계정의 생활 한국어 저장 연결을 확인해 주세요.」
- `synk-world-app/world-game-host.mjs:21` 「게임 계정 연결이 끝났어요.」 — account-host의 짝(「로그인이 끝나 이 계정에 게임 기록을 저장할 수 없어요.」)만 바뀌었고 이 줄은 표에도 없어 en·mn에서 한국어로 남는다.
- `world-strings.mjs:893` `records.failed` 「옮기지 못했어요. 연결을 확인한 뒤 다시 골라 주세요.」, `927` `msg.tutorConnect`, `930` `msg.cafeCheck`(`app-shell.mjs:651` 토스트), `862` `account.logoutFailed` 「…서버 연결을 다시 확인해 주세요.」
- `synk-world-home/wardrobe-studio.mjs:210`「…최신 목록을 확인해 주세요.」·`:233`「…바뀔 내용을 다시 확인해 주세요.」·`:352`「…최신 차림을 먼저 확인해 주세요.」, `korean-runner/listening-check-ui.mjs:122` 「…WORLD에서 학습 목표를 다시 확인해 주세요.」
근거: 각 파일:줄(모두 오류·막힘 갈래라 캡처 없음) — 고칠 방향: 이번 31줄과 같은 식으로 원인+다음 행동(무엇을 어디서)으로, 표에 있는 줄은 ko·en·mn 함께. 공개를 막을 급은 아니다.

[P2] 몽골어 홈 튜터 카드 — `fable\world-extra\lang\mn-390-05-home.png`: 튜터 말 아래 설명이 「Дасгалын мэдээлэл одоохондоо цөөн байна. Богино дасгал хийхийн хэрээр танд таарул…」로 둘째 문장 끝이 잘린다(`home.css:86` `#home-tutor .home-tutor-context` `-webkit-line-clamp:2`; 한국어 「아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.」 한 줄, 영어 두 줄 꽉 참 `en-390-05-home.png`). 이번 변경 밖이지만 학습자 화면의 잘림 — 고칠 방향: mn은 세 줄 허용하거나 mn 문장을 줄인다.

[P2] 몽골어 놀이 판 — `fable\world-extra\lang\mn-390-06-play-panel.png`: 「한글 만나기」 카드 제목 「Солонгос үсэгтэй танилцах」가 세 줄로 접히며 첫 줄 「Солонг…」과 머리글 「02 · HANGU」가 떠 있는 그림 밑에 깔린다(영어도 「03 · RHYTH」 머리글이 잘림 `en-390-06-play-panel.png`; 한국어는 「02 · HANGUL」·「03 · RHYTHM」 온전 `after2\06-play-panel-390.png`). 이번 변경 밖 — 고칠 방향: 390에서 카드 글 칸의 오른쪽 여백을 그림 폭만큼 두거나 그림을 줄인다.

[P2] `experiences/play-common/account-client.mjs:32` 영어 짝 `stopped:'Account connection ended.'` — 같은 띠에 「한국어 / 영어」로 붙는데 한국어는 「로그인이 끝났어요.」로 바뀌었고 영어는 옛 뜻(「연결」) 그대로다(`conflict`의 「…on your account page.」는 단추 「계정 페이지 열기」와 맞음) — 근거: 파일:줄(게임 띠, 호스트가 멈춘 상태라 캡처 없음) — 고칠 방향: 「You’re signed out. Sign in again to keep saving.」처럼 맞춘다.

[P3] **로컬 서버(server.mjs)에서만** 화면 언어가 둘로 갈린다 — 환경 문제, 공개본은 정상. `app-shell.mjs:20`의 `../brand-opening/world-lang.mjs`가 `/world/app-shell.mjs` 기준 `/brand-opening/world-lang.mjs`로 풀리고(`server.mjs:90` 경로), `home.mjs`는 `worldUrl('brand-opening/home.mjs')`(`app-shell.mjs:35`)로 `/world/brand-opening/…`에서 열려 `world-lang.mjs`가 **두 URL·두 인스턴스**가 된다. 언어 고르기는 home 쪽 인스턴스에만 닿아, 처음 고른 세션에서는 synk-world-app 모듈 7개(app-shell·life-ui·world-learning-ui·world-reminder-device·display-language-sync·speaking·writing)가 `t()`를 한국어로 돌린다 — 근거: `fable\world-extra\lang\probe-log.txt`(모듈 목록 두 벌, `pick-en`은 로그인 시트 한국어 · `saved-en`(저장된 언어로 새로 열기)은 영어), `lang\en-390-07-wardrobe-guest.png`·`mn-390-07-…`·`en-390-09b-settings-bottom.png`(REMINDERS 칸 한국어). 라이브 `https://synk.im/world/`는 공개 빌드가 `./brand-opening/`으로 다시 써서 인스턴스 하나이고, 손님으로 영어를 고르자 로그인 시트가 영어로 나왔다(`lang\live-en-07-wardrobe-guest.png`, `probe-live-log.txt`; 옛 판이라 제목은 「Connect an account」). — 고칠 방향: server.mjs가 `/brand-opening/*`를 `/world/brand-opening/*`로 301 보내거나 app-shell이 `worldUrl` 기준으로 world-lang을 들여오게. 그 전까지 로컬 서버의 en·mn 캡처는 「언어를 먼저 저장한 뒤 새로 연」 것만 믿을 수 있다(현장 노트감).

[P3] `experiences/brand-opening/home-tutor-recap.mjs:7` 닫기 단추 「우리 동네로」 — 이 단추는 `onClose:closeRecap`으로 창만 닫는다(`home-tutor.mjs:25`). 여는 단추(`home-tutor.mjs:84`, 오늘 기록이 있을 때만 보임)는 `#home-tutor` 카드에 있고 그 카드는 3D 방에도 있어(`after-argon\room-memory-frame-390.png`), 방에서 닫으면 방에 남는데 글은 「우리 동네로」라 방의 뒤로 단추 「동네로」와 헷갈릴 수 있다 — 고칠 방향: 「닫기」 또는 「돌아가기」. (참고: `after2\05c` 빈 상태 캡처는 숨은 단추를 강제로 눌러 찍은 것이라, 「레슨에서 표현을 만나면 여기에 모여요.」는 실제로는 거의 안 보이는 글이다.)

[P3] `experiences/play-common/collection-adapter.js:108` 「오늘의 공통 코인 보상 10회분을 모두 받았어요.」(보상 결과 글) ↔ `:70` 「오늘 받을 수 있는 코인 보상 10번을 다 받았어요. 놀이는 계속할 수 있고, 코인은 내일 다시 모여요.」 — 같은 한도를 두 말로. 다른 자리(결과 토스트 / 보상 안내)라 P3 — 고칠 방향: 108도 「오늘 받을 수 있는 코인 보상 10번을 다 받았어요.」로(레이싱 QA 짝 확인).

[P3] 리허설(개발) 모드 로그인 시트 — `after2\31-rehearsal-signin-390.png`: 「웹과 Unity 앱은 같은 로컬 서버 계약을 써요. 실제 계정 연결은 네이티브 인증을 설정한 뒤 확인해요.」(`account.testNote`, 표 827), `app-shell.mjs:444` 「테스트 계정 연결하기」 — 내부 말이지만 공개 빌드(`mode=account`)에는 나오지 않는다. 그대로 둬도 됨.

[P3] `world-account.bundle.mjs`에 남은 옛 꼴 4개는 다른 영역 모듈 것 — `synk-account/src/world-classroom.mjs:80` 「과제 연결을 확인하지 못했어요.」(WORLD 「내 계정」의 반 과제 칸에 보임 — 짝인 `course-writing-entry.mjs`는 「과제 목록을 불러오지 못했어요…」로 바뀜), `synk-account/src/{client,desktop-account,product-account}.mjs` 「계정 연결을 확인하지 못했어요.」, `teacher-world/course-writing-ui.mjs:73·121` 「과제 연결을…」·「작성 중인 글을 닫고…」 — 포털·교사 담당에게 같은 말로 맞추기를 넘긴다.

[P3] 로그인 시트 `account.oneIdBody` 「반에 공유하는 기록은 내 계정의 동의 설정을 따라요.」가 반이 없는 손님에게도 보인다(`after2\07-wardrobe-390.png`) — 옛 「학원」도 같았고 뜻은 맞다. 「반에 들어가면 공유하는 기록은…」처럼 조건을 넣으면 더 쉽다. 취향.

## 본 범위 / 못 본 범위

- **본 범위**: HEAD 8a2d7bea0 대비 WORLD 47개 파일 diff 전부(원천·표·시험·생성물), 캡처 `after2` 75장·`after` 1440 리허설 10장·`after-argon` 9장·`after-bubble` 5장·`after-bubble2` 10장(+verify.json 전부)·`check` 2장·`before` 6장 비교, 내가 찍은 영어·몽골어 손님 흐름 39장(`fable\world-extra\lang\`)과 로컬 두 시나리오·라이브 탐침, tMessage 대조 26줄, 묶음 글 대조, 포털 dist 포함 여부, 시험 9파일 88개.
- **못 본 범위**: PC 앱 다리에서만 나오는 `msg.worldAccount` 실제 화면, 로그인 뒤 오류 갈래(저장 실패·충돌·계정 바뀜·호스트 멈춤)의 실화면(코드 조건으로만 봄), 몽골어 문장 품질(검문 기록을 믿음), 게임 진행 중 실제 타이밍에 오는 말풍선(측정값·정지 캡처만), 공개 빌드 실행(안 돌림 — 라이브 구조와 빌드 코드로 대신 확인), 다른 게임 폴더의 `collection.js` 화면(레이싱 등), `synk-account/dist` 내용 전체(새 글 포함 여부만).
