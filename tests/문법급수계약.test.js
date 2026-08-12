/**
 * **문법 급수 계약 회귀 — 뱅크(정본)와 `계약/문법급수_계약.json`(파생)이 갈라지지 않는다.**
 *
 * 왜 기계로 막나: 이 계약은 **형제 저장소(SYNK-talk)가 급수를 얻는 유일한 통로**다. 저장소가
 *   둘이라 서로의 CI 가 상대를 못 보고(`tests/계약.test.js` 머리말), Apps Script 는 JSON 을
 *   import 못 해 뱅크는 소스 리터럴로만 산다. 즉 이 파일이 낡으면 **이쪽은 전부 초록인 채**
 *   저쪽 문항팩이 옛 급수로 배정한다 — 학생 화면엔 아무 표시도 없다.
 *
 * 구조 (CLAUDE.md 가드 3맹점):
 *   ①**탐지력은 픽스처가 진다** — 뱅크를 손댄 가짜 소스를 넣어 «생성기가 실제로 뱅크를 읽는지»
 *     실증한다. 실저장소가 초록인 것만으로는 생성기가 상수를 베껴 들고 있어도 통과한다.
 *   ②**실저장소에는 거짓양성만** — 파일이 지금 뱅크와 같은가 하나. 「버그가 아직 있을 것」을
 *     요구하지 않는다.
 *   ③**자기 처방을 막지 않는지** — 실패 메시지가 시키는 명령(`node tools/문법급수계약.js`)이
 *     실제로 이 상태를 고치는 명령인지 본다.
 *
 * ⚠ 어느 문형이 몇 급인가는 **여기서 판정하지 않는다** — 그 축은 `tests/문법급수.test.js` 가
 *   요목 정본과 대조해 이미 진다. 여기가 재는 것은 「정본 → 파생」 이 한 걸음뿐이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, engineSource } = require('./_engine-source');
const { 판, 계약경로, 계약짓기, 계약글 } = require('../tools/문법급수계약.js');
const { 뱅크읽기 } = require('../tools/lib/문법뱅크.js');
const 동기화 = require('../tools/계약동기화.js');

/* ── ① 탐지력 (픽스처) ─────────────────────────────────────────── */

/** 실엔진 소스에서 한 글자만 바꾼 가짜 — 뱅크 한 줄의 도입급을 1 → 5 로. */
function 손댄소스(원본, 줄, 새줄) {
  assert.ok(원본.includes(줄), `픽스처 앵커가 낡았다 — 뱅크에서 다음 줄을 못 찾았다:\n  ${줄}`);
  return 원본.replace(줄, 새줄);
}

test('① 생성기는 뱅크를 «읽는다» — 뱅크의 급을 바꾸면 계약도 바뀐다 (상수 베끼기 아님)', () => {
  const 원본 = engineSource();
  const 가짜 = 손댄소스(원본,
    "['G201', '이/가', '주격 조사 — 주어 표시', 1, null, '요'],",
    "['G201', '이/가', '주격 조사 — 주어 표시', 5, null, '요'],");
  const 산 = 계약짓기(원본).문법.find((g) => g.id === 'G201');
  const 죽은 = 계약짓기(가짜).문법.find((g) => g.id === 'G201');
  assert.strictEqual(산.도입급, 1, '실뱅크의 G201 도입급이 1이 아니다 — 픽스처 앵커부터 갱신하라');
  assert.strictEqual(죽은.도입급, 5,
    '뱅크를 고쳤는데 계약이 그대로다 — 생성기가 소스를 안 읽고 어딘가에 값을 베껴 들고 있다');
});

test('① 밴드도 뱅크에서 나온다 — `LEVEL_TOPIK_BAND` 를 고치면 계약 밴드가 따라 바뀐다', () => {
  const 가짜 = 손댄소스(engineSource(),
    'const LEVEL_TOPIK_BAND = { 1: [1], 2: [2], 3: [2, 3], 4: [3], 5: [3, 4], 6: [4, 5] };',
    'const LEVEL_TOPIK_BAND = { 1: [1], 2: [2], 3: [2, 3], 4: [3], 5: [3, 4], 6: [5] };');
  assert.deepStrictEqual(계약짓기(가짜).레벨밴드[6], [5],
    '밴드가 뱅크와 따로 논다 — 레벨↔급 대응이 두 곳에 적혀 있으면 한쪽만 낡는다');
});

test('① 앵커가 사라지면 «던진다» — 조용히 빈 계약을 뱉지 않는다', () => {
  assert.throws(() => 뱅크읽기('function 아무것도 없는 소스() {}'), /GRAMMAR_BANK 선언을 못 찾았다/,
    '뱅크를 못 찾았는데 값을 냈다 — 형제 저장소가 그 빈 값을 정본으로 믿는다');
  assert.throws(() => 뱅크읽기('const GRAMMAR_BANK = [];'), /끝 표식/,
    '끝 표식이 없는데 잘라 냈다 — 엉뚱한 구간이 계약이 된다');
});

/* ── ② 실저장소 (거짓양성만) ───────────────────────────────────── */

test('② 계약 파일이 지금 뱅크와 같다 — 분모: 문법 72개 · 칸 5개', () => {
  assert.ok(fs.existsSync(계약경로), `계약 파일이 없다 — node tools/문법급수계약.js`);
  const 디스크 = fs.readFileSync(계약경로, 'utf8').replace(/\r\n/g, '\n');
  assert.strictEqual(디스크, 계약글(),
    '계약이 뱅크와 갈라졌다 — 고치는 법: node tools/문법급수계약.js  (손으로 고치지 마라, 다음 생성에서 통째로 덮인다)');

  const 계약 = JSON.parse(디스크);
  assert.strictEqual(계약.판, 판, '계약 판이 생성기와 다르다');
  assert.strictEqual(계약.문법.length, 뱅크읽기(engineSource()).GRAMMAR_BANK.length,
    '계약 문법 수가 뱅크와 다르다 — 생성기가 일부를 흘렸다');
  assert.ok(계약.문법.length >= 72, `분모가 비었다 — 문법 ${계약.문법.length}개(미실행은 통과와 같은 모양이다)`);
  for (const g of 계약.문법) {
    assert.deepStrictEqual(Object.keys(g), ['id', '이름', '도입급', '재출현급', '근거'],
      `${g.id}: 칸 규격이 바뀌었다 — 형제 문항팩이 읽는 이름이라, 바꾸려면 계약 «판»을 같이 올린다`);
  }
});

test('② 동기화 목록은 손 목록이 아니다 — `계약/` 안 .json 전량이 대상이다', () => {
  const 실제 = fs.readdirSync(path.join(ROOT, '계약')).filter((f) => f.endsWith('.json')).sort();
  const 대상 = 동기화.대상들().map((p) => path.basename(p));
  assert.deepStrictEqual(대상, 실제,
    '새 계약이 동기화 밖에 남았다 — 그 침묵이 정확히 계약동기화가 막으려던 것이다');
  assert.ok(대상.includes('문법급수_계약.json') && 대상.includes('수집_교정_계약.json'),
    `분모가 비었다 — 동기화 대상 ${대상.length}개`);
});
