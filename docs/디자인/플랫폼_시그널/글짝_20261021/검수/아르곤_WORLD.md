# WORLD — 아르곤 검수 처리 (2026-10-22)

묶음: `world-A.txt` → 답 `world-A-answer.json`(판정 「고친 뒤」, P1 4 · P2 3). 지적마다 실제 코드에서 그 글이 나오는 조건을 보고 처리했다. 짝 맵: `maps\world\10-argon.json`.

## 결과 — 반영 3 · 일부 2 · 안 함 2

| 지적 | 처리 |
|---|---|
| P1 `msg.worldAccount` 「PC 앱을 최신 판으로 업데이트한 뒤…」가 웹·휴대폰에도 나온다 / 「판」 | 일부 — 이 글은 PC 앱 다리(`globalThis.synkDesktop`에 `accountRequest`·`authStatus`가 있을 때)에서만 도는 `prepareNative()`에서만 던진다. 옛 PC 앱이라 `getEnvironment`·`onAuthChanged`·`authSignIn`·`authSignOut`이 없거나, 다리가 WORLD 창이 아닐 때(`clientId!=='world'`)다. 웹·휴대폰 브라우저에는 다리가 없어 이 갈래가 돌지 않으므로 「PC 앱」 안내가 맞다(제안한 「새로고침」은 PC 앱의 옛 판을 고치지 못한다). 「최신 판」만 PC 앱 화면의 말(「최신 버전 확인」 단추·「최신 버전이에요」)에 맞춰 「최신 버전」으로 바꿨다(world-strings ko + world-account.mjs 두 곳). en·mn은 이미 version이라 그대로 — 몽골어 줄이 바뀌지 않아 final-01 검문 기록(해시 같음)이 그대로 유효하다. tMessage 대조 통과 |
| P1 account-host 「계정에 저장하고 있어요. 저장하지 못한 기록 N개는…」 진행형 | 반영 — `phase==='synced'`는 저장 대기가 빈 뒤(`pending().length`가 0)에만 온다. 「계정에 저장했어요. 기록 N개는 저장하지 못해 이 기기에 남겨 뒀어요.」 같은 상태의 게임 계정 띠 영어(account-client.mjs)도 옛 뜻(「Connected. Unprocessed requests…」)이라 「Saved to your account. N record(s) couldn’t be saved and stay on this device.」로 맞췄다. 계정 포털 `synk-account/src/account-view.mjs:76`에도 같은 옛 영어가 붙는다 — 다른 영역이라 손대지 않음(같은 영어로 바꾸기를 포털 담당에 제안) |
| P1 collection-adapter 「저장 공간을 쓸 수 없어…」 — 옛 글·영어와 뜻, 다음 행동 | 반영(글은 다시 씀) — 이 글은 저장소가 막혔거나(`store` 없음) 지갑·기록을 못 읽었거나(`load` 실패·기록 읽기 오류) 할 때 나온다. 용량이 모자란다는 뜻으로 읽히는 「저장 공간」은 틀렸고 다음 행동도 빠졌다. 「저장된 기록을 읽지 못해 보상 안내를 못 불러왔어요. 잠시 뒤 다시 열어 주세요. 배우는 건 언제나 무료예요.」 / en 「Couldn’t read your saved records, so reward guidance didn’t load. Please open it again later. Learning stays free.」 공통 컬렉션 사본 12개를 생성기로 다시 만들었다(바뀐 줄은 이 두 줄과 account-client 한 줄뿐, 사본 12개 같음) |
| P1 living-home-scene 「앨범 사진」/「아직 배운 표현이 없어요」 짝 | 일부 — 지적한 불일치는 없다. 표현이 있으면 그 표현이 그대로 보이고, 「앨범 사진」은 표현 없이 사진만 있을 때 사진 옆에 붙는 글이다(제안한 「모은 기록」은 사진 옆 글로 더 흐리다). 대신 확인하다 다른 문제를 찾았다. 액자는 「오늘」 연습한 표현만 보여서(`home-memory` → `homeTutorDays().today`), 어제까지 배운 사람에게 「아직 배운 표현이 없어요」는 틀린 말이다. 그래서 「오늘 배운 표현이\n아직 없어요.」로 고쳤다 — 캔버스가 글자 단위로 끊어 한 줄로 쓰면 「…아직 없/어요」로 갈려서 줄을 직접 나눴다. 액자를 누르면 여는 「기억 액자」 창(home.mjs)도 같은 말로 바꿨다(날짜·「오늘 배운 표현 보기」 단추와 맞음) |
| P2 「입어 봄」 — trying 상태 뜻과 말투 | 반영(제안과 다른 글) — trying은 고른 옷이 미리 보기에 올라 있고 아직 저장 전인 상태다. 「착용 중」은 저장된 「입는 중」과 뜻이 겹치고, 「입어 보기」는 단추(행동) 말이라 상태로 맞지 않는다. 「입는 중」과 짝인 「고르는 중」으로 바꿨다(아래 안내 「고르던 차림은 이 기기에 남아요」와 같은 말). 후보 9개를 390·360에서 실측했는데 두 줄로 넘는 것은 「입어 보는 중」(390)뿐이었고, 「고르는 중」은 1440·390 모두 한 줄 |
| P2 game-tutor-support 「노트가 선에 닿을 때」 | 안 함 — 말의 리듬 화면이 이미 「노트」를 쓴다: 방법 안내 「노트가 크림색 선에 닿을 때 아래 O·X 단추를 눌러요」, 진행 중 힌트 「골랐어요. 노트가 선에 닿을 때 한 번 더 눌러요.」, 멈춤 「음악·문장·노트가 함께 멈췄어요」, 튜터 안내 「노트가 크림색 선에 닿을 때 누른다」, 연습 「긴 노트 끝까지」. 맵 05에서 뺀 것은 「음원과 노트의 길이가 달라요」라는 기술 오류 글 전체이지 낱말 「노트」가 아니다. 같은 화면에서는 같은 말로 부른다 |
| P2 app-shell 「다른 기기에서 로그인해도 이어져요」 주어 | 안 함 — 이 문장은 싱크타운 알림의 본문이고, 바로 위 굵은 제목이 「타운 기록은 SYNK ID에 저장돼요」라 무엇이 이어지는지 제목이 말한다. 「기록은」을 붙이면 제목을 되풀이할 뿐이다 |

## 바꾼 파일

- brand-opening: `world-strings.mjs`(msg.worldAccount ko), `home.mjs`(기억 액자 창 빈 글)
- synk-world-app: `world-account.mjs`(두 곳)
- play-common: `account-host.mjs`, `account-client.mjs`(영어 짝), `collection-adapter.js`, 생성물 `collection.js` 12개(play-common · korean-racing · korean-rhythm · korean-runner · blank-slice · entry-check · story-classroom · talk-rally · order-rush · word-magic · spaceship-coop · learning-hub, 줄 끝 CRLF로 맞춤)
- synk-world-home: `living-home-scene.mjs`, `wardrobe-studio.mjs`

## 시험(아르곤 처리 전 → 후)

| 묶음 | 전(after5) | 후(after7) |
|---|---|---|
| WORLD qa 비브라우저(앱) | 513/518 | 513/518 |
| brand-opening qa | 133/134 | 133/134 |
| 놀이 공통·게임 셋 | 229/229 | 229/229 |
| 뿌리 tests | 110/110 | 110/110 |
| WORLD 브라우저 | 4/6 | 4/6 |

실패는 모두 전과 같은 이름·원인이다(frozen /world 4 · 소개 카드 정본 1 · 브라우저 2). 바꾼 파일은 `node --check`를 통과했다.

## 캡처(`scratchpad\shots\world\after-argon\`, 2배 해상도)

- `room-memory-frame-1440.png`·`-390.png`, 확대 `room-memory-frame-zoom-1440.png`·`-390.png` — 3D 방 액자 「오늘 배운 표현이 / 아직 없어요.」(두 줄로 깔끔하게 나뉨)
- `memory-panel-1440.png`·`-390.png` — 「기억 액자」 창: 날짜 · 「오늘 배운 표현이 아직 없어요」 · 「레슨을 하나 끝내면 배운 표현이 여기에 걸려요.」
- `wardrobe-trying-1440.png`·`-390.png` — 고른 옷 카드 「● 고르는 중」(한 줄), 아래 안내 「미리 입어 보는 차림 · 고르던 차림은 이 기기에 남아요」
- msg.worldAccount(옛 PC 앱 다리에서만), account-host 저장 실패 기록, 보상 안내 막힘은 그 상태를 웹에서 만들 수 없어 캡처하지 않았다. 대신 코드 조건과 tMessage 대조로 확인했다.

## 총괄이 마지막에 돌릴 것

- `node tools/build-world-account.mjs` — 지금 묶음에는 「PC 앱을 최신 판으로…」와 account-host의 옛 글이 들어 있다. 다시 만들기 전에는 표의 새 ko(「최신 버전」)와 글자가 달라서 이 글이 영어·몽골어로 번역되지 않는다.
- `node tools/check-account-bundles.js --build` — account-host가 계정 포털 묶음(synk-account/dist)에 들어간다.
