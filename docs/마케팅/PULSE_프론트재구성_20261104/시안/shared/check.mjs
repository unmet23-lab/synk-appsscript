// 세 방향을 끝까지 눌러 본다: 작품 열기 · 닫기, 의견 남기기 · 보내기, 승인 흐름, 움직임 줄이기, 콘솔 오류. node shared/check.mjs
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const HOME = homedir().replaceAll('\\', '/');
const require = createRequire(`${HOME}/Documents/SYNK-appsscript/package.json`);
const { chromium } = require('playwright');
const BASE = process.env.SIAN_BASE || 'http://127.0.0.1:4793';
const OUT = `${HOME}/Documents/synk-vendor/pulse-rebuild-20261104/shots/`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle'] });
const results = [];
const ok = (name, pass, note = '') => { results.push({ name, pass, note }); console.log(`${pass ? 'OK ' : 'NG '} ${name}${note ? ` — ${note}` : ''}`); };
async function open(path, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.m ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'ko-KR', isMobile: !!opts.m, hasTouch: !!opts.m, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().slice(-60)}`); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1400);
  return { page, ctx, errs };
}
const playing = (page, sel) => page.evaluate((s) => { const v = document.querySelector(s); return v && !v.paused && v.currentTime > 0; }, sel);

// A 첫 화면
{
  const { page, ctx, errs } = await open('/a/');
  ok('A 첫 화면: 쇼릴이 돈다', await playing(page, '[data-reel]'));
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1200);
  ok('A 키보드로 다음 쪽', (await page.evaluate(() => document.body.dataset.section)) === '1');
  await page.click('[data-work=cf]'); await page.waitForTimeout(900);
  ok('A 작품 누르면 상영이 열린다', await page.locator('.screening').count() === 1);
  await page.keyboard.press(' '); await page.waitForTimeout(300);
  ok('A 상영 창에서 스페이스는 멈춤', await page.locator('.screening').count() === 1 && await page.evaluate(() => document.querySelector('.screening video').paused));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  ok('A Esc로 닫힌다', await page.locator('.screening').count() === 0);
  await page.evaluate(() => { const r = document.querySelector('.reel'); r.scrollTo({ top: document.querySelectorAll('.s')[2].offsetTop, behavior: 'instant' }); }); await page.waitForTimeout(900);
  await page.hover('[data-check="2"]'); await page.waitForTimeout(1000);
  ok('A 세 번 확인 줄을 고르면 화면이 바뀐다', await page.evaluate(() => document.querySelector('.pane-cuts').classList.contains('is-on')));
  ok('A 작품 목록은 완성된 둘 + 공모전 한 줄', await page.evaluate(() => document.querySelectorAll('.works .work').length === 2 && document.querySelectorAll('.work.is-contest').length === 1));
  await page.evaluate(() => { const r = document.querySelector('.reel'); r.scrollTo({ top: document.querySelectorAll('.s')[6].offsetTop, behavior: 'instant' }); }); await page.waitForTimeout(700);
  const chained = await page.evaluate(() => { const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); document.querySelector('.reel').dispatchEvent(ev); return !ev.defaultPrevented; });
  ok('A 끝 쪽에서 더 내리면 바깥 페이지로 넘긴다', chained);
  ok('A 콘솔 오류 없음', !errs.length, errs.join(' / '));
  await ctx.close();
}
// A 시안 확인
for (const dir of ['a', 'b', 'c']) {
  const D = dir.toUpperCase();
  const input = dir === 'b' ? '[data-compose] input' : '[data-say] input';
  const { page, ctx, errs } = await open(`/${dir}/review.html`);
  ok(`${D} 시안 확인: 달라진 곳 안에서 시작`, Math.abs((await page.evaluate(() => document.querySelector('[data-main]').currentTime)) - 10) < 0.3);
  await page.click('[data-play]'); await page.waitForTimeout(900);
  ok(`${D} 재생`, await playing(page, '[data-main]'));
  await page.click('[data-main]'); await page.waitForTimeout(200);
  await page.fill(input, '뚜껑이 조금 더 빨리 보이면 좋겠어요');
  if (dir === 'b') await page.click('[data-add]'); else await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok(`${D} 의견이 임시로 쌓인다`, (await page.textContent('[data-decide-label]')).includes('의견 1개'));
  await page.click('[data-decide]'); await page.waitForTimeout(300);
  const label = await page.textContent('[data-decide-label]');
  ok(`${D} 보낸 뒤 단추는 다시 승인`, label.includes('최종 승인'), label);
  await page.click('[data-decide]'); await page.waitForTimeout(500);
  ok(`${D} 승인 창이 열린다`, await page.locator('[data-sheet]').isVisible());
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  ok(`${D} Esc로 승인 창이 닫힌다`, !(await page.locator('[data-sheet]').isVisible()));
  await page.click('[data-decide]'); await page.waitForTimeout(400); await page.click('[data-sheet-ok]'); await page.waitForTimeout(500);
  ok(`${D} 승인하면 완료 문구`, (await page.textContent('[data-decide-label]')).includes('승인했어요'));
  if (dir !== 'b') ok(`${D} 승인 뒤 「보냈어요」가 남지 않는다`, !(await page.locator('[data-sent]').isVisible()));
  await page.click('[data-compare]'); await page.waitForTimeout(600);
  const over = await page.evaluate(() => {
    const films = [...document.querySelectorAll('.film-box:not([hidden])')].map((f) => f.getBoundingClientRect());
    const right = document.querySelector('.right,.table,.board')?.getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, n: films.length, filmRight: Math.max(...films.map((r) => r.right)), right: right?.left };
  });
  ok(`${D} 나란히 보기가 글과 겹치지 않는다`, over.n === 2 && over.sw <= 1440 && over.filmRight <= over.right + 1, JSON.stringify(over));
  await page.screenshot({ path: `${OUT}chk-${dir}-compare.jpg`, type: 'jpeg', quality: 76 });
  const hit = await page.evaluate(() => { const r = document.querySelector('[data-main]').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.tagName; });
  ok(`${D} 나란히 보기에서 영상이 눌린다`, hit === 'VIDEO', hit);
  if (dir === 'b') {
    await page.locator('.fr[data-v=v1]:visible').first().click(); await page.waitForTimeout(500);
    ok('B 나란히 보기에서 1차 띠를 눌러도 왼쪽은 2차', await page.evaluate(() => /v2\.mp4/.test(document.querySelector('[data-main]').currentSrc)));
    await page.keyboard.press('Escape');
    const folds = await page.evaluate(() => [...document.querySelectorAll('[data-strip=v2] .fold span')].map((n) => n.textContent));
    ok('B 접힌 칸 경계가 달라진 곳과 맞는다', folds.join('|') === '0~6초그대로|13~15초그대로', folds.join('|'));
  } else {
    await page.click('[data-ver=v1]'); await page.waitForTimeout(600);
    const st = await page.evaluate(() => ({ compare: document.body.classList.contains('is-compare'), src: document.querySelector('[data-main]').currentSrc.slice(-6) }));
    ok(`${D} 나란히 보기에서 1차를 고르면 한 편으로`, !st.compare && st.src === 'v1.mp4', JSON.stringify(st));
  }
  ok(`${D} 시안 확인 콘솔 오류 없음`, !errs.length, errs.join(' / '));
  await ctx.close();
}
// B 첫 화면
{
  const { page, ctx, errs } = await open('/b/');
  const moved = await page.evaluate(async () => { const t = document.querySelector('.track'); const a = new DOMMatrix(getComputedStyle(t).transform).m41; await new Promise((r) => setTimeout(r, 900)); return new DOMMatrix(getComputedStyle(t).transform).m41 - a; });
  ok('B 필름 띠가 흐른다', Math.abs(moved) > 2, String(moved));
  // 띠가 흐르므로 자리로 마우스를 옮기면 멈춘다.
  await page.mouse.move(720, 200); await page.waitForTimeout(500);
  ok('B 손을 올리면 인화가 뜬다', await page.locator('[data-print]').isVisible());
  await page.screenshot({ path: `${OUT}chk-b-print.jpg`, type: 'jpeg', quality: 76 });
  await page.mouse.click(720, 200); await page.waitForTimeout(1200);
  const t = await page.evaluate(() => { const v = document.querySelector('.screen video'); return v ? v.currentTime : -1; });
  ok('B 누르면 그 순간부터 튼다', t > 1, String(t));
  await page.screenshot({ path: `${OUT}chk-b-screen.jpg`, type: 'jpeg', quality: 76 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.keyboard.press(' ');
  ok('B 작품은 완성된 둘 + 공모전 한 줄', await page.evaluate(() => document.querySelectorAll('.roll').length === 3 && document.querySelectorAll('.roll.is-contest').length === 1));
  const size = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-fit]')).fontSize);
  const before = await size();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300);
  const after = await size();
  ok('B 창을 바꿨다 돌아와도 제목 크기가 같다', before === after, `${before} → ${after}`);
  ok('B 콘솔 오류 없음', !errs.length, errs.join(' / '));
  await ctx.close();
}
// C 첫 화면
{
  const { page, ctx, errs } = await open('/c/');
  ok('C 글자 속 영상이 돈다', await playing(page, '[data-film]'));
  await page.evaluate(() => scrollTo(0, innerHeight * 1.05)); await page.waitForTimeout(700);
  ok('C 획 속으로 들어가면 글자 판이 사라진다', (await page.evaluate(() => getComputedStyle(document.querySelector('[data-cut]')).opacity)) === '0');
  await page.evaluate(() => scrollTo(0, document.querySelector('.three').offsetTop + 40)); await page.waitForTimeout(600);
  ok('C 어두운 절에서 머리글이 밝다', await page.evaluate(() => document.body.classList.contains('is-dark-top')));
  await page.evaluate(() => scrollTo(0, document.querySelector('.works').offsetTop)); await page.waitForTimeout(800);
  await page.click('[data-watch=gift]'); await page.waitForTimeout(900);
  ok('C 작품 이름을 누르면 상영', await page.locator('.screen').count() === 1);
  await page.screenshot({ path: `${OUT}chk-c-screen.jpg`, type: 'jpeg', quality: 76 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  ok('C 작품은 완성된 둘 + 공모전 한 줄', await page.evaluate(() => document.querySelectorAll('.names .name').length === 2 && document.querySelectorAll('.contest').length === 1));
  ok('C 콘솔 오류 없음', !errs.length, errs.join(' / '));
  await ctx.close();
}
// C 큰 숫자
{
  const { page, ctx } = await open('/c/review.html');
  const now = () => page.evaluate(() => document.querySelector('[data-main]').currentTime);
  const b = await page.locator('[data-clock]').boundingBox();
  const t0 = await now();
  await page.mouse.move(b.x + 40, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(300);
  const t1 = await now();
  ok('C 큰 숫자를 잡기만 하면 시간이 안 튄다', Math.abs(t1 - t0) < 0.2, `${t0} → ${t1}`);
  await page.mouse.move(b.x + 40, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + 160, b.y + b.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  const t2 = await now();
  ok('C 큰 숫자를 끈 만큼 시간이 옮겨 간다', t2 > t1 + 0.5, `${t1} → ${t2}`);
  await ctx.close();
}
// 비교 페이지
{
  const { page, ctx, errs } = await open('/');
  await page.evaluate(() => document.querySelector('[data-dir=a] .stage').scrollIntoView()); await page.waitForTimeout(2500);
  const box = await page.locator('[data-dir=a] [data-view=d]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const y0 = await page.evaluate(() => scrollY);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(120); }
  await page.waitForTimeout(300);
  const y1 = await page.evaluate(() => scrollY);
  ok('비교 페이지: 시안 위에서도 페이지가 내려간다', y1 > y0 + 300, `${y0} → ${y1}`);
  await page.evaluate(() => document.querySelector('[data-dir=a] .stage').scrollIntoView()); await page.waitForTimeout(800);
  await page.locator('[data-dir=a] [data-view=d] .shield').click(); await page.waitForTimeout(400);
  ok('비교 페이지: 누르면 시안을 직접 조작할 수 있다', await page.evaluate(() => document.querySelector('[data-dir=a] [data-view=d]').classList.contains('is-live')));
  ok('비교 페이지: 콘솔 오류 없음', !errs.length, errs.join(' / '));
  await ctx.close();
}
// 움직임 줄이기
for (const path of ['/a/', '/b/', '/c/', '/a/review.html', '/b/review.html', '/c/review.html']) {
  const { page, ctx, errs } = await open(path, { reduced: true });
  const paused = await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused));
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.track') || document.body).animationName);
  ok(`움직임 줄이기 ${path}: 영상이 저절로 돌지 않는다`, paused && (anim === 'none'), anim);
  const name = path.replace(/[/.]/g, '_');
  await page.screenshot({ path: `${OUT}chk-rm${name}.jpg`, type: 'jpeg', quality: 70 });
  ok(`움직임 줄이기 ${path}: 오류 없음`, !errs.length, errs.join(' / '));
  await ctx.close();
}
// 휴대폰에서 받은 링크로 열기
for (const dir of ['a', 'b', 'c']) {
  const { page, ctx } = await open(`/${dir}/`, { m: true });
  const vis = await page.locator('[data-open]:visible').count();
  ok(`${dir.toUpperCase()} 휴대폰에서 받은 링크로 열기가 보인다`, vis >= 1);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(`${dir.toUpperCase()} 휴대폰 가로 넘침 없음`, sw <= 390, String(sw));
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} 통과`);
if (bad.length) { console.log(bad.map((r) => `NG ${r.name} ${r.note}`).join('\n')); process.exit(1); }
process.exit(0);
