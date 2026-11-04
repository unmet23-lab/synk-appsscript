# MT 바닷가 자전거 레이스(WORLD 판) · 재료와 다시 돌리는 법

설계 정본은 [설계.md](설계.md). 게임 코드는 `../../ride/`(WORLD일 때만 불러옴) · `../../lane-core.js` · `../../world-host.js` · `../../world-skin.css`, 갈림은 `../../app.js`의 `rig`.

## 돌려 보기

세션 워크트리에는 git 무시 파일이 없어 먼저 공용 작업본에서 복사한다: `assets/car.glb` · `assets/coastal-rocks-v6.glb`. 공개 후보를 만들 때는 `공개후보.cjs`가 바위 모델을 공용 작업본에서 넣는다(저장 용량 관문이 GLB 추적을 막는다).

```bash
node experiences/korean-racing/qa/world-mt-20261104/serve.mjs 5287
```

- 시안 틀(WORLD `.game-frame` 흉내): `http://127.0.0.1:5287/qa/world-mt-20261104/틀.htm` — `?bike=hybrid`로 결 B, `?qa`로 `__racingQA`.
- 자전거 · 사람 모형만: `http://127.0.0.1:5287/qa/world-mt-20261104/자전거보기.htm?rider=taeo&view=rear&spin=0`.
- 앱 안 브라우저 칸이 숨어 있으면 게임이 멈춘다(`visibilitychange`) — 확인은 아래 대본으로.

## 대본

| 파일 | 하는 일 |
|---|---|
| `장면.cjs` | 장면을 정해 찍는다(입구 · 출발 · 게이트 앞 · 내리막 질주 · 뒤 6m · 옆 2m · 스침, `--장면=`으로 고르면 코스창 · 멈춤창 · 결과1등~3등 · 연습도). 결과는 공용 작업본 `.tmp/world-mt-20261104/장면/` |
| `앱화면.cjs` | WORLD 앱(이PC 시범 서버, launch 「WORLD앱MT」) 안에서 잠김 → 열림 → 입구 → 고르기 → 한 판 → 결과. 결과는 `.tmp/world-mt-20261104/앱/` |
| `공개후보.cjs` | 커밋 둘을 꺼내 공개 빌드(바탕 · 새 판)를 만들고 world/ 차이를 센다. git 밖 자산은 공용 작업본에서. 결과 `.tmp/world-mt-20261104/공개/` |
| `공개묶음동기화.cjs` | 공개본 계정 묶음 + 후보(또는 공개본 그대로)로 한 판 — 학습 기록이 막히지 않고 가는지 |
| `검수장면.mjs` · `검수배경.md` | `tools/검수묶음.mjs 준비 … --장면 · --배경` 재료. 설계.md를 배경으로 주면 묶음마다 되풀이돼 묶음이 배로 늘어난다 |
| `시안영상.cjs` | 소리까지 담은 한 판 녹화(탭 녹화, 주문 폭주와 같은 길). 결과는 `.tmp/world-mt-20261104/시안/` |
| `lab-proof.cjs` | LAB 차이 0 증명(입구 픽셀 · 스타일 · DOM + 자동 시연 한 판 상태 · 그리기 수) → `lab-proof.json` |
| `serve.mjs` | 시안 · 검수용 정적 서버(공용 지면서버는 `.mjs`를 모른다) |
