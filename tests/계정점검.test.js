const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', '엔진_계정점검.js'), 'utf8');
function harness(options = {}) {
  const calls = [];
  const reads = [];
  const body = options.body ?? { model: 'claude-opus-5', content: [{ type: 'text', text: 'SYNK_ANTHROPIC_OK' }], usage: { input_tokens: 17, output_tokens: 9 } };
  const ctx = {
    AI_FEEDBACK_MODEL: 'claude-opus-5',
    ADMIN_EMAIL: Object.hasOwn(options, 'admin') ? options.admin : 'owner@example.test',
    Session: {
      getActiveUser() { if (options.sessionError) throw new Error('private-session-detail'); return { getEmail: () => options.active ?? 'owner@example.test' }; },
      getEffectiveUser() { return { getEmail: () => options.effective ?? 'owner@example.test' }; }
    },
    PropertiesService: { getScriptProperties() {
      if (options.propertiesError) throw new Error('private-property-detail');
      return { getProperty(name) {
        reads.push(name);
        if (name === '배치리허설_만료') return Object.hasOwn(options, 'rehearsal') ? options.rehearsal : null;
        if (name === 'CLAUDE_API_KEY') return options.key ?? 'SYNTHETIC_TEST_KEY';
        throw new Error('Unexpected property read');
      }, setProperty() { throw new Error('No property writes permitted'); }, deleteProperty() { throw new Error('No property deletion permitted'); } };
    } },
    UrlFetchApp: { fetch(url, request) {
      calls.push({ url, request });
      if (options.fetchError) throw new Error('SYNTHETIC_TEST_KEY secret error');
      return {
        getResponseCode: () => options.httpStatus ?? 200,
        getContentText: () => options.rawBody ?? JSON.stringify(body)
      };
    } }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { calls, reads, run: (...args) => JSON.parse(JSON.stringify(ctx.aiConnectionCheck(...args))) };
}

for (const [label, options] of [
  ['anonymous', { active: '' }], ['other account', { active: 'teacher@example.test' }],
  ['empty effective user', { effective: '' }], ['session error', { sessionError: true }],
  ['same other active and effective account', { active: 'teacher@example.test', effective: 'teacher@example.test' }],
  ['missing admin', { admin: '' }], ['null admin', { admin: null }]
]) test(label + ' is denied before keys or API', () => {
  const h = harness(options);
  assert.deepEqual(h.run(), { ok: false, stage: 'access' });
  assert.equal(h.reads.length, 0); assert.equal(h.calls.length, 0);
});

for (const rehearsal of ['', '0', 'expired', '2099-01-01']) test('rehearsal property presence blocks without deletion: ' + rehearsal, () => {
  const h = harness({ rehearsal });
  assert.deepEqual(h.run(), { ok: false, stage: 'rehearsal' });
  assert.deepEqual(h.reads, ['배치리허설_만료']); assert.equal(h.calls.length, 0);
});

test('missing key and property failure never call provider', () => {
  for (const options of [{ key: '' }, { propertiesError: true }]) {
    const h = harness(options); assert.equal(h.run().ok, false); assert.equal(h.calls.length, 0);
  }
});

test('owner receives bounded synthetic response and usage with exactly one request', () => {
  const h = harness();
  assert.deepEqual(h.run(), { ok: true, stage: 'response', httpStatus: 200, model: 'claude-opus-5', usage: { input_tokens: 17, output_tokens: 9 } });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(h.calls[0].request.followRedirects, false);
  const payload = JSON.parse(h.calls[0].request.payload);
  assert.equal(payload.model, 'claude-opus-5'); assert.equal(payload.max_tokens, 128);
  assert.deepEqual(payload.thinking, { type: 'disabled' });
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'Return exactly SYNK_ANTHROPIC_OK and nothing else.' }]);
});

test('caller parameters cannot change prompt, model, tokens or access', () => {
  const h = harness(); h.run({ prompt: 'student record', model: 'other-model', max_tokens: 999999 });
  const payload = JSON.parse(h.calls[0].request.payload);
  assert.equal(payload.max_tokens, 128); assert.equal(payload.model, 'claude-opus-5');
  assert.ok(!JSON.stringify(payload).includes('student record'));
  const denied = harness({ active: '' }); denied.run('owner@example.test'); assert.equal(denied.calls.length, 0);
});

for (const httpStatus of [302, 401, 402, 403, 429, 500]) test('HTTP ' + httpStatus + ' is not retried and does not expose body', () => {
  const h = harness({ httpStatus, rawBody: 'SYNTHETIC_TEST_KEY private body' });
  assert.deepEqual(h.run(), { ok: false, stage: 'provider', httpStatus }); assert.equal(h.calls.length, 1);
});

test('network and JSON errors are bounded without sensitive details or retries', () => {
  for (const options of [{ fetchError: true }, { rawBody: 'SYNTHETIC_TEST_KEY not JSON' }]) {
    const h = harness(options); assert.deepEqual(h.run(), { ok: false, stage: 'provider_exception' }); assert.equal(h.calls.length, 1);
  }
});

test('non-exact answer fails without returning response text', () => {
  const h = harness({ body: { content: [{ type: 'text', text: 'Unexpected private response' }] } });
  const r = h.run(); assert.equal(r.ok, false); assert.ok(!JSON.stringify(r).includes('private response'));
});

test('only safe numeric usage and bounded model name leave the function', () => {
  const h = harness({ body: { model: '<private>', content: [{ type: 'text', text: 'SYNK_ANTHROPIC_OK' }], usage: { input_tokens: null, output_tokens: '9', cache_creation_input_tokens: -1, cache_read_input_tokens: 0, secret: 'PRIVATE' } } });
  assert.deepEqual(h.run(), { ok: true, stage: 'response', httpStatus: 200, model: null, usage: { cache_read_input_tokens: 0 } });
});

test('deployment contracts remain deployer execution and myself-only API', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.executionApi.access, 'MYSELF');
});
