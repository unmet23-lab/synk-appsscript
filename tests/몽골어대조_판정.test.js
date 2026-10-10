'use strict';
/* 몽골어 검문 — 문법 층 답 해석의 «실패 방향» 회귀 (2026-09-06 · 철학 5회차 심문 아스트라 A6)
 *
 * 무엇을 지키나: 산문 폴백이 「판정: 정상 아님」을 `정상` 으로 읽던 구멍. 부정 판정을 통과로 읽으면
 *   다른 층이 초록일 때 «종합 통과»에 보태져 「판정불능은 통과가 아니다」가 깨진다.
 *
 * 실제 제미나이 왕복은 하지 않는다. 아래 main 검사는 API와 파일 입출력을 메모리 대역으로 바꾼다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const 대조 = require(path.join(path.resolve(__dirname, '..'), 'tools', '몽골어대조.js'));

test('🔴 「정상 아님」은 정상이 아니다 — 부정이 붙으면 판정불능(null · 통과 아님)', () => {
  assert.strictEqual(대조.판정추출('판정: 정상 아님. 문법이 파손되어 있습니다.'), null);
  assert.strictEqual(대조.판정추출('판정: 정상이 아닙니다'), null);
  assert.strictEqual(대조.판정추출('판정: 정상적이지 않습니다'), null);
  assert.strictEqual(대조.판정추출('판정 : 정상은 아님'), null);
  /* 「파손 아님」을 정상으로 뒤집어 읽지도 않는다 — 산문은 못 믿는다 */
  assert.strictEqual(대조.판정추출('판정: 파손 아님'), null);
  /* 6회차 심문(아스트라) — 부정이 몇 어절 뒤에 오는 꼴 셋이 첫 수리를 지나갔다 */
  assert.strictEqual(대조.판정추출('판정: 정상으로 볼 수 없습니다.'), null);
  assert.strictEqual(대조.판정추출('판정: 정상이라 할 수 없다'), null);
  assert.strictEqual(대조.판정추출('판정: 정상 범위에 들지 못한다'), null);
  /* 마침표 «뒤»의 부정은 다른 문장이다 — 여기서 「없음」은 판정을 뒤집지 않는다 */
  assert.strictEqual(대조.판정추출('판정: 정상. 이유: 문제 없음'), '정상');
});

test('부정이 없으면 그대로 읽는다 — 정상·어색·파손 셋', () => {
  assert.strictEqual(대조.판정추출('판정: 정상'), '정상');
  assert.strictEqual(대조.판정추출('판정: 정상. 이유 없음'), '정상');
  assert.strictEqual(대조.판정추출('판정：정상입니다'), '정상');
  assert.strictEqual(대조.판정추출('판정: 어색 — 조사가 어긋났다'), '어색');
  assert.strictEqual(대조.판정추출('판정: 파손'), '파손');
  assert.strictEqual(대조.판정추출('아무 말도 없다'), null);
  assert.strictEqual(대조.판정추출(''), null);
});

test('문법파싱 — JSON 이 1순위, 산문은 폴백, 부정 산문은 null 로 실패한다', () => {
  assert.deepStrictEqual(
    대조.문법파싱(JSON.stringify({ 판정: '어색', 이유: 'x', 문제문장: 'y' })),
    { 판정: '어색', 이유: 'x', 문제문장: 'y' },
  );
  assert.strictEqual(대조.문법파싱('판정: 정상 아님. 문법이 파손되어 있습니다.'), null);
  const 산문 = 대조.문법파싱('판정: 정상\n이유: 없음');
  assert.ok(산문 && 산문.판정 === '정상', '부정 없는 산문은 그대로 읽는다');
});

test('실제 CLI 판정은 뜻 검토를 대기시키며 정상·정상 아님을 자동 통과시키지 않는다', async () => {
  const filename = path.resolve(__dirname, '../tools/몽골어대조.js');
  const source = fs.readFileSync(filename, 'utf8');
  for (const grammar of [JSON.stringify({ 판정: '정상', 이유: '' }), '판정: 정상 아님']) {
    const logs = [], ledger = [];
    const fakeProcess = { argv: ['node', filename, '안녕하세요', 'Сайн байна уу.'], env: {}, stdout: { isTTY: false }, exit(code) { throw new Error(`unexpected exit ${code}`); } };
    const fakeFs = {
      existsSync: () => true,
      readFileSync: () => 'test-key',
      mkdirSync() {},
      appendFileSync(_file, row) { ledger.push(JSON.parse(row)); },
    };
    const mockedRequire = (id) => {
      if (id === 'fs') return fakeFs;
      if (id === './모델정책.js') return { 기본용도: () => '글', 제미나이설정: () => ({ model: 'test-model', thinking_level: 'high' }), 제미나이키경로: () => 'test-key-file' };
      if (id === './lib/몽골어맞춤법.js') return { 맞춤법검사: async () => ({ 의심: [], 허용: [], 제안: {} }) };
      if (id === './lib/제미나이호출.js') return { 제미나이: async (_key, _model, _prompt, options) => options.schema ? grammar : '안녕하세요', 재시도가능: () => false };
      if (id === 'path' || id === 'crypto') return require(id);
      throw new Error(`unexpected dependency ${id}`);
    };
    await vm.runInNewContext(source + '\nmain();', {
      require: mockedRequire, module: { exports: {} }, __dirname: path.dirname(filename),
      process: fakeProcess, console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) }, Buffer,
    }, { filename });
    assert.strictEqual(fakeProcess.exitCode, 2);
    assert.strictEqual(ledger.length, 1);
    assert.strictEqual(ledger[0].통과, false);
    assert.strictEqual(ledger[0].층.뜻, null);
    const outcome = require('../tools/몽골어출구.js').한판읽기(logs.join('\n'), fakeProcess.exitCode);
    assert.strictEqual(outcome.갈래, '검수');
    assert.strictEqual(ledger[0].사유, grammar.startsWith('{') ? '공식 앱 뜻 검토 대기' : '판정불능');
  }
});
