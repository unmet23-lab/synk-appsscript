'use strict';
// tools/버려진화면스크립트.js를 실제 크롬 · Edge로 잰다(2026-11-04, Windows 전용 — Linux CI에서는 하는 일 없이 지나간다).
// 안 끝나는 옛 꼴 스크립트를 둘 띄우고, 도구는 --대상으로 시험이 띄운 번호에만 쓴다. 다른 세션의 브라우저에는 닿지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 도구 = path.join(ROOT, 'tools', '버려진화면스크립트.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const 플레이라이트 = () => require.resolve('playwright', { paths: [ROOT, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] });
const 살아있나 = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// 실패를 잡고 browser.close()를 건너뛴 앱화면 꼴: 브라우저가 남아 node가 안 끝나고, 페이지는 계속 CPU를 쓴다.
const 옛꼴 = (채널) => `'use strict';
const { chromium } = require(${JSON.stringify(플레이라이트())});
(async () => {
  const browser = await chromium.launch({ channel: ${JSON.stringify(채널)}, headless: true });
  const page = await browser.newPage();
  await page.setContent('<canvas></canvas>');
  await page.evaluate(() => { const 돌기 = () => { const 끝 = performance.now() + 40; while (performance.now() < 끝); setTimeout(돌기, 0); }; 돌기(); });
  const cdp = await browser.newBrowserCDPSession();
  const 목록 = (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  console.log('준비 ' + JSON.stringify({ pid: process.pid, pids: 목록.map((p) => p.id), 메인: 목록.find((p) => p.type === 'browser').id, 렌더러들: 목록.filter((p) => p.type === 'renderer').map((p) => p.id) }));
})();`;

function 띄우기(t, 폴더, 채널) {
  const 파일 = path.join(폴더, `${채널}.cjs`);
  fs.writeFileSync(파일, 옛꼴(채널));
  const 자식 = spawn(process.execPath, [파일], { stdio: ['ignore', 'pipe', 'pipe'] });
  let 받음 = '', 오류 = '';
  자식.stderr.on('data', (d) => { 오류 += d; });
  t.after(() => { if (자식.exitCode === null && 자식.signalCode === null) spawnSync('taskkill', ['/PID', String(자식.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 30000 }); });
  return new Promise((res, rej) => {
    자식.stdout.on('data', (d) => { 받음 += d; const m = /^준비 (.+)$/m.exec(받음); if (m) res({ 자식, ...JSON.parse(m[1]) }); });
    자식.on('exit', (code) => rej(Error(`옛 꼴 스크립트가 먼저 끝났다(${code}): ${오류.slice(0, 300)}`)));
  });
}

function 도구돌리기(기록, ...인자) {
  const r = spawnSync(process.execPath, [도구, '--실행', '--json', '--문턱분', '0', '--창초', '3', ...인자], { encoding: 'utf8', timeout: 150000, env: { ...process.env, SYNK_버려진화면스크립트_기록: 기록 } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

async function 사라질때까지(pids, 초 = 30) {
  const 끝 = Date.now() + 초 * 1000;
  while (Date.now() < 끝 && pids.some(살아있나)) await sleep(200);
  return pids.filter(살아있나);
}

test('끄기명령: 시작 시각이 다르면 그 번호를 끄지 않고, 같으면 끈다 — 표를 읽은 뒤 번호를 남이 물려받아도 안전하다', { timeout: 200000 }, async (t) => {
  if (process.platform !== 'win32') { t.diagnostic('Windows 전용 도구라 여기서는 재지 않는다'); return; }
  const { 프로세스읽기, 끄기명령 } = require(도구);
  const 자식 = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => { try { 자식.kill(); } catch { /* 이미 없음 */ } });
  const 끝남 = new Promise((res) => 자식.on('exit', res));
  await sleep(500);
  const 나 = 프로세스읽기().get(자식.pid);
  assert.ok(나, '표에 있어야 한다');
  끄기명령([{ pid: 자식.pid, 시작: 나.시작 - 3600000 }]);
  await sleep(500);
  assert.equal(살아있나(자식.pid), true, '시작 시각이 다르면 남의 프로세스로 본다');
  끄기명령([{ pid: 자식.pid, 시작: 나.시작 }]);
  await Promise.race([끝남, sleep(30000)]);
  assert.equal(살아있나(자식.pid), false, '시작 시각이 같으면 끈다');
});

test('실제 크롬 · Edge: 코어가 낮으면 남기고, 맞으면 지정한 트리만 끄며 옆 트리는 그대로다', { timeout: 300000 }, async (t) => {
  if (process.platform !== 'win32') { t.diagnostic('Windows 전용 도구라 여기서는 재지 않는다'); return; }
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '버려진실측-'));
  t.after(async () => { for (let i = 0; i < 40; i += 1) { try { fs.rmSync(폴더, { recursive: true, force: true }); break; } catch { await sleep(250); } } });
  const 기록 = path.join(폴더, '기록.jsonl');
  const 크롬 = await 띄우기(t, 폴더, 'chrome'), 엣지 = await 띄우기(t, 폴더, 'msedge');

  // 코어 기준을 못 넘으면 끄지 않는다
  const 남김 = 도구돌리기(기록, '--대상', String(크롬.pid), '--코어', '99');
  assert.equal(남김.결과.length, 1);
  assert.equal(남김.결과[0].결과, '남김');
  assert.equal(남김.결과[0].pid, 크롬.pid, '주인 node가 뿌리');
  assert.ok(남김.결과[0].코어 > 0.1, `쟀어야 할 코어 ${남김.결과[0].코어}`);
  assert.equal(살아있나(크롬.메인), true);

  // 지정한 크롬 트리만 끈다
  const 끔 = 도구돌리기(기록, '--대상', String(크롬.pid), '--코어', '0.01');
  assert.equal(끔.결과[0].결과, '끔', JSON.stringify(끔));
  assert.equal(살아있나(크롬.pid), false);
  assert.deepEqual(await 사라질때까지(크롬.pids), []);
  assert.equal(살아있나(엣지.pid), true, '옆 트리의 node는 그대로');
  // Edge의 보조 프로세스(Extractor 등)는 도구 없이도 저절로 사라지므로 메인과 렌더러로 본다(11-04 실측)
  assert.equal(살아있나(엣지.메인), true, '옆 트리의 브라우저 메인도 그대로');
  assert.ok(엣지.렌더러들.some(살아있나), '옆 트리의 렌더러도 그대로');

  // Edge도 같은 이름으로 잡힌다
  const 엣지끔 = 도구돌리기(기록, '--대상', String(엣지.pid), '--코어', '0.01');
  assert.equal(엣지끔.결과[0].결과, '끔', JSON.stringify(엣지끔));
  assert.deepEqual(await 사라질때까지([엣지.pid, ...엣지.pids]), []);

  const 줄들 = fs.readFileSync(기록, 'utf8').trim().split('\n').map((x) => JSON.parse(x));
  assert.deepEqual(줄들.map((x) => x.결과), ['남김', '끔', '끔']);

  // 끝난 번호를 다시 대상으로 주면 할 일이 없다
  assert.deepEqual(도구돌리기(기록, '--대상', String(크롬.pid), '--코어', '0.01'), { 후보: 0, 결과: [] });
});
