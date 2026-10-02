'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

const deps = createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = deps('playwright');
const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const candidate = fs.readFileSync(path.join(dir, 'after-마스코트.html'));
assert.equal(sha(candidate), manifest.candidate.sha256, '후보 HTML 지문');
assert.equal(sha(fs.readFileSync(path.join(root, manifest.stage.localPath))), manifest.stage.sha256, '추석 영상 지문');

const runtimeHashes = Object.fromEntries(Object.entries(manifest.protectedRemote)
  .filter(([p]) => p.includes('/bots/오버레이/')));
const marineHashes = Object.fromEntries(Object.entries(manifest.protectedRemote)
  .filter(([p]) => p.includes('/화면_1024/마린_')));
const exactRemote = { ...runtimeHashes, ...marineHashes };
const remotePaths = Object.keys(exactRemote);
const remoteCode = `const fs=require('fs'),crypto=require('crypto');const paths=${JSON.stringify(remotePaths)};const out={};for(const p of paths){const b=fs.readFileSync(p);out[p]={sha256:crypto.createHash('sha256').update(b).digest('hex'),base64:b.toString('base64')}}process.stdout.write(JSON.stringify(out));`;
const remoteJson = execFileSync('ssh', [
  '-i', path.join(os.homedir(), '.ssh', 'synk_radio'), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 'synk@34.71.111.97', 'node',
], { input: remoteCode, encoding: 'utf8', timeout: 90000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
const remote = JSON.parse(remoteJson);
const remoteAssets = new Map();
for (const p of remotePaths) {
  assert.equal(remote[p]?.sha256, exactRemote[p], '서버 파일이 검수 기준과 달라졌다: ' + path.basename(p));
  const bytes = Buffer.from(remote[p].base64, 'base64');
  assert.equal(sha(bytes), exactRemote[p], '전송된 파일 지문: ' + path.basename(p));
  remoteAssets.set(p.replace('/opt/synk-radio/지면', ''), bytes);
}

const query = new URLSearchParams({ 층: '마스코트,전광판', 크기: '.32', 자리: '중하', 바닥: '2.5', 부스: '1', DJ: '마린', 결: '추석보름달마당' });
const wrapper = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#171716}video{position:absolute;width:1280px;height:720px;object-fit:cover}iframe{position:absolute;width:1920px;height:1080px;transform:scale(.6666666667);transform-origin:0 0;border:0}</style><video autoplay muted loop playsinline src="/docs/라디오/무대영상/추석_자연생동_20260909_v2.mp4"></video><iframe src="/bots/오버레이/마스코트.html?${query}"></iframe>`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
const report = { at: new Date().toISOString(), scope: '실제 1280×720 방송 크기, 서버에 현재 배포된 마린 그림으로 12초 확인', errors: [], missing: [], checks: {} };

async function main() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (url === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(wrapper); }
    if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url === '/bots/오버레이/마스코트.html') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(candidate); }
    if (remoteAssets.has(url)) {
      res.writeHead(200, { 'content-type': mime[path.extname(url).toLowerCase()] || 'application/octet-stream' });
      return res.end(remoteAssets.get(url));
    }
    const file = path.resolve(root, '.' + url);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('outside root'); }
    fs.readFile(file, (e, b) => {
      if (e) { report.missing.push(url); res.writeHead(404); return res.end('missing'); }
      res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(b);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) report.missing.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    let mascot = page.frames().find((f) => decodeURIComponent(f.url()).includes('/마스코트.html'));
    if (!mascot) {
      await page.waitForEvent('framenavigated', {
        predicate: (f) => decodeURIComponent(f.url()).includes('/마스코트.html'),
        timeout: 30000,
      });
      mascot = page.frames().find((f) => decodeURIComponent(f.url()).includes('/마스코트.html'));
    }
    assert.ok(mascot, '마스코트 프레임 생성');
    await mascot.waitForFunction(() => typeof 준비 !== 'undefined' && 준비, { timeout: 30000 });
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.currentTime > 1 && !v.paused; }, { timeout: 15000 });
    await mascot.waitForFunction(() => {
      const h = document.querySelector('#마스코트틀 img.옷[data-이름="펠트헤드폰"]');
      return 현재DJ === '마린' && 현재차림 === '추석보름달마당' && h && !h.hidden && h.naturalWidth > 0
        && document.querySelectorAll('#부스 img.디스크').length === 2 && !document.querySelector('#부스').hidden;
    }, { timeout: 20000 });

    const before = await mascot.evaluate(() => [...document.querySelectorAll('#부스 .디스크')].map((e) => getComputedStyle(e).transform));
    await page.waitForTimeout(1400);
    const after = await mascot.evaluate(() => ({
      DJ: 현재DJ,
      scene: 현재차림,
      ready: 준비,
      videoTime: parent.document.querySelector('video').currentTime,
      visibleMascot: [...document.querySelectorAll('#마스코트틀 img')].filter((e) => !e.hidden && getComputedStyle(e).display !== 'none').map((e) => ({ name: decodeURIComponent(e.src).split('/').at(-1), width: e.naturalWidth })),
      headset: (() => { const e = document.querySelector('#마스코트틀 img.옷[data-이름="펠트헤드폰"]'); return { loaded: !!e && !e.hidden && e.naturalWidth > 0, width: e?.naturalWidth, rect: e?.getBoundingClientRect().toJSON() }; })(),
      booth: { hidden: document.querySelector('#부스').hidden, rect: document.querySelector('#부스').getBoundingClientRect().toJSON() },
      mascotRect: document.querySelector('#마스코트틀').getBoundingClientRect().toJSON(),
      discTransforms: [...document.querySelectorAll('#부스 .디스크')].map((e) => getComputedStyle(e).transform),
      discsLoaded: [...document.querySelectorAll('#부스 .디스크')].map((e) => e.naturalWidth > 0),
    }));
    report.checks.initialDiscTransforms = before;
    report.checks.after = after;
    report.checks.discsRotated = after.discTransforms.some((x, i) => x !== before[i]);

    mascot.evaluate(() => window.마스코트반응({ 종류: '결', 결: '반딧불노을들판', DJ: '까몽' }));
    await page.waitForTimeout(2400);
    report.checks.afterSongBoundarySignal = await mascot.evaluate(() => ({ DJ: 현재DJ, scene: 현재차림, boothHidden: document.querySelector('#부스').hidden }));
    await page.screenshot({ path: path.join(dir, '미리보기.png') });

    assert.equal(after.DJ, '마린');
    assert.equal(after.scene, '추석보름달마당');
    assert.equal(after.ready, true);
    assert.equal(after.headset.loaded, true, '헤드폰 층 로드');
    assert.equal(after.booth.hidden, false, '부스 표시');
    assert.ok(after.discsLoaded.every(Boolean), '양쪽 디스크 로드');
    assert.equal(report.checks.discsRotated, true, '디스크 회전');
    assert.ok(after.videoTime > 1, '추석 배경 영상 재생');
    assert.deepEqual(report.checks.afterSongBoundarySignal, { DJ: '마린', scene: '추석보름달마당', boothHidden: false }, '곡 장면 신호 뒤에도 마린/추석/부스 고정');
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.equal(report.missing.length, 0, JSON.stringify(report.missing));
    report.passed = true;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(path.join(dir, '로컬검수.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, errors: report.errors, missing: report.missing }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
