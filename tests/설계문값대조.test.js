/* 상태기반 과제선택 설계문 — «절 간 값 대조» 가드 · 2026-08-16 신설 (세션 local_8369e570 · 13회차 처분 §5 ⓐ-1).
 *
 * 왜 이 파일이 생겼나 — 네 판 연속 같은 병이 났고, 처방이 «주소»에서 실패했다:
 *   v10 이 축 셋을 적고 닫음 → v11 에서 ①③ 재발 → v11 이 「축을 «적는» 것으로는 안 닫힌다」를 적음
 *   → v12 에서 ㉡(형제 절 미수거)가 2건 → v12 가 「이번엔 **기계로** 옮긴다」며 §12 항30 을 세움
 *   → **v13(이 판)에서 ㉡가 또 2건**(`input_hash` 낱말 · `degraded` 생산자).
 *
 *   그런데 v13 실측으로 드러난 것은 「대조 목록이 좁았다」가 아니다 — **목록이 없었다.**
 *   항30 이 이름 댄 「설계문 숫자 회귀」(설계문 §12-5 항5)는 **저장소 전량 0매치**였고,
 *   항30 이 적힌 §12-21 은 **⛔착수 차단 중인 구현의 «인수 조건»**이라 구현이 서기 전엔 안 돈다.
 *   ⇒ 처방은 옳았고(기계) **층이 틀렸다.** 이 파일이 그 주소다 — `tests/설계문_폐기어휘.test.js`
 *   와 같은 문서층이고, 착수 차단과 무관하게 **오늘 돈다**.
 *
 * 무엇을 지키나 — 「같은 값이 두 곳에 적힌 자리」 넷 + 「적용 순서」 하나:
 *   ① `input_hash` 의 대상 낱말      — 「요약 문자열」 ↔ 「렌더된 요청 본문 전체」 (13회차 갈래 6)
 *   ② `degraded` 의 생산자           — 호출 봉투가 그 값을 실으면 안 된다 (13회차 갈래 7 · v5.7 D1)
 *   ③ `policy_ver` 값의 자리수       — 12 ↔ 16 ↔ 전문 (13회차 갈래 8)
 *   ④ `policy_ver` 재료 «수»         — §5-1 ↔ §12-5 (v12 항30 이 「이미 한다」고 적었던 그 대조)
 *   ⑤ **DDL 적용 순서**              — 자기보다 «아래»에서 처음 만들어지는 표를 참조하는 문장
 *                                      (13회차 갈래 9 · 2026-08-16 세션 `local_fe2e0293` 신설)
 *
 * ⑤ 는 앞 넷과 «축이 다르다» — 앞 넷은 「같은 값이 두 곳에서 갈렸나」를 보고, ⑤ 는 「이 문서를 빈 DB 에
 * 위에서 아래로 적용하면 죽나」를 본다. 왜 필요했나: v5.10 은 `generation_batch_runs` 의 RLS·revoke 를
 * 그 표의 `create` 보다 **44줄 앞**에 뒀다 ⇒ 빈 스키마에서 「relation does not exist」로 즉사한다.
 * §12-21 이 「빈 DB 전량 적용」을 «필수»로 걸어 놓고도 못 잡았다 — 그것이 ⛔착수 차단 중인 **구현의
 * 인수 조건**이라 한 줄도 안 돌기 때문이다(v13 §6 의 규율 = 처방을 «오늘 도는» 주소에 적는다).
 *
 * ⚠ **이 장치의 대가**(새 장치엔 대가를 함께 적는다 · CLAUDE.md 맹점 ④):
 *   - **틀릴 때의 모습** = 「맞는 얼굴로 틀린 값」 쪽으로 샌다. ①~④ 는 «낱말»을 보지 «뜻»을 못 본다 —
 *     같은 모순을 다른 낱말로 적으면 초록이다. 그러니 초록을 「절 간 모순 0」으로 읽지 마라.
 *     읽을 수 있는 것은 **「이 다섯은 안 갈렸다」**뿐이고, 분모는 이 파일의 대조 수(5)다.
 *   - **⑤ 가 틀릴 때의 모습은 «다르다»** — 이것은 낱말이 아니라 순서를 재므로 거짓음성이 아니라
 *     **거짓양성** 쪽으로 샌다(산문 속 표 이름, 문자열 리터럴). 그래서 검사 대상을 «SQL 코드블록 안의
 *     DDL 문장»으로 좁혔고, 그 좁힘 자체가 사각이다: **`create table` 문 밖·DDL 문 밖에서 표를 참조하는
 *     자리(예: plpgsql 함수 본문)는 안 본다.** 그건 의도다 — 함수 본문은 실행 시점에 해석되므로 적용을
 *     죽이지 않는다. ⑤ 가 재는 것은 **「마이그가 끝까지 도나」** 하나뿐이다.
 *   - **문서를 고칠 때 회귀가 더 자주 깨진다** — 그것이 목적이다(지금까진 안 깨졌다).
 *   - **닫은 것** = §12 항30 의 「§12-21 이 **이미** 대조한다」는 문장. 장치 총량은 +1 이지만
 *     **«있다고 적힌 없는 장치» −1** 이다. 그 문장은 v5.10 에서 정정했다.
 *
 * 탐지력은 **픽스처로 못박는다** — 실저장소가 초록이어도 「잡을 수 있는 눈」인지는 가짜 입력으로
 * 증명한다(가드의 맹점 ②: 버그가 아직 있길 요구하는 회귀 금지 · CLAUDE.md).
 * 설계문이 없거나 못 읽으면 **fail 이 아니라 skip**(F296: 부재를 적색으로 위장 금지).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 설계문 = path.join(ROOT, 'docs', '상태기반_과제선택_설계.md');

/**
 * 그 줄이 «역사·철회·정정»을 말하고 있나 — 그런 줄의 옛 낱말은 정상이다.
 * (무엇이 틀렸는지 적으려면 틀린 낱말을 쓸 수밖에 없다 · 폐기어휘 가드와 같은 규율.)
 * 🔑 취소선(`~~`)을 포함시킨 이유 = 13회차 갈래 6 의 처방이 「걷되 원문은 취소선으로 남긴다」다.
 */
/* 🔑 「섞여/갈려/갈렸」을 넣은 근거 = 실사용 첫 호출이 잡은 거짓양성이다(이 파일을 세운 그 자리).
 *    §12 항30 의 「…「요약 문자열」과 「요청 본문 전체」가 **섞여 있었다**」는 결함을 «신고»하는 줄이지
 *    «저지르는» 줄이 아니다. 판별자 = **정의문은 갈림을 말하지 않는다** — 정의는 값을 하나 못박는다.
 *    ⚠ 그래서 이 escape 는 「과거형」이 아니라 «갈림을 서술하는 낱말»로 좁혀야 한다(과거형 전체를
 *    빼면 「v5.5 는 요약 문자열이었다」 같은 진짜 잔존까지 통과한다). */
const 역사표기 =
  /~~|🚫|정정|철회|폐기|걷었다|걷는다|걷어|옛 규격|옛 낱말|다른 대상|아니었다|거짓이었다|섞여|갈려|갈렸/;

/** 주석으로 죽은 줄인가 — SQL(`--`)·JS(`//`) 둘 다 이 문서 안에 산다. */
const 주석줄 = (줄) => /^\s*(--|\/\/|>?\s*\/\/)/.test(줄);

// ─────────────────────────────────────────────── 대조 넷

/** ① `input_hash` 를 정의하는 줄이 「요약 문자열」을 «살아 있는 서술»로 쓰면 잡는다. */
function 대조1_input_hash(본문) {
  return 본문.split('\n').flatMap((줄, i) =>
    줄.includes('input_hash') && 줄.includes('요약 문자열') && !역사표기.test(줄)
      ? [{ 대조: '①input_hash', 줄번호: i + 1, 본문: 줄.trim().slice(0, 100) }]
      : [],
  );
}

/** ② 호출 봉투가 `degraded` 를 «살아 있는 JSON 칸»으로 실으면 잡는다(v5.7 D1 = 함수 몫). */
function 대조2_degraded(본문) {
  return 본문.split('\n').flatMap((줄, i) =>
    /"degraded"\s*:/.test(줄) && !주석줄(줄)
      ? [{ 대조: '②degraded', 줄번호: i + 1, 본문: 줄.trim().slice(0, 100) }]
      : [],
  );
}

/**
 * ③ `policy_ver` 값 형식을 말하는 줄은 **전부 12자**여야 한다.
 * `오늘과제.v4+<…>` 를 적은 줄에서 12 말고 다른 자리수가 나오면 잡는다.
 */
function 대조3_자리수(본문) {
  return 본문.split('\n').flatMap((줄, i) => {
    if (!줄.includes('오늘과제.v4+')) return [];
    if (역사표기.test(줄)) return [];
    const 자리수 = [...줄.matchAll(/(?:해시|앞\s*)(\d{1,2})\s*자?/g)].map((m) => Number(m[1]));
    const 어긋난것 = 자리수.filter((n) => n !== 12);
    return 어긋난것.length
      ? [{ 대조: '③자리수', 줄번호: i + 1, 본문: `12 아닌 자리수 ${어긋난것.join(',')} — ${줄.trim().slice(0, 80)}` }]
      : [];
  });
}

const 한글수 = { 여덟: 8, 아홉: 9, 열: 10, 열하나: 11, 열둘: 12, 열셋: 13, 열넷: 14, 열다섯: 15 };

/** §5-1 제목의 재료 수(한글 수사) 와 §12-5 의 `판지문` 회귀 벌수(아라비아) 를 뽑는다. */
function 재료수들(본문) {
  const 절 = 본문.match(/###\s*5-1\..*?재료\s*=\s*\*\*(\S+?)\*\*/);
  const 회귀 = 본문.match(/`판지문`\s*회귀\s*\*\*(\d{1,2})벌\*\*/);
  return {
    절5_1: 절 ? (한글수[절[1]] ?? Number(절[1])) : null,
    절12_5: 회귀 ? Number(회귀[1]) : null,
  };
}

/** ④ 두 절이 같은 수를 말하나. 한쪽이라도 «못 읽었으면» 0건이 아니라 «미측정»이다(F207). */
function 대조4_재료수(본문) {
  const { 절5_1, 절12_5 } = 재료수들(본문);
  if (절5_1 === null || 절12_5 === null) {
    return [{ 대조: '④재료수', 줄번호: 0, 본문: `미측정 — §5-1=${절5_1} · §12-5=${절12_5}(패턴이 안 잡혔다 · 0건 아님)` }];
  }
  return 절5_1 === 절12_5
    ? []
    : [{ 대조: '④재료수', 줄번호: 0, 본문: `§5-1 은 ${절5_1} · §12-5 는 ${절12_5} — 한 문서에 두 정본` }];
}

// ─────────────────────────────────────────────── ⑤ DDL 적용 순서

/** ```sql 코드블록 «안»의 줄만 — 원래 줄번호를 유지한다(산문 속 표 이름은 대상 밖). */
function sql줄들(본문) {
  const 결과 = [];
  let 블록안 = false;
  본문.split('\n').forEach((줄, i) => {
    if (/^\s*```sql\s*$/.test(줄)) { 블록안 = true; return; }
    if (/^\s*```\s*$/.test(줄)) { 블록안 = false; return; }
    if (블록안) 결과.push({ 줄, 줄번호: i + 1 });
  });
  return 결과;
}

/**
 * 「빈 DB 에 위에서 아래로 적용하면 죽는 문장」만 본다 = **DDL 문장**.
 * 시작 줄부터 세미콜론까지를 한 문장으로 모으고, 줄 끝 주석(`--`)은 떼어낸다.
 */
/* 🔑 `create constraint trigger` 를 따로 적은 이유 = 실사용이 잡은 사각이다. 첫 판은 `create trigger`
 *    만 적었는데, 갈래 10 집행이 `create constraint trigger` 를 쓰자 그 문장이 **검사 밖으로 빠졌다**.
 *    가드가 「막는 것을 다 잡는지」는 규칙이 아니라 실제 표기로 확인한다(CLAUDE.md 맹점 ①). */
const DDL시작 = /^(create table|alter table|create (unique )?index|create (constraint )?trigger|drop trigger|revoke|grant|comment on)/i;

function DDL문장들(줄목록) {
  const 결과 = [];
  let 모으는중 = null;
  for (const { 줄, 줄번호 } of 줄목록) {
    const 코드 = 줄.replace(/--.*$/, '');
    if (모으는중 === null) {
      if (!DDL시작.test(코드.trim())) continue;
      모으는중 = { 시작: 줄번호, 본문: 코드 };
    } else {
      모으는중.본문 += '\n' + 코드;
    }
    if (코드.includes(';')) { 결과.push(모으는중); 모으는중 = null; }
  }
  if (모으는중) 결과.push(모으는중);   // 세미콜론을 못 만난 꼬리도 버리지 않는다
  return 결과;
}

/** 이 문서가 «스스로 만드는» 표만 대상이다 — `engine.learners` 처럼 밖에서 오는 표는 대조 밖. */
function 표생성줄(줄목록) {
  const 표 = new Map();
  for (const { 줄, 줄번호 } of 줄목록) {
    const m = 줄.match(/^create table\s+(?:if not exists\s+)?engine\.([a-z_]+)/i);
    if (m && !표.has(m[1])) 표.set(m[1], 줄번호);
  }
  return 표;
}

/**
 * ⑤ 어느 DDL 문장도 «자기보다 아래»에서 처음 만들어지는 표를 참조하지 않는다.
 * 🔑 이 한 줄이 규칙의 전부다(설계 §3-5-b 머리 · 13회차 갈래 9).
 */
function 대조5_DDL순서(본문) {
  const 줄목록 = sql줄들(본문);
  const 생성줄 = 표생성줄(줄목록);
  if (생성줄.size === 0) return [];      // 볼 대상이 없다 — 분모는 아래 «분모» 검사가 따로 공개한다
  const 걸린것 = [];
  for (const { 시작, 본문: 문장 } of DDL문장들(줄목록)) {
    for (const [표, 만든줄] of 생성줄) {
      if (시작 >= 만든줄) continue;
      if (!new RegExp(`engine\\.${표}\\b`).test(문장)) continue;
      걸린것.push({
        대조: '⑤DDL순서',
        줄번호: 시작,
        본문: `engine.${표} 는 ${만든줄} 줄에서 처음 만들어진다 — 빈 DB 에서 이 문장이 즉사한다: ${문장.trim().split('\n')[0].slice(0, 70)}`,
      });
    }
  }
  return 걸린것;
}

const 대조들 = [대조1_input_hash, 대조2_degraded, 대조3_자리수, 대조4_재료수, 대조5_DDL순서];
const 전량대조 = (본문) => 대조들.flatMap((f) => f(본문));

// ─────────────────────────────────────────────── 픽스처 — 탐지력 증명

test('픽스처 ① — `input_hash` 를 「요약 문자열」로 적으면 잡는다', () => {
  const 가짜 = ['`input_hash` = 그 사례의 **요약 문자열**(그 값).'].join('\n');
  assert.equal(대조1_input_hash(가짜).length, 1);
});

test('픽스처 ① — 취소선·정정 표기가 붙으면 통과시킨다 (거짓양성 0)', () => {
  const 가짜 = [
    '`input_hash` = 그 사례의 ~~**요약 문자열**~~ → 렌더된 요청 본문 «전체».',
    '🚫 `input_hash` 를 「요약 문자열」로 되돌리기.',
  ].join('\n');
  assert.deepEqual(대조1_input_hash(가짜), []);
});

test('픽스처 ② — 호출 봉투가 `degraded` 를 실으면 잡고, 주석으로 죽이면 통과한다', () => {
  assert.equal(대조2_degraded('    "degraded": true,').length, 1, '살아 있는 칸은 잡아야 한다');
  assert.deepEqual(대조2_degraded('    // "degraded": <함수가 채운다>,'), [], '주석은 잡으면 안 된다');
  assert.deepEqual(대조2_degraded('--    "degraded": true,'), [], 'SQL 주석도 잡으면 안 된다');
});

test('픽스처 ③ — `오늘과제.v4+` 줄에 12 아닌 자리수가 오면 잡는다', () => {
  assert.equal(대조3_자리수("값 = `'오늘과제.v4+<해시16>'` 이다.").length, 1);
  assert.deepEqual(대조3_자리수("값 = `'오늘과제.v4+<해시12>'` 이다."), []);
  assert.deepEqual(대조3_자리수('값 = `오늘과제.v4+<hex 앞 12자>` 이다.'), []);
  assert.deepEqual(
    대조3_자리수('~~`오늘과제.v4+<해시16>`~~ 은 옛 규격이다.'),
    [],
    '역사 표기가 붙은 줄은 통과',
  );
});

test('픽스처 ④ — 두 절의 재료 수가 갈리면 잡는다 · 못 읽으면 «미측정»으로 드러낸다', () => {
  const 갈림 = ['### 5-1. `policy_ver` 지문의 재료 = **열셋**', '- `판지문` 회귀 **12벌**'].join('\n');
  assert.equal(대조4_재료수(갈림).length, 1);
  assert.match(대조4_재료수(갈림)[0].본문, /13 · §12-5 는 12/);

  const 같음 = ['### 5-1. `policy_ver` 지문의 재료 = **열셋**', '- `판지문` 회귀 **13벌**'].join('\n');
  assert.deepEqual(대조4_재료수(같음), []);

  // 🔑 「못 읽었다」가 「0건」과 같은 얼굴이면 안 된다(F207).
  const 못읽음 = 대조4_재료수('아무것도 없는 문서');
  assert.equal(못읽음.length, 1);
  assert.match(못읽음[0].본문, /미측정/);
});

/* ⑤ 픽스처 — v5.10 이 실제로 저지른 그 형태를 가짜로 재현해 「잡는 눈」임을 증명한다.
 * 🔑 이 픽스처가 이 파일에서 가장 중요하다: 실저장소는 방금 «고쳐서» 초록이므로,
 *    고친 뒤의 초록만으로는 「검사가 도는지」와 「검사가 눈이 먼지」가 같은 모양이다. */
const 빈DB에서죽는판 = [
  '```sql',
  'create table if not exists engine.generation_jobs (',
  '  job_id uuid primary key',
  ');',
  'alter table engine.generation_batch_runs enable row level security;',
  'create table if not exists engine.generation_batch_runs (',
  '  run_id uuid primary key',
  ');',
  '```',
].join('\n');

const 순서가맞는판 = [
  '```sql',
  'create table if not exists engine.generation_jobs (',
  '  job_id uuid primary key',
  ');',
  'create table if not exists engine.generation_batch_runs (',
  '  run_id uuid primary key',
  ');',
  'alter table engine.generation_batch_runs enable row level security;',
  '```',
].join('\n');

test('픽스처 ⑤ — create 보다 «앞»에서 그 표를 참조하면 잡는다 (v5.10 이 저지른 그 형태)', () => {
  const 걸린것 = 대조5_DDL순서(빈DB에서죽는판);
  assert.equal(걸린것.length, 1);
  assert.equal(걸린것[0].줄번호, 5, '즉사하는 문장의 줄번호를 그대로 짚어야 한다');
  assert.match(걸린것[0].본문, /generation_batch_runs 는 6 줄에서 처음 만들어진다/);
});

test('픽스처 ⑤ — 순서가 맞으면 통과한다 (거짓양성 0)', () => {
  assert.deepEqual(대조5_DDL순서(순서가맞는판), []);
});

test('픽스처 ⑤ — «밖에서 오는 표»와 «산문 속 이름»은 대조 밖이다', () => {
  // engine.learners 는 이 문서가 만들지 않는다 — 참조해도 순서 결함이 아니다.
  const 외부표 = [
    '```sql',
    'create table if not exists engine.generation_jobs (',
    '  learner_id uuid not null references engine.learners(learner_id)',
    ');',
    '```',
  ].join('\n');
  assert.deepEqual(대조5_DDL순서(외부표), [], '밖에서 오는 표를 결함으로 세면 안 된다');

  // 코드블록 «밖»의 산문이 표 이름을 말하는 것은 DDL 이 아니다.
  const 산문 = [
    'alter table engine.generation_batch_runs 를 앞에 두면 죽는다고 이 문서가 적는다.',
    '```sql',
    'create table if not exists engine.generation_batch_runs (run_id uuid);',
    '```',
  ].join('\n');
  assert.deepEqual(대조5_DDL순서(산문), [], '산문은 적용되지 않는다 — 잡으면 문서를 못 쓰게 만든다');
});

test('픽스처 ⑤ — 줄 끝 주석에 적힌 표 이름은 실행되지 않는다', () => {
  const 주석 = [
    '```sql',
    'create table if not exists engine.generation_jobs (job_id uuid);   -- engine.generation_batch_runs 는 아래에 있다',
    'create table if not exists engine.generation_batch_runs (run_id uuid);',
    '```',
  ].join('\n');
  assert.deepEqual(대조5_DDL순서(주석), []);
});

// ─────────────────────────────────────────────── 실저장소 — 거짓양성만 검사

test('실저장소 — 설계문의 절 간 값이 갈린 자리가 0건이다 (대조 5벌)', (t) => {
  if (!fs.existsSync(설계문)) {
    t.skip('설계문이 없다 — 부재를 적색으로 위장하지 않는다(F296)');
    return;
  }
  const 걸린것 = 전량대조(fs.readFileSync(설계문, 'utf8'));
  assert.deepEqual(
    걸린것,
    [],
    '절 간 값이 갈렸다 — 형제 절 미수거다(축 ㉡):\n' +
      걸린것.map((x) => `  ${x.대조} 줄 ${x.줄번호}: ${x.본문}`).join('\n'),
  );
});

test('실저장소 — 대조 다섯이 «실제로 대상을 찾았다»(분모 공개 · F207)', (t) => {
  if (!fs.existsSync(설계문)) {
    t.skip('설계문이 없다(F296)');
    return;
  }
  const 본문 = fs.readFileSync(설계문, 'utf8');
  // 각 대조가 볼 «대상»이 문서에 실재하는지 — 대상이 0이면 그 대조는 초록이 아니라 미실행이다.
  assert.ok(본문.includes('input_hash'), '①의 대상 낱말이 문서에 없다 — 초록이 아니라 미실행이다');
  assert.ok(/"degraded"/.test(본문), '②의 대상이 없다 — 미실행이다');
  assert.ok(본문.includes('오늘과제.v4+'), '③의 대상이 없다 — 미실행이다');
  const { 절5_1, 절12_5 } = 재료수들(본문);
  assert.equal(typeof 절5_1, 'number', '④ §5-1 재료 수를 못 읽었다 — 미측정이다');
  assert.equal(typeof 절12_5, 'number', '④ §12-5 회귀 벌수를 못 읽었다 — 미측정이다');

  // ⑤ 의 분모는 «표 수»와 «DDL 문장 수» 둘 다다 — 어느 쪽이 0이어도 그 초록은 미실행이다.
  const 줄목록 = sql줄들(본문);
  const 표수 = 표생성줄(줄목록).size;
  const 문장수 = DDL문장들(줄목록).length;
  assert.ok(표수 >= 3, `⑤ 이 볼 표가 ${표수}개다 — 이 설계문은 최소 셋(jobs·attempts·batch_runs)을 만든다`);
  assert.ok(문장수 >= 20, `⑤ 이 볼 DDL 문장이 ${문장수}개다 — 코드블록을 못 읽었을 수 있다(미실행)`);
});
