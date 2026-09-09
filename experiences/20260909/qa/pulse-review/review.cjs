const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { createExperienceServer } = require('../../server.cjs');
const root = process.env.PULSE_REVIEW_ROOT || 'C:/Users/q1212/Documents/SYNK-worktrees/pulse-20260909/experiences/20260909';
const output = __dirname;
const records = [], failures = [], errors = [];
const sources = ['pulse/index.html','pulse/app.js','pulse/scene.js','pulse/style.css'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
function check(name, detail = {}) { records.push({name, ...detail}); console.log('PASS ' + name); }
async function phase(page, value) { await page.waitForFunction(v => document.getElementById('experience').dataset.phase === v, value); }
async function countShared(page, n) { await page.waitForFunction(v => document.getElementById('shared-count').textContent === String(v), n); }
async function audit(page, name) {
  await page.addScriptTag({path: 'C:/Users/q1212/Documents/SYNK-appsscript/tools/vendor/axe.min.js'});
  const result = await page.evaluate(async () => {
    const result = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}});
    return result.violations.map(v => ({id:v.id, impact:v.impact, description:v.description, nodes:v.nodes.map(n => ({target:n.target, summary:n.failureSummary}))}));
  });
  fs.writeFileSync(path.join(output, name + '-axe.json'), JSON.stringify(result, null, 2));
  check(name + ' axe audit', {violations: result.length});
}
async function ownClues(page, label) {
  await page.locator('#object-nav').getByRole('button', {name:label}).click();
  await page.locator('.private-clue').first().waitFor();
  const text = await page.locator('.private-clue h3').allTextContents();
  assert.equal(text.length, 2);
  return text;
}
async function share(page) {
  await page.getByRole('button', {name:'이 단서 함께 나누기 →', exact:true}).first().click();
  await page.getByRole('button', {name:'이 단서 함께 나누기 →', exact:true}).first().click();
}
let app, browser;
(async () => {
  app = createExperienceServer({root});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({channel:'chrome', headless:true});
  const c1 = await browser.newContext({viewport:{width:1440,height:960}});
  const c2 = await browser.newContext({viewport:{width:1365,height:900}});
  const a = await c1.newPage(), b = await c2.newPage();
  for (const p of [a,b]) p.on('pageerror', e => errors.push(e.message.replace(/token=[^&\s]+/g, 'token=[redacted]')));
  await a.goto(base + '/pulse/', {waitUntil:'domcontentloaded'});
  await a.locator('#loading').waitFor({state:'hidden', timeout:60000});
  await a.keyboard.press('Tab');
  check('entry first keyboard target', {target:await a.locator(':focus').textContent()});
  await audit(a, 'entry-desktop');
  await a.locator('#create-open').click();
  await a.locator('#name-input').fill('검수 정비사');
  await a.locator('#form-submit').click();
  await phase(a, 'lobby');
  assert.equal(await a.locator('#start-story').isDisabled(), true);
  const code = (await a.locator('#room-code').textContent()).trim();
  await b.goto(base + '/pulse/?room=' + code, {waitUntil:'domcontentloaded'});
  await b.locator('#name-input').fill('검수 기록원');
  await b.locator('#form-submit').click();
  await phase(b, 'lobby');
  await a.locator('#start-story').waitFor({state:'visible'});
  await a.locator('#start-story').click();
  await Promise.all([phase(a,'explore'),phase(b,'explore')]);
  check('two contexts create join and host start');
  const first = await ownClues(a, /멈춘 전차/);
  const second = await ownClues(b, /작은 방송국/);
  const aBody = await a.locator('body').innerText(), bBody = await b.locator('body').innerText();
  for (const text of first) assert(!bBody.includes(text));
  for (const text of second) assert(!aBody.includes(text));
  check('private evidence isolated before explicit share');
  await audit(a, 'explore-desktop');
  await share(a); await countShared(b, 2);
  await share(b); await Promise.all([phase(a,'vote'),phase(b,'vote'),countShared(a,4),countShared(b,4)]);
  check('four explicit shares unlock decision in both contexts');
  await a.locator('#open-vote').click(); await b.locator('#open-vote').click();
  await a.locator('[data-choice="lighthouse"]').click();
  await b.locator('[data-choice="homes"]').click();
  await a.getByText('아직 서로 다른 곳을 보고 있습니다.', {exact:false}).waitFor();
  assert.equal(await a.locator('#finalize').isDisabled(), true);
  check('disagreement blocks finalization and explains why');
  await audit(a, 'vote-desktop');
  await b.reload({waitUntil:'domcontentloaded'}); await phase(b,'vote');
  await b.locator('#open-vote').click();
  assert.equal(await b.locator('[data-choice="homes"]').getAttribute('aria-pressed'), 'true');
  assert((await b.locator('#current-role').textContent()).includes('방송 기록원'));
  check('reload reconnect keeps role evidence and vote');
  await b.locator('[data-choice="lighthouse"]').click();
  await a.locator('#finalize').click();
  await Promise.all([phase(a,'ended'),phase(b,'ended')]);
  assert((await a.locator('#ending').innerText()).includes('돌아오는 빛'));
  assert((await b.locator('#ending').innerText()).includes('돌아오는 빛'));
  check('revote consensus reaches same authored ending');
  await audit(a, 'ending-desktop');
  await a.screenshot({path:path.join(output,'ending-desktop.png')});
  await a.getByRole('button', {name:'같은 동료와 다른 밤을 시작',exact:true}).click();
  await Promise.all([phase(a,'lobby'),phase(b,'lobby')]);
  check('host reset returns all peers to lobby');
  await c1.close(); await c2.close();
  for (const width of [390,320]) {
    const c = await browser.newContext({viewport:{width,height:844}, reducedMotion:'reduce'}), p = await c.newPage();
    await p.goto(base+'/pulse/',{waitUntil:'domcontentloaded'}); await p.locator('#loading').waitFor({state:'hidden',timeout:60000});
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) failures.push({name:'mobile horizontal overflow',width});
    await p.locator('#dual-start').click(); await phase(p,'explore');
    const clues1 = await ownClues(p, /멈춘 전차/); await share(p);
    await p.locator('#role-switch').getByRole('button', {name:/방송 기록원/}).click();
    await p.waitForFunction(() => document.querySelector('#current-role').textContent === '방송 기록원' && document.querySelectorAll('#object-nav button').length === 4);
    await ownClues(p, /작은 방송국/); await share(p); await phase(p,'vote'); await countShared(p,4);
    await p.locator('#open-vote').click(); await p.locator('[data-choice="station"]').click();
    await p.locator('#role-switch').getByRole('button', {name:/전차 정비사/}).click();
    await p.waitForFunction(() => document.querySelector('#current-role').textContent === '전차 정비사' && document.querySelectorAll('#choices button').length === 3);
    await p.locator('[data-choice="station"]').click(); await p.locator('#finalize').click(); await phase(p,'ended');
    const endingScroll = await p.locator('#panel-body').evaluate(el=>el.scrollTop);
    if (endingScroll > 2) failures.push({name:'ending retains previous panel scroll position',width,scrollTop:endingScroll});
    check('one device two role flow and ending at ' + width, {horizontalOverflow:overflow});
    await audit(p, 'ending-mobile-'+width);
    await p.screenshot({path:path.join(output,'ending-mobile-'+width+'.png'),fullPage:true});
    await c.close();
  }
  check('browser runtime errors', {count:errors.length});
})().catch(e => {failures.push({name:'test interrupted',message:e.message,stack:e.stack});console.error(e.message);process.exitCode=1;}).finally(async()=>{
  if(browser) await browser.close();
  if(app) app.close();
  const sourcesAfter = sources.map(source=>({...source,changed:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source.file))).digest('hex') !== source.sha256}));
  fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({checkedAt:new Date().toISOString(),sources:sourcesAfter,records,failures,errors},null,2));
});
