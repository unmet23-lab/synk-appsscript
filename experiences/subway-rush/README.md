# 환승 러시

SYNK WORLD 「놀이」의 듣기 게임. 1인칭으로 서울 지하철을 타고 안내방송 · 길 안내를 들어 문 · 통로 · 출구를 고른다. 설계와 근거는 [설계.md](설계.md), 그림 길 비교는 [시안 README](qa/시안-20261104/README.md).

| 파일 | 맡은 일 |
|---|---|
| `core.mjs` | 판 규칙: 안내가 끝나기 전 못 고름 · 손짓 없으면 답 아님 · 시계는 구간 · 오답 · 연속 정답으로만 · 늘 도착 |
| `level.mjs` | 시작 난도(주소 > 고른 난도 > 시험 목표 급) |
| `lines.mjs` | 노선 사실 한 곳(번호 · 색 · 역 순서 · 환승). 2026-11-04 위키백과 1 · 2호선 문서로 순서와 환승을 대조했다. 노선 색 값은 그 문서에 16진수가 없어 색 이름만 대조했다 |
| `journeys.mjs` | 여정 틀 · 안내 원고 · 변형(「첫 등굣길」 1~2급, 「바쁜 아침」 3~4급) · 해설 |
| `people.mjs` | 오늘의 칸 · 만남 여섯 · 도감 원고 |
| `learning.mjs` | Atlas 기록(문항 키 · 전달 · 도움 · 답) · 다음 판 복습 고르기 |
| `plan-items.mjs` | 「이번 주 계획」 · 튜터 후보가 겨누는 문항 표(`synk-world-app/world-learning-plan.mjs`가 읽는다). `reviewDecisions`는 판 12,000개를 돌려 화면에서 못 불러 표로 둔다. 시험이 대조하고 게임 공개 폴더에는 안 싣는다 |
| `scene.mjs` | 깊이 셰이더 한 장(다가감 · 문 틈 · 터널 빛 · 먼 표지 · 바닥 스티커) |
| `led.mjs` | 도트 LED 전광판(시각 · 상태 말은 판에 굽고 파형만 갱신) |
| `audio.mjs` · `music.mjs` | 목소리 · 효과음 · 레일 · 대합실 · 앱 설정 · 아이폰 무음 스위치 / 달리는 구간 · 결과 음악(고리 · 덕킹) |
| `app.mjs` | 차례만 잇는다: 입구 → 승강장 → 열차 · 만남 → 통로 → 열차 → 출구 → 개찰구 → 지상 → 결과 |
| `index.html` · `style.css` · `world-host.js` | 게임 틀 화면. 지하철에 실제로 있는 물건만 올린다 |
| `atlas-learning.js` · `collection.js` | 생성 사본(`node tools/build-game-learning.js` · `node experiences/play-common/build-collection.mjs`) — 손으로 고치지 않는다. 이 게임의 Atlas 사본만 WORLD 지도(TOPIK II 능력 15개 포함, `strata/world-map.js`)로 묶는다(`tools/lib/atlas-copies.js` `WORLD_MAP_GAMES`) |
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

- 안내 문장 · 보기 · 정답을 바꾸면 `learning.mjs`의 `ITEM_VERSION`을 올리고, 문항 2중 검수(`tools/topik-review.mjs`의 `subway-rush` 묶음)와 목소리 굽기를 다시 돈다. 문항을 더하거나 뺐으면 `plan-items.mjs`도 고친다(`learning.test.mjs`가 대조한다).
- 문항 id · family는 영문 · 숫자만 쓴다(`atlas/game-learning.js` `identifier`). 역 이름을 넣으려면 `journeys.mjs`의 `SLUG`를 거친다 — 한글이 들어가면 그 문항은 기록이 조용히 안 남는다(11-05에 `fork.청량리.*` 넷이 그랬다).
- 얼굴이 보이는 사람을 다시 구우면 공개 전에 실존 인물 대조(`experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs`)를 처음부터 다시 돈다. 숫자 · 판정만 시안 README에 적고, 렌즈 결과는 git 밖에 둔다.
- 앱 연결은 `brand-opening/home.mjs` · `play-unlocks.mjs` · `world-strings.mjs` · `synk-world-app/app-shell.mjs` · `server.mjs` · `desktop/src/security.cjs` · `tools/build-world-app-public.mjs` · `korean-racing/garage-core.js` · `play-common/build-collection.mjs` · `tools/lib/atlas-copies.js`.

## 알아 둘 것

- 이번 주 계획 · 튜터 후보: `world-learning-plan.mjs`의 `world.play.subway`. 해금 표(`play-unlocks.mjs` `subway`)로 열린 학생에게만 후보가 되고, 손님은 다른 놀이처럼 Core가 뺀다. 1~2급 문항만 겨누다가 3급 이상을 목표로 고른 학생에게 3~4급 문항까지 겨눈다. 그 학생은 고른 난도가 없을 때 바쁜 아침으로 열린다(`app-shell.mjs` `subway` · `level.mjs`). 튜터는 계획이 고른 놀이를 그대로 권한다(`home-tutor-lines.mjs`). `blank` · `snap`은 계획 후보에 없어 바람길 줄과 같은 꼴로 넣었다. `learning-hub`는 LAB 추천이고 이 게임은 LAB 공개 길이 없어(설계 9절) 넣지 않는다.
- 학습 기록: 60문항 모두 실제 묶음의 제시 · 전달 · 답까지 지나간다(`learning.test.mjs`). 이 게임의 Atlas 사본만 WORLD 지도라 564,654 → 573,964바이트(+9,310, gzip +1,011)이고 다른 게임 사본은 바이트까지 그대로다.
- 로그인 학생의 공통 코인은 계정 서버 `synk-play`의 `MINI_GAMES`에 이 게임이 있어 쌓인다(11-05 운영 v33). 이 이름은 `PLAY_GAMES`에 넣지 않아 지갑에 새 칸이 생기지 않고, 옛 호스트가 그대로 읽는다. 서버가 `invalid-round`를 돌려주면 결과 화면은 코인 줄을 안 띄운다. 공개판의 손님은 이 게임을 열 때 로그인으로 간다(`app-shell.mjs` `GUEST_GAMES`). 코인이 이 기기에 쌓이는 것은 계정 서버 없는 이PC 시범 서버뿐이다.
- 「오늘 만난 사람」 · 내 노선도 · 난도 선택은 이 기기의 `localStorage`에만 있고 계정을 따라가지 않는다. 학습 기록(Atlas)만 계정으로 올라간다.
- 배포 점검은 첫 화면만 잰다. 화면을 고치면 `qa/접근성.cjs`로 입구부터 내 노선도까지 재 본다.
- 공개 후보는 `qa/공개후보.cjs`로 짓는다. 게임 폴더는 라이브와 달라진 파일만, 공용 파일은 master 빌드가 아니라 라이브 판 + 이 게임 줄이다. 계정 · 생활 묶음에 끼운 계획 후보는 `qa/계획후보대조.mjs`가 원본 빌드와 견준다.

