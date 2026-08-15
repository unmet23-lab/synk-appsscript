/* 헤더 정본 — 「시트 헤더 배열을 리터럴로 다시 적은 자리 0」을 배포집합에서 소스로 센다.
 *
 * 왜 이 검사가 있나 (같은 병 세 번째 = 원인을 쓸 수 없게 만든다 · CLAUDE.md 신뢰성):
 *   v9.87  teacher_stats  — 정본과 손사본이 갈려 한쪽만 늘었다.
 *   v9.138 hw_feedback    — 같은 모양으로 또 갈렸다.
 *   v9.239 mastery/academic — 상수를 세워 손사본 3벌을 1벌로 줄였는데 **전수가 아니었다**.
 *                            넷이 남았고(엔진_콘텐츠AI 2 · 엔진_운영배치 2), 값이 마침 같아
 *                            아무것도 안 깨졌다 — 즉 **증상이 언제나 「통과」인 결함**이다.
 *   🔴 실측 08-15: 그때 세운 상수를 검사하는 회귀가 **0건**이었다. 그래서 반만 닫힌 채로
 *      조용했다. 호출부를 하나씩 고치는 대신, 여기서 **잘못 쓸 수 없게** 만든다.
 *
 * 무엇을 막나: 열을 늘리는 날 정본만 바뀌고 손사본은 안 바뀐다. 그러면 `ensureSheet` 가
 *   **시트를 만들 때만** 헤더를 쓰므로, 갈라진 쪽으로 태어난 시트는 옛 열로 굳는다.
 *
 * ── 이 장치의 대가 (CLAUDE.md 「새 장치엔 대가를 함께 적는다」) ──
 *   ① 틀릴 때의 모습 A — 헤더가 아닌 배열이 우연히 어느 정본과 값이 같으면 거짓 적색이 된다.
 *      실측 08-15: 배포집합 15파일·정본 25개에서 그런 자리 **0건**이라 최소 원소 수 문턱을
 *      두지 않았다(1열짜리 정본 2개 SHARED4_COL_HEADERS·CONSENT_EXT_HEADERS 도 오탐 0).
 *      문턱은 재서 정한 값이지 추정이 아니다.
 *   ② 틀릴 때의 모습 B — 이쪽이 더 위험하다: 파싱이 조용히 깨져 **분모가 0**이 되면
 *      「적발 0건」이 초록의 얼굴을 하고 나온다(F207). 그래서 분모를 별도 검사로 세운다.
 *   ③ 닫을 것 — **없다**. 근거: 이 두 상수(그리고 나머지 23개)를 검사하는 회귀가 실측 0건이라
 *      대체할 낡은 검사가 애초에 존재하지 않는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ROOT } = require('./_engine-source.js');

/** 값이 계산식이라 문자열 대조가 불가능한 정본 — 여기 이름을 적으면 검사에서 빠진다.
 *  ⚠ 비우는 것이 정상이다. 이름이 늘면 그만큼 **탐지 밖**이라는 뜻이니, 적을 땐 왜인지 함께 적는다. */
const 대조_불가 = [];

/* ───────────────────────── 탐지기 (픽스처와 실저장소가 같은 것을 쓴다) ───────────────────────── */

/** 배포집합 = `.claspignore` 허용목록에서 파생한다 — 손 목록을 다시 베끼지 않는다(F080).
 *  .claspignore 는 전부 제외한 뒤 `!이름` 으로 되살리는 허용목록이라, 그 자체가 배포집합의 정본이다. */
function 배포집합(root) {
  const pats = fs.readFileSync(path.join(root, '.claspignore'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim()).filter(Boolean);
  const out = [];
  for (const t of pats) {
    if (t.includes('*')) {
      const re = new RegExp('^' + t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      fs.readdirSync(root).filter((f) => re.test(f)).forEach((f) => out.push(f));
    } else if (fs.existsSync(path.join(root, t))) out.push(t);
  }
  return out.filter((f) => f.endsWith('.js'));
}

/** 중첩 없는 대괄호 덩어리 — 다중행 포함(`[^[\]]` 는 개행도 먹는다). */
const 배열덩어리 = /\[[^[\]]*\]/g;

/** 원소가 전부 따옴표 문자열일 때만 정규화 목록을 낸다. 홑·겹따옴표, 다중행, 후행 쉼표 모두 사람이 실제로 쓰는 표기다(맹점 ①). */
function 문자열배열(raw) {
  const inner = raw.slice(1, -1).trim();
  if (!inner) return null;
  const parts = [];
  const re = /\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*(,|$)/g;
  let idx = 0, m;
  while ((m = re.exec(inner))) {
    if (m.index !== idx) return null; // 문자열 아닌 원소가 섞였다
    parts.push(m[1] !== undefined ? m[1] : m[2]);
    idx = re.lastIndex;
    if (!m[3]) break;
  }
  const 꼬리 = inner.slice(idx).trim();
  if (꼬리 && 꼬리 !== ',') return null;
  return parts.length ? parts : null;
}

/** 정본 상수 수집 → {정본: Map(값JSON → {name,file,len}), 선언범위, 못읽은: string[]} */
function 정본수집(root, files) {
  const 정본 = new Map(), 선언범위 = [], 못읽은 = [], 같은값 = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const re = /const\s+([A-Z][A-Z0-9_]*_HEADERS)\s*=\s*(\[[^[\]]*\])\s*;/g;
    let m;
    while ((m = re.exec(src))) {
      선언범위.push({ file: f, start: m.index, end: m.index + m[0].length });
      const els = 문자열배열(m[2]);
      if (!els) { 못읽은.push(`${f}:${m[1]}`); continue; }
      const key = JSON.stringify(els);
      if (정본.has(key)) 같은값.push(`${정본.get(key).name} ↔ ${m[1]}`);
      else 정본.set(key, { name: m[1], file: f, len: els.length });
    }
  }
  return { 정본, 선언범위, 못읽은, 같은값 };
}

/** 정본과 값이 같은 배열 리터럴이 **정본 선언 밖에** 적힌 자리. */
function 손사본찾기(root, files) {
  const { 정본, 선언범위, 못읽은, 같은값 } = 정본수집(root, files);
  const 적발 = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const 내범위 = 선언범위.filter((r) => r.file === f);
    let m;
    배열덩어리.lastIndex = 0;
    while ((m = 배열덩어리.exec(src))) {
      const s = m.index, e = s + m[0].length;
      if (내범위.some((r) => s >= r.start && e <= r.end)) continue; // 정본 선언 자신은 손사본이 아니다
      const els = 문자열배열(m[0]);
      if (!els) continue;
      const hit = 정본.get(JSON.stringify(els));
      if (!hit) continue;
      적발.push({ file: f, line: src.slice(0, s).split('\n').length, name: hit.name, 정본파일: hit.file });
    }
  }
  return { 적발, 정본수: 정본.size, 못읽은, 같은값 };
}

/* ───────────────────────── 분모 (초록은 분모와 함께만 읽는다 · F207) ───────────────────────── */

test('분모: 배포집합과 정본 상수를 실제로 찾아냈다 (0건 초록을 막는다)', () => {
  const files = 배포집합(ROOT);
  assert.ok(files.length >= 10,
    `배포집합 .js 가 ${files.length}건 — 파싱이 깨졌다. 이 상태면 아래 「적발 0건」은 통과가 아니라 미실행이다`);
  const { 정본수, 못읽은 } = 손사본찾기(ROOT, files);
  assert.ok(정본수 >= 20,
    `정본 *_HEADERS 상수가 ${정본수}개 — 실측 08-15 은 25개였다. 줄었다면 정규식이 소스 표기를 못 따라간 것이다`);
  const 미허용 = 못읽은.filter((n) => !대조_불가.includes(n.split(':')[1]));
  assert.deepStrictEqual(미허용, [],
    '값이 문자열 배열이 아닌 *_HEADERS 가 생겼다 — 그만큼 탐지 밖이다.\n' +
    '  ▶ 이 검사를 그 표기까지 넓히거나, 넓힐 수 없으면 `대조_불가` 에 이름과 이유를 적어 **눈에 보이게** 뺀다.');
});

/* ───────────────────────── 실저장소 (거짓양성만 본다 · 맹점 ②) ───────────────────────── */

test('배포집합에 시트 헤더 손사본이 0건이다 (정본 상수를 쓴다)', () => {
  const files = 배포집합(ROOT);
  const { 적발, 같은값 } = 손사본찾기(ROOT, files);
  assert.deepStrictEqual(같은값, [],
    `값이 똑같은 정본이 둘 있다(${같은값.join(' / ')}) — 둘 중 하나가 손사본일 수 있고, 이 검사는 그 둘을 못 가른다`);
  assert.deepStrictEqual(
    적발.map((a) => `${a.file}:${a.line} → ${a.name}`), [],
    '시트 헤더 배열을 리터럴로 다시 적은 자리가 있다.\n' +
    '  ▶ 그 리터럴을 위에 적힌 상수 이름으로 바꾼다(값은 그대로다 — 이 검사가 값이 같을 때만 잡는다).\n' +
    '  왜: 열을 늘리는 날 정본만 바뀌고 이쪽은 안 바뀐다. 갈라진 쪽의 증상은 언제나 「통과」다(v9.87·v9.138·v9.239).');
});

/* ───────────────────────── 픽스처 (탐지력은 여기가 진다 · 맹점 ②) ───────────────────────── */

/** 임시 저장소 한 벌 — `.claspignore` + 파일들. CI 에도 있는 것만 쓴다(홈·시간대 무의존 · F296). */
function 픽스처(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-헤더정본-'));
  fs.writeFileSync(path.join(dir, '.claspignore'), '**/*\n!*.js\n', 'utf8');
  for (const [name, src] of Object.entries(파일들)) fs.writeFileSync(path.join(dir, name), src, 'utf8');
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const 정본선언 = "const MASTERY_LOG_HEADERS = ['student_id', 'grammar_id', '상태', '첫기록일', '도달일', '출처', 'updated_at'];\n";

test('픽스처: 손사본을 잡는다 — 이 검사가 무엇을 탐지하는지', () => {
  const dir = 픽스처({
    'a.js': 정본선언,
    'b.js': "function f(){ ensureSheet(ss, 'mastery_log', ['student_id', 'grammar_id', '상태', '첫기록일', '도달일', '출처', 'updated_at']); }\n",
  });
  const { 적발 } = 손사본찾기(dir, 배포집합(dir));
  assert.strictEqual(적발.length, 1, '손사본을 못 잡았다 — 이 검사는 탐지력이 없다');
  assert.strictEqual(적발[0].file, 'b.js');
  assert.strictEqual(적발[0].name, 'MASTERY_LOG_HEADERS', '어느 정본을 베낀 것인지 이름을 못 댄다 — 처방이 따라갈 수 없어진다');
});

test('픽스처: 사람이 실제로 쓰는 표기를 전부 잡는다 — 겹따옴표·다중행·후행 쉼표 (맹점 ①)', () => {
  const 겹따옴표 = `function a(){ x(["student_id", "grammar_id", "상태", "첫기록일", "도달일", "출처", "updated_at"]); }\n`;
  const 다중행 = "function b(){ x([\n  'student_id', 'grammar_id', '상태',\n  '첫기록일', '도달일', '출처', 'updated_at',\n]); }\n"; // 후행 쉼표 겸함
  const dir = 픽스처({ 'a.js': 정본선언, 'b.js': 겹따옴표, 'c.js': 다중행 });
  const { 적발 } = 손사본찾기(dir, 배포집합(dir));
  assert.deepStrictEqual(적발.map((a) => a.file).sort(), ['b.js', 'c.js'],
    '표기가 바뀌면 못 잡는다 — 검사가 「내가 쓰는 표기」만 보고 있다');
});

test('픽스처: 거짓양성을 안 낸다 — 정본 선언 자신·값이 다른 배열', () => {
  const dir = 픽스처({
    'a.js': 정본선언,
    'b.js': "const 다른것 = ['student_id', 'grammar_id', '상태'];\n" +            // 원소가 적다
            "const 순서다름 = ['grammar_id', 'student_id', '상태', '첫기록일', '도달일', '출처', 'updated_at'];\n" +
            "function f(){ return [1, 2, 3]; }\n",                                  // 문자열이 아니다
  });
  const { 적발 } = 손사본찾기(dir, 배포집합(dir));
  assert.deepStrictEqual(적발, [], '값이 다른데 잡았다 — 거짓 적색은 이 검사를 우회 대상으로 만든다(F103)');
});

test('픽스처: 차단 사유가 시키는 대로 고치면 통과한다 (자기 처방을 안 막는다 · 맹점 ③)', () => {
  const dir = 픽스처({
    'a.js': 정본선언,
    'b.js': "function f(){ ensureSheet(ss, 'mastery_log', MASTERY_LOG_HEADERS); }\n", // 처방 그대로 적용한 꼴
  });
  const { 적발, 정본수 } = 손사본찾기(dir, 배포집합(dir));
  assert.strictEqual(정본수, 1, '픽스처 분모가 깨졌다 — 아래 0건이 미실행일 수 있다');
  assert.deepStrictEqual(적발, [], '처방대로 상수를 썼는데도 막힌다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)');
});
