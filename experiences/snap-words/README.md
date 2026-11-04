# 찰칵 낱말

SYNK WORLD 미니게임. 1인칭으로 장소를 둘러보며 판과 물건을 찍고, 태오의 부탁으로 찾고, 인화에서 이름을 붙인다. 설계 · 근거: [설계.md](설계.md).

- 띄우기: `PORT=5207 node experiences/snap-words/server.mjs` → `/index.html`(`?look=phone|film` · `?lang=ko|en` · `?seed=7`). 앱에서는 `.game-frame` 틀 안에서 열린다.
- 시험: `node --test experiences/snap-words/core.test.mjs experiences/snap-words/places.test.mjs experiences/snap-words/sign.test.mjs experiences/snap-words/sfx.test.mjs experiences/snap-words/learning.test.mjs experiences/snap-words/review.test.mjs experiences/snap-words/album.test.mjs` — `places.test.mjs`가 꼬리표 시험(글자를 안 읽고 풀리지 않는지)이고, `album.test.mjs`가 계정 저장 · 합치기다.
- 브라우저 확인: `qa/앱화면.cjs`(앱 틀 안 390 · 1280 한 판) · `qa/고친곳.cjs`(검수 지적을 고친 자리) · `qa/접근성.cjs <주소> <폴더>`(입구부터 앨범까지 화면마다 axe, 배포 점검은 첫 화면만 본다) · `qa/공개묶음동기화.cjs [--후보 <폴더>]`(공개본 계정 묶음과 학습 기록이 맞물리는가) · `qa/계정저장.cjs <폴더>`(실제 게임 + 실제 놀이 호스트 + 가짜 서버로 새 프로필 복원 · 기기 앨범 옮기기 · 합치기 · 저장 실패).
- 나누기: `core.mjs` 규칙(판 짜기 · 부탁 · 판정 · 앨범) · `album.mjs` 앨범 저장(계정 놀이 기록 + 기기 사본, 합치기) · `places.mjs` 장소와 판 모서리 · `words.mjs` 낱말 카드 원고 · `sign.mjs` 네 점 원근 · `sfx.mjs` 소리 · `fx.mjs` 움직임 · `app.mjs` 흐름과 카메라.
- 사진에는 글자가 없다. 글은 전부 화면이 판 위에 얹는다. 판 모서리 재는 법: `qa/판재기.py`, 지시문: `qa/지시문/`.
- 장소를 더하려면: 지시문으로 빈 판 사진을 굽고(16:9, 나노바나나 2.1) → 모서리를 재어 `places.mjs`에 무리 · 물건을 적고 → 낱말을 `words.mjs`에 더한 뒤 2중 검수와 몽골어 검문을 태운다. 꼬리표 시험이 통과해야 한다.
- 시안 영상: `node experiences/snap-words/qa/시안영상.cjs <출력 폴더> [phone|film]`.
