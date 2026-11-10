# 시제품 시험을 옮긴 자리

시제품(`docs/_ops/qa/atlas-redesign-20261110/prototype/`)은 설계 검토 네 번과 구조 검토 한 번을 거친 6판이다. 단계 2(11-10)가 그 시험을 두뇌와 함께 패키지 시험으로 옮겼다 — 시제품의 `brain.mjs`를 import하지 않고 `test/support/subject.mjs`로 패키지의 `src`를 부른다. 옮기는 동안 같은 씨앗에서 시제품 두뇌와 패키지 두뇌를 한 걸음씩 맞대 어긋남 0을 확인했다(접기 · 얹기 3,000열 · 고르기 1,500명 10만 7,702걸음 — [단계 2 기록](../../../../docs/_ops/qa/atlas-redesign-20261110/단계2_계획.md) §9).

| 시제품 | 옮긴 곳 | 명령 |
|---|---|---|
| `scenarios.mjs`의 단정 46개(장면 ①~⑯) | `test/properties/scenarios.test.mjs` — 장면 하나가 `test()` 하나. 단계 2가 더한 규칙의 장면 ⑰~⑳은 `stage2.test.mjs` | `npm --prefix packages/atlas run test:props` |
| `spec.mjs` | `test/oracle/spec.mjs` — 설계 §3-2 · §3-3의 글을 옮긴 독립 기준. `src`를 import하지 않고 `ts-fsrs`를 직접 부른다(창 · 끈질긴 단위 · 놓친 꼴 · 「모르겠어요」 바닥 · 마지막 측정 난도까지) | — |
| `fuzz.mjs` | `test/properties/fold.property.test.mjs` | `ATLAS_SEEDS=3000 npm --prefix packages/atlas run test:props` |
| `fuzz-session.mjs` | `test/properties/session.property.test.mjs`(+ 끈질긴 단위의 판 몫 · 미룬 까닭 · 자리 잡기 선행값 · 채우기 차례) | 같음 |
| `mutants.mjs`의 변형 64개 | `tools/mutants/brain.mjs`(+ 단계 2 규칙을 깬 변형 — 수와 결과는 [단계 2 기록](../../../../docs/_ops/qa/atlas-redesign-20261110/단계2_계획.md) §9) | `npm --prefix packages/atlas run test:mutants` |
| `sim-core.mjs` · `sim30.mjs` · `sweep.mjs` | `test/learners/`(관문 2~5 — 지금 엔진 비교는 뺐다, 앞 판 값은 `baseline.json`) | `npm --prefix packages/atlas run test:learners` |
| `intervals.mjs` | `test/properties/intervals.test.mjs`(간격의 모양 — 설계 §3-2) | `npm --prefix packages/atlas run test:props` |

- 씨앗은 `test/support/seeds.mjs`의 `rng`가 시제품과 같은 수열이다. 어긋난 판은 씨앗과 함께 찍는다(`ATLAS_FIRST_SEED=<씨앗> ATLAS_SEEDS=1`로 다시 돈다). `ATLAS_SEED_SCALE`(0~1)은 기본 씨앗 수를 비율로 줄인다 — `check`가 0.1로 돈다.
- 전체 씨앗의 properties는 약 10초, learners는 몇 분, 변형 시험은 몇십 분 걸린다. `check`(CI)에는 줄인 씨앗의 properties까지, 나머지는 `npm run gate`.
- 단계 3(기록과 저장)은 서버 접기 · 수명 주기 임의 시험을 `test/record/`에 두고, 접기 사건 꼴 검사는 `src/fold/events.mjs`의 `checkFoldEvent`를 같이 쓴다.
