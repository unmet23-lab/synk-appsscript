# 무료 운세 잠시 내림 — 2026-10-30

유호님 「우리 회원 혜택중에 운세 있잖아. 이거 지금 잠깐 비공개하자. 다시 개발해야할것같아.」 → 다시 만들 때까지 무료 운세를 사람들이 보거나 열 수 없게 했다. 앱 원천·계정에 저장된 기록·로그인 연결은 지우지 않았다. 정본은 [플랫폼 설계 「무료 운세 잠시 내림」](../../../../docs/SYNK_플랫폼_계정과_연결_설계.md#member-benefit-fortune-paused-20261030)이다.

## 이 폴더

| 파일 | 하는 일 |
|---|---|
| `patch-live.mjs` | 공개본 `account/dist/platform.js`(master 빌드와 구성이 다른 묶음)에 이번 원천 고침 10곳만 글자로 얹는다. 곳마다 공개본에서 한 번만 맞는지, 넣는 글이 같은 원천의 master 빌드에 그대로 있는지 단언하고, 얹은 뒤 공개본 혜택 목록(JSON)이 원천 `MEMBER_BENEFITS`와 칸마다 같은지 대조한다. |
| `patch-knowledge.mjs` | 홈페이지 질문창 `knowledge.json`·`en/knowledge.json`의 회원 혜택 문장 3곳을 셋으로 고치고 운세 소개 문단을 뺀다. 질문창 엔진은 답의 문단마다 같은 글의 근거 문단이 있어야 답을 열어 답과 근거를 같이 고친다. 쉬는 중 안내는 질문창이 펼쳐 보이는 첫 문단에 둔다. |

## 공개(10-30)

- synk.im — synk-policy `a07ae12`: `fortune/index.html`(안내 쪽) · `account/dist/platform.js`(이 폴더 `patch-live.mjs`로 10곳) · `knowledge.json`·`en/knowledge.json`(`patch-knowledge.mjs`) · 나머지 17파일은 `?v=` 토큰. 공개 주소 바이트 21/21, 배포 점검 41030815791 통과(새 접근성 위반 0). 공개 뒤 실제 주소(끼우기 없음)에서 안내 쪽 · 혜택 카드 셋 · 운세 소개 주소 「찾는 회원 혜택이 없어요」 · 질문창 쉬는 중 안내를 1440·390으로 봤다.
- 배포 점검 기준 그림 — synk-policy `7e49f43`(/fortune/ 컴퓨터·휴대폰, 배포 점검 41049762387은 무관한 쪽의 Pages 일시 503으로 세 번 실패 — 그 파일들은 다시 받으면 200, 이 커밋은 공개 주소로 나가는 파일을 안 바꿈).
- 질문창 원고 — SYNK-website `879f99a`(codex/company-conversations).
- 검수 — 화면 `fortune-pause-20261030`(아르곤 P1 1건 반영: 계정 라이브러리 「이어가기」 → `RETIRED_PLATFORM_APP_IDS`) → `-b`(아르곤 0건 · Fable 2건 반영: PC 내 홈 메모 `PAUSED_APP_IDS` · 원고 확인 날짜) → `-c`(Fable 다시 0건). 기준 그림 `fortune-pause-baseline-20261030-r2`(GPT 0건 — 1차는 그림 바이트를 못 열어 덜 읽음).
- PC 앱 — 10-30에는 따로 판을 내지 않았고, 다음 판들(0.4.56~0.4.66)이 이 고침을 `held`로 빼서 10-31까지 PC 앱에 운세가 남았다. **0.4.67(10-31, synk-policy `52c7dd94`)로 실었다** — 설치본 혜택 칸 셋 · master와 다른 파일 0 · 앱 화면 「세 가지 회원 혜택」 · 운세 글 0건을 봤다([현장 노트](../../../../docs/현장노트/배포_공개.md#좁은-범위로-pc-판을-내며-held로-뺀-남의-고침이-기존-실패로-넘어가-라이브에-안-실린다--공개-판과-견주는-비교로는-못-잡는다-2026-10-31-claude)).

## 다시 열 때

1. 새 운세 앱을 만들고(`experiences/daily-fortune`) `desktop/renderer/benefits.mjs`에 칸을 다시 넣는다.
2. 이번에 「셋·세 가지」로 바꾼 글(`desktop/renderer/index.html`·`member-home.mjs`, `experiences/synk-account/src/member-benefits.mjs`·`platform.mjs`)과 계정 라이브러리의 `getAppIds` 거르기, 새소식, `convenience-state.mjs` 허용 목록, 시험을 되돌린다.
3. 홈페이지 질문창 원고(SYNK-website `site-v10/knowledge/{ko,en}.mjs`)를 새 소개로 고치고, synk.im/fortune/에 새 앱 빌드를 올린다(지금은 안내 쪽 `experiences/daily-fortune/paused/index.html`). 배포 점검의 /fortune/ 기준 그림도 바꾼다.
