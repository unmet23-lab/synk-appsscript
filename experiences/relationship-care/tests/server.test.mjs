import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, MAX_AUDIO_BYTES } from '../server.mjs';

async function fixture(t, transcribe = async () => ({ text: '생일 축하해요.', raw: { response: { language: 'ko', durationSeconds: 2 } } }), options = {}) {
  const calls = [];
  const server = createServer({ port: 0, accountConfigPath: path.join(os.tmpdir(), 'synk-no-account-config', 'absent.json'), ...options, transcriber: { status: async () => ({ available: true, reason: 'test' }), close: async () => {}, transcribe: async input => { calls.push(Buffer.from(input.bytes)); return transcribe(input); } } });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: base, 'X-SYNK-Care': '1', 'Content-Type': 'audio/mpeg' };
  return { base, headers, calls };
}

test('local health and capability report actual limitations without paths or account material', async t => {
  const { base } = await fixture(t);
  const res = await fetch(base + '/api/capabilities');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await res.json(), { transcription: { available: true, reason: 'test', mode: 'local-whisper', maxBytes: MAX_AUDIO_BYTES, speakerSeparation: false }, cloudAI: false, accountSync: false, backgroundNotifications: false });
  const lunar = await fetch(base + '/lunar.mjs');
  assert.equal(lunar.status, 200);
  assert.match(lunar.headers.get('content-type'), /javascript/);
  assert.match(await lunar.text(), /export function lunarToSolar/);
});

async function callbackFixture(t, redirect = base => base + '/') {
  const reserve = http.createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'care-callback-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const accountConfigPath = path.join(dir, 'public.json');
  await writeFile(accountConfigPath, JSON.stringify({ version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://portal.example.test', clients: { care: { clientId: 'care-synthetic', redirectUri: redirect(`http://127.0.0.1:${port}`) } } }));
  return fixture(t, undefined, { port, accountConfigPath });
}
const returnHeaders = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
function navigation(url, headers = returnHeaders, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, path: url.slice(new URL(url).origin.length) }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}
test('registered cross-site OAuth approval and denial load only the return document', async t => {
  const { base, calls } = await callbackFixture(t);
  for (const query of ['code=synthetic-code&state=synthetic-state', 'error=access_denied&state=synthetic-state&error_description=Cancelled']) {
    const response = await navigation(`${base}/?${query}`);
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.match(response.body, /app\.mjs/);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
    assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  }
  assert.equal(calls.length, 0);
});
test('OAuth document exception keeps API, assets, frames, methods and malformed returns blocked', async t => {
  const { base, calls } = await callbackFixture(t);
  const valid = '/?code=synthetic-code&state=synthetic-state';
  const cases = [
    [valid, { ...returnHeaders, 'Sec-Fetch-Mode': 'cors' }],
    [valid, { ...returnHeaders, 'Sec-Fetch-Dest': 'iframe' }],
    [valid, { 'Sec-Fetch-Site': 'cross-site' }],
    [valid, { ...returnHeaders, Origin: 'https://portal.example.test' }],
    [valid, { ...returnHeaders, Host: 'evil.example' }],
    [valid, returnHeaders, 'HEAD'], [valid, returnHeaders, 'POST'],
    ['/'], ['/?state=state'], ['/?code=code'], ['/?code=&state=state'], ['/?code=code&state='],
    ['/?code=code&state=a&state=b'], ['/?code=a&code=b&state=state'],
    ['/?code=code&error=access_denied&state=state'], ['/?error=&state=state'],
    ['/?code=code&state=state&access_token=forbidden'], ['/?code=code&state=state&next=/'],
    ['/index.html?code=code&state=state'], ['/api/account-config?code=code&state=state'],
    ['/api/transcribe?code=code&state=state'], ['/app.mjs?code=code&state=state'],
    ['/assets/../?code=code&state=state'],
  ];
  for (const [url, headers, method] of cases) {
    const response = await navigation(base + url, headers ?? returnHeaders, method ?? 'GET');
    assert.equal(response.status, 403, `${method ?? 'GET'} ${url} ${JSON.stringify(headers)}`);
  }
  assert.equal(calls.length, 0);
});
test('unconfigured and differently registered callback hosts or paths cannot use the exception', async t => {
  const unconfigured = await fixture(t);
  assert.equal((await navigation(unconfigured.base + '/?code=code&state=state')).status, 403);
  for (const redirect of [base => base.replace('127.0.0.1', 'localhost') + '/', base => base + '/other', () => 'http://127.0.0.1:1/']) {
    const { base } = await callbackFixture(t, redirect);
    assert.equal((await navigation(base + '/?code=code&state=state')).status, 403);
  }
});

test('audio request invokes only supplied local engine and never returns internal metadata', async t => {
  let inputBytes;
  const { base, headers, calls } = await fixture(t, async input => { inputBytes = input.bytes; return { text: '생일 축하해요.', raw: { request: { privatePath: 'private' }, response: { language: 'ko', durationSeconds: 2 } } }; });
  const res = await fetch(base + '/api/transcribe', { method: 'POST', headers, body: Buffer.from('synthetic-audio') });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: '생일 축하해요.', language: 'ko', durationSeconds: 2, mode: 'local-whisper', speakerSeparation: false, needsReview: true });
  assert.equal(calls[0].toString(), 'synthetic-audio');
  assert.ok(inputBytes.every(byte => byte === 0));
});

test('rejects cross origin, missing custom header, host rebinding and private source reads', async t => {
  const { base, headers, calls } = await fixture(t);
  for (const badHeaders of [{ ...headers, Origin: 'https://example.com' }, { 'Content-Type': 'audio/mpeg', Origin: base }, { ...headers, Host: 'example.com' }, { ...headers, 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(base + '/api/transcribe', { method: 'POST', headers: badHeaders }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end('data');
    });
    assert.equal(status, 403, JSON.stringify(badHeaders));
  }
  for (const url of ['/server.mjs', '/tests/server.test.mjs', '/.runtime/local-stt.json', '/assets/../server.mjs', '/atlas/server.js', '/atlas/../server.mjs', '/atlas/trail-followup.js']) assert.equal((await fetch(base + url)).status, 404);
  assert.equal(calls.length, 0);
});

test('product engine modules load through an exact public allowlist', async t => {
  const { base } = await fixture(t);
  for (const pathname of ['/atlas/domain.js', '/atlas/ask.js', '/atlas/vellum-expression.js', '/care-followup.js', '/atlas/temper-outcomes.js', '/care-planner.mjs', '/care-personalization.mjs', '/care-support.mjs', '/care-outcomes.mjs', '/memory-card.mjs', '/memory-theme.mjs']) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 200, pathname); assert.match(response.headers.get('content-type'), /javascript/, pathname);
  }
  const policy = (await fetch(base + '/')).headers.get('content-security-policy');
  assert.match(policy, /img-src 'self' data: blob:/); assert.match(policy, /frame-src 'none'/);
});

test('rejects empty and unsupported uploads; returns generic local engine failure', async t => {
  const { base, headers, calls } = await fixture(t, async () => { throw new Error('SECRET LOCAL FILE PATH'); });
  assert.equal((await fetch(base + '/api/transcribe', { method: 'POST', headers, body: '' })).status, 400);
  assert.equal((await fetch(base + '/api/transcribe', { method: 'POST', headers: { ...headers, 'Content-Type': 'text/html' }, body: 'no' })).status, 415);
  const res = await fetch(base + '/api/transcribe', { method: 'POST', headers, body: 'bad audio' });
  assert.equal(res.status, 422); assert.doesNotMatch(await res.text(), /SECRET/); assert.equal(calls.length, 1);
});

test('oversized declared upload is rejected before transcribing', async t => {
  const { base, headers, calls } = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + '/api/transcribe', { method: 'POST', headers: { ...headers, 'Content-Length': MAX_AUDIO_BYTES + 1 } }, res => { res.resume(); resolve(res.statusCode); req.destroy(); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 413); assert.equal(calls.length, 0);
});

test('concurrent audio is rejected instead of mixing two people recordings', async t => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  const { base, headers } = await fixture(t, async () => { entered(); await waiting; return { text: '하나' }; });
  const first = fetch(base + '/api/transcribe', { method: 'POST', headers, body: 'one' });
  await started;
  try { assert.equal((await fetch(base + '/api/transcribe', { method: 'POST', headers, body: 'two' })).status, 409); }
  finally { release(); }
  assert.equal((await first).status, 200);
});

test('account config exposes only validated public clients and adds exact connection origins to CSP', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'care-config-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const accountConfigPath = path.join(dir, 'public.json');
  await writeFile(accountConfigPath, JSON.stringify({ version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://portal.example.test', accountApiUrl: 'https://api.example.test', clients: { care: { clientId: 'care', redirectUri: 'http://127.0.0.1:4296/' }, unknown: { secret: 'MUST_NOT_LEAK' } } }));
  const server = createServer({ port: 0, accountConfigPath, transcriber: { close: async () => {} } });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/account-config'), config = await response.json();
  assert.equal(config.clients.care.clientId, 'care');
  assert.equal(config.clients.unknown, undefined);
  assert.doesNotMatch(JSON.stringify(config), /MUST_NOT_LEAK/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/auth.example.test https:\/\/api.example.test;/);
  assert.equal((await fetch(base + '/account-core.mjs')).status, 200);
  assert.equal((await fetch(base + '/public.json')).status, 404);
});

test('invalid secret-bearing account config fails closed and cannot loosen CSP', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'care-config-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const accountConfigPath = path.join(dir, 'secret.json');
  await writeFile(accountConfigPath, JSON.stringify({ version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_secret_synthetic' }));
  const server = createServer({ port: 0, accountConfigPath, transcriber: { close: async () => {} } });
  await server.start(); t.after(() => server.stop());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/account-config`);
  assert.deepEqual(await response.json(), { version: 1, clients: {} });
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self';/);
});
