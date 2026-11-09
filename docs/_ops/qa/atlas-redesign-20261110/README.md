# Atlas 재설계 — 시제품과 검토 기록 (2026-11-10)

> 설계 정본은 [아틀라스 재설계](../../../아틀라스_재설계_20261110.md)다. 이 폴더에는 설계를 굳히기 전에 돌려 본 시제품과 설계 검토 기록을 둔다. 근거가 된 검수는 [Fable 5.2 전체 검수](../atlas-fable-review-20261110/README.md)다.

## 1. 시제품

제품 코드가 아니다. 새 두뇌(기억 · 작업 난도 · 고르기 · 이유)의 규칙이 검수의 결함 장면을 실제로 없애는지, 고정 사다리보다 나은지를 숫자로 보려고 만들었다. 구현 세션은 이 파일을 계약의 예로 읽고 `packages/atlas/`에 새로 짓는다.

| 파일 | 무엇 |
|---|---|
| [`prototype/brain.mjs`](prototype/brain.mjs) | 새 두뇌 시제품(약 180줄). `ts-fsrs` 위에 등급 대응 · 접기 · 작업 난도 · 예상 성공 확률 · 층으로 고르기 · 이유 종류와 근거 칸 |
| [`prototype/scenarios.mjs`](prototype/scenarios.mjs) | 검수의 결함 장면 다섯을 새 두뇌로 다시 돌린다. 결과는 [`scenarios.결과.txt`](prototype/scenarios.결과.txt) |
| [`prototype/sim30.mjs`](prototype/sim30.mjs) | 가상 학습자 40명 · 30일 · 낱말 60개로 지금 엔진 · 고정 사다리 · 새 두뇌를 견준다. 결과는 [`sim30.결과.txt`](prototype/sim30.결과.txt) |
| [`prototype/intervals.mjs`](prototype/intervals.mjs) | 기억 1판의 간격이 어떻게 늘어나는지. 결과는 [`intervals.결과.txt`](prototype/intervals.결과.txt) |
| [`prototype/fsrs-path.mjs`](prototype/fsrs-path.mjs) | `ts-fsrs`를 찾는다(이 저장소 → 옆 저장소 SYNK-talk의 `node_modules` → 환경 변수 `TS_FSRS`) |

돌리는 법(저장소 어디서나):

```bash
node docs/_ops/qa/atlas-redesign-20261110/prototype/scenarios.mjs
```

```bash
node docs/_ops/qa/atlas-redesign-20261110/prototype/sim30.mjs
```

`sim30.mjs`는 지금 엔진을 실제 코치로 돌리므로 3~4분 걸린다. `BASE=2`(첫 반감기 중앙값, 일) · `LEARNERS=40` · `POLICIES=brain,ladder`로 가정과 범위를 바꾼다. 지금 엔진은 [검수의 재현 도우미](../atlas-fable-review-20261110/repro/core1/common.cjs)를 그대로 쓴다.

**가상 학습자의 가정.** 낱말마다 반감기가 있고, 어렵게 떠올릴수록 반감기가 크게 늘며, 놓치면 줄어든다. 못 떠올리면 넷 중 하나를 찍는다. 새 두뇌의 기억 모형(FSRS)과 다른 모형으로 만들어, 모형이 자기 자신을 맞히는 시험이 되지 않게 했다. 이 숫자는 규칙을 견주는 자료이고 실제 학습 효과의 증거가 아니다.

## 2. 설계 검토

(아르곤 · 아스트라 · 그록의 검토와 반영을 적는다.)
