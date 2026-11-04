'use strict';
// qa 화면 스크립트의 전체 시간 한도(tools/lib/화면시험.cjs, 2026-11-04). 11-04에 코어 약 6개를 10~13시간 잡은 꼴을 실제 크롬으로 재현한다.
// 새 스크립트가 한도 안에서 도는지는 tests/화면시험관문.test.js가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 모듈 = path.join(ROOT, 'tools/lib/화면시험.cjs');
const { 닫기, 한도넘김코드 } = require(모듈);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const 여유ms = 60000;   // 바쁜 PC에서 프로세스가 끝나기까지의 여유 — 한도 자체는 한참 짧다

const 플레이라이트 = () => require.resolve('playwright', { paths: [ROOT, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] });

function 띄우기(t, 글, env = {}) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '화면시험-'));
  const 파일 = path.join(폴더, '스크립트.cjs');
  fs.writeFileSync(파일, 글);
  const 환경 = { ...process.env, ...env };
  if (!('SYNK_QA_LIMIT_SEC' in env)) delete 환경.SYNK_QA_LIMIT_SEC;
  const 시작 = Date.now();
  const 자식 = spawn(process.execPath, [파일], { stdio: ['ignore', 'pipe', 'pipe'], env: 환경 });
  const 받음 = { 출력: '', 오류: '' };
  자식.stdout.setEncoding('utf8');
  자식.stderr.setEncoding('utf8');
  자식.stderr.on('data', (d) => { 받음.오류 += d; });
  let 준비됨; const 준비 = new Promise((res) => { 준비됨 = res; });
  자식.stdout.on('data', (d) => { 받음.출력 += d; const m = /^준비 (.+)$/m.exec(받음.출력); if (m) 준비됨({ ...JSON.parse(m[1]) }); });
  const 끝 = new Promise((res) => 자식.on('exit', (code, signal) => res({ code, signal, 지난ms: Date.now() - 시작, 끝난때: Date.now() })));
  t.after(async () => {
    // 안 끝난 자식은 트리째 끈다 — node만 죽이면 브라우저 렌더러가 남는다. 살아 있는 부모에서 내려가므로 남의 프로세스에 닿지 않는다.
    if (자식.exitCode === null && 자식.signalCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(자식.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 30000 });
      else 자식.kill('SIGKILL');
    }
    for (let i = 0; i < 40; i += 1) { try { fs.rmSync(폴더, { recursive: true, force: true }); break; } catch { await sleep(100); } }
  });
  return { 자식, 받음, 준비, 끝 };
}

// Linux에는 트리 끄기가 없어 시험이 띄운 브라우저를 PID로 치운다.
const 리눅스치우기 = (준비값) => { if (process.platform !== 'win32' && 준비값) for (const pid of 준비값.pids) { try { process.kill(pid, 'SIGKILL'); } catch { /* 이미 없음 */ } } };
const 살아있나 = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
// 꺼진 PID를 다른 프로세스가 금세 다시 쓸 수 있어, 끝까지 살아 있는 것만 시작 시각으로 같은 프로세스인지 가린다.
function 시작시각(pid) {
  const 답 = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).StartTime.ToUniversalTime().ToString('o')`], { encoding: 'utf8', timeout: 60000 })
    : spawnSync('ps', ['-o', 'stat=', '-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 60000 });
  const 글 = String(답.stdout || '').trim();
  if (/^Z/.test(글)) return null;   // Linux의 좀비는 이미 끝난 것이다
  const 값 = Date.parse(글.replace(/^\S+\s+(?=\w{3} \w{3} )/, ''));
  return Number.isNaN(값) ? null : 값;
}
async function 남은브라우저(준비) {
  const 끝 = Date.now() + 30000;
  let 남은 = 준비.pids;
  while (Date.now() < 끝) {
    남은 = 준비.pids.filter(살아있나);
    if (!남은.length) return [];
    await sleep(200);
  }
  return 남은.filter((pid) => { const 시각 = 시작시각(pid); return 시각 !== null && 시각 <= 준비.at; });
}

const 브라우저머리 = () => `'use strict';
const { chromium } = require(${JSON.stringify(플레이라이트())});
const { 화면시험, 닫기 } = require(${JSON.stringify(모듈)});
async function 띄우기() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const cdp = await browser.newBrowserCDPSession();
  const pids = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.map((p) => p.id);
  console.log('준비 ' + JSON.stringify({ pids, at: Date.now() }));
  return { browser, page };
}
const 실패하는run = async () => {
  const { page } = await 띄우기();
  page.setDefaultTimeout(500);
  await page.locator('#없는것').click();   // 시간 초과로 던지고 browser.close()에 닿지 않는다
};
`;

test('대조: 옛 꼴은 실패를 잡고 main이 끝나도 node가 끝나지 않고 브라우저가 남는다', { timeout: 180000 }, async (t) => {
  const 실행 = 띄우기(t, `${브라우저머리()}
(async () => {
  try { await 실패하는run(); } catch { console.log('run 실패를 잡았다'); }
  console.log('main 끝');
})();`);
  let 준비값;
  t.after(() => 리눅스치우기(준비값));
  준비값 = await 실행.준비;
  for (let i = 0; i < 600 && !실행.받음.출력.includes('main 끝'); i += 1) await sleep(100);
  assert.match(실행.받음.출력, /main 끝/);
  const 끝남 = await Promise.race([실행.끝.then(() => true), sleep(3000).then(() => false)]);
  assert.equal(끝남, false, '이 꼴이 저절로 끝나게 바뀌었다면 Playwright 동작이 달라진 것이다');
  assert.ok(준비값.pids.some(살아있나));
});

test('실패를 잡고 닫지 않은 채 main이 끝나도 프로세스와 브라우저가 바로 끝난다', { timeout: 180000 }, async (t) => {
  const 실행 = 띄우기(t, `${브라우저머리()}
화면시험({ 초: 150 }, async () => {
  try { await 실패하는run(); } catch { console.log('run 실패를 잡았다'); }
  console.log('main 끝');
});`);
  const 준비값 = await 실행.준비;
  const 결과 = await 실행.끝;
  assert.match(실행.받음.출력, /main 끝/);
  assert.equal(결과.code, 0, 실행.받음.오류);
  assert.ok(결과.끝난때 - 준비값.at < 150000 - 1000, '한도까지 기다리지 않는다');
  assert.deepEqual(await 남은브라우저(준비값), []);
});

test('렌더러가 막혀 page.evaluate가 안 돌아와도 한도 안에 실패(124)로 끝나고 브라우저가 남지 않는다', { timeout: 180000 }, async (t) => {
  const 실행 = 띄우기(t, `${브라우저머리()}
(async () => {
  const { page } = await 띄우기();
  page.setDefaultTimeout(1000);
  화면시험({ 초: 3 }, async () => {
    page.evaluate(() => { setTimeout(() => { for (;;) {} }, 20); }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => 1);   // setDefaultTimeout이 닿지 않는다
    console.log('돌아옴');
  });
})();`);
  const 준비값 = await 실행.준비;
  const 결과 = await 실행.끝;
  assert.equal(결과.code, 한도넘김코드, 실행.받음.오류);
  assert.match(실행.받음.오류, /한도 3초를 넘겨/);
  assert.doesNotMatch(실행.받음.출력, /돌아옴/);
  const 지난 = 결과.끝난때 - 준비값.at;
  assert.ok(지난 >= 2500 && 지난 < 3000 + 여유ms, `준비에서 끝까지 ${지난}ms`);
  assert.deepEqual(await 남은브라우저(준비값), []);
});

test('node 주 스레드가 막혀도 강제 시계가 끝내고, Windows에서는 브라우저도 함께 끝난다', { timeout: 180000 }, async (t) => {
  const 실행 = 띄우기(t, `${브라우저머리()}
(async () => {
  await 띄우기();
  화면시험({ 초: 1, 강제여유초: 2 }, async () => { for (;;) {} });
})();`);
  const 준비값 = await 실행.준비;
  t.after(() => 리눅스치우기(준비값));
  const 결과 = await 실행.끝;
  assert.ok(결과.code !== 0, `종료 코드 ${결과.code} · 신호 ${결과.signal}`);
  assert.match(실행.받음.오류, /트리를 바로 끈다/);
  assert.ok(결과.끝난때 - 준비값.at < 3000 + 여유ms);
  if (process.platform === 'win32') assert.deepEqual(await 남은브라우저(준비값), []);   // 트리 끄기(taskkill /T)는 Windows에서만 한다
});

test('main이 끝나지 않은 채 할 일이 없어져도 성공으로 끝나지 않는다', { timeout: 120000 }, async (t) => {
  const 실행 = 띄우기(t, `const { 화면시험 } = require(${JSON.stringify(모듈)});
화면시험({ 초: 1 }, () => new Promise(() => {}));`);
  const 결과 = await 실행.끝;
  assert.equal(결과.code, 한도넘김코드, 실행.받음.오류);
});

test('main이 던지면 오류를 보이고 1, process.exitCode를 줬으면 그 값으로 끝난다 — 열린 서버가 있어도', { timeout: 120000 }, async (t) => {
  const 머리 = `const { 화면시험 } = require(${JSON.stringify(모듈)});
const 서버 = () => new Promise((res) => require('node:http').createServer().listen(0, '127.0.0.1', res));`;
  const 던짐 = 띄우기(t, `${머리}
화면시험({ 초: 90 }, async () => { await 서버(); throw Error('일부러 던짐'); });`);
  const 코드값 = 띄우기(t, `${머리}
화면시험({ 초: 90 }, async () => { await 서버(); process.exitCode = 3; });`);
  const [가, 나] = await Promise.all([던짐.끝, 코드값.끝]);
  assert.equal(가.code, 1);
  assert.match(던짐.받음.오류, /일부러 던짐/);
  assert.equal(나.code, 3);
});

test('파이프로 받은 긴 결과가 끝날 때 잘리지 않는다', { timeout: 120000 }, async (t) => {
  const 크기 = 4 * 1024 * 1024;
  const 실행 = 띄우기(t, `const { 화면시험 } = require(${JSON.stringify(모듈)});
화면시험({ 초: 90 }, async () => { console.log('가'.repeat(${크기})); console.log('끝줄'); });`);
  const 결과 = await 실행.끝;
  for (let i = 0; i < 100 && !실행.받음.출력.includes('끝줄'); i += 1) await sleep(100);
  assert.equal(결과.code, 0, 실행.받음.오류);
  assert.equal(실행.받음.출력.trim(), `${'가'.repeat(크기)}\n끝줄`.replace(/\r/g, ''));
});

test('SYNK_QA_LIMIT_SEC가 그 실행의 한도를 바꾸고, 한도를 안 주면 바로 알린다', { timeout: 120000 }, async (t) => {
  const 바꿈 = 띄우기(t, `const { 화면시험 } = require(${JSON.stringify(모듈)});
화면시험({ 분: 90 }, () => new Promise(() => {}));`, { SYNK_QA_LIMIT_SEC: '1' });
  const 없음 = 띄우기(t, `const { 화면시험 } = require(${JSON.stringify(모듈)});
화면시험({}, async () => {}).catch((e) => { console.error(e.message); process.exit(9); });`);
  const [가, 나] = await Promise.all([바꿈.끝, 없음.끝]);
  assert.equal(가.code, 한도넘김코드, 바꿈.받음.오류);
  assert.match(바꿈.받음.오류, /한도 1초를 넘겨/);
  assert.equal(나.code, 9);
  assert.match(없음.받음.오류, /한도가 없다/);
});

test('닫기: close가 안 돌아오거나 실패해도 정해진 시간 안에 넘어간다', async () => {
  const 시작 = Date.now();
  assert.equal(await 닫기({ close: () => new Promise(() => {}) }, { 초: 0.2 }), false);
  assert.ok(Date.now() - 시작 < 5000);
  assert.equal(await 닫기({ close: async () => { throw Error('이미 닫힘'); } }), false);
  assert.equal(await 닫기({ close: async () => {} }), true);
});
