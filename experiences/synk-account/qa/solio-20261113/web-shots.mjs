// 웹 플랫폼 SYNK SOLIO 판(2026-11-13) 화면 점검: 작업본(또는 공개 후보) account 폴더를 로컬 정적 서버로 띄워
// 1440×900 · 390×844(낮 · 밤)로 솔리오 · 회원 혜택 · 내 계정 · 맞춤 정보 · 홈 · 둘러보기 · 옛 주소를 찍고 잰다.
// 손님은 브라우저 그대로(설정 파일 없음), 회원은 PC 앱 안에서 이 화면이 열리는 옛 길(window.synkDesktop)을 합성 계정으로 흉내 낸다.
// 바깥 주소(localhost 밖) 요청은 모두 막는다. 실제 계정 · 결제 · 배포 없음.
// 사용: node web-shots.mjs <account 폴더> <출력 폴더> [--no-shots]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fixture = require('../../../../desktop/tools/member-insight-fixture.cjs');

const [,, rootArg, outArg, ...flags] = process.argv;
if (!rootArg || !outArg) throw Error('사용: node web-shots.mjs <account 폴더> <출력 폴더> [--no-shots]');
const root = path.resolve(rootArg), out = path.resolve(outArg), shots = !flags.includes('--no-shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile() || /config\.json$/.test(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/platform.html`;

const owner = 'A', accountId = 'synthetic-insight-' + owner, summary = fixture.currentSummary('enabled', owner);
const memberScript = `(() => {
  const auth = { configured: true, status: 'signed-in', signedIn: true, sessionGeneration: 1, account: { synk_user_id: ${JSON.stringify(accountId)}, display_name: '합성 A' }, learningSync: true, library: { status: 'ready', appIds: ['messenger', 'care'] } };
  const summary = ${JSON.stringify(summary)};
  const empty = resource => ({ ok: true, scope: 'synk-personal', resource, accountId: ${JSON.stringify(accountId)}, revision: 0, state: null, updatedAt: null });
  window.synkDesktop = Object.freeze({
    authStatus: async () => auth, onAuthChanged: () => () => {},
    getEnvironment: async () => ({ platform: 'win32', arch: 'x64', version: 'synthetic', mode: 'development' }),
    getClients: async () => [{ id: 'messenger', status: 'installed', version: 'synthetic', canLaunch: true }],
    launch: async () => ({ ok: false }),
    accountRequest: async operation => operation === 'insightLoad' ? empty('member-insight') : operation === 'understandingLoad' ? empty('member-understanding') : operation === 'platformLoad' ? empty('platform-library')
      : operation === 'memoryGet' ? { ok: true, revision: 0, entries: [] } : operation === 'atlasSummary' ? summary : { ok: false, error: { code: 'QA_OPERATION_DISABLED' } },
  });
})();`;

// 내장 브라우저가 없으면 설치된 Chrome(또는 SYNK_CHROME)을 쓴다 — 화면 엔진은 같은 Chromium이다.
const chrome = process.env.SYNK_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const report = { checkedOn: new Date().toISOString(), base: root, checks: [], shots: [], consoleErrors: [], pageErrors: [], blocked: [] };
const check = (name, ok, details = {}) => report.checks.push({ name, ok: !!ok, ...details });
async function session({ width, height, scale, theme, member }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: theme === 'night' ? 'dark' : 'light' });
  await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch {} }, ['synk.platform.theme', theme]);
  if (member) await context.addInitScript(memberScript);
  await context.route(/^(?!http:\/\/127\.0\.0\.1:)/, route => { report.blocked.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(message.text())) report.consoleErrors.push(`${width}-${theme}-${member ? 'member' : 'guest'}: ${message.text()}`); });
  page.on('pageerror', error => report.pageErrors.push(`${width}-${theme}-${member ? 'member' : 'guest'}: ${error.message}`));
  await page.goto(base + '#home');
  await page.waitForFunction(() => document.getElementById('page-content')?.children.length > 0);
  return { context, page };
}
const measure = page => page.evaluate(() => ({ hash: location.hash, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), title: document.querySelector('#page-content h1')?.textContent.trim() || '',
  images: [...document.querySelectorAll('#page-content img')].filter(img => img.getAttribute('src')).every(img => img.complete && img.naturalWidth > 0),
  current: [...document.querySelectorAll('.main-nav [aria-current],.tabbar [aria-current]')].map(node => node.dataset.route).join(','), profileOpen: !document.getElementById('profile-menu').hidden,
  small: [...document.querySelectorAll('#page-content *')].filter(node => node.childNodes.length && [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()) && parseFloat(getComputedStyle(node).fontSize) < 12.5 && node.offsetParent).length }));
async function visit(page, hash, label, { shoot = true } = {}) {
  await page.evaluate(value => { location.hash = value; }, hash);
  await page.waitForTimeout(250);await page.evaluate(() => document.fonts.ready);
  const info = await measure(page);
  if (shots && shoot) { const file = `${label}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.shots.push(file); info.shot = file; }
  return info;
}

for (const theme of ['day', 'night']) for (const [width, height, scale] of [[1440, 900, 1], [390, 844, 2]]) {
  const tag = `${theme}-${width}`, full = theme === 'day' || width === 1440;
  // 손님
  let { context, page } = await session({ width, height, scale, theme, member: false });
  let info = await visit(page, '#home', `guest-home-${tag}`, { shoot: full });
  check(`guest-home-${tag}`, !info.overflow && info.images && /SYNK 앱과 솔리오/.test(info.title) && await page.evaluate(() => !!document.querySelector('.home-shelf [data-shortcut="solio"]')), info);
  info = await visit(page, '#solio', `guest-solio-home-${tag}`);
  check(`guest-solio-${tag}`, !info.overflow && info.images && info.title === '솔리오' && info.current.split(',').every(route => route === 'solio'), info);
  info = await visit(page, '#solio/backup', `guest-solio-backup-${tag}`, { shoot: full });
  check(`guest-solio-backup-${tag}`, !info.overflow && info.title === '백업·복구' && await page.evaluate(() => !document.querySelector('.solio-backup a,.solio-backup button')), info);
  info = await visit(page, '#solio/subscriptions', `guest-solio-subscriptions-${tag}`);
  check(`guest-solio-subscriptions-${tag}`, !info.overflow && info.images && info.title === 'AI 구독 관리'
    && await page.evaluate(() => { const t = document.getElementById('page-content')?.textContent || ''; return /「솔리오」 → 「AI 구독 관리」/.test(t) && /이전 판에서는 「회원 혜택」 → 「AI 구독 계정판」/.test(t); }), info);
  info = await visit(page, '#benefits', `guest-benefits-${tag}`, { shoot: full });
  check(`guest-benefits-${tag}`, !info.overflow && info.images && info.title === '회원 혜택' && await page.evaluate(() => document.querySelectorAll('.benefit-grid [data-benefit]').length === 1), info);
  info = await visit(page, '#benefits/care', `guest-care-${tag}`, { shoot: full && theme === 'day' });
  check(`guest-care-${tag}`, !info.overflow && info.title === '플레저' && await page.evaluate(() => /☆ 홈에 고정/.test(document.getElementById('page-content').textContent)), info);
  info = await visit(page, '#account', `guest-account-${tag}`, { shoot: full && theme === 'day' });
  check(`guest-account-${tag}`, !info.overflow && info.title === '내 계정' && await page.evaluate(() => /로그인하면 맞춤 정보를 볼 수 있어요/.test(document.getElementById('page-content').textContent)), info);
  info = await visit(page, '#discover?q=계정판', `guest-discover-old-name-${tag}`, { shoot: full && theme === 'day' });
  check(`guest-discover-old-name-${tag}`, !info.overflow && await page.evaluate(() => !!document.querySelector('.solio-found a[href="#solio/subscriptions"]')), info);
  // 옛 주소
  for (const [from, to] of [['#benefits/subscriptions', '#solio/subscriptions'], ['#benefits/insight', '#account/insight']]) {
    info = await visit(page, from, `old-${from.slice(10)}-${tag}`, { shoot: false });
    check(`old-address-${from}-${tag}`, info.hash === to, info);
  }
  await page.goto(base + '#benefits/subscriptions');await page.waitForTimeout(300);
  check(`old-address-first-load-${tag}`, await page.evaluate(() => location.hash) === '#solio/subscriptions' && (await measure(page)).title === 'AI 구독 관리');
  // 손님에게 계정 칩은 로그인 링크 그대로(메뉴 없음)
  check(`guest-account-chip-is-link-${tag}`, await page.evaluate(() => { const entry = document.querySelector('.account-entry'); return !entry.hasAttribute('aria-expanded') && entry.getAttribute('href') === './client.html?product=platform'; }));
  await context.close();
  // 회원(PC 앱 안 웹 화면 길, 합성 계정)
  ({ context, page } = await session({ width, height, scale, theme, member: true }));
  await page.waitForFunction(() => document.querySelector('.account-entry')?.getAttribute('aria-label') === '내 계정 메뉴');
  info = await visit(page, '#home', `member-home-${tag}`, { shoot: full });
  check(`member-home-${tag}`, !info.overflow && info.images, info);
  await page.click('.account-entry');await page.waitForTimeout(150);
  info = await measure(page);
  if (shots && full) { const file = `member-profile-menu-${tag}.png`; await page.screenshot({ path: path.join(out, file) }); report.shots.push(file); info.shot = file; }
  check(`member-profile-menu-${tag}`, info.profileOpen && await page.evaluate(() => document.querySelector('.account-entry').getAttribute('aria-expanded') === 'true' && document.activeElement?.getAttribute('href') === '#account'), info);
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  check(`member-profile-menu-escape-${tag}`, await page.evaluate(() => document.getElementById('profile-menu').hidden && document.activeElement?.classList.contains('account-entry')));
  await page.click('.account-entry');await page.mouse.click(10, height - 10);await page.waitForTimeout(100);
  check(`member-profile-menu-outside-${tag}`, await page.evaluate(() => document.getElementById('profile-menu').hidden));
  await page.click('.account-entry');await page.click('#profile-menu a[href="#account"]');await page.waitForTimeout(250);
  info = await measure(page);
  if (shots && full) { const file = `member-account-${tag}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.shots.push(file); info.shot = file; }
  check(`member-account-${tag}`, !info.overflow && info.title === '내 계정' && !info.profileOpen && await page.evaluate(() => !!document.querySelector('a[href="#account/insight"]')), info);
  info = await visit(page, '#account/insight', `member-insight-${tag}`, { shoot: full });
  check(`member-insight-${tag}`, !info.overflow && await page.evaluate(() => document.querySelector('.mi2-eyebrow')?.textContent === '맞춤 정보' && !!document.querySelector('.mi2-back[href="#account"]')), info);
  info = await visit(page, '#benefits/care', `member-care-${tag}`, { shoot: false });
  await page.click('[data-action="favorite"][data-id="care"]');await page.waitForTimeout(200);
  check(`member-care-pin-${tag}`, await page.evaluate(() => document.querySelector('[data-action="favorite"][data-id="care"]')?.getAttribute('aria-pressed') === 'true'));
  info = await visit(page, '#home', `member-home-pinned-${tag}`, { shoot: full && theme === 'day' });
  check(`member-home-pinned-${tag}`, await page.evaluate(() => { const ids = [...document.querySelectorAll('.home-shelf [data-shortcut]')].map(node => node.dataset.shortcut); return ids[0] === 'care' && ids.includes('solio'); }), info);
  await context.close();
}
await browser.close();server.close();
report.ok = report.checks.every(item => item.ok) && !report.pageErrors.length && !report.consoleErrors.length && !report.blocked.filter(url => !/^(data|blob):/.test(url)).length;
fs.writeFileSync(path.join(out, 'web-shots.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed: report.checks.filter(item => !item.ok).map(item => item.name), pageErrors: report.pageErrors, consoleErrors: report.consoleErrors.slice(0, 5), blocked: report.blocked.slice(0, 5), shots: report.shots.length }, null, 2));
process.exitCode = report.ok ? 0 : 1;
