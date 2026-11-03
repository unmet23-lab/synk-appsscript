# 찰칵 낱말

SYNK WORLD 미니게임. 1인칭으로 장소를 둘러보며 판과 물건을 찍고, 태오의 부탁으로 찾고, 인화에서 이름을 붙인다. 설계 · 근거: [설계.md](설계.md).

- 띄우기: `PORT=5207 node experiences/snap-words/server.mjs` → `/index.html`(`?look=phone|film` · `?lang=ko|en` · `?seed=7`). 앱에서는 `.game-frame` 틀 안에서 열린다.
- 시험: `node --test experiences/snap-words/core.test.mjs experiences/snap-words/places.test.mjs experiences/snap-words/sign.test.mjs experiences/snap-words/sfx.test.mjs` — `places.test.mjs`가 꼬리표 시험(글자를 안 읽고 풀리지 않는지)이다.
- 나누기: `core.mjs` 규칙(판 짜기 · 부탁 · 판정 · 앨범) · `places.mjs` 장소와 판 모서리 · `words.mjs` 낱말 카드 원고 · `sign.mjs` 네 점 원근 · `sfx.mjs` 소리 · `fx.mjs` 움직임 · `app.mjs` 흐름과 카메라.
- 사진에는 글자가 없다. 글은 전부 화면이 판 위에 얹는다. 판 모서리 재는 법: `qa/판재기.py`, 지시문: `qa/지시문/`.
- 장소를 더하려면: 지시문으로 빈 판 사진을 굽고(16:9, 나노바나나 2.1) → 모서리를 재어 `places.mjs`에 무리 · 물건을 적고 → 낱말을 `words.mjs`에 더한 뒤 2중 검수와 몽골어 검문을 태운다. 꼬리표 시험이 통과해야 한다.
- 시안 영상: `node experiences/snap-words/qa/시안영상.cjs <출력 폴더> [phone|film]`.
