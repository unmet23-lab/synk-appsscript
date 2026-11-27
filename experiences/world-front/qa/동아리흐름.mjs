// 동아리장 알림 → 튜터 고르기 → 실력 파악 → 맞춤(club.mjs · world-front-club.mjs, 11-24) 실제 앱 흐름 시험.
// 로컬 WORLD 리허설 서버(서울행 qa/서버.mjs)에서 손님이 1화 전 내 길에 있는 기록을 심고, 내 길의 동아리장 알림을 눌러
// 앞면의 처음 만남을 끝까지 간다. 문항 넷은 실제 엔진(「내 위치」 짧은 진단과 같은 고르기 · 세션 · 끝 기록)이 낸다. 운영 계정 · talk는 건드리지 않는다.
//   node experiences/world-front/qa/동아리흐름.mjs [--폭 390x844] [--언어 ko|en|mn] [--튜터 seoha|taeo|yuna] [--못읽음] [--찍기] [--라이브] [--날] [--나중에] [--다리실패]
// --라이브: 로컬 서버 대신 synk.im/world 공개본을 손님으로 연다(공개본은 안 바꾼다. GET이 아닌 요청이 나가면 실패).
// --나중에: 튜터를 고른 뒤 첫 문항에서 「나중에 할게요」로 나갔다가, 맞춤 화면의 작은 얼굴로 다시 들어와 그 튜터부터 잇는다.
// --날: 처음 만난 날을 앞으로 옮겨 이튿날 복습 알림과 사흘째 내 위치 알림까지 본다.
// --다리실패: 「맞춤 연습 시작」에서 앞면 다리(world-front-club.mjs의 clubDone)가 던지게 바꿔, 단추가 잠긴 채 남지 않고 대화가 닫혀 맞춤 화면이 서는지 본다(11-27 검수 front-fix3 P2 후속).
// --못읽음: 한글 「커피」에서 「아직 못 읽어요」 — 문항 없이 한글 길로 끝나는지 본다.
// 기록: .tmp/world-front-qa/club-<폭>-<언어>/ (찍기와 결과.json)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MAIN = path.join(os.homedir(), 'Documents', 'SYNK-appsscript');
const require = createRequire(path.join(fs.existsSync(path.join(ROOT, 'node_modules')) ? ROOT : MAIN, 'x.js'));
const {chromium} = require('playwright');
const args = process.argv.slice(2), opt = (n, d = null) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, has = n => args.includes(n);
const [W, H] = opt('--폭', '390x844').split('x').map(Number), LANG = opt('--언어', 'ko'), SHOTS = has('--찍기'), TUTOR = opt('--튜터', 'taeo'), NOREAD = has('--못읽음'), LIVE = has('--라이브'), DAYS = has('--날'), LATER = has('--나중에'), BRIDGEFAIL = has('--다리실패');
const OUT = path.join(ROOT, '.tmp', 'world-front-qa', `${LIVE ? '라이브-' : ''}club-${W}x${H}-${LANG}${NOREAD ? '-noread' : ''}${LATER ? '-later' : ''}${BRIDGEFAIL ? '-bridgefail' : ''}`); fs.mkdirSync(OUT, {recursive: true});
const PORT = Number(opt('--포트', String(5100 + Math.floor(Math.random() * 300))));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [], fail = [];
const check = (ok, what, detail = '') => { log.push(`${ok ? '통과' : '실패'} ${what}${detail ? ` — ${detail}` : ''}`); if (!ok) fail.push(what); console.log(log.at(-1)); };

const data = path.join(ROOT, '.tmp', 'world-front-qa', `db-${PORT}`);
const server = LIVE ? {kill() {}} : spawn(process.execPath, [path.join(ROOT, 'experiences/seoul-arrival/qa/서버.mjs'), String(PORT)], {env: {...process.env, SYNK_WORLD_DATA_DIR: data}, stdio: 'ignore'});
process.on('exit', () => { try { server.kill(); } catch {} });
const base = LIVE ? 'https://synk.im/world' : `http://127.0.0.1:${PORT}`;
for (let i = 0; !LIVE && i < 120; i++) { try { const r = await fetch(base + '/health'); if (r.ok) break; } catch {} await sleep(500); }

const browser = await chromium.launch({channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required']});
const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: W < 700, locale: LANG === 'ko' ? 'ko-KR' : LANG === 'mn' ? 'mn-MN' : 'en-US'});
const page = await context.newPage();
const errors = [], bad = [], posts = [];
if (LIVE) page.on('request', q => { if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method())) posts.push(`${q.method()} ${q.url().slice(0, 120)}`); });
page.on('pageerror', e => errors.push('페이지 ' + String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('콘솔 ' + m.text().slice(0, 300)); });
page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/\/api\//.test(u)) bad.push(`${r.status()} ${u.replace(base, '')}`); });
let patched = 0;
if (BRIDGEFAIL) await context.route(/\/world-front-club\.mjs(\?|$)/, async route => {
  const r = await route.fetch(), body = await r.text(), head = 'async clubDone({open=true}={}){';
  if (body.includes(head)) patched++;
  await route.fulfill({response: r, body: body.replace(head, head + "if(open)throw new Error('다리 실패 시험');")});
});
const shot = async name => { if (SHOTS) await page.screenshot({path: path.join(OUT, name + '.png')}); };
const F = () => page.frames().find(f => f.url().includes('/world-front/'));
const S = () => page.frames().find(f => f.url().includes('/seoul-arrival/'));
const until = async (what, fn, ms = 30000) => { const t0 = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) { check(false, what, '시간 초과'); return null; } await sleep(150); } };
// 그림자 안 단추 누르기(club.mjs는 두 틀의 CSS와 섞이지 않게 그림자 안에 그린다)
const inClub = (fn, arg) => F().evaluate(fn, arg);
const press = (sel, text = '') => inClub(({sel, text}) => { const sr = document.querySelector('.cl-host')?.shadowRoot; const list = [...(sr?.querySelectorAll(sel) || [])].filter(b => !b.disabled && (!text || b.textContent.includes(text))); const b = list.at(-1); if (!b) return false; b.click(); return true; }, {sel, text});
const waitPress = (what, sel, text = '', ms = 30000) => until(what, () => press(sel, text), ms);
async function finish() {
  check(!errors.length, '콘솔 · 페이지 오류 0', errors.slice(0, 4).join(' | '));
  check(!bad.length, '404 · 400대 응답 0', bad.slice(0, 4).join(' | '));
  if (LIVE) check(!posts.length, 'GET 아닌 요청 없음', posts.slice(0, 4).join(' | '));
  fs.writeFileSync(path.join(OUT, '결과.json'), JSON.stringify({폭: `${W}x${H}`, 언어: LANG, 튜터: TUTOR, 못읽음: NOREAD, 통과: log.filter(l => l.startsWith('통과')).length, 실패: fail, 기록: log}, null, 1));
  console.log(fail.length ? `실패 ${fail.length}건` : '모두 통과');
  await browser.close(); server.kill(); process.exit(fail.length ? 1 : 0);
}

// ── 1화 전 내 길에 선 손님(학생증까지 받음) ──
const arrival = {version: 1, stage: 'card', dream: 'idol', name: '볼로르', nameEn: 'Bolor', call: '언니', from: '몽골', look: 'mn_f', scenes: [], updatedAt: Date.now() - 60e3};
await page.goto(`${base}/mobile.html${LIVE ? '' : '?frontAuto=1'}`, {waitUntil: 'domcontentloaded'});
await page.evaluate(({lang, arrival}) => {
  if (lang !== 'ko') localStorage.setItem('synk.world.lang', lang);
  localStorage.setItem('synk.world.arrival.v1:guest', JSON.stringify(arrival));
}, {lang: LANG, arrival});
await page.reload({waitUntil: 'domcontentloaded'});
// 학생증까지 받은 손님은 타이틀을 지나 곧장 내 길로 간다(seoulDecision at 'road'). 타이틀이 서면 한 번 누른다
const onRoad = async () => !!S() && await S().evaluate(() => document.querySelector('#s-path')?.classList.contains('on'));
const first = await until('타이틀 또는 내 길', async () => (await onRoad()) ? 'road' : (await page.evaluate(() => window.__synkOpening?.stage?.() === 'title')) ? 'title' : null, 40000);
if (first === 'title') { await sleep(800); await page.mouse.click(W / 2, H * .55); }
await until('내 길', onRoad, 30000);
await shot('0-내길');
await sleep(1500);
const road = await S().evaluate(() => ({home: !!document.querySelector('#goHome'), start: !!document.querySelector('#startEp'), note: !!document.querySelector('.cl-host-note')}));
check(road.start, '내 길에 「1화 시작」이 있음');
check(!road.home, '1화 전 내 길에 「오늘은 여기까지」가 없음');
check(road.note, '내 길에 동아리장 알림이 있음');
await sleep(1800); await shot('1-내길알림');
await S().evaluate(() => { setTimeout(() => document.querySelector('.cl-host-note')?.shadowRoot?.querySelector('.cl-isl')?.click(), 0); }).catch(() => {});   // 누르면 내 길 틀이 떨어진다
await until('앞면이 처음 만남으로 열림', async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && !!F() && await inClub(() => !!document.querySelector('.cl-host')?.shadowRoot?.querySelector('.cl-who')), 30000);
check(await page.evaluate(() => !document.querySelector('#seoul-layer')), '내 길이 닫힘');
await sleep(2500); await shot('2-동아리장');

// ── 동아리장 → 튜터 고르기 ──
await waitPress('「조금 해요」', '.cl-rp', '조금 해요');
await until('튜터 고르기 판', () => inClub(() => !!document.querySelector('.cl-host')?.shadowRoot?.querySelector('.cl-pick.on')), 20000);
await sleep(700); await shot('3-튜터고르기');
// 고르기 전에는 단추가 잠겨 있고 미리 골라진 장이 없다(이야기 지도 3-5 선배 고르기 규칙)
check(await inClub(() => { const r = document.querySelector('.cl-host').shadowRoot; return r.querySelector('[data-go]').disabled && !r.querySelector('.cl-pick .tc[aria-checked="true"]'); }), '튜터 고르기 — 미리 골라진 장 없음 · 단추 잠김');
await inClub(t => document.querySelector('.cl-host').shadowRoot.querySelector(`.cl-pick .tc[data-t="${t}"]`)?.click(), TUTOR);
await sleep(900); await shot('3b-튜터고른뒤');
await waitPress('튜터 고르기 단추', '[data-go]');
await waitPress('「시작」', '.cl-rp.solid', '', 30000);

// ── 한글 한 문제 ──
await until('「커피」 카드', () => inClub(() => !!document.querySelector('.cl-host').shadowRoot.querySelector('.cl-ch[data-v="coffee"]')), 20000);
await sleep(500); await shot('4-커피');
if (NOREAD) await waitPress('「아직 못 읽어요」', '.cl-skip');
else await waitPress('커피 그림', '.cl-ch[data-v="coffee"]');
await sleep(800);
await waitPress('판정 뒤 단추', '.cl-nx');

// ── 나중에: 첫 문항에서 나갔다가 작은 얼굴로 다시 ──
if (LATER) {
  await until('첫 문항', () => inClub(() => [...document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cl-card')].at(-1)?.querySelectorAll('.cl-ch:not([data-v="coffee"])').length > 1 && !!document.querySelector('.cl-host').shadowRoot.querySelector('.cl-out:not([hidden])')), 40000);
  await sleep(600); await shot('L1-첫문항');
  const label = await inClub(() => document.querySelector('.cl-host').shadowRoot.querySelector('.cl-out').textContent);
  check(label === {ko: '나중에 할게요', en: 'Maybe later', mn: 'Дараа хийнэ'}[LANG], '머리에 「나중에 할게요」', label);
  await press('.cl-out');
  await until('나간 뒤 맞춤 화면', () => F().evaluate(() => !document.querySelector('.cl-host') && !!document.querySelector('.view.home')), 20000);
  await sleep(1500); await shot('L2-나간뒤');
  const m = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}'));
  check(m.club?.tutor === TUTOR && !m.club?.done, '나가도 고른 튜터는 남고 마친 것은 아니다', JSON.stringify({tutor: m.club?.tutor, done: m.club?.done}));
  const row = (m.inbox || []).filter(r => r.from === 'club' || r.from === 'tutor');
  check(row.length === 1 && row[0].who === TUTOR && row[0].dropped === true && row[0].read === false, '알림은 한 줄 · 그 튜터 · 오늘은 다시 내려오지 않음', JSON.stringify(row.map(r => ({who: r.who, code: r.code, dropped: r.dropped, read: r.read}))));
  const face = await F().evaluate(() => { const i = document.querySelector('.cl-host-note')?.shadowRoot?.querySelector('.cl-isl'); return i ? {docked: i.classList.contains('docked'), badge: !!i.querySelector('.badge'), label: i.getAttribute('aria-label')} : null; });
  check(!!face?.docked && face.badge, '작은 얼굴과 빨간 1로 남는다', JSON.stringify(face));
  await F().evaluate(() => document.querySelector('.cl-host-note').shadowRoot.querySelector('.cl-isl').click());
  await until('다시 들어온 튜터 대화', () => inClub(() => !!document.querySelector('.cl-host')?.shadowRoot?.querySelector('.cl-rp.solid')), 30000);
  await sleep(500); await shot('L3-다시');
  check(await inClub(() => !document.querySelector('.cl-host').shadowRoot.querySelector('.cl-pick') && !document.querySelector('.cl-host').shadowRoot.querySelector('.cl-who')), '동아리장 · 튜터 고르기를 되풀이하지 않는다');
  await waitPress('「시작」(다시)', '.cl-rp.solid', '', 30000);
  await until('「커피」 카드(다시)', () => inClub(() => !!document.querySelector('.cl-host').shadowRoot.querySelector('.cl-ch[data-v="coffee"]')), 20000);
  await sleep(400); await waitPress('커피 그림(다시)', '.cl-ch[data-v="coffee"]');
  await sleep(800); await waitPress('판정 뒤 단추(다시)', '.cl-nx');
}

// ── 문항(실제 엔진) ──
let items = 0, listened = 0;
if (!NOREAD) {
  for (let i = 0; i < 6; i++) {
    const kind = await until('다음 문항 또는 결과', () => inClub(() => { const sr = document.querySelector('.cl-host').shadowRoot; const cards = [...sr.querySelectorAll('.cl-card')]; const last = cards.at(-1); if (last?.classList.contains('res')) return 'res';
      if (last && last.querySelector('.cl-ch:not(.cl-ch[data-v="coffee"])') && !last.querySelector('.cl-fb .cl-nx') && !last.querySelector('.cl-ch.mine')) return last.querySelector('.cl-listen') ? 'listen' : 'read'; return null; }), 40000);
    if (!kind || kind === 'res') break;
    items++;
    if (kind === 'listen') {
      await press('.cl-listen');
      const heard = await until('끝까지 들으면 보기가 열림', () => inClub(() => [...document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cl-card')].at(-1).querySelectorAll('.cl-ch:not([disabled])').length > 0), 30000);
      if (heard) listened++;
    }
    await sleep(300);
    if (i === 0) await shot('5-첫문항');
    await inClub(() => { const last = [...document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cl-card')].at(-1); last.querySelector('.cl-ch:not([disabled])')?.click(); });
    await until('판정 줄', () => inClub(() => !![...document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cl-card')].at(-1).querySelector('.cl-fb .cl-nx')), 15000);
    const fb = await inClub(() => [...document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cl-card')].at(-1).querySelector('.cl-fb')?.innerText || '');
    check(fb.replace(/\s+/g, '').length > 8, `문항 ${items}: 판정 줄에 까닭이 있음`, fb.slice(0, 60).replace(/\s+/g, ' '));
    if (LANG !== 'ko') check(!/[가-힣]{2}/.test(fb.replace(/「[^」]*」/g, '')), `문항 ${items}: 까닭이 화면 언어(따옴표 밖 한국어 없음)`, fb.replace(/\s+/g, ' ').slice(0, 90));
    await press('.cl-nx');
  }
  check(items >= 1, '실제 엔진이 문항을 냄', `${items}문항 · 듣기 ${listened}`);
}

// ── 지금 여기 ──
await until('결과 카드', () => inClub(() => !!document.querySelector('.cl-host').shadowRoot.querySelector('.cl-card.res')), 30000);
await sleep(2500); await shot('6-지금여기');
const res = await inClub(() => document.querySelector('.cl-host').shadowRoot.querySelector('.cl-card.res')?.innerText || '');
if (!NOREAD) check(/16/.test(res), '결과에 16칸 지도가 있음', res.slice(0, 60).replace(/\s+/g, ' '));
const over = await inClub(() => document.documentElement.scrollWidth - innerWidth);
check(over <= 0, '가로 넘침 없음', String(over));
const mark = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}'));
check(mark.club?.tutor === TUTOR, '고른 튜터를 기기 표에 남김', String(mark.club?.tutor));
if (!NOREAD) check(!('cells' in (mark.club || {})) && Array.isArray(mark.club?.results) && mark.club.results.length === items + 1, '기기 표에는 문항 줄만(칸은 지도에서)', `${mark.club?.results?.length}`);
// 결과 칸은 「내 위치」 판과 같은 지도 칸(혼자 해냄 · 연습 중 · 아직) — 붉은 칸 없음, 세 칸 수의 합이 칸 수(설계 검토 11-25)
const grid = await inClub(() => { const r = document.querySelector('.cl-host').shadowRoot.querySelector('.cl-card.res'); return {cells: r.querySelectorAll('.cells i').length, red: r.querySelectorAll('.cells i.next, .cells i.done').length, sum: [...r.querySelectorAll('.mapkey b')].reduce((n, b) => n + Number(b.textContent), 0)}; });
if (!NOREAD) check(grid.cells === 16 && grid.red === 0 && grid.sum === 16, '결과 칸은 지도 칸 셋 · 세 칸 수의 합', JSON.stringify(grid));
if (BRIDGEFAIL) {
  check(patched > 0, '다리 원천에 던지는 줄을 넣음', String(patched));
  // 두 번 누른다 — 첫 누름이 단추를 잠그고, 다리가 던져도 대화는 닫힌다
  const twice = await until('「맞춤 연습 시작」 두 번 누름', () => inClub(() => { const b = document.querySelector('.cl-host')?.shadowRoot?.querySelector('.cl-cta'); if (!b || b.disabled) return null; b.click(); b.click(); return true; }));
  check(!!twice, '「맞춤 연습 시작」을 두 번 누름');
  await until('다리가 던져도 대화가 닫히고 맞춤 화면', () => F().evaluate(() => !document.querySelector('.cl-host') && !!document.querySelector('.view.home')), 20000);
  await sleep(1500); await shot('7-다리실패-맞춤');
  const after = await F().evaluate(() => ({hosts: document.querySelectorAll('.cl-host').length, home: document.querySelectorAll('.view.home').length, stuck: [...document.querySelectorAll('.view.home button')].filter(b => b.disabled).length}));
  check(after.hosts === 0 && after.home === 1, '대화 판 0 · 맞춤 화면 하나', JSON.stringify(after));
  const who2 = await F().evaluate(() => document.querySelector('.view.home .who b')?.textContent || '');
  log.push(`참고 다리 실패 뒤 말하는 사람 ${who2}`);
  await finish();
}
await waitPress('「맞춤 연습 시작」', '.cl-cta');
await until('맞춤 화면', () => F().evaluate(() => !document.querySelector('.cl-host') && !!document.querySelector('.view.home')), 20000);
await sleep(2000); await shot('7-맞춤');
const mark2 = await page.evaluate(() => JSON.parse(localStorage.getItem('synk.world.front.v1:guest') || '{}'));
check(mark2.club?.done === true, '처음 만남을 마친 것으로 남김');
const who = await F().evaluate(() => document.querySelector('.view.home .who b')?.textContent || '');
check(TUTOR === 'seoha' ? who.startsWith('서하') : who.includes(TUTOR === 'taeo' ? '태오' : '유나'), '맞춤 화면의 말하는 사람이 고른 튜터', who);
const hangul = await page.evaluate(() => { try { return JSON.stringify(window.__synkWorld?.life?.progress?.hangulReading?.() || null); } catch { return 'err'; } });
log.push(`참고 한글 답 ${hangul}`);
// 판이 떴으면(오늘 할 일을 바로 연다) 닫고 앞면으로
await sleep(1500);
if (await page.evaluate(() => document.querySelector('#world-panel')?.open)) { await shot('8-오늘할일판'); log.push('참고 오늘 할 일 판이 열림'); }

// ── 이튿날 · 사흘째 알림(기기 표의 처음 만난 날과 알림 줄의 날을 앞으로 옮긴다) ──
if (DAYS) for (const [days, level] of [[1, false], [3, true]]) {
  await page.evaluate(d => { const k = 'synk.world.front.v1:guest', m = JSON.parse(localStorage.getItem(k)); m.club.at = Date.now() - d * 864e5; m.inbox = (m.inbox || []).map(r => ({...r, at: (r.at || Date.now()) - 864e5})); localStorage.setItem(k, JSON.stringify(m)); }, days);
  await page.goto(`${base}/mobile.html${LIVE ? '' : '?frontAuto=1'}`, {waitUntil: 'domcontentloaded'});
  // 앞면에 다녀온 학생은 앞면이 바로 열린다. 내 길에 서면 「오늘은 여기까지」로 간다
  const frontOpen = async () => (await page.evaluate(() => !!document.querySelector('#front-layer')?.open)) && !!F();
  const at = await until(`${days}일째 앞면 또는 내 길`, async () => (await frontOpen()) ? 'front' : (await onRoad()) ? 'road' : (await page.evaluate(() => window.__synkOpening?.stage?.() === 'title')) ? 'title' : null, 40000);
  if (!at) continue;
  if (at === 'title') { await sleep(900); await page.mouse.click(W / 2, H * .55); }
  if (at !== 'front') {
    await until(`${days}일째 앞면 또는 내 길`, async () => (await frontOpen()) || onRoad(), 30000);
    if (!(await frontOpen())) { await sleep(1800); await S().evaluate(() => { setTimeout(() => document.querySelector('#goHome')?.click(), 0); }).catch(() => {}); }
    if (!await until(`${days}일째 앞면`, frontOpen, 30000)) continue;
  }
  const got = await until(`${days}일째 알림`, () => F().evaluate(() => !!document.querySelector('.cl-host-note')?.shadowRoot?.querySelector('.cl-isl')), 20000);
  await sleep(1500); await shot(`${days}일-1알림`);
  if (!got) continue;
  check(true, `${days}일째 튜터 알림이 뜸`, await F().evaluate(() => (document.querySelector('.cl-host-note').shadowRoot.querySelector('.cl-isl').innerText || '').replace(/\s+/g, ' ').slice(0, 80)));
  await F().evaluate(() => document.querySelector('.cl-host-note').shadowRoot.querySelector('.cl-isl').click());
  if (!await until(`${days}일째 대화`, () => inClub(() => !!document.querySelector('.cl-host')?.shadowRoot?.querySelector('.cl-cta')), 20000)) continue;
  await sleep(450);
  const y0 = await inClub(() => document.querySelector('.cl-host').shadowRoot.querySelector('.cl-cta').getBoundingClientRect().top);
  await sleep(4500); await shot(`${days}일-2대화`);
  const y1 = await inClub(() => document.querySelector('.cl-host').shadowRoot.querySelector('.cl-cta').getBoundingClientRect().top);
  check(Math.abs(y1 - y0) < 2, `${days}일째 단추가 뜬 뒤 밀리지 않음`, `${Math.round(y0)} → ${Math.round(y1)}`);
  const cells = await inClub(() => document.querySelector('.cl-host').shadowRoot.querySelectorAll('.cells i').length);
  check(level ? cells === 16 : cells === 0, level ? '사흘째 대화에 내 위치 칸 16' : '이튿날은 복습 대화(칸 없음)', String(cells));
}
await finish();
