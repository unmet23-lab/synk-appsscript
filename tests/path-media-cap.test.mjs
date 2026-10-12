// PATH 공개 미디어 월 한도 차단 함수(tools/path-media-cap/index.js)를 가짜 Functions Framework와 가짜 GCS로 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let handler;
const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === '@google-cloud/functions-framework') return { cloudEvent: (name, fn) => { if (name === 'cap') handler = fn; } };
  return originalLoad.call(this, request, ...rest);
};
try { require('../tools/path-media-cap/index.js'); } finally { Module._load = originalLoad; }

const DAY = 86_400_000;
// 결제 기간은 태평양 시간 자정(1일 07:00 또는 08:00 UTC)에 시작한다. 시험에서는 지금(이번 기간)과 40일 전(지난 기간)을 쓴다.
const periodStart = (monthsBack = 0) => new Date(Date.now() - monthsBack * 40 * DAY).toISOString();
const OWNER = { role: 'roles/storage.legacyBucketOwner', members: ['projectOwner:synk-path-media'] };
const open = () => ({ version: 1, bindings: [structuredClone(OWNER), { role: 'roles/storage.objectViewer', members: ['allUsers'] }] });
const closed = () => ({ version: 1, bindings: [structuredClone(OWNER)] });
const note = (body, publishTime) => ({ data: { message: { data: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64'), ...(publishTime ? { publishTime } : {}) } } });
const budgetNote = (costAmount, extra = {}) => ({ costAmount, budgetAmount: 10000, currencyCode: 'KRW', costIntervalStart: periodStart(), ...extra });

async function run(bucket, message, { failOnce } = {}) {
  const calls = [], logs = [];
  let failed = false;
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const reply = (json) => ({ ok: true, status: 200, json: async () => structuredClone(json) });
    if (url.startsWith('http://metadata.google.internal/')) { assert.equal(init.headers['Metadata-Flavor'], 'Google'); return reply({ access_token: 'token' }); }
    assert.ok(url.startsWith('https://storage.googleapis.com/storage/v1/b/synk-path-media'), url);
    assert.equal(init.headers.Authorization, 'Bearer token');
    const suffix = url.slice('https://storage.googleapis.com/storage/v1/b/synk-path-media'.length);
    calls.push(`${method} ${suffix}`);
    if (failOnce === `${method} ${suffix}` && !failed) { failed = true; return { ok: false, status: 503, json: async () => ({ error: 'backend' }) }; }
    // Like GCS: the IAM etag follows the bucket metageneration, which any label or IAM change moves.
    bucket.meta ??= 1;
    if (suffix === '/iam?optionsRequestedPolicyVersion=3' && method === 'GET') return reply({ ...bucket.policy, etag: 'm' + bucket.meta });
    if (suffix === '/iam' && method === 'PUT') {
      const body = JSON.parse(init.body);
      if (body.etag !== 'm' + bucket.meta) return { ok: false, status: 412, json: async () => ({ error: { code: 412 } }) };
      bucket.meta += 1; bucket.policy = { version: body.version, bindings: body.bindings }; return reply(bucket.policy);
    }
    if (suffix === '?fields=labels' && method === 'GET') return reply({ labels: bucket.labels });
    if (suffix === '?fields=labels' && method === 'PATCH') {
      bucket.meta += 1;
      for (const [key, value] of Object.entries(JSON.parse(init.body).labels)) { if (value === null) delete bucket.labels[key]; else bucket.labels[key] = value; }
      return reply({ labels: bucket.labels });
    }
    throw new Error('unexpected request ' + method + ' ' + url);
  };
  const saved = { fetch: globalThis.fetch, log: console.log };
  globalThis.fetch = fetch; console.log = (line) => logs.push(JSON.parse(line));
  let error = null;
  try { await handler(message); } catch (caught) { error = caught; } finally { globalThis.fetch = saved.fetch; console.log = saved.log; }
  const isPublic = bucket.policy.bindings.some((binding) => binding.role === 'roles/storage.objectViewer' && !binding.condition && binding.members.includes('allUsers'));
  return { action: logs.at(-1)?.action, reason: logs.at(-1)?.reason, isPublic, capped: bucket.labels['budget-capped'] === 'yes', bucket, calls, error };
}
const writes = (calls) => calls.filter((call) => call.startsWith('PUT') || call.startsWith('PATCH'));

test('reaching the monthly budget marks the bucket first, then closes public reads', async () => {
  const sent = '2026-10-20T03:00:00.250Z';
  const result = await run({ policy: open(), labels: { purpose: 'path-public-media' } }, note(budgetNote(10000), sent));
  assert.equal(result.action, 'closed');
  assert.equal(result.isPublic, false);
  assert.equal(result.capped, true);
  assert.deepEqual(writes(result.calls), ['PATCH ?fields=labels', 'PUT /iam']);
  assert.equal(result.calls.filter((call) => call.startsWith('GET /iam')).length, 2, 'the policy is read again after the label change');
  assert.equal(result.bucket.labels.purpose, 'path-public-media', 'other labels stay');
  assert.equal(result.bucket.labels['budget-acted-at'], String(Date.parse(sent)));
  assert.deepEqual(result.bucket.policy.bindings, [OWNER], 'no empty binding is written and the owner binding stays');
});

test('a close interrupted between the label and the IAM change finishes when the notice is delivered again', async () => {
  const bucket = { policy: open(), labels: {} }, message = note(budgetNote(10500), '2026-10-20T03:00:00Z');
  const first = await run(bucket, message, { failOnce: 'PUT /iam' });
  assert.ok(first.error, 'the failure is thrown so Pub/Sub delivers the notice again');
  assert.equal(first.isPublic, true);
  assert.equal(first.capped, true);
  const retry = await run(bucket, message);
  assert.equal(retry.action, 'closed');
  assert.equal(retry.isPublic, false);
});

test('a new month (cost under budget) reopens only a bucket this function closed, IAM first', async () => {
  const reopened = await run({ policy: closed(), labels: { 'budget-capped': 'yes', 'budget-acted-at': '1' } }, note(budgetNote(0), '2026-11-01T09:00:00Z'));
  assert.equal(reopened.action, 'reopened');
  assert.equal(reopened.isPublic, true);
  assert.equal(reopened.capped, false);
  assert.deepEqual(writes(reopened.calls), ['PUT /iam', 'PATCH ?fields=labels']);
  // Someone closed it by hand (no label): stays closed.
  const manual = await run({ policy: closed(), labels: {} }, note(budgetNote(0)));
  assert.equal(manual.action, 'none');
  assert.equal(manual.isPublic, false);
  assert.deepEqual(writes(manual.calls), []);
});

test('a reopen interrupted before the label is removed is tidied by the next notice', async () => {
  const bucket = { policy: closed(), labels: { 'budget-capped': 'yes' } }, message = note(budgetNote(0), '2026-11-01T09:00:00Z');
  const first = await run(bucket, message, { failOnce: 'PATCH ?fields=labels' });
  assert.ok(first.error);
  assert.equal(first.isPublic, true);
  assert.equal(first.capped, true);
  const retry = await run(bucket, message);
  assert.equal(retry.action, 'label-cleared');
  assert.equal(retry.isPublic, true);
  assert.equal(retry.capped, false);
});

test('notices from a previous period or sent before the last change are ignored', async () => {
  const stale = await run({ policy: open(), labels: {} }, note(budgetNote(15000, { costIntervalStart: periodStart(1) })));
  assert.equal(stale.action, 'ignored');
  assert.equal(stale.reason, 'previous period');
  assert.equal(stale.calls.length, 0);
  // An under-budget notice from earlier this month arriving after the close must not reopen.
  const late = await run({ policy: closed(), labels: { 'budget-capped': 'yes', 'budget-acted-at': String(Date.parse('2026-10-20T03:00:00Z')) } }, note(budgetNote(9000), '2026-10-20T02:30:00Z'));
  assert.equal(late.action, 'ignored');
  assert.equal(late.reason, 'older than the last change');
  assert.equal(late.isPublic, false);
  assert.deepEqual(writes(late.calls), []);
});

test('the previous-period check follows the billing month in US Pacific time, daylight saving included', async () => {
  const realNow = Date.now;
  try {
    for (const [now, start, expected] of [
      ['2026-12-01T07:30:00Z', '2026-11-01T07:00:00Z', 'closed'],   // PST: 23:30 on Nov 30 in Pacific time, November still runs
      ['2026-12-01T08:30:00Z', '2026-11-01T07:00:00Z', 'ignored'],  // December began at 08:00Z
      ['2026-10-01T06:30:00Z', '2026-09-01T07:00:00Z', 'closed'],   // PDT: September still runs
      ['2026-10-01T07:30:00Z', '2026-09-01T07:00:00Z', 'ignored'],  // October began at 07:00Z
    ]) {
      Date.now = () => Date.parse(now);
      const result = await run({ policy: open(), labels: {} }, note(budgetNote(12000, { costIntervalStart: start }), now));
      assert.equal(result.action, expected, `${now} with a period from ${start}`);
    }
  } finally { Date.now = realNow; }
});

test('repeated notifications change nothing', async () => {
  for (const [bucket, body] of [
    [{ policy: open(), labels: {} }, budgetNote(2500)],
    [{ policy: closed(), labels: { 'budget-capped': 'yes' } }, budgetNote(12000)],
  ]) {
    const result = await run(bucket, note(body));
    assert.equal(result.action, 'none');
    assert.deepEqual(writes(result.calls), [], JSON.stringify(body));
  }
});

test('conditional bindings are read with policy version 3 and kept', async () => {
  const conditional = { role: 'roles/storage.objectViewer', members: ['user:reviewer@example.com'], condition: { title: 'until', expression: 'request.time < timestamp("2027-01-01T00:00:00Z")' } };
  const policy = { ...open(), version: 3, bindings: [...open().bindings, conditional] };
  const result = await run({ policy, labels: {} }, note(budgetNote(10000)));
  assert.equal(result.action, 'closed');
  assert.equal(result.bucket.policy.version, 3);
  assert.deepEqual(result.bucket.policy.bindings, [OWNER, conditional]);
});

test('messages that are not budget notifications are ignored without touching the bucket', async () => {
  for (const message of [note('not json'), note({ budgetDisplayName: 'x' }), note({ costAmount: 5, budgetAmount: 0 }), { data: {} }, {}]) {
    const result = await run({ policy: open(), labels: {} }, message);
    assert.equal(result.action, 'ignored');
    assert.equal(result.isPublic, true);
    assert.equal(result.calls.length, 0);
  }
});
