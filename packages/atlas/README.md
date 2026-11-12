# Atlas 새 엔진 — `packages/atlas`

> 재설계 정본은 [아틀라스 재설계](../../docs/아틀라스_재설계_20261110.md)다. 이 패키지는 그 설계의 엔진을 옛 `atlas/` 옆에 새로 짓는 자리이고, 단계 0(길 닦기, 2026-11-10)이 바닥을 깔았다 — [단계 0 기록](../../docs/_ops/qa/atlas-redesign-20261110/단계0_계획.md). 12/10까지 라이브는 옛 판이고, 이 패키지는 스위치 뒤에서 짓는다(공개본 동작을 바꾸지 않는다).

## 모듈 지도

| 폴더 | 무엇 | 채우는 단계 | 설계 |
|---|---|---|---|
| `src/map/` | 지도 — 읽기(`index.mjs` — 묶음에 드는 유일한 지도 코드) · 번호 장부 · 조립 · 빌드 검사(`ledger` · `compose` · `audit` — 빌드 도구만 부른다). 자료는 `map/`(생성물 커밋) | 1 | §3-1 · §4 |
| `src/params.mjs` | 매개변수 판 — 기억 · 난도 · 고르기의 숫자와 판 이름(`params-1` · `memory-1` · `ability-1` · `select-1`) | 2 | §6 |
| `src/memory/` | 기억 1판 — 단위마다 FSRS-6 상태 · 같은 자리 · 「이미 알아요」 · 끈질긴 단위(최근 8자리 창) · 놓친 꼴. ts-fsrs는 `fsrs.mjs` 한 곳에서만 부른다 | 2 | §3-2 · §3-5 |
| `src/ability/` | 난도 1판 — 능력마다 θ · 이어서 혼자 맞힌 수 · 마지막 측정 난도 | 2 | §3-3 · §3-4 |
| `src/fold/` | 접기 — 접기 사건 → 근거 줄 · 서버 접기(잎 함수) · 기기 얹기(기다리기). 단계 3이 부른다. 접기 사건의 꼴은 `events.mjs` 한 곳 | 2 | §5-3 · §5-4 |
| `src/select/` | 고르기 1판 — 층 · 한도 · 차례 · 판 몫, `idle` · `none`, 예상 확률의 세 항, 자리 잡기의 선행값, 활동 고르기 틀 · 설정 거르기 | 2 | §3-4 · §3-5 · §3-6 |
| `src/reason/` | 이유 — 종류 · 근거 칸 · 근거(`{ code, slots, evidence }`), 한국어 기본 한 벌(`ko.mjs` — 문장 표는 Vellum, 단계 4) | 2 | §3-7 |
| `src/record/` | 기록 — 사건 2판(`events.mjs` 한 곳) · 측정 계약(`judge`) · 사건 → 접기 사건 어댑터 · 근거 줄 · 서버 접기 순서(SQL은 SYNK-talk 포트) · 기기 기록부(저장 포트 · 대기열 · 요약 받기 · 얹기) · 옛 기록 옮기기. 시험 `test/record/`(묶음 `record`) | 3 | §5 · [단계 3 계획](../../docs/_ops/qa/atlas-redesign-20261110/단계3_계획.md) |
| `src/coach/` | 코치 3판 — 메서드 이름(`methods.mjs`) · 제시 칸(`fields.mjs`) · 기록 얇은 겹(`record.mjs`) · 호스트(같은 출처 위 창의 기록부 하나 · 알림) · 올리기 · 받기(`sync.mjs` — 오류 갈래 표 · 묶음 자르기 · 가려내기) · 차례(`turn.mjs` — 파생 기록을 쓰는 일 하나 동안만 쥐는 Web Locks, 일마다 한도 · 못 얻었을 때) · 앞 판 사본 버리기(`stores.mjs`) · 판과 일지(`session.mjs` — 두뇌만 돌린 결정과 같고, 저장 실패는 그 답이 없던 판으로 다시 세운다). 시험 `test/coach/`(묶음 `coach`) | 4 | §8 · [단계 4 계획](../../docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md) §18-5 |
| `src/vellum/` | 이유 문장 표 — 종류 × 화면 언어 × 눈높이 × 말하는 사람(`render`), 언어는 물러서지 않는다. 지금은 한국어 보통 · 기능 글 | 4 | §7 |
| `src/health/` | 계기 — 묶음 받기 · 저장 · 추천의 실패를 센다. `legacy.mjs`는 지금 판 코치에 붙이는 덧대기(묶음에 안 든다) | 0 | §1 표 5행 · §11 |

`src/index.mjs`가 바깥 입구이고 빌드가 이것을 묶음 하나로 묶는다. 단계마다 자기 폴더에 짓고 `src/index.mjs`에는 내보내기를 한 줄씩 더한다. 함께 고치는 곳은 `src/index.mjs` · `src/record/events.mjs`(2와 3이 같은 사건 이름을 쓰도록) · `tools/mutants.mjs`(단계마다 `tools/mutants/<단계>.mjs` 목록 하나를 모은다) · `package.json`의 시험 명령뿐이다. 두뇌가 ts-fsrs를 묶음에 넣으므로 판 폴더에 `LICENSES.txt`(MIT 고지)가 함께 난다.

**두뇌 쓰는 법(단계 2).** 기기: `createLearner(요약)` → `startSession(learner, now, PARAMS, { length, newLimit, more, level, dayOffset })` → `choose(후보, learner, memory, now)[0]`(맨 앞 줄: `item` · `tier` · `target` · `p` · `expected` · `why` · `arm` · `brandNew` · `idle` · `none` · `stubborn`) → `present(learner, row)` → `record(learner, memory, item, { correct, …, target: row.target }, now)`. 본인 말은 `say`. 서버 · 손님 기기: `foldServer(접기 사건들, memory)` 또는 줄마다 `foldUnit` · `foldSkill(skillRowsOf(만남))` · `firstMeeting`. 기기 얹기: `overlay(요약, 내 밀린 사건, memory, PARAMS, { familySkills, lookup })`. `memory = createMemory(PARAMS)`. 계약 전문은 [단계 2 기록](../../docs/_ops/qa/atlas-redesign-20261110/단계2_계획.md) §2 · §8.

**지도 쓰는 법(단계 1).** `openMap({ index, units, words })` — `index`는 전체 색인(`map/index.json`) 하나 또는 은행 조각(`map/items/<은행>.json`)의 배열, `units`는 문형 · 생활 표현 · 한글, `words`는 낱말 2,005(쓰는 게임만 — 은행 조각에는 그 조각이 쓰는 낱말 줄이 실려 있어(400개 이하, 레이싱 빼고) 낱말 표 없이도 `unit()`이 이름 · 뜻(`sense`)을 낸다). `map.item(itemKey | { itemKey, familyKey, skillId, difficulty, responseFormat, … })`이 두뇌 꼴 문항을 낸다(태그 없으면 `units = ['family:<계열>']`, 은퇴 문항은 `null`, 색인에 줄이 없어도 제품 값이 온전하면 태그 없는 문항). 계열 줄(한글 단계 · 드라마 — 판마다 열쇠가 생긴다)은 제품이 넘긴 난도 · 꼴을 얹는다. `map.familySkills`(계열 → 능력들)는 기기 얹기에 그대로 넘기고, `map.editions`(`map-<능력 분류 판 skillsEdition>` · `index-<색인 판 edition>`)는 제시 사건의 판 칸에 더한다 — 색인 판은 태그 · 능력 · 난도 · 꼴 · 계열이 바뀔 때마다 빌드가 올리는 「태그 판」이라 단계 3 서버의 다시 접기 판 묶음에 든다. 단계 3에는 `map.foldIndex`(`{ edition, lookup, familySkills }` — 접기 어댑터 · 기기 얹기 직전이 함께 쓴다)를 넘긴다. 번호 · 이름 바꾸기는 `itemNumber` · `itemKeyOf` · `familyNumber` · `unit`이 사슬을 끝까지 따른다. 꼴 · 번호 규칙 · 판 목록(`map/revisions.json` — 바뀐 문항의 옛 값 · 새 값)은 [단계 1 기록](../../docs/_ops/qa/atlas-redesign-20261110/단계1_계획.md) §2 · §3.

## 명령

- 지도 — `node packages/atlas/tools/map-build.mjs`(대조: 제품 은행 · strata 원천에서 다시 만든 지도가 커밋된 것과 같은가) · `--write`(다시 써서 커밋 — 장부는 덧붙이기만, 접기 칸이 바뀌면 색인 판 +1, 계열 이름 후보가 있거나 origin 장부가 앞서면 쓰지 않는다). 태그 채우기 · 2중 검수는 `node packages/atlas/tools/map-tags.mjs 준비 | 초안 | 클로드 | 아르곤 | 판정 | 반영 <이름>`(묶음은 `.tmp/atlas-map-tags/`, 판정을 거친 줄만 `map/tags/<은행>.json`에 — 기준 글 `map/tags/rubric-r2.md`, 검수 전 태그 없는 문항만은 `준비 … --태그없음`, 태그를 붙일 수 없는 문항 목록은 `까닭 <파일>`). 낱말 단위의 뜻(표제어 하나 — 주제 단계 낱말 · 보조 용언 고침, 같은 글의 다른 뜻 덧붙임 `w2001`~)은 `map/senses.json`이 strata 원천 위에 얹는다(`src/map/senses.mjs`). 제품 문항 은행을 고쳤으면 `map-build --write` 뒤 생성물을 같은 커밋에 — 단계 4 전까지는 어긋나도 build 시험이 알리기만 한다.

```bash
npm --prefix packages/atlas ci --ignore-scripts
```

```bash
npm --prefix packages/atlas run check
```

```bash
npm --prefix packages/atlas run format
```

```bash
node packages/atlas/tools/build.mjs --out <폴더>
```

- `check` — 이 패키지의 관문 한 줄. ① `biome ci`(포맷터: 한 줄 한 문장 · 폭 100, 린트: 함수 인지 복잡도 15 · 한 문장에 선언 하나) ② 빌드를 임시 폴더에 내고 `budget.json`의 묶음 압축 용량 상한을 잰다 ③ 시험 `unit` · `build` · `properties`(줄인 씨앗 — `ATLAS_SEED_SCALE=0.1`). CI는 `syntax-check`의 「verify Atlas package」 단계가 같은 명령을 돈다.
- `gate` — 두뇌의 관문(설계 §11 가상 학습자 관문 1~7): `properties` 전체 씨앗 · `learners`(가정 36가지 × 40명, 몇 분) · 변형 시험(몇십 분). 두뇌의 규칙이나 매개변수 판을 바꿀 때 돌리고 결과를 단계 기록에 남긴다. 관문 5의 앞 판 값은 `test/learners/baseline.json`(판을 올릴 때 `ATLAS_WRITE_BASELINE=1`로 고쳐 쓰고 결정 표에 적는다).
- 시험 묶음은 `node packages/atlas/tools/test.mjs <묶음…>`이다(`npm run test` · `test:unit` · `test:props` · `test:learners`).
  - `unit` — 의존 없이 돈다. 패키지 의존(ts-fsrs · esbuild …)을 부르면 훅(`test/support/leaf-only.mjs`)이 멈춘다. 루트 `tests/atlas-package.test.js`가 이 묶음을 부르므로, 패키지 의존을 깔지 않은 작업본의 전체 시험도 깨지지 않는다. `src/index.mjs`가 ts-fsrs를 부르게 되면 index를 거치는 unit 시험은 잎 모듈(`src/<모듈>/`)만 부르게 고치거나 `test/build/`로 옮긴다.
  - `build` — 빌드 · ts-fsrs · 변형 실행기.
  - `properties` — 장면 단정(시제품 ①~⑯ + 단계 2의 ⑰~⑳) · 간격 모양 · 접기 임의 시험(3,000열) · 고르기 임의 시험(1,500명). 독립 기준은 `test/oracle/spec.mjs`(src를 부르지 않는다).
  - `learners` — 가상 학습자 관문 2~5와 설계 §1 표 2 · 4 · 7(`test/learners/`). [옮긴 표](test/properties/README.md).
- 시험은 `src` · `loader`를 `test/support/subject.mjs`로만 부른다(`ATLAS_SUBJECT_ROOT`가 있으면 그 사본을 시험한다 — 변형 실행기가 쓴다). 씨앗은 `test/support/seeds.mjs`(`ATLAS_SEEDS` · `ATLAS_SEED_SCALE` · `ATLAS_FIRST_SEED`), 임시 폴더는 `test/support/temp.mjs`의 `tempDir`(그 시험 파일이 끝나면 지운다).
- `test:mutants` — 변형 시험(`tools/mutants.mjs`, 두뇌 목록은 `tools/mutants/brain.mjs`). 규칙을 더하거나 고칠 때 그 규칙을 깬 변형을 목록에 함께 더한다. build 묶음이 목록의 바꿀 글이 그 파일에 꼭 한 번 있는지 본다(포맷이 바꿔도 낡지 않게). 사본은 실행마다 `.mutants/<pid>`(git 밖)에 만들고 — 함께 도는 다른 실행의 사본은 건드리지 않는다 — 바꾸지 않은 사본에서 시험이 먼저 통과해야 변형을 본다. `--self`는 실행기 자체 시험이다.

## 검사 셋 — 줄 수 상한 대신(설계 §14-3)

| 검사 | 값 | 바꿀 때 |
|---|---|---|
| 포맷터 | Biome 2.6.4 — 폭 100 · 들여쓰기 2칸 · 작은따옴표 · 세미콜론, `useSingleVarDeclarator` | `biome.json` |
| 함수 복잡도 | `noExcessiveCognitiveComplexity` 15(인지 복잡도) | 올리지 않는다 — 함수를 나눈다 |
| 묶음 압축 용량 | `atlas.mjs` gzip 64KiB · `loader.js` gzip 2KiB · 지도 `map/index.json` 96KiB · `units.json` 8KiB · `words.json` 20KiB · 은행 조각 가장 큰 것 48KiB | 설계값이다. 실제 값에 맞춰 올리지 않고, 올릴 때는 [결정 표](../../docs/_ops/결정.md)에 까닭을 적는다 |

옛 `atlas/`에는 줄 수 상한이 없고 「새 모듈을 더하지 않는다」는 파일 수 울타리만 있다(`tests/atlas-size-budget.test.js`).

## 빌드와 판

빌드는 묶음 하나와 입구를 공개 경로 그대로의 나무로 낸다. 같은 커밋이면 같은 바이트다(시험이 두 번 빌드해 견준다).

```
<밖>/atlas/loader.js            입구 — 판 이름 한 줄(올리기 · 되돌리기 모두 이 한 줄)
<밖>/atlas/loader.mjs           ES 모듈 겉 — 판과 무관해 바뀌지 않는다
<밖>/atlas/<판>/atlas.mjs        엔진 묶음
<밖>/atlas/<판>/manifest.json    판 · 커밋 · 파일마다 바이트 · sha256 · gzip 바이트 · 제3자 코드
<밖>/atlas/<판>/LICENSES.txt     묶음에 든 제3자 코드의 고지(있을 때만 — ts-fsrs가 들면 MIT 고지)
<밖>/atlas/<판>/map/index.json   지도 전체 색인(서버 접기 · 도구) — 엔진 묶음과 따로(설계 §9)
<밖>/atlas/<판>/map/items/<은행>.json   은행 조각 — 제품은 자기 은행만 받는다(쓰는 낱말 줄 words 포함)
<밖>/atlas/<판>/map/units.json · words.json   단위(문형 · 생활 · 한글) · 낱말 2,005(뜻 풀이 sense 칸)
```

- **판 이름.** `--release`면 `package.json`의 판(`1.2.3` 꼴)이다 — 이 패키지에 커밋하지 않은 고침이 없고, HEAD가 `origin/master`에 들었고, 판이 `0.0.0`이 아닐 때만 낸다(꼬리표는 쓰지 않는다 — 바로올리기가 꼬리표를 올리지 않아 다른 세션이 확인할 수 없다). 그 밖은 `<판>-dev.<커밋 앞 7자>`(고침이 있으면 `.dirty`)라 공개 판과 섞이지 않는다.
- 묶음에 이 PC의 경로가 남으면 빌드가 멈춘다. 공개 사이트의 도구 이름 검사는 공개 때 `tools/공개.js`가 본다.

## 입구 — `await coach.ready`

```js
// 게임 · 드라마(클래식 스크립트)
// <script src="/atlas/loader.js"></script>
const coach = SynkAtlas.coach(options);
await coach.ready;

// 계정 셸(ES 모듈) — 묶음 도구에서는 /atlas/를 바깥(external)으로 둔다
const { coach: open } = await import('/atlas/loader.mjs');
```

- `loader.js`에는 정적 `import` · `export`가 없어 클래식 스크립트로도 모듈로도 실린다. 판 묶음은 동적 `import()`로 받는다(드라마 CSP `script-src 'self'` · PC 앱 `synk-desktop://` 모두 같은 출처라 통한다).
- **`ready`는 한 번만 정해진다.** 판 묶음을 못 받으면(404 · 오프라인 · 시간 상한 20초) `code: 'LOAD_FAILED'`(`reason`: `IMPORT` · `TIMEOUT` · `EDITION_MISMATCH` · `NO_BASE`)로 거절한다. 제품은 이때 지금처럼 원고 순서로 가고, 호스트는 계기에 원인까지 담은 코드로 넘긴다 — `note('load', { ok: false, code: error.reason ? 'LOAD_' + error.reason : error.code })`(`LOAD_IMPORT` · `LOAD_TIMEOUT` · `LOAD_EDITION_MISMATCH` · `LOAD_NO_BASE` — 404인지 느린 망인지 판 엇갈림인지 가르려고). 판 묶음이 낸 코치의 `ready`가 거절되면 입구가 그 코치를 닫고 같은 거절을 넘긴다(그 코치가 쥔 잠금 · 구독이 새지 않게).
- `ready` 전에 부른 메서드는 `NOT_READY`로 던진다. 떠나는 화면은 `ready` 전에도 `dispose()`할 수 있다 — 그 뒤 도착한 코치는 붙이지 않고 닫고, 메서드는 `DISPOSED`로 던진다.
- **`ready`는 서버를 기다리지 않는다.** 요약이 있는 기기는 오프라인으로도 바로 선다. 계정으로 처음 여는 기기에서 판을 정하는 화면(첫 진단 · 「처음 오셨네요」)만 `await coach.synced()`로 첫 받기를 한도(4초) 안에서 기다린다 — `{ ok, base, kind?, code? }`, `base`는 이 기기에 그 계정 · 그 동의 판의 요약이 있는가, `kind`는 못 받은 갈래(`offline` · `switch` · `account` · `auth` · `other` · `timeout`). 손님은 곧 `{ ok: true, base: true }`다(단계 4 계획 §18-5-5 G4).
- **손님 → 계정 옮기기는 `coach.guestRecords()`** — 계정 코치가 손님 저장소를 옆으로(문서 호스트 없이) 열어 옛 기록 옮기기를 한 번 돌린 뒤 `plan(watermarks)`(옮길 계획 — 물음의 수) · `move({ watermarks, postLegacy })`(다섯 걸음 — 옛 꼴은 제품의 옛 POST로 먼저, 2판은 계정 저장소에 그 판으로, 그 뒤 옮김 표지) · `keep()`(「이 기기에만 두기」) · `note('visited' | 'logout')`(되는 만큼만 쓰는 표지) · `close()`를 준다. `watermarks`는 제품의 기준 시각 `{ others, all }`(남이 다녀간 때 · 자기 결정까지), 옛 꼴의 기준 시각 고르기(`guestLearningEvents`)는 제품이 `postLegacy` 앞에서 건다. `create: false`면 손님 저장소가 없을 때 만들지 않고 `null`(단계 4 계획 §18-5-3).
- 같은 문서에 입구가 두 번 실리면 먼저 실린 판 하나만 돈다. **같은 출처의 위 창에 입구가 있으면 그 판을 따른다**(WORLD 틀 안 게임과 위 창이 다른 판을 받지 않게). 엇갈린 판은 `SynkAtlas.conflicts`에 남는다.
- 제품은 입구를 `/atlas/loader.js` · `/atlas/loader.mjs` 절대 주소로, `?v=` 없이 부른다 — 토큰을 붙이면 엔진을 올릴 때마다 `tools/공개.js`가 제품 HTML의 토큰까지 바꿔 「엔진을 고쳐도 제품 묶음을 건드리지 않는다」가 깨진다. 판 폴더(`/atlas/<판>/…`)를 제품이 바로 부르지 않는다. WORLD 공개 빌드(`tools/build-world-app-public.mjs`)가 이것을 막는다.

## 공개 절차(단계 4부터 — 단계 0에서는 공개하지 않는다)

```bash
node packages/atlas/tools/build.mjs --release --out <밖>
```

```bash
node packages/atlas/tools/publish.mjs <밖>
```

`publish.mjs`는 공개 판인지, 나무가 manifest와 같은지, 공개본에 같은 판 폴더가 다른 바이트로 있지 않은지(판 폴더는 덮지 않는다) 기계로 보고, 맞으면 `tools/공개.js 올리기 --원본 <밖> atlas/<판>/… atlas/loader.js atlas/loader.mjs` 명령을 찍는다. 그 뒤는 `tools/공개.js`의 절차 그대로다(검수 · 계획 해시 · 바이트 대조). synk.im에는 이미 `/atlas/index.html`(Atlas 소개 쪽)이 있고, 판 폴더 이름은 숫자로 시작해 겹치지 않는다. GitHub Pages라 입구가 바뀌면 10분 동안 옛 판 · 새 판이 섞일 수 있다(설계 §9).

## 브라우저 밖 — 판을 동봉하는 자리(정해 두기만, 단계 4에서 짓는다)

| 곳 | 동봉 자리 | 판을 묶어 두는 검사 |
|---|---|---|
| PC 앱 | `desktop/renderer/atlas/loader.js` · `desktop/renderer/atlas/<판>/` — `synk-desktop://`가 `/assets/` 밖의 주소를 `renderer/`에서 읽으므로(`desktop/src/native-content.cjs`) 웹과 같은 `/atlas/loader.js`가 그대로 통한다. `.mjs` MIME은 이미 있고, 화면 CSP는 `script-src 'self'; connect-src 'none'`이며 바깥 요청을 끊으므로 원격 입구는 못 쓴다 | 새 울타리를 짓는다 — 지금 `tools/lib/atlas-copies.js`의 미등록 사본 훑기는 `desktop/assets`까지만 보므로 `desktop/renderer/atlas/`는 밖이다. `manifest.json`의 판 · sha256을 빌드 나무와 대조하는 검사를 그 도구에 더한다 |
| Talk 앱 | `SYNK-talk/lib/atlas/<판>/` | `lib/atlas/sync-manifest.json`에 `edition`과 파일 sha256(지금 `engine` · `files` 꼴을 넓힌다, `tools/sync-atlas.js`) |
| Talk 서버 | `supabase/functions/_shared/synk-atlas-<판>.mjs` 하나 | Talk `tools/synk-server-build.js`의 `OUTPUTS`에 더하고 머리에 sha256(지금 `_shared/synk-atlas.js` · `synk-atlas-summary.js`와 같은 방식). 사건 표를 읽고 쓰는 함수가 `동봉.json`으로 받는다 — 어느 함수인지는 단계 3에서 서버 코드와 정한다 |
