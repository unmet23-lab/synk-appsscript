// 실제 공개 주소(https://synk.im/account/platform.html)에서 계정 라이브러리를 본다 — 1440·390, 콘솔 오류·가로 넘침·화면 글·캡처.
//   node check-live.cjs <공개본 폴더(옛판을 돌려 old-src가 있는)> <후보 폴더> <캡처 폴더>
// ① 연결: 로그인 전 상자를 열고 「계정 라이브러리 연결」을 누른다(live = 공개본 그대로, candidate = 묶음·페이지·라이브러리 CSS만 끼움).
// ② 로그인 뒤: 시험 계정 없이, 페이지 안에 가짜 웹 계정 호스트(네트워크 없음)를 둔 라이브러리를 하나 더 붙여 찍는다.
//    old = 되살린 옛 판(공개본과 바이트 같은 판) 묶음, new = 후보 묶음에서 뗀 모듈. new일 때는 후보 셋도 끼운다.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const L = require('./live-modules.cjs');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [liveDir, dir, shots] = process.argv.slice(2);
if (!liveDir || !dir || !shots) throw Error('node check-live.cjs <공개본 폴더> <후보 폴더> <캡처 폴더>');
const files = { '/account/dist/platform.js': ['account__dist__platform.js', 'text/javascript; charset=utf-8'], '/account/platform.html': ['account__platform.html', 'text/html; charset=utf-8'], '/account/src/platform-library.css': ['account__src__platform-library.css', 'text/css; charset=utf-8'] };
fs.mkdirSync(shots, { recursive: true });
const oldRoot = path.join(liveDir, 'old-src');
if (!fs.existsSync(oldRoot)) throw Error('먼저 node patch-live.cjs 옛판 ' + liveDir);
const modules = {
  old: L.esbuild.buildSync({ absWorkingDir: oldRoot, entryPoints: ['experiences/synk-account/src/platform-library-view.mjs'], bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8' }).outputFiles[0].text,
  new: L.testModule(fs.readFileSync(path.join(dir, 'account__dist__platform.js'), 'utf8')),
};
const candidateRoutes = async page => { for (const [pathname, [name, type]] of Object.entries(files)) await page.route(url => { const u = new URL(url); return u.origin === 'https://synk.im' && u.pathname === pathname; }, route => route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(path.join(dir, name)) })); };
async function open(browser, width, routes, hash) {
  const page = await browser.newPage({ viewport: { width, height: width > 500 ? 1100 : 900 } }), errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  if (routes) await candidateRoutes(page);
  return { page, errors, go: () => page.goto('https://synk.im/account/platform.html?probe=library-' + Date.now() + hash, { waitUntil: 'networkidle' }) };
}
const mountInPage = async () => {
  const { mountPlatformLibrary } = await import('/__harness/lib.mjs');
  const now = Date.now(), owner = 'qa-account';
  const doc = { version: 1, consent: true, favorites: ['world', 'teacher'], recent: [{ id: 'path', at: now - 60000, mode: 'web' }, { id: 'teacher', at: now - 120000, mode: 'web' }], rememberRecent: true,
    notes: [{ id: 'n1', appId: 'world', title: 'TOPIK 듣기 연습 이어서 하기', done: false, createdAt: now - 3600000 }, { id: 'n2', appId: 'teacher', title: '반 과제 확인하기', done: false, createdAt: now - 5400000 }, { id: 'n3', appId: 'path', title: '면접 연습 다시 보기', done: true, createdAt: now - 7200000 }] };
  let row = { revision: 3, state: doc }; const identity = { configured: true, signedIn: true, status: 'signed-in', accountId: owner, sessionGeneration: 1 };
  const host = { identity: () => ({ ...identity }), refresh: async () => ({ ...identity }), subscribe: () => () => {},
    request: async (operation, params = {}) => {
      if (operation === 'platformSave' || operation === 'platformDelete') { if (params.expected_revision !== row.revision) return { ok: false, revision: row.revision, error: { code: 'REVISION_CONFLICT' } }; row = { revision: row.revision + 1, state: operation === 'platformDelete' ? null : params.state }; }
      return { ok: true, scope: 'synk-personal', resource: 'platform-library', accountId: owner, updatedAt: null, revision: row.revision, state: row.state ? structuredClone(row.state) : null };
    } };
  const memory = new Map(), storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k), key: i => [...memory.keys()][i] ?? null, get length() { return memory.size; } };
  const real = document.querySelector('.platform-continuity'), aside = document.createElement('aside');
  aside.setAttribute('aria-label', '계정 라이브러리'); real.before(aside); real.hidden = true;
  const view = mountPlatformLibrary(aside, { getHost: () => host, getDevice: () => ({ favorites: [], recent: [] }), storage, onOpen: () => {}, onLogin: () => {}, onManage: () => {} });
  view.render();
  const beforeConnect = aside.querySelector('[data-library-detail]').textContent;
  await aside.querySelector('[data-connect-button]').onclick();
  for (let i = 0; i < 60 && !aside.querySelector('[data-cloud="favorite"]'); i++) await new Promise(r => setTimeout(r, 50));
  const toggle = aside.querySelector('[data-panel-toggle]'); if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  await new Promise(r => setTimeout(r, 300));
  return { beforeConnect, title: aside.querySelector('[data-library-title]').textContent, detail: aside.querySelector('[data-library-detail]').textContent,
    favorites: [...aside.querySelectorAll('[data-cloud="favorite"]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? ' (눌림)' : '')),
    order: [...aside.querySelectorAll('.continuity-favorite-order li span')].map(s => s.textContent), options: [...aside.querySelectorAll('select[name=appId] option')].map(o => o.textContent),
    noteTools: !!aside.querySelector('.continuity-note-tools'), noteApps: [...aside.querySelectorAll('[data-note-id] p')].map(p => p.textContent),
    // 「최근에 연 시각도 계정에 저장」 토글 너비(웹 토글은 40px — 휴대폰 폭에서 줄면 손잡이가 글자를 덮는다)
    rememberToggle: Math.round(aside.querySelector('[data-cloud="remember"]')?.getBoundingClientRect().width ?? -1) };
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }), report = { connect: {}, signedIn: {} };
  for (const mode of ['live', 'candidate']) for (const width of [1440, 390]) {
    const { page, errors, go } = await open(browser, width, mode === 'candidate', '#library'); await go(); await page.waitForTimeout(1200);
    const box = page.locator('.platform-continuity').first();
    const before = { detail: await box.locator('[data-library-detail]').textContent(), button: await box.locator('[data-connect-button]').textContent() };
    await box.screenshot({ path: path.join(shots, `connect-${mode}-${width}-before.png`) });
    await box.locator('[data-connect-button]').click(); await page.waitForTimeout(2500);
    const after = await page.evaluate(() => { const root = document.querySelector('.platform-continuity'); return { status: root.querySelector('[data-library-status]').textContent, panelHidden: root.querySelector('[data-library-panel]')?.hidden, content: root.querySelector('[data-cloud-content]')?.innerText.trim().slice(0, 200) }; });
    await box.screenshot({ path: path.join(shots, `connect-${mode}-${width}-after.png`) });
    report.connect[mode + '-' + width] = { before, after, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    await page.close();
  }
  for (const mode of ['old', 'new']) for (const width of [1440, 390]) {
    const { page, errors, go } = await open(browser, width, mode === 'new', '#library');
    await page.route(url => new URL(url).pathname === '/__harness/lib.mjs', route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: modules[mode] }));
    await go(); await page.waitForTimeout(800);
    const seen = await page.evaluate(mountInPage);
    await page.locator('aside[aria-label="계정 라이브러리"]:not([hidden])').first().screenshot({ path: path.join(shots, `signed-in-${mode}-${width}.png`) });
    report.signedIn[mode + '-' + width] = { ...seen, errors, overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(shots, 'check-live.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report, null, 1));
  const bad = [...Object.values(report.connect), ...Object.values(report.signedIn)].some(v => v.errors.length || v.overflow > 0);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
