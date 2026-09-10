'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const c = require('../tools/lib/클로드구독검수.js');
const build = require('../tools/codex-build.js');
const auth = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' };
const value = { 완료: true, 요약: '검수 완료', 지적: [], 읽은파일: ['add.js'], 안본것: '실행·미제공 의존 코드' };
const wireValue = { completed: true, summary: '검수 완료', findings: [], read_files: ['add.js'], unreviewed: '실행·미제공 의존 코드' };
const envelope = overrides => ({ type: 'result', subtype: 'success', is_error: false,
  modelUsage: { 'claude-opus-5': { inputTokens: 10, outputTokens: 20 } }, structured_output: wireValue, ...overrides });
const wire = (result, model = c.기본.model) => [
  { type: 'system', subtype: 'init', model }, { type: 'assistant', message: { model } }, result,
].map(x => JSON.stringify(x)).join('\n');

test('구독 환경은 API·대체 공급자·유료 허용을 걷고 공식 OAuth만 유지한다', () => {
  const e = c.구독환경({ ANTHROPIC_API_KEY: 'test', ANTHROPIC_BASE_URL: 'test', CLAUDE_CODE_USE_VERTEX: '1',
    OPENAI_API_KEY: 'test', SYNK_ALLOW_PAID_API: '1', CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test', PATH: 'path' });
  assert.deepEqual(e, { CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test', PATH: 'path' });
});
test('API 인증·무료 계정·제3자 인증은 구독 검수로 인정하지 않는다', () => {
  assert.equal(c.구독인증(auth).subscriptionType, 'max');
  for (const change of [{ authMethod: 'api_key' }, { apiProvider: 'vertex' }, { loggedIn: false }, { subscriptionType: null }]) {
    assert.throws(() => c.구독인증({ ...auth, ...change }), /구독 OAuth/);
  }
});
test('실행 모델·완료·구조화·읽은 범위가 빠진 응답은 clean으로 기록하지 않는다', () => {
  assert.equal(c.결과확인(wire(envelope()), c.기본.model).모델, 'claude-opus-5');
  for (const result of [envelope({ subtype: 'error_max_turns' }), envelope({ modelUsage: { 'claude-sonnet-5': {} } }),
    envelope({ structured_output: { ...wireValue, completed: false } }), envelope({ structured_output: { ...wireValue, read_files: [] } }),
    envelope({ structured_output: { ...wireValue, findings: [{ severity: 'P9' }] } })]) assert.throws(() => c.결과확인(wire(result), c.기본.model));
  assert.throws(() => c.결과확인(wire(envelope(), 'claude-sonnet-5'), c.기본.model));
  assert.throws(() => c.결과확인(JSON.stringify(envelope()), c.기본.model));
  assert.deepEqual(c.결과확인(wire(envelope({ modelUsage: { 'claude-opus-5': {}, 'claude-haiku-4-5-20251001': {} } })), c.기본.model).보조회계모델, ['claude-haiku-4-5-20251001']);
});
test('실제 호출 인자는 Opus xhigh·safe mode·도구 없음이며 폴백을 요청하지 않는다', () => {
  const calls = [];
  const result = c.구독검수('synthetic source', { spawnImpl: (bin, args, options) => {
    calls.push({ bin, args, options });
    return { status: 0, stdout: args[0] === 'auth' ? JSON.stringify(auth) : wire(envelope()) };
  } });
  assert.equal(result.통로, 'claude-subscription-oauth');
  const args = calls[1].args;
  assert.ok(args.includes('--safe-mode') && args.includes('--no-session-persistence'));
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5');
  assert.equal(args[args.indexOf('--effort') + 1], 'xhigh');
  assert.ok(!args.includes('--fallback-model') && !args.includes('--bare'));
});
test('인증 실패는 추론 호출 0회로 끝나고 프로세스 실패도 모델을 다시 부르지 않는다', () => {
  let count = 0;
  assert.throws(() => c.구독검수('source', { spawnImpl: () => { count++; return { status: 0, stdout: JSON.stringify({ ...auth, authMethod: 'api_key' }) }; } }), /구독 OAuth/);
  assert.equal(count, 1);
  count = 0;
  assert.throws(() => c.구독검수('source', { spawnImpl: () => { count++; return count === 1 ? { status: 0, stdout: JSON.stringify(auth) } : { status: 1 }; } }), /전환하지 않는다/);
  assert.equal(count, 2);
});
test('같은 SHA의 옛 GPT 도장·짧은 SHA·다른 모델은 Claude 독립 검수를 대신하지 못한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-claude-ledger-'));
  const ledger = path.join(dir, 'review.jsonl');
  const sha = 'a'.repeat(40);
  const row = { 시각: '2026-09-11T00:00:00Z', 대상: { 종류: 'commit', 값: sha }, 지은쪽: 'gpt', 통로: 'claude-subscription-oauth',
    벤더들: ['claude'], 모델: { 분석: c.기본 }, 지적: [] };
  for (const bad of [{ ...row, 벤더들: ['codex'] }, { ...row, 통로: undefined },
    { ...row, 대상: { 종류: 'commit', 값: sha.slice(0, 8) } }, { ...row, 모델: { 분석: { model: 'claude-sonnet-5', effort: 'xhigh' } } }]) {
    fs.writeFileSync(ledger, JSON.stringify(bad) + '\n');
    assert.equal(build.검수행찾기(sha, ledger), null);
  }
  fs.writeFileSync(ledger, JSON.stringify(row) + '\n');
  assert.equal(build.검수행찾기(sha, ledger).통로, row.통로);
  fs.appendFileSync(ledger, JSON.stringify({ 종류: '무효', 무효행: row.시각 }) + '\n');
  assert.equal(build.검수행찾기(sha, ledger), null, '명시 무효화한 도장을 재사용하면 안 된다');
});
test('실행자는 자기 독립 검수 코드나 원격 판정기를 고칠 수 없다', () => {
  for (const file of ['tools/lib/클로드구독검수.js', 'tools/lib/github-review-judge.js']) {
    assert.deepEqual(build.범위밖([file], ['tools/lib/']), [file]);
  }
});
test('GPT 실행 커밋은 Claude 호출과 같은 SHA·모델·범위를 장부에 남긴다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-claude-build-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'add.js'), 'module.exports = (a,b) => a+b;\n');
  git('add', 'add.js'); git('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'synthetic source');
  const sha = git('rev-parse', 'HEAD');
  const ledger = path.join(dir, 'review.jsonl');
  let calls = 0;
  const result = build.검수부르기(dir, sha, 60, false, (prompt, options) => {
    calls++; assert.match(prompt, /module.exports/); assert.equal(options.model, c.기본.model);
    return { ...value, 모델: c.기본.model, 효력: c.기본.effort, 통로: 'claude-subscription-oauth', 인증: c.구독인증(auth) };
  }, ledger);
  assert.equal(result.종료, 0, result.꼬리); assert.equal(calls, 1);
  assert.equal(build.검수행찾기(sha, ledger).대상.값, sha);
  assert.deepEqual(result.행.벤더들, ['claude']);
  const rejected = build.검수부르기(dir, sha, 60, false, () => { throw new Error('quota'); }, ledger);
  assert.equal(rejected.종료, 2); assert.equal(rejected.행, null);
  assert.equal(fs.readFileSync(ledger, 'utf8').trim().split('\n').length, 1);
});
