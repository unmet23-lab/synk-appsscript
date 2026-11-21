# 출시 안내 띠 · /assets/launch-notice.js

2026-11-21 유호님 결정이다. 지금 체험할 수 있는 공개 화면 맨 위에 「SYNK는 2027년 2월에 정식 출시합니다. 지금은 사전 모집 등록만 진행하고 있습니다.」를 보인다. 근거는 [결정](../../docs/_ops/결정.md) 11-21 행이다.

| 무엇 | 어디 |
|---|---|
| 띠 스크립트(글 네 언어, 꼴 둘) | `launch-notice.js` → 공개 `assets/launch-notice.js` |
| 붙인 쪽 목록과 꼴 | 아래 표 |

## 붙이는 법

쪽의 원본 HTML `</head>` 앞에 한 줄을 넣고, 그 쪽의 빌드로 다시 만든다.

```html
<script src="/assets/launch-notice.js" defer></script>
```

보통 쪽과 LAB 게임(기본 `flow`)은 띠가 body 맨 앞에 끼어 본문을 밀어 내린다. 띠는 쌓임 순서를 만들지 않고(z-index auto) 쪽의 다른 요소를 움직이지 않는다. 게임 화면이 보이는 동안(`body.playing`이거나 `main#game`이 `hidden`이 아님)은 띠를 접는다. 위에 붙은 고정 머리띠가 있는 쪽은 그 쪽 CSS 한 줄로 `--synk-launch-h`(지금 보이는 띠 높이, 스크롤하면 줄어 0px)만큼 내린다 — 아래 표의 「쪽 CSS」 칸.

WORLD는 `data-mode="overlay" data-anchor=".synk-opening"`을 붙인다. 띠는 첫 화면(모달 창)이 떠 있는 동안에만 그 창 안 맨 앞에 맨 위 층으로 뜨고 닫기 단추가 있다. 첫 화면이 닫히거나 이 로드에서 뜨지 않으면 띠는 없다. 뜨지 않는 로드는 첫 화면과 같은 조건(`?opening=off`, 또는 이 탭의 `synk.brand-opening.v1.seen`)으로 처음에 정하고, 첫 화면보다 다른 모달 창이 먼저 열려도 거둔다. 첫 화면의 위 단추와 로고는 `opening.css`가 `--synk-launch-h`로 내린다.

말은 `<html lang>`을 따른다(ko · en · mn · es, 그 밖은 영어). 쪽이 언어를 바꾸면 띠도 바뀐다.

## 붙인 쪽(2026-11-21)

| 쪽 | 꼴 · 쪽 CSS | 원본에 붙인 자리 |
|---|---|---|
| `/world/` · `world/desktop.html` · `world/mobile.html` | overlay(첫 화면이 떠 있는 동안만) · `opening.css` 여덟 자리 | `experiences/synk-world-app/document.mjs`(첫 화면 위 단추는 `experiences/brand-opening/opening.css`가 `--synk-launch-h`로 내림) |
| `/korean/` · `/classroom/` · `/study-abroad/` · `/job/` · `/community/`와 `/en/` 다섯 | flow · `<style id="synk-launch-offset">.nav{top:var(--synk-launch-h,0px)}</style>` | `docs/디자인/synk.im_새로짓기_20261119/시안/detail.html` · `시안/en/detail.html` |
| `/lab/topik4/` · `/ub/` | flow | `experiences/lab-topik4/src/index.html` · `experiences/ub-korea/src/index.html` |
| `/nombre/` · `/rl/` | flow | `docs/마케팅/맞춤도구/nombre/index.html` · `rl/index.html` |
| `/care/` · `/try/travel/` · `/try/learning-hub/` | flow | `experiences/relationship-care` · `path-travel` · `learning-hub`의 `index.html` |
| `/try/` 게임 9곳(blank-slice · entry-check · order-rush · racing · rhythm · runner · story-classroom · talk-rally · word-magic) | flow(게임 화면이 보이는 동안 접힘) | `experiences/<게임>/index.html`(racing · rhythm · runner는 `korean-` 앞붙이) |
| `/mn/` · `/name/` | flow · `/mn/`만 `.bar{top:calc(14px + var(--synk-launch-h,0px))}.bar-panel{top:calc(70px + var(--synk-launch-h,0px))}@media (max-width:900px){.bar{top:calc(10px + var(--synk-launch-h,0px))}}`(site.css의 휴대폰 기준 10px을 따름) | 공개본에만 있다. `/mn/`은 SYNK-website `site-v10`, `/name/`은 원본을 못 찾았다 — 다시 만들면 한 줄을 다시 넣는다 |

## 글을 바꾸거나 걷을 때

이 파일의 `TEXT`만 고쳐 `node tools/공개.js 올리기 assets/launch-notice.js=experiences/launch-notice/launch-notice.js …`로 다시 공개한다. 몽골어와 스페인어를 바꾸면 현지어 검수(`tools/몽골어대조.js`, `tools/현지어대조.js`)를 다시 받는다. 출시 뒤 띠를 걷을 때는 스크립트를 빈 함수로 바꿔 공개한 다음, 쪽마다 붙인 한 줄을 다음 빌드에서 뺀다.
