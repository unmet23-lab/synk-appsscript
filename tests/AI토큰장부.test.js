'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../엔진_콘텐츠AI.js'), 'utf8');
const start = source.indexOf('const AI_캐시최소토큰_ =');
const end = source.indexOf('// 공통 API 헬퍼', start);
assert.ok(start >= 0 && end > start, '실제 캐시 기준과 토큰 장부 구간을 읽어야 한다');

// 실제 장부·보고 함수를 실행한다. 외부 호출과 메일은 보내지 않는다.
function 기록과보고(model, tokens) {
  const mails = [];
  const ctx = vm.createContext({
    AI_FEEDBACK_MODEL: model,
    Logger: { log() {} },
    adminMail: (subject, body) => mails.push({ subject, body }),
  });
  new vm.Script(source.slice(start, end), { filename: '엔진_콘텐츠AI.js:토큰장부' }).runInContext(ctx);
  ctx.AI사용_기록_('스튜디오', { input_tokens: tokens, output_tokens: 1 });
  const report = ctx.AI사용_보고_();
  return { threshold: ctx.AI캐시선_(), report, mails };
}

for (const model of ['claude-fable-5-1', 'claude-mythos-5-1', 'claude-opus-5']) {
  test(`${model} — 입력 511토큰은 알리지 않고 512토큰부터 캐시 재검토를 알린다`, () => {
    const below = 기록과보고(model, 511);
    assert.equal(below.threshold, 512);
    assert.equal(below.mails.length, 0);
    const reached = 기록과보고(model, 512);
    assert.equal(reached.threshold, 512);
    assert.equal(reached.mails.length, 1);
    assert.match(reached.mails[0].body, /캐시 최소선\(512토큰\)/);
    assert.match(reached.report, /입력 512\(평균 512\)/);
  });
}

test('미등록 모델의 보수적 기본값은 4096토큰으로 유지한다', () => {
  const below = 기록과보고('unknown-model-for-test', 4095);
  assert.equal(below.threshold, 4096);
  assert.equal(below.mails.length, 0);
  const reached = 기록과보고('unknown-model-for-test', 4096);
  assert.equal(reached.threshold, 4096);
  assert.equal(reached.mails.length, 1);
  assert.match(reached.mails[0].body, /캐시 최소선\(4096토큰\)/);
});
