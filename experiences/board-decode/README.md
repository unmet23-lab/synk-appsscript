# 게시판 해독

SYNK WORLD 미니게임. 태오 선배가 수업 중에 공지를 봐 달라고 하면, 캠퍼스 게시물을 읽어 답장을 고른다. 낱말 하나(보관 ↔ 폐기, 연기 ↔ 취소)로 답이 뒤집히고, 잘못 읽으면 그 일이 선배에게 벌어진다. TOPIK 3→4급 읽기 판이다. 설계 · 근거: [설계.md](설계.md), 작은 시험: [qa/small-test-20261104](qa/small-test-20261104/README.md).

- 띄우기: `PORT=5208 node experiences/board-decode/server.mjs` → `/index.html`(`?lang=ko|en|mn` · `?seed=7` · `?round=laundry&auto=1`). 앱에서는 `.game-frame` 틀 안에서 열린다.
- 시험: `node --test experiences/board-decode/core.test.mjs experiences/board-decode/sfx.test.mjs experiences/board-decode/review.test.mjs`. 공략 시험(정정 칸 · 앨범 · `ko2` 사건)과 원고 규칙(밑줄 말마다 열쇠 칸, 보기에 쉬운 뜻 없음, 게시물 90음절)이 `core.test.mjs`에 있다.
- 나누기: `core.mjs` 규칙 · `content.mjs` 판 원고 · `app.mjs` 화면 · `sfx.mjs` 소리 · `strings.mjs` 바깥 글 · `review-items.mjs` 문항 검수 원본(게임에 안 실림).
- 연필 메모 서체: `assets/fonts/board-pencil.woff2`(Nanum Pen Script에서 메모 글자만, 안쪽 이름은 Board Pencil · 라이선스 글은 옆 `board-pencil-OFL.txt`). 메모 글을 고치면 `node experiences/board-decode/qa/서체굽기.mjs <원본 ttf>`, 원본은 공용 작업본 `.tmp/board-decode-20261104/서체/`(git 밖).
- 사진에는 글자가 없다. 글은 전부 화면이 얹는다. 지시문 `qa/지시문/`, 구운 원본은 공용 작업본 `.tmp/board-decode-20261104/`(git 밖), WebP 만들기 `qa/웹판.py`.
- 화면 확인: `node experiences/board-decode/qa/판돌리기.cjs <폴더> 390x844,1280x800,360x640`(세 판 끝까지), `qa/키보드.cjs`(키보드 · 포커스 · 앱 소리 설정 · 끝 화면), `qa/접근성.cjs`(화면마다 axe), `qa/앱화면.cjs`(앱 안 잠김 · 열림), `qa/후보시험.cjs <빈 폴더> <사건 JSON> <사진 폴더>`(라이브 synk.im에서 잠긴 카드 · 한 판, 사건은 `qa/후보시험자료.mjs`).
- 공개: 11-05에 게임 폴더와 입구 줄을 나눠 올렸다. `qa/공개후보.cjs`는 그 첫 공개용이다 — 입구 줄이 공개본에 들어간 지금은 앵커에서 멈춘다. 게임만 고칠 때는 `world/board-decode` 파일만 `tools/공개.js`로 올린다.
- 판을 더하려면: `content.mjs`에 게시물 · 갈림 쌍 · 칸 · 정정을 쓰고, 지시문으로 사진을 굽고, 시험을 돌린 뒤 `node tools/topik-review.mjs 준비 <이름> --기존 board-decode`로 2중 검수를 태운다.
- 학습 기록은 이 게임의 저장소(`synk.board-decode.v1:<계정>`)에만 둔다. Trail에 `ko2.*` 사건을 남기지 않는다(10-22 결정 — TOPIK II 근거는 시험 꼴 문항에서만).
