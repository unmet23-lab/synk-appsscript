# SYNK LAB PLAY 키트

여덟 게임(말 랠리·주문 폭주·이야기 교실·말의 리듬·바람길·레이싱·빈칸 베기·입장 검사)이 같이 쓰는 화면 뼈대와 펠트 부품이다.
2026-10-06 유호님 「니 방식대로 싹다 리디자인 및 재설계 해도 좋으니까 제대로 부탁해」 → 말 랠리·빈칸 베기·입장 검사의 펠트 화면을 한 벌로 묶어 키트로 만들고,
게임마다 따로 그리던 입구·게임 바·멈춤·결과·코인 줄을 키트에서 그린다.

## 쓰는 법

- 원본은 이 폴더(`experiences/play-common/kit/`)다. 게임마다 `kit/` 사본을 둔다 — 게임 폴더가 synk.im에 따로따로 공개되기 때문이다.
  `node experiences/play-common/build-kit.mjs`가 `KIT_GAMES`에 적힌 게임에 복사하고, `node --test experiences/play-common/kit.test.mjs`가 사본이 바이트까지 같은지 본다. 사본은 직접 고치지 않는다.
- 게임의 `index.html`은 `kit/lab.css` → 게임 `style.css` 순으로 읽는다. 게임 `style.css`에는 그 게임에만 있는 것(입구 그림, 무대, 보기)만 둔다.
- 화면 구조(말 랠리 `index.html`이 본보기):
  - 입구 `main.lobby`: `.topbar`(펠트 로고 꼬리표 · 영문 kicker · 소리 단추) → `.hero`(코랄 펠트 머리 면: kicker, 큰 제목, 두 줄 lede, 입구 그림) → `.plan`(종이 카드 둘: `.start-card` 오늘의 한 판, `.how` 하는 방법 셋) → `.lobby-foot`
  - 게임 `main.game`: `.game-bar`(작은 로고 · 게임 이름 · `.hud .pill` · 멈춤 `.disc-btn`) → `.arena`(크림 펠트 벽 + 코랄 펠트 받침) → `.tip`·`.pop`·`.explain`
  - 결과 `main.results`: `.res-hero`(제목·큰 점수·별·몽글) → `.res-grid`(`.paper` 카드: 기록·학습 항목·다음)
  - 멈춤 `dialog.lab-dialog`: 이어 하기 `felt-cta` · 소리·천천히 칩 · 처음으로
  - 공통 코인 줄 `.synk-collection-line`(입구 잔액 `data-collection-balance` · 결과 `#r-coins` · 공통 차고 링크 `data-collection-garage`)
- `lab.mjs`: `$`·`$$`·`el`·`esc`, `preloadImages(urls)`, `fitText(글상자)`(쉼표 뒤 줄바꿈·매인 말 붙이기·긴 낱말만 줄이기), `bindSoundToggles({isOn,setOn})`.

## 펠트 부품(`felt/`)

`badge-coral`·`badge-cream`(빈 원)·`badge-check`(정답) · `chip-blush-long`(칩·HUD 알약·꼬리표 바탕) · `slab-coral-long`·`slab-cream-long`·`slab-blush(-long)`(단추 판) · `tag-cream`(로고 꼬리표) ·
`tex-coral`·`tex-cream`(큰 면의 결) · `wide-cream`(판 벽) · `sparkle` · `cushion-{blush,butter,lapis}-{phone,mid,wide}`(도톰한 쿠션 대답 카드, 1.6·2.4·3.2:1) · `cushion-*-strip`(6:1 칩).
원본은 [`docs/디자인/펠트부품`](../../../docs/디자인/펠트부품/README.md)이다. 키트의 부품을 바꾸면 원본 README의 「사본 맞추기」를 따른다.

## 글꼴(`fonts/`)

SUIT Variable(woff2), DM Mono Medium·Inter Tight Medium/Bold(ttf → woff2로 바꿈, 2026-10-06). 라이선스 OFL 원문을 같이 둔다.
