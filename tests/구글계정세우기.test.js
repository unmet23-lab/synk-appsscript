'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const tool = path.join(__dirname, '..', 'tools', '구글계정세우기.js');
const source = fs.readFileSync(tool, 'utf8');

function 응답(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function 조회실행(args, { 프로젝트있음 = true } = {}) {
  const calls = [], writes = [], unlinks = [], logs = [];
  const payload = Buffer.from(JSON.stringify({ email: 'test@example.com' })).toString('base64url');
  const credential = JSON.stringify({
    ...(프로젝트있음 ? { 프로젝트: 'synk-existing' } : {}),
    tokens: { default: { client_id: 'client', client_secret: 'secret', refresh_token: 'refresh', id_token: `x.${payload}.x` } },
  });
  const fakeFs = {
    existsSync: () => true,
    readFileSync: () => credential,
    writeFileSync: (...xs) => writes.push(xs),
    unlinkSync: (...xs) => unlinks.push(xs),
  };
  const fakeProcess = {
    argv: ['node', tool, ...args],
    env: { SYNK_VERTEX_OAUTH: 'C:\\test-only\\oauth.json' },
    stdout: { write: () => {} },
    exit(code) { throw new Error(`unexpected exit ${code}`); },
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).includes('oauth2.googleapis.com/token')) return 응답(200, { access_token: 'token' });
    if (String(url).includes('/v1/projects?')) return 응답(200, {
      projects: 프로젝트있음 ? [{ projectId: 'synk-existing', projectNumber: '123', name: 'SYNK' }] : [],
    });
    if (String(url).endsWith('/billingAccounts')) return 응답(200, { billingAccounts: [{ name: 'billingAccounts/TEST', displayName: 'Trial', open: true }] });
    if (String(url).endsWith('/billingInfo')) return 응답(200, { billingEnabled: true, billingAccountName: 'billingAccounts/TEST' });
    if (String(url).includes('/services?filter=')) return 응답(200, { services: [] });
    throw new Error(`unexpected URL ${url}`);
  };
  await vm.runInNewContext(source, {
    __dirname: path.dirname(tool), Buffer, URLSearchParams, setTimeout,
    process: fakeProcess, fetch,
    console: { log: (...xs) => logs.push(xs.join(' ')), error: (...xs) => logs.push(xs.join(' ')) },
    require(id) {
      if (id === 'fs') return fakeFs;
      if (id === 'os') return os;
      if (id === 'path') return path;
      throw new Error(`unexpected require ${id}`);
    },
  }, { filename: tool });
  return { calls, writes, unlinks, logs };
}

test('프로젝트가 없어도 조회 모드는 새 프로젝트를 만들지 않는다', async () => {
  const r = await 조회실행(['--재보기'], { 프로젝트있음: false });
  const 생성 = r.calls.filter((c) => c.url.endsWith('/v1/projects') && c.method === 'POST');
  assert.deepEqual(생성, []);
  assert.equal(r.writes.length + r.unlinks.length, 0);
  assert.match(r.logs.join('\n'), /프로젝트를 만들지 않았다/);
});
for (const args of [[], ['--재보기']]) {
  test(`${args.length ? '--재보기' : '기본'}는 조회만 하고 Google 자원·자격 파일을 바꾸지 않는다`, async () => {
    const r = await 조회실행(args);
    const 바꾸는호출 = r.calls.filter((c) => c.method !== 'GET' && !c.url.includes('oauth2.googleapis.com/token'));
    assert.deepEqual(바꾸는호출, []);
    assert.equal(r.writes.length, 0);
    assert.equal(r.unlinks.length, 0);
    assert.ok(r.logs.some((s) => s.includes('조회 전용')));
  });
}

test('실제 Google 자원 변경은 --적용 뒤에만 놓여 있다', () => {
  assert.match(source, /const 적용 = 인자\.includes\('--적용'\)/);
  assert.ok(source.indexOf('if (!적용)') < source.indexOf('services/${api}:enable'));
  assert.ok(source.indexOf('if (!적용)') < source.indexOf("방법: 'PUT'"));
  assert.ok(source.indexOf('if (!적용)') < source.indexOf('fs.writeFileSync(자격파일'));
});
