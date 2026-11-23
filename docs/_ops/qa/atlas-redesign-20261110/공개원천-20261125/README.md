# WORLD 선택 공개 — 11-25 02시 창 ③ 두 공개의 원천

이 커밋은 11-25 02시 창에 synk.im에 올리는 ③ (1) · (2)의 원천이다(설계 주인 11-23 「원천을 공개보다 먼저 올립니다」). master에는 ③이 라이브가 된 뒤 3방향으로 합친다. 11-24 창의 원천은 가지 `atlas-world-publish-src-20261124`에 있다.

## 들어 있는 것

- `experiences/` 변경: ③에 든 고침의 master 쪽 원천과 시험이다. 바탕은 origin master 3d58dbe2e3이다. 11-24 원천의 고침을 3방향으로 다시 얹었고(life-ui.mjs의 종이 겉 겹침 두 덩이는 `대본/s3fix/resolve-src-life-ui.cjs`), 검수 -s3f1 Fable F1 고침과 그 시험(qa/life-ui-off.test.mjs)이 더해졌다.
- `후보/`: 검수한 최종 바이트와 공개 도구의 후보 명세(`후보.json`)다.
- `입력/step1/`: 올릴 때 공개 도구에 주는 원본(`pub/`)과 기준(`pubbase/`)의 열세 파일, 공개 경로 목록(`items.txt`)이다.
- `대본/`: 후보를 지은 대본이다.

## 두 공개

| 공개 | 검수 사슬 | 검수한 후보 |
|---|---|---|
| ③ (1) 열한 파일 | `atlas-world-step1-pub-20261124-s3f1` → `-s3f1b` | `후보/step1-1` — 계획 2d7dc701af83, 라이브 f63a9e38f 위 |
| ③ (2) app-shell · home.css · HTML 셋 | `atlas-world-step1-pub-20261124-s3g2` | `후보/step1-2` — 계획 13c0fea1ecaa, 라이브 f63a9e38f 위. (1) 전이라 `--허용 world/app-shell.mjs`로 지었다. 올릴 때는 (1)이 라이브가 되고 10분 뒤 허용 없이 다시 미리 보고 항목 · 바이트가 같은지 본다 |

올릴 때 입력은 `--원본 입력/step1/pub --기준폴더 입력/step1/pubbase`와 `items.txt`의 경로, (1)은 `--만` 열한 파일, (2)는 `--만 world/app-shell.mjs --만 world/brand-opening/home.css`다(`대본/s3fix/preview-s3f.sh`). 올린 뒤 공개 커밋의 바이트는 `후보/<공개>/후보.json`의 sha256과 같아야 한다. 그사이 라이브가 같은 파일을 바꾸면 공개 도구가 3방향으로 합쳐 바이트가 달라지므로, 올리기 전에 멈추고 다시 짓는다.

## 지은 차례

- 11-24 원천(가지 `atlas-world-publish-src-20261124`)의 입력 cand-step1e에서 시작했다.
- 라이브 종이 겉(7386af758 · 830ab084e)과 겹친 life-ui.mjs 다섯 덩이를 `대본/s3fix/resolve-life-ui.cjs`로 풀어 cand-step1f를 만들었다(기준 pubbase의 life-ui는 라이브 830ab084e).
- 검수 -s3f1 Fable F1 고침을 `대본/s3fix/fix-f1.cjs`로 넣어 cand-step1g를 만들었다(master 원천에도 같은 고침).
- (2)는 03:18 라이브 f63a9e38f(서울행 손님 1화)가 app-shell.mjs와 HTML 셋을 바꿔 그 위에서 다시 지었다.
- 대본의 절대 경로는 이 작업을 한 PC의 작업 자리다.
