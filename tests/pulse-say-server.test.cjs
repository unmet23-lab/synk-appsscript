'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createQaRun } = require('./lib/pulse-qa-evidence.cjs');
const ROOT = path.resolve(__dirname, '..');
const REL = 'docs/마케팅/PULSE_AI모델_캐스팅_20260930';

test('PULSE 문장 서버: 잘못된 URL은 400으로 끝내고 다음 정상 요청도 처리한다', { timeout: 15_000 }, async t => {
  const run = createQaRun({ root: ROOT, label: 'pulse-say-server', sources: [REL + '/say-server.cjs', REL + '/roster-v2.json', REL + '/voices.json', 'tests/pulse-say-server.test.cjs'], synthetic: true });
  // 서버 원고를 독립 fixture에서 실행해 원본 site·캐시와 실제 키 경로를 쓰지 않는다.
  for (const file of ['say-server.cjs', 'roster-v2.json', 'voices.json']) fs.copyFileSync(path.join(ROOT, REL, file), path.join(run.dataDirectory, file));
  fs.mkdirSync(path.join(run.dataDirectory, 'site'));
  fs.writeFileSync(path.join(run.dataDirectory, 'site/index.html'), 'PULSE static control');
  const code = "global.fetch=()=>{throw Error('external API forbidden in URL regression')};const {server}=require('./say-server.cjs');server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port})+'\\n'));";
  const env = { ...process.env, TYPECAST_API_KEY: '' }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['-e', code], { cwd: run.dataDirectory, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '', ok = false;
  const checks = [];
  child.stderr.on('data', bytes => { stderr += bytes; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    fs.writeFileSync(path.join(run.out, 'server-stderr.txt'), stderr);
    run.finish({ ok, checks });
    console.log('PULSE 서버 근거: ' + path.relative(ROOT, run.manifestPath));
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('server start timeout')), 5000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('server exited before listening')); });
    child.stdout.on('data', bytes => {
      output += bytes;
      try { const value = JSON.parse(output.split('\n')[0]); if (value.port) { clearTimeout(timer); resolve(value.port); } } catch { /* 다음 줄을 기다린다 */ }
    });
  });
  const request = (requestPath, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', part => { body += part; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(3000, () => req.destroy(Error('request timeout'))); req.once('error', reject); req.end();
  });
  assert.equal((await request('/')).body, 'PULSE static control');
  for (const malformed of ['/%', '/%ZZ', '/%FF', '//', 'http://[::1']) {
    const bad = await request(malformed);
    assert.equal(bad.status, 400, malformed);
    assert.match(JSON.parse(bad.body).message, /요청/);
    const next = await request('/');
    assert.equal(next.status, 200); assert.equal(next.body, 'PULSE static control');
    assert.equal(child.exitCode, null);
    checks.push({ path: malformed, status: bad.status, nextStatus: next.status, serverAlive: true });
  }
  assert.equal((await request('/not-present')).status, 404);
  assert.equal((await request('/api/say')).status, 405);
  assert.equal((await request('/api/say', 'OPTIONS')).status, 204);
  assert.equal((await request('/', 'POST')).status, 405);
  assert.equal(stderr, '');
  ok = true;
});
