// WORLD 앱 창 연습 보기(놓친 곳부터 추천)를 PC 앱 다리(window.synkDesktop)를 흉내 내어 장면마다 찍고 눌러 본다(2026-11-22).
// 작업본 experiences/synk-account를 https://synk.im/account/ 자리에 싣는다. 계정 · 로그인 요청은 모두 합성이고 바깥으로 나가지 않는다.
// node experiences/synk-account/qa/world-practice-20261122/scenes.mjs <playwright 폴더> <나갈 폴더> [--live --후보 <폴더>]
//   --live --후보 <폴더>: 공개본을 열되 <폴더>/account/… 파일은 후보로 돌려준다(공개 전 후보 확인).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SCENES as BASE, answer as baseAnswer, bridge, accountData, USER } from '../client-a-20261121/synthetic.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const account = path.join(root, 'experiences/synk-account'), hub = path.join(root, 'experiences/learning-hub');
const args = process.argv.slice(2), live = args.includes('--live');
const candIndex = args.indexOf('--후보'), candidate = candIndex >= 0 ? path.resolve(args[candIndex + 1]) : null;
const [playwrightDir, outArg] = args.filter((a, i) => !a.startsWith('--') && !(candIndex >= 0 && i === candIndex + 1));
if (!playwrightDir || !outArg) { console.error('usage: scenes.mjs <playwright 폴더> <나갈 폴더> [--live --후보 <폴더>]'); process.exit(2); }
const out = path.resolve(outArg);fs.mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(path.resolve(playwrightDir));
const at = '2026-11-21T10:00:00.000Z';
const skill = (id, label, status, line, recent = 0, correct = 0) => ({ id, label, domain: id.split('.')[1], status, recent, correct, assisted: 1, lastAt: at, line });
const SKILLS = [
  skill('ko.listening.negation', '듣고 부정·변경 이해하기', 'practice', '최근 놓친 「듣고 부정·변경 이해하기」를 조금 더 연습해 봐요.', 9, 4),
  skill('ko.reading.condition', '읽고 조건 이해하기', 'supported', '「읽고 조건 이해하기」를 도움과 함께 해냈어요. 이어서 살펴봐요.'),
  skill('ko.reading.grammar', '조사·문형 읽기', 'review', '「조사·문형 읽기」를 다시 살펴볼 때예요.'),
  skill('ko.listening.word', '낱말 듣기', 'recent-independent', '「낱말 듣기」를 최근 혼자 해냈어요. 가볍게 이어가요.', 12, 11),
];
const periods = { days: 30, recent: { answered: 128, independent: 96, assisted: 32, activeDays: 9 }, previous: { answered: 60, independent: 40, assisted: 20, activeDays: 5 }, sufficient: true };
const summary = (practice, shared = 'practice-and-settings') => ({ ok: true, shared, learning: { enabled: shared === 'practice-and-settings', revision: 3 }, summary: { reasons: ['travel'], presentation: { support: 'choose' }, forReasons: [], practice } });
const SCENES = {
  practice: { ...BASE['signed-in'], atlas: summary({ answered: 128, independent: 96, assisted: 32, periods, skills: SKILLS }) },
  'practice-new': { ...BASE['signed-in'], atlas: summary({ answered: 0, independent: 0, assisted: 0, periods: { days: 30, recent: { answered: 0, independent: 0, assisted: 0, activeDays: 0 }, previous: { answered: 0, independent: 0, assisted: 0, activeDays: 0 }, sufficient: false }, skills: [] }) },
  'practice-off': { ...BASE['signed-in-new'], atlas: summary({ answered: 0, independent: 0, assisted: 0, skills: [] }, 'declared-only') },
  'practice-class': { ...BASE['signed-in-class'], atlas: summary({ answered: 128, independent: 96, assisted: 32, periods, skills: SKILLS }) },
  'practice-oldserver': { ...BASE['signed-in'], atlas: summary({ answered: 18, independent: 12, assisted: 4, skills: [{ line: '최근 놓친 듣고 세부 정보 찾기를 조금 더 연습해 봐요.' }] }) },
  'atlas-fail': { ...BASE['signed-in'], atlasFail: true },
};
function answer(scene, op, params, unknown) {
  if (op === 'atlasSummary') return scene.atlasFail ? { ok: false, error: { code: 'ATLAS_UNAVAILABLE', message: '요약을 불러오지 못했어요.', retryable: true } } : scene.atlas;
  return baseAnswer(scene, op, params, unknown);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.avif': 'image/avif', '.woff2': 'font/woff2' };
function local(dir, rel) {
  const file = path.join(dir, decodeURIComponent(rel));
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  return { body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' };
}
const fails = [], ok = m => console.log('  ok', m), bad = m => { fails.push(m);console.log('  FAIL', m); };
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open(name, width, height) {
  const scene = SCENES[name];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const errors = [], unknown = [], external = [];
  await context.exposeBinding('__synthRequest', (_src, op, params) => answer(scene, op, params, unknown));
  await context.addInitScript(bridge, { auth: scene.auth });
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (!live && u.origin === 'https://synk.im' && u.pathname.startsWith('/account/')) { const hit = local(account, u.pathname.slice('/account/'.length));return hit ? route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body }) : route.fulfill({ status: 404, body: '' }); }
    if (!live && u.origin === 'https://synk.im' && u.pathname.startsWith('/learning-hub/')) { const hit = local(hub, u.pathname.slice('/learning-hub/'.length));return hit ? route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body }) : route.fulfill({ status: 404, body: '' }); }
    if (u.origin === 'https://synk.im' && live && candidate) { const hit = local(candidate, u.pathname.slice(1));if (hit) return route.fulfill({ status: 200, headers: { 'Content-Type': hit.contentType }, body: hit.body }); }
    if (u.origin === 'https://synk.im' && live) return route.continue();
    if (u.origin === 'https://synk.im' && u.pathname.startsWith('/try/')) return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: '<!doctype html><title>게임</title><body style="margin:0;display:grid;place-items:center;height:100vh;font:20px sans-serif;background:#eef">합성 게임 자리</body>' });
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    external.push(u.origin + u.pathname);return route.fulfill({ status: 404, body: '' });
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('https://synk.im/account/client.html?product=world', { waitUntil: 'load' });
  await page.waitForTimeout(1800);await page.evaluate(() => document.fonts?.ready);
  return { context, page, errors, unknown, external };
}
const measure = page => page.evaluate(() => {
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const small = [...document.querySelectorAll('button,a,input,select,label.toggle')].filter(visible).filter(el => { const r = el.getBoundingClientRect();return r.height < 44 && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline') && !(el.tagName === 'INPUT' && el.closest('label')); }).map(el => `${el.tagName.toLowerCase()}「${(el.textContent || '').trim().slice(0, 16)}」${Math.round(el.getBoundingClientRect().height)}`);
  const texts = [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const odd = texts.filter(el => { const c = getComputedStyle(el);return !['13px', '15px', '17px', '22px', '34px'].includes(c.fontSize) || !['400', '600'].includes(c.fontWeight); }).map(el => `${el.tagName.toLowerCase()}.${el.className}「${el.textContent.trim().slice(0, 16)}」${getComputedStyle(el).fontSize}/${getComputedStyle(el).fontWeight}`).slice(0, 8);
  const tiles = [...document.querySelectorAll('#world-games>*')].filter(visible).map(el => { const r = el.getBoundingClientRect();return `${el.className || el.tagName}@${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
  const fold = document.querySelector('.wp-games')?.getBoundingClientRect().bottom ?? null;
  return { overflow, small, odd, tiles, fold: fold && Math.round(fold), viewport: innerHeight };
});
const text = (page, sel) => page.locator(sel).first().textContent();
try {
  for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]]) {
    for (const name of Object.keys(SCENES)) {
      const { context, page, errors, unknown, external } = await open(name, width, height);
      const shot = suffix => page.screenshot({ path: path.join(out, `${name}-${width}${suffix}.png`), fullPage: width < 600 });
      await shot('');const m = await measure(page);report.push({ scene: name, width, ...m, errors, unknown, external });
      m.overflow > 0 ? bad(`${name} ${width} 가로 넘침 ${m.overflow}`) : ok(`${name} ${width} 가로 넘침 없음`);
      if (m.odd.length) bad(`${name} ${width} 글 크기 · 굵기 벗어남 ${m.odd.join(' ')}`);
      if (m.small.length) bad(`${name} ${width} 44px 미만 ${m.small.join(' ')}`);
      errors.length ? bad(`${name} ${width} 오류 ${errors.join(' | ')}`) : ok(`${name} ${width} 오류 없음`);
      const missing = unknown.filter(op => !/^(memoryGet|learningGet|classroom:learningGet|classroom:townMembership)$/.test(op));if (missing.length) bad(`${name} ${width} 합성에 없는 요청 ${missing}`);
      if (width >= 1280 && m.fold && m.fold > height) console.log(`  note ${name} ${width}: 게임 판 아래 끝 ${m.fold}px > 창 ${height}px`);
      if (name === 'practice') {
        (await text(page, '.wp-hero h2')) === '듣고 부정·변경 이해하기' ? ok('첫 판: 가장 먼저 연습할 곳') : bad('첫 판 기술 ' + await text(page, '.wp-hero h2'));
        (await text(page, '.wp-meta')).includes('최근 혼자 푼 9문항 중 4문항 맞힘') && (await text(page, '.wp-meta b')) === '44%' ? ok('첫 판 비율 44%') : bad('첫 판 비율 ' + await text(page, '.wp-meta'));
        (await text(page, '.wp-skill[data-skill="ko.listening.word"] .wp-pct')) === '92%' && (await text(page, '.wp-skill[data-skill="ko.reading.condition"] .wp-pct')) === '' ? ok('줄 비율(푼 문항 없는 줄은 비움)') : bad('줄 비율');
        (await text(page, '[data-rec-go]')) === '바람길로 연습' ? ok('연습 단추: 바람길(부정·변경 듣기가 주된 연습인 첫 게임)') : bad('연습 단추 ' + await text(page, '[data-rec-go]'));
        (await page.getAttribute('.game-links>button >> nth=0', 'data-game')) === 'korean-runner' ? ok('첫 게임 칸: 바람길') : bad('첫 게임 칸');
        (await page.locator('.game-links>button[data-rec]').count()) === 3 ? ok('노란 칸 셋') : bad('노란 칸 수 ' + await page.locator('.game-links>button[data-rec]').count());
        (await page.getAttribute('.game-links>button >> nth=-1', 'data-game')) === 'learning-hub' ? ok('모든 게임 · 상점은 끝') : bad('상점 칸 자리');
        await page.click('.wp-skill[data-skill="ko.reading.condition"]');await page.waitForTimeout(150);
        (await text(page, '[data-rec-go]')) === '입장 검사로 연습' && (await page.getAttribute('.game-links>button >> nth=0', 'data-game')) === 'entry-check' ? ok('조건 읽기 고름 → 입장 검사') : bad('고른 뒤 ' + await text(page, '[data-rec-go]'));
        (await page.getAttribute('.wp-skill[data-skill="ko.reading.condition"]', 'aria-pressed')) === 'true' ? ok('고른 줄 표시') : bad('고른 줄');
        (await page.evaluate(() => document.activeElement?.dataset?.skill)) === 'ko.reading.condition' ? ok('고른 뒤 초점 그대로') : bad('고른 뒤 초점');
        (await text(page, '.wp-tag')) === '오늘의 연습' ? ok('놓치지 않은 곳 꼬리표') : bad('꼬리표 ' + await text(page, '.wp-tag'));
        (await text(page, '.wp-games .wp-head .small')).startsWith('노란 칸은 「조건 읽기」를') ? ok('게임 머리 글') : bad('게임 머리 글 ' + await text(page, '.wp-games .wp-head .small'));
        await shot('-pick');
        await page.click('.wp-skill[data-skill="ko.listening.word"]');(await text(page, '.wp-tag')) === '잘 이어 가는 곳' ? ok('혼자 해낸 곳 고름') : bad('혼자 해낸 곳 꼬리');
        await page.click('.wp-skill[data-skill="ko.listening.negation"]');
        await page.click('[data-rec-go]');await page.waitForTimeout(500);
        (await page.isVisible('#world-games>iframe')) && (await page.isVisible('.wp-playing')) && !(await page.isVisible('.wp-hero')) && !(await page.isVisible('#world-games>.world-preferences')) && !(await page.isVisible('.wp-games')) ? ok('게임 열림: 판 접고 게임만') : bad('게임 열기');
        await shot('-game');
        await page.click('.wp-tab[data-tab="id"]');await page.waitForTimeout(200);await page.click('.wp-tab[data-tab="practice"]');await page.waitForTimeout(200);
        !(await page.isVisible('#world-games>iframe')) && (await page.isVisible('.wp-hero')) ? ok('게임 연 채 보기를 옮기면 게임을 닫음') : bad('보기 옮김에 게임 닫기');
        await page.click('[data-rec-go]');await page.waitForTimeout(400);
        await page.click('.wp-playing button');await page.waitForTimeout(200);
        (await page.isVisible('.wp-hero')) && !(await page.isVisible('#world-games>iframe')) ? ok('게임 닫고 연습으로') : bad('게임 닫기');
        await page.click('.wp-tab[data-tab="wardrobe"]');await page.waitForTimeout(300);
        (await page.isVisible('.wardrobe-section')) && !(await page.isVisible('.wp-hero')) && !(await page.isVisible('#world-games>.world-preferences')) && !(await page.isVisible('.wp-games')) ? ok('옷장 보기') : bad('옷장 보기');await shot('-wardrobe');
        await page.click('.wp-tab[data-tab="id"]');await page.waitForTimeout(300);
        (await page.isVisible('#account')) && !(await page.isVisible('#world-games')) ? ok('내 SYNK ID 보기') : bad('ID 보기');await shot('-id');
        const m2 = await measure(page);if (m2.overflow > 0) bad(`ID ${width} 가로 넘침`);if (m2.odd.length) bad(`ID ${width} 글 ${m2.odd.join(' ')}`);if (m2.small.length) bad(`ID ${width} 44px 미만 ${m2.small.join(' ')}`);
      }
      if (name === 'practice-off') { (await text(page, '[data-rec-go]')) === '내 SYNK ID에서 켜기' ? ok('연결 꺼짐: 켜러 가기') : bad('꺼짐 단추');await page.click('[data-rec-go]');await page.waitForTimeout(200);(await page.isVisible('#account')) ? ok('켜러 가기 → 내 SYNK ID') : bad('켜러 가기'); }
      if (name === 'practice-new') { (await text(page, '[data-rec-go]')) === '바람길로 시작' ? ok('첫 연습: 바람길') : bad('첫 연습 단추');!(await page.isVisible('.wp-big')) ? ok('새 계정: 0일 대신 빈 문장') : bad('새 계정 0일'); }
      if (name === 'practice-oldserver') (await text(page, '.wp-hero h2')) === '연습을 골라 이어 가요' ? ok('옛 서버 줄: 이어 가기 문장') : bad('옛 서버 첫 판 ' + await text(page, '.wp-hero h2'));
      if (name === 'atlas-fail') (await text(page, '.wp-hero h2')) === '연습을 골라 시작해요' ? ok('요약 실패 문장') : bad('요약 실패');
      if (name === 'practice-class') { await shot('-class');(await page.isVisible('#world-classroom')) ? ok('반 과제가 연습 보기에') : bad('반 과제'); }
      if (external.length) console.log(`  note ${name} ${width} 바깥 요청 막음 ${external.length}`);
      await context.close();
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(fails.length ? `\n실패 ${fails.length}` : '\n모두 통과');
process.exitCode = fails.length ? 1 : 0;
