# 시제품 시험을 옮겨 올 자리

시제품(`docs/_ops/qa/atlas-redesign-20261110/prototype/`)은 설계 검토 네 번과 구조 검토 한 번을 거친 6판이다. 그 시험을 두뇌 · 기록과 함께 패키지 시험으로 옮긴다. 옮기면서 시제품의 `brain.mjs`를 import하지 않고 `test/support/subject.mjs`로 패키지의 `src`를 부른다.

| 시제품 | 옮길 곳 | 단계 | 명령 |
|---|---|---|---|
| `scenarios.mjs`의 단정 46개 | `test/properties/scenarios.test.mjs` — 장면 하나가 `test()` 하나 | 2(두뇌 장면) · 3(접기 · 얹기 장면) | `npm --prefix packages/atlas run test:props` |
| `spec.mjs` | `test/oracle/spec.mjs` — 설계 §3-2 · §3-3의 글을 옮긴 독립 기준. `src`를 import하지 않는다(ts-fsrs는 `src/memory/fsrs.mjs`로 받는다) | 2 | — |
| `fuzz.mjs` | `test/properties/fold.property.test.mjs` | 2(두뇌 접기) · 3(서버 접기 · 기기 얹기 — 태그 고침을 더한다, 저장 관문) | `ATLAS_SEEDS=3000 npm --prefix packages/atlas run test:props` |
| `fuzz-session.mjs` | `test/properties/session.property.test.mjs` | 2 | 같음 |
| `mutants.mjs`의 변형 64개 | `tools/mutants.mjs`의 `MUTANTS` — `[잡을 묶음, 갈래, 이름, 바꿀 파일, 바꿀 글, 바꾼 글]` | 2 · 3(규칙을 더하거나 고칠 때 깬 변형을 함께) | `npm --prefix packages/atlas run test:mutants` |
| `sim-core.mjs` · `sim30.mjs` · `sweep.mjs` | `test/learners/`(가상 학습자 관문 2~5 — 설계 §11) | 2 | `npm --prefix packages/atlas run test:learners` |
| `intervals.mjs` | `test/properties/intervals.test.mjs`(간격의 모양 — 설계 §3-2) | 2 | `npm --prefix packages/atlas run test:props` |

- 씨앗은 `test/support/seeds.mjs`의 `rng`가 시제품과 같은 수열이다. 어긋난 판은 씨앗과 함께 찍는다(`ATLAS_FIRST_SEED=<씨앗> ATLAS_SEEDS=1`로 다시 돈다).
- 임의 시험은 몇 초, 변형 시험은 몇 분 걸린다(시제품 기준 4~5분). CI의 `check`에는 `unit` · `build`만 들고, `properties`를 `check`에 넣는 것은 단계 2가 첫 파일을 넣을 때 정한다 — 넣으면 씨앗 수를 줄인 판으로.
- 이 폴더에 `*.test.mjs`가 없으면 `test:props`는 「단계 2가 채운다」를 찍고 끝낸다(`unit` · `build`와 달리 꼭 도는 묶음이 아니라서다 — 통과로 세지 않는다).
