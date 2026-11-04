# 환승 러시

SYNK WORLD 「놀이」의 듣기 게임. 1인칭으로 서울 지하철을 타고 안내방송 · 길 안내를 들어 문 · 통로 · 출구를 고른다. 설계와 근거는 [설계.md](설계.md), 그림 길 비교는 [시안 README](qa/시안-20261104/README.md).

| 파일 | 맡은 일 |
|---|---|
| `core.mjs` | 판 규칙: 안내가 끝나기 전 못 고름 · 손짓 없으면 답 아님 · 시계는 구간 · 오답 · 연속 정답으로만 · 늘 도착 |
| `lines.mjs` | 노선 사실 한 곳(번호 · 색 · 역 순서 · 환승). 2026-11-04 위키백과 1 · 2호선 문서로 순서와 환승을 대조했다. 노선 색 값은 그 문서에 16진수가 없어 색 이름만 대조했다 |
| `journeys.mjs` | 여정 틀 · 안내 원고 · 변형(「첫 등굣길」 1~2급, 「바쁜 아침」 3~4급) · 해설 |
| `people.mjs` | 오늘의 칸 · 만남 여섯 · 도감 원고 |
| `learning.mjs` | Atlas 기록(문항 키 · 전달 · 도움 · 답) · 다음 판 복습 고르기 |
| `scene.mjs` | 깊이 셰이더 한 장(다가감 · 문 틈 · 터널 빛 · 먼 표지 · 바닥 스티커) |
| `led.mjs` | 도트 LED 전광판(시각 · 상태 말은 판에 굽고 파형만 갱신) |
| `audio.mjs` · `music.mjs` | 목소리 · 효과음 · 레일 · 대합실 · 앱 설정 · 아이폰 무음 스위치 / 달리는 구간 · 결과 음악(고리 · 덕킹) |
| `app.mjs` | 차례만 잇는다: 입구 → 승강장 → 열차 · 만남 → 통로 → 열차 → 출구 → 개찰구 → 지상 → 결과 |
| `index.html` · `style.css` · `world-host.js` | 게임 틀 화면. 지하철에 실제로 있는 물건만 올린다 |
| `atlas-learning.js` · `collection.js` | 생성 사본(`node tools/build-game-learning.js` · `node experiences/play-common/build-collection.mjs`) — 손으로 고치지 않는다 |
| `assets/` | `world/`(실사 판 + 깊이 지도) · `voice/`(줄 + manifest) · `music/` · `fonts/`(Noto Sans KR 일부 · Neo둥근모, OFL) |

## 시험과 도구

```bash
node --test experiences/subway-rush/core.test.mjs experiences/subway-rush/people.test.mjs experiences/subway-rush/learning.test.mjs
```

```bash
node experiences/subway-rush/qa/판찍기.cjs --씨앗 777 --난도 busy --틀림 2 --이름 점검
```

| 도구 | 하는 일 |
|---|---|
| `qa/판찍기.cjs` | 게임 틀에서 `?auto=1`로 끝까지 돌리며 화면 · 상태 · 오류 · 프레임 간격 · 넘침을 적는다 |
| `qa/판영상.cjs` | 소리까지 담아 한 판 녹화(유호님 시안) |
| `qa/웹판.py` | 굽기 원본 → 게임 webp · 깊이 지도 · `assets.json` |
| `qa/글꼴묶기.py` | 표지 · LED 글꼴을 게임에 쓰는 글자만 woff2로 |
| `qa/목소리굽기.mjs` · `qa/받아쓰기.py` | 줄 굽기(Typecast · 일레븐, 역마다 표 한 곳) · 원고와 받아쓰기 대조 |
| `qa/목소리후보.mjs` · `qa/받아쓰기-후보.py` | 역마다 같은 줄의 후보를 구워 귀로 고르기 전에 거르기 |
| `qa/음악고리.py` | 곡 → BPM · 마디 실측 · 고리 · −18 LUFS(곡 출처는 `qa/음악출처.json`) |
| `qa/시안-20261104/굽기순서.mjs` | 실사 판 굽기(GPT 이미지 2.5, 지시문은 `지시문/`) |

## 고칠 때

- 안내 문장 · 보기 · 정답을 바꾸면 `learning.mjs`의 `ITEM_VERSION`을 올리고, 문항 2중 검수(`tools/topik-review.mjs`의 `subway-rush` 묶음)와 목소리 굽기를 다시 돈다.
- 얼굴이 보이는 사람을 다시 구우면 공개 전에 실존 인물 대조(`experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs`)를 처음부터 다시 돈다. 숫자 · 판정만 시안 README에 적고, 렌즈 결과는 git 밖에 둔다.
- 앱 연결은 `brand-opening/home.mjs` · `play-unlocks.mjs` · `world-strings.mjs` · `synk-world-app/app-shell.mjs` · `server.mjs` · `desktop/src/security.cjs` · `tools/build-world-app-public.mjs` · `korean-racing/garage-core.js` · `play-common/build-collection.mjs` · `tools/lib/atlas-copies.js`.
