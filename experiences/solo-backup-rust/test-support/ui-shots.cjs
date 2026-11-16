'use strict';
// 화면 캡처 · 점검 — dist/를 작은 로컬 서버로 띄우고 Chrome으로 모든 화면 × 창 크기를 찍는다.
//   node test-support/ui-shots.cjs <출력 폴더> [--폭 1080x820,760x640] [--화면 home,restore]
// 엔진 대신 window.__TAURI__ 흉내가 예시 상태(ui/engine-fixtures.js)를 돌려준다(브리지는 진짜 bridge.js가 돈다).
// 잰 것(report.json): 가로 넘침, 채운 알약이 첫 화면 안에 있는지, 화면 글 검사(T18), 쪽 오류, 글꼴이 실렸는지, 작은 글의 대비 4.5:1.
// 먼저 node scripts/stage-ui.cjs 로 dist/를 만든다. Playwright가 이 작업본에 없으면 공용 작업본의 것을 쓴다.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const APP = path.resolve(__dirname, '..');
const DIST = path.join(APP, 'dist');
const REPO = path.resolve(APP, '..', '..');
const args = process.argv.slice(2);
const out = path.resolve(args[0] || 'ui-shots');
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const sizes = (flag('--폭') || '1080x820,760x640').split(',').map((s) => s.split('x').map(Number));
const only = flag('--화면')?.split(',');

function playwright() {
  try { return require('playwright'); } catch {
    const { 공용작업본 } = require(path.join(REPO, 'tools/lib/공용작업본.js'));
    return require('node:module').createRequire(path.join(공용작업본(REPO), 'package.json'))('playwright');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// 계정의 기기(서버 devices 꼴)와 되돌리기 미리 보기(restorePlan 꼴)
const DEVICES = [
  { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', createdAt: Date.parse('2026-11-01T09:00:00+09:00'), lastSeenAt: Date.parse('2026-11-13T14:02:00+09:00'), current: false },
  { id: 'b'.repeat(12), name: '옛 데스크톱', role: 'read', state: 'revoked', createdAt: Date.parse('2026-10-20T09:00:00+09:00'), lastSeenAt: Date.parse('2026-11-02T18:00:00+09:00'), current: false },
  { id: 'c'.repeat(12), name: '새 데스크톱', role: 'read', state: 'active', createdAt: Date.parse('2026-11-13T14:30:00+09:00'), lastSeenAt: Date.parse('2026-11-13T14:39:00+09:00'), current: true },
];
// 기본 화면 상태(이 PC가 「작업 노트북」)에서 여는 서랍의 기기 목록
const DEVICES_HOME = [
  { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', createdAt: Date.parse('2026-11-01T09:00:00+09:00'), lastSeenAt: Date.parse('2026-11-13T14:39:00+09:00'), current: true },
  { id: 'b'.repeat(12), name: '옛 데스크톱', role: 'read', state: 'revoked', createdAt: Date.parse('2026-10-20T09:00:00+09:00'), lastSeenAt: Date.parse('2026-11-02T18:00:00+09:00'), current: false },
  { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active', createdAt: Date.parse('2026-11-05T20:00:00+09:00'), lastSeenAt: Date.parse('2026-11-12T21:10:00+09:00'), current: false },
];
// 기기가 다 찬 계정(LIMIT_DEVICES의 details.devices) — 한도를 채운 셋과, 한도에 들지 않는 끊긴 기기 하나
const DEVICES_FULL = [
  { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', lastSeenAt: Date.parse('2026-11-13T14:02:00+09:00') },
  { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active', lastSeenAt: Date.parse('2026-11-12T21:10:00+09:00') },
  { id: 'e'.repeat(12), name: '옛 노트북', role: 'read', state: 'active', lastSeenAt: Date.parse('2026-09-30T18:00:00+09:00') },
  { id: 'b'.repeat(12), name: '옛 데스크톱', role: 'read', state: 'revoked', lastSeenAt: Date.parse('2026-11-02T18:00:00+09:00') },
];
// 이 PC에 앞서 깐 연결(sameInstall의 e…)이 남은 계정
const DEVICES_SAME = [
  { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', lastSeenAt: Date.parse('2026-11-13T14:39:00+09:00'), current: true },
  { id: 'e'.repeat(12), name: '작업 노트북', role: 'read', state: 'active', lastSeenAt: Date.parse('2026-11-08T09:20:00+09:00'), current: false },
  { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active', lastSeenAt: Date.parse('2026-11-12T21:10:00+09:00'), current: false },
];
const PICK = Date.parse('2026-11-12T14:59:00+09:00');
const PLAN = { at: PICK, counts: { copy: 3412, hide: 186, unchanged: 9120 }, copyBytes: Math.round(5.6 * 1024 ** 3) };
const UNDO = { value: { suggestions: [{ at: PICK, reason: 'before-mass-hide' }, { at: Date.parse('2026-11-04T09:12:00+09:00'), reason: 'before-overwrite' }], plan: PLAN, oldestAt: Date.parse('2026-10-15T14:40:00+09:00') }, plans: { [PICK]: PLAN }, pickAt: PICK };

// 화면마다 쓸 예시 상태
const CASES = [
  ['home', 'home'], ['home-run', 'home'], ['home-partial', 'home'], ['home-missing', 'home'], ['home-mass', 'home'], ['home-moved', 'home'],
  ['home-overdue', 'home'], ['home-credential', 'home'], ['home-startup', 'home'], ['home-restored', 'home'], ['home-health', 'home'], ['home-paused', 'home'], ['home-off', 'home'], ['home-probe', 'home'], ['home-error', 'home'],
  ['start', 'start-1'], ['home', 'start-2'], ['home', 'start-3'], ['home', 'restore'], ['home-partial', 'partial'], ['home-partial', 'partial-std'],
  ['home', 'move-0'], ['home', 'move-1'], ['home', 'move-2'], ['home', 'move-3'], ['home', 'move-4'],
  ['home', 'undo-1'], ['home', 'undo-2'], ['home', 'undo-3'], ['home', 'lost'], ['home', 'lost-2'], ['home', 'code'], ['home-mass', 'mass-list'], ['home', 'drawer'],
  // 개통 잇기(11-16) — 실제 상태 모양의 갈래. 셋째 칸은 창이 기억하는 개통 걸음(app.js acct)과 되돌리기 미리 보기(undo)
  ['home-writekey', 'home'], ['home-lost-step', 'home'], ['home-continue', 'home'], ['home-restore-wait', 'home'],
  ['start-signin', 'start-1', { name: 'start-1-signing', acct: { signing: true } }],
  ['start-signin', 'start-1', { name: 'start-1-full', acct: { limit: DEVICES_FULL } }],
  ['start-write', 'start-2', { name: 'start-2-empty' }], ['start-write-picked', 'start-2', { name: 'start-2-picked' }],
  ['start-google-step', 'start-2', { name: 'start-2-google' }], ['start-write-picked', 'start-2', { name: 'start-2-again', acct: { repoExists: true } }],
  ['start-read', 'start-2', { name: 'start-2-read', acct: { devices: DEVICES } }],
  ['home', 'undo-1', { name: 'undo-1-plan', undo: 'UNDO' }], ['home', 'undo-2', { name: 'undo-2-plan', undo: 'UNDO' }],
  ['home-lost-step', 'drawer', { name: 'drawer-devices', acct: { devices: DEVICES_HOME }, scrollTo: '[data-act="lost-dev"]' }],
  // 둘째 증분(조율 세션 c725f319c 뒤): 되돌리기 진행 · 고르기 · 실패 · 취소 중, 분실 신고 둘, 이어서 백업, Google 로그인 그만두기
  ['home-restore-run', 'home'], ['home-restore-choose', 'home'], ['home-restore-failed', 'home'], ['home-restore-read', 'home'],
  ['home-restore-run', 'undo-3', { name: 'undo-3-run' }], ['home-restore-choose', 'undo-3', { name: 'undo-3-choose' }],
  ['home-restore-failed', 'undo-3', { name: 'undo-3-failed' }], ['home-restore-undo', 'undo-3', { name: 'undo-3-undo' }],
  ['home-lost-step', 'lost', { name: 'lost-real', acct: { lostTarget: { id: 'd'.repeat(12), name: '거실 PC' } } }],
  ['home-lost-step', 'lost-2', { name: 'lost-2-real', acct: { lost: { name: '거실 PC', at: Date.parse('2026-11-13T14:35:00+09:00'), url: 'https://myaccount.google.com/connections', next: 'read-key-rotate' } } }],
  ['start-read', 'start-2', { name: 'start-2-take', acct: { take: true, devices: DEVICES } }],
  ['start-signin', 'start-1', { name: 'start-1-cancel', acct: { signing: true } }],
  ['home-writekey', 'home', { name: 'home-writekey-wait', acct: { running: 'writekey', googleWait: true } }],
  // 셋째 증분(조율 세션 25d66f324 · 616e9dce5 뒤): 전체 되살리기 실패, 놓을 자리, 같은 PC의 앞선 연결
  ['home-restore-error', 'home'], ['home-restore-unsafe', 'home'],
  ['home', 'restore', { name: 'restore-pick', ui: { place: 'pick' } }], ['home', 'restore', { name: 'restore-confirm', ui: { confirmAll: true } }], ['home-downloads', 'restore', { name: 'restore-guarded' }],
  ['home-same-install', 'drawer', { name: 'drawer-same', acct: { devices: DEVICES_SAME }, scrollTo: '[data-act="lost-dev"]' }],
  // 되돌리기 셋(조율 세션 57c3d17e6 뒤): 끝난 결과 · 취소 실패 부호 · 복구 전용 PC의 되돌리기
  ['home-restore-ended', 'home'], ['home-restore-undofail', 'home'], ['home-restore-read-hold', 'home'],
  ['home-restore-undofail', 'undo-3', { name: 'undo-3-undofail' }], ['home-restore-read-hold', 'undo-3', { name: 'undo-3-readonly' }], ['home-restore-ended', 'undo-3', { name: 'undo-3-ended' }],
  ['home-restore-read', 'undo-2', { name: 'undo-2-readonly', undo: 'UNDO' }],
  // 옮겨 오기를 엔진에 이음(조율 세션 d32d25233 · moveState · folders[].roots) — mv는 창의 옮겨 오기 기억(engine-fixtures MOVE_MV)
  ['home-move-read', 'move-1', { name: 'move-1-plan', mv: 'plan', acct: 'MOVE' }], ['home-move-read', 'move-1', { name: 'move-1-open', mv: 'open', acct: 'MOVE' }],
  ['home-move-read', 'move-1', { name: 'move-1-short', mv: 'short', acct: 'MOVE' }], ['home-move-read', 'move-1', { name: 'move-1-nokit', mv: 'nokit', acct: 'MOVE' }],
  ['home-move-read', 'move-1', { name: 'move-1-loading', mv: 'loading', acct: 'MOVE' }], ['home-move-read', 'move-1', { name: 'move-1-empty', mv: 'empty', acct: 'MOVE' }],
  ['home-move-run', 'move-2', { name: 'move-2-run', mv: 'run', acct: 'MOVE' }], ['home-move-reading', 'move-2', { name: 'move-2-reading', mv: 'reading', acct: 'MOVE' }],
  ['home-move-read', 'move-2', { name: 'move-2-stopped', mv: 'stopped', acct: 'MOVE' }],
  ['home-move-read', 'move-3', { name: 'move-3-result', mv: 'result', acct: 'MOVE' }], ['home-move-read', 'move-3', { name: 'move-3-ok', mv: 'ok', acct: 'MOVE' }],
  ['home-move-read', 'move-4', { name: 'move-4-result', mv: 'result', acct: 'MOVE' }], ['home-move-read', 'move-4', { name: 'move-4-fresh', mv: 'fresh', acct: 'MOVE' }],
  ['home-move-quit', 'move-4', { name: 'move-4-quit', mv: 'quit', acct: 'MOVE' }],
  ['home-move-read', 'home', { name: 'home-move-stopped', mv: 'stopped', acct: 'MOVE' }], ['home-move-read', 'home', { name: 'home-move-done', mv: 'result', acct: 'MOVE' }],
  ['home-move-run', 'home', { name: 'home-move-run', mv: 'run', acct: 'MOVE' }], ['home-move-read', 'home', { name: 'home-move-read', acct: 'MOVE' }],
  // 조율 세션 c6ae51da6의 엔진 값(E4 · E9 공간 부족으로 멈춤 · E13 다시 시작한 뒤 멈춤 · E15 없는 자리 · E10 적어 둔 고름)
  ['home-move-nospace', 'move-2', { name: 'move-2-nospace', mv: 'nospace', acct: 'MOVE' }], ['home-move-listbig', 'move-1', { name: 'move-1-listbig', mv: 'listbig', acct: 'MOVE' }], ['home-move-nospace', 'move-1', { name: 'move-1-nospace-fresh', mv: 'nospaceFresh', acct: 'MOVE' }],
  ['home-move-read', 'move-3', { name: 'move-3-rerun', mv: 'rerun', acct: 'MOVE' }], ['home-move-read', 'move-3', { name: 'move-3-carried', mv: 'carried', acct: 'MOVE' }], ['home-move-read', 'move-3', { name: 'move-3-gone', mv: 'gone', acct: 'MOVE' }],
  ['home-move-read', 'move-4', { name: 'move-4-gone', mv: 'gone', acct: 'MOVE' }], ['home-move-saved', 'move-4', { name: 'move-4-saved', mv: 'saved', acct: 'MOVE' }],
  // 옮겨 오기 4b — 프로그램과 설정(다시 깔기 · 앱 설정 되돌리기 · 다시 로그인할 곳)
  ['home-move-read', 'move-apps', { name: 'move-apps-loading', mv: 'apps-loading', acct: 'MOVE' }], ['home-move-read', 'move-apps', { name: 'move-apps-pick', mv: 'apps-pick', acct: 'MOVE' }],
  ['home-move-read', 'move-apps', { name: 'move-apps-open', mv: 'apps-open', acct: 'MOVE' }], ['home-move-read', 'move-apps', { name: 'move-apps-none', mv: 'apps-none', acct: 'MOVE' }],
  ['home-move-read', 'move-apps', { name: 'move-apps-notready', mv: 'apps-notready', acct: 'MOVE' }], ['home-move-read', 'move-apps', { name: 'move-apps-empty', mv: 'apps-empty', acct: 'MOVE' }],
  ['home-move-read', 'move-apps', { name: 'move-apps-error', mv: 'apps-error', acct: 'MOVE' }], ['home-move-apps-elevated', 'move-apps', { name: 'move-apps-elevated', mv: 'apps-running', acct: 'MOVE' }],
  ['home-move-apps-user', 'move-apps', { name: 'move-apps-user', mv: 'apps-running', acct: 'MOVE' }], ['home-move-apps-done', 'move-apps', { name: 'move-apps-restoring', mv: 'apps-restoring', acct: 'MOVE' }],
  ['home-move-apps-done', 'move-apps', { name: 'move-apps-result', mv: 'apps-result', acct: 'MOVE' }], ['home-move-apps-ok', 'move-apps', { name: 'move-apps-ok', mv: 'apps-ok', acct: 'MOVE' }],
  ['home-move-apps-declined', 'move-apps', { name: 'move-apps-declined', mv: 'apps-declined', acct: 'MOVE' }], ['home-move-apps-failed', 'move-apps', { name: 'move-apps-failed', mv: 'apps-failed', acct: 'MOVE' }],
  ['home-move-apps-done', 'move-apps', { name: 'move-apps-settings-error', mv: 'apps-settings-error', acct: 'MOVE' }], ['home-move-apps-elevated', 'move-4', { name: 'move-4-installing', mv: 'apps-running', acct: 'MOVE' }],
];
const CATALOG = {
  profile: 'b2', token: 't', fileCount: 12480, totalBytes: 19756849561, query: '견적', offset: 0, total: 5, loading: false,
  selection: { revision: 3, count: 3, bytes: 6396314 },
  // source는 엔진의 목록 줄과 같은 꼴(번호 붙은 폴더 이름, engine/src/restore-select.cjs)이다(Fable F6 — 전체 경로를 넣어 차이를 가렸다)
  rows: [
    { id: '1', name: '견적서_1112_최종.pdf', source: '01-Documents', path: '/견적/견적서_1112_최종.pdf', size: 1258291, mtime: '2026-11-12T10:00:00+09:00', selected: true },
    { id: '2', name: '견적서_1112_최종.hwp', source: '01-Documents', path: '/견적/견적서_1112_최종.hwp', size: 90112, mtime: '2026-11-12T10:00:00+09:00', selected: true },
    { id: '3', name: '견적 참고 사진.jpg', source: '03-Pictures', path: '/현장/견적 참고 사진.jpg', size: 5033164, mtime: '2026-11-09T10:00:00+09:00', selected: true },
    { id: '4', name: '견적 양식.xlsx', source: '01-Documents', path: '/양식/견적 양식.xlsx', size: 47104, mtime: '2026-10-02T10:00:00+09:00', selected: false },
    { id: '5', name: '2026 견적 모음.zip', source: '04-Projects', path: '/보관/2026 견적 모음.zip', size: 222298112, mtime: '2026-09-30T10:00:00+09:00', selected: false },
  ],
};

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/가 없습니다. 먼저 node scripts/stage-ui.cjs');
  const { STATES, NOW, MOVE_MV, MOVE_ACCT } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
  const { findBanned } = await import(pathToFileURL(path.join(APP, 'ui/banned-words.js')).href);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright().chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
  const report = [];
  for (const [w, hgt] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, reducedMotion: args.includes('--움직임') ? 'no-preference' : 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await ctx.addInitScript((initial) => {
      // 엔진 흉내 — getState는 예시 상태, onState는 구독만 받는다. 그 밖의 호출은 가짜 성공(시험이 엔진에 보내지 않는다)
      window.__TAURI__ = { core: { invoke: async (_n, { method }) => (method === 'getState' ? { ok: true, value: initial } : { ok: false, error: 'x', code: 'FIXTURE' }) }, event: { listen: async () => () => {} } };
    }, STATES.home);
    const pg = await ctx.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await pg.goto(base);
    await pg.waitForFunction(() => window.__wb && document.fonts.status === 'loaded');
    for (const [stateName, screen, extra = {}] of CASES) {
      const name = extra.name || (screen === 'home' ? stateName : screen);
      if (only && !only.includes(name)) continue;
      const before = errors.length;
      await pg.evaluate(({ screen, state, now, catalog, acct, undo, ui, mv }) => {
        if (screen === 'drawer') window.__wb.show('home', { state, now, still: true, drawer: true, acct });
        else window.__wb.show(screen, { state, now, still: true, catalog: screen === 'restore' ? catalog : null, acct, undo, ui, mv });
      }, { screen, state: STATES[stateName], now: NOW, catalog: CATALOG, acct: extra.acct === 'MOVE' ? MOVE_ACCT : extra.acct || null, undo: extra.undo === 'UNDO' ? UNDO : null, ui: extra.ui || null, mv: extra.mv ? MOVE_MV[extra.mv] : null });
      // 서랍 아래쪽처럼 첫 화면 밖에 있는 줄은 그 자리로 굴려서 찍는다
      if (extra.scrollTo) await pg.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), extra.scrollTo);
      await pg.waitForTimeout(120);
      const m = await pg.evaluate(() => {
        const vw = innerWidth, vh = innerHeight, room = document.getElementById('room');
        // 서랍이 열렸으면 서랍 안의 첫 단추를, 아니면 화면의 채운 단추를 잰다(카본 A14 — 서랍 화면에서 뒷화면 단추를 쟀다)
        const drawerOpen = !document.getElementById('drawer').hidden;
        const main = drawerOpen ? document.querySelector('.drawer .lnk') : document.querySelector('#room .pill.main');
        const r = main ? main.getBoundingClientRect() : null;
        const over = [...document.querySelectorAll('#stage *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && (b.right > vw + 1 || b.left < -1) && getComputedStyle(el).position !== 'fixed'; }).map((el) => el.className || el.tagName).slice(0, 5);
        // 작은 글의 대비(검정 바탕) — 글자색 알파를 바탕에 섞어 잰다
        const lum = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const low = [];
        // 제 글을 가진 요소는 모두 잰다(카본 A14 — h1~h3 · div · i 같은 것이 빠져 있었다). 서랍이 열리면 가린 뒷화면은 빼고 서랍 안만 본다
        for (const el of document.querySelectorAll('#stage *')) {
          if (/^(SCRIPT|STYLE|svg|path|circle|CANVAS)$/i.test(el.tagName)) continue;
          if (!el.textContent.trim() || el.closest('[hidden]') || el.closest('.cg.hide')) continue;
          if (drawerOpen && !el.closest('.drawer')) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
          const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity === 0) continue;
          const m2 = s.color.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/); if (!m2) continue;
          let bg = [0, 0, 0]; if (el.closest('.pill.main')) bg = [243, 241, 236]; else if (el.closest('.drawer')) bg = [5, 5, 5];
          const a = m2[4] === undefined ? 1 : +m2[4];
          const rgb = [+m2[1], +m2[2], +m2[3]].map((c, i) => c * a + bg[i] * (1 - a));
          const L1 = 0.2126 * lum(rgb[0]) + 0.7152 * lum(rgb[1]) + 0.0722 * lum(rgb[2]), L2 = 0.2126 * lum(bg[0]) + 0.7152 * lum(bg[1]) + 0.0722 * lum(bg[2]);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(s.fontSize), big = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700);
          if (ratio < (big ? 3 : 4.5)) low.push(`${el.textContent.trim().slice(0, 24)} ${ratio.toFixed(2)}`);
        }
        return { screen: document.getElementById('stage').dataset.screen, scrollW: document.documentElement.scrollWidth, vw, roomScroll: room.scrollHeight > room.clientHeight + 2, mainBottom: r ? Math.round(r.bottom) : null, vh, over, low: low.slice(0, 6), font: document.fonts.check('16px "SUIT Variable"'), webgl: !!document.getElementById('orb').getContext };
      });
      const text = await pg.evaluate(() => window.__wb.text());
      const banned = findBanned(text);
      const file = `${name}_${w}x${hgt}.png`;
      await pg.screenshot({ path: path.join(out, file) });
      fs.writeFileSync(path.join(out, file.replace(/\.png$/, '.txt')), text);
      // 검수 묶음(tools/검수묶음.mjs --캡처)이 읽는 꼴로도 둔다: 후/<창 폭>/<화면>.png · .txt
      const rv = path.join(out, '검수', '후', String(w)); fs.mkdirSync(rv, { recursive: true });
      fs.copyFileSync(path.join(out, file), path.join(rv, `${name}.png`)); fs.writeFileSync(path.join(rv, `${name}.txt`), text);
      const issues = [];
      if (m.scrollW > m.vw) issues.push(`가로 넘침 ${m.scrollW}`);
      if (m.over.length) issues.push(`창 밖 요소 ${m.over.join(' · ')}`);
      if (m.mainBottom !== null && m.mainBottom > m.vh) issues.push(`주 단추가 첫 화면 밖(${m.mainBottom} > ${m.vh})`);
      if (banned.length) issues.push(`화면 글 검사 걸림: ${banned.join(', ')}`);
      if (!m.font) issues.push('SUIT 글꼴이 실리지 않음');
      if (m.low.length) issues.push(`대비 낮음: ${m.low.join(' / ')}`);
      if (errors.length > before) issues.push(`쪽 오류: ${errors.slice(before).join(' / ')}`);
      report.push({ name, size: `${w}x${hgt}`, file, ...m, banned, issues });
      console.log(`${issues.length ? '✗' : '✓'} ${name} ${w}x${hgt}${issues.length ? ` — ${issues.join(' | ')}` : ''}`);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.issues.length);
  console.log(`화면 ${report.length}장 · 걸림 ${bad.length}장 → ${out}`);
  process.exitCode = bad.length ? 1 : 0;
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
