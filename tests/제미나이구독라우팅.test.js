'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 구독 = require('../tools/lib/제미나이구독호출.js');
const 검수 = require('../tools/codex-review.js');

test('Google AI Pro 구독 모델은 정책 픽과 정확히 대응하고 자동 하향하지 않는다', () => {
  assert.equal(구독.구독모델('gemini-3.1-pro-preview', 'high'), 'gemini-3.1-pro-high');
  assert.equal(구독.구독모델('gemini-3.8-flash', 'medium'), 'gemini-3.8-flash-medium');
  assert.throws(() => 구독.구독모델('gemini-3.1-pro-preview', 'medium'), /자동 대체하지 않는다/);
  assert.throws(() => 구독.구독모델('없는-model', 'high'), /지원하지 않는 픽/);
});
test('agy 스트림은 정확히 한 완료 결과만 받고 모델·구조 응답을 보존한다', () => {
  const raw = [
    JSON.stringify({ event: 'init', init: { model: 'gemini-3.1-pro-high', cwd: 'temp' } }),
    JSON.stringify({ event: 'step_update', step_update: { state: 'DONE' } }),
    JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '{"지적":[]}', structured_output: { 지적: [] }, usage: { total_tokens: 12 } } }),
  ].join('\n');
  const r = 구독.결과읽기(raw);
  assert.equal(r.init.model, 'gemini-3.1-pro-high');
  assert.deepEqual(r.result.structured_output, { 지적: [] });
  assert.throws(() => 구독.결과읽기('{"event":"init","init":{}}\n'), /하나가 아니다/);
});

test('구독 자식에는 API 비밀값과 유료 API 허용 변수를 넘기지 않는다', () => {
  const env = 구독.비밀환경걷기({ PATH: 'ok', OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: 'y', GEMINI_API_KEY: 'z', GOOGLE_GEMINI_BASE_URL: 'https://paid.example', SYNK_ALLOW_PAID_API: '1' });
  assert.deepEqual(env, { PATH: 'ok' });
});

test('Antigravity는 구독 기본 몫만 허용하고 크레딧·API 키 제공자 설정을 거절한다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-agy-settings-'));
  const p = path.join(d, 'settings.json');
  try {
    fs.writeFileSync(p, '{}');
    assert.deepEqual(구독.구독설정확인(p), { useG1Credits: false, sparseDefault: true });
    fs.writeFileSync(p, '{"useG1Credits":false}');
    assert.deepEqual(구독.구독설정확인(p), { useG1Credits: false, sparseDefault: false });
    fs.writeFileSync(p, '{"useG1Credits":true}');
    assert.throws(() => 구독.구독설정확인(p), /Use G1 Credits/);
    fs.writeFileSync(p, '{"modelProvider":"gemini"}');
    assert.throws(() => 구독.구독설정확인(p), /구독 통로가 아니다/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test('검수 기본은 로컬 구독·GitHub 무료 API이며 Vertex는 명시 경로만 쓴다', () => {
  const 로컬 = 검수.제미나이호출명세(null, {});
  assert.equal(로컬.통로, 'subscription');
  assert.equal(로컬.픽.model, 'gemini-3.1-pro-preview');
  assert.equal(path.basename(로컬.경로), '제미나이구독호출.js');

  const 깃허브 = 검수.제미나이호출명세(null, { GITHUB_ACTIONS: 'true' });
  assert.equal(깃허브.통로, 'free-api');
  assert.equal(깃허브.픽.model, 'gemini-3.8-flash');
  assert.deepEqual(깃허브.추가인자, ['--용도', '글']);

  const 유료 = 검수.제미나이호출명세(null, { SYNK_GEMINI_ROUTE: 'vertex' });
  assert.equal(유료.통로, 'vertex');
  assert.ok(유료.추가인자.includes('--유료-api'));
  assert.throws(() => 검수.제미나이통로({ SYNK_GEMINI_ROUTE: 'anything' }), /subscription\|free-api\|vertex/);
  assert.throws(
    () => 검수.제미나이호출명세({ model: 'gemini-3.1-pro-preview', thinking_level: 'high' }, { GITHUB_ACTIONS: 'true' }),
    /조용히 내리지 않는다/,
  );
});

test('구독 응답은 경로와 요청 모델이 모두 맞아야 같은 실행으로 인정한다', () => {
  const 픽 = { model: 'gemini-3.1-pro-preview' };
  assert.equal(검수.제미나이응답일치({ route: 'google-ai-pro-subscription', requestedModel: 픽.model }, 픽, 'subscription'), true);
  assert.equal(검수.제미나이응답일치({ route: 'vertex-paid-api', requestedModel: 픽.model }, 픽, 'subscription'), false);
});
