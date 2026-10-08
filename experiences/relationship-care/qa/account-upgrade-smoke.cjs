'use strict';
// Isolated synthetic data. This checks product workflows; account transport is tested separately.
// No account credentials, paid AI, messages, purchases or real people's data are used.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CARE_TEST_BASE || 'http://127.0.0.1:4296';
const out = path.join(__dirname, 'account-upgrade-20261006');
const report = { at: new Date().toISOString(), scope: 'Synthetic product UI; account transport is verified by separate tests.', checks: [], errors: [], missing: [], screenshots: [] };
const check = (name, condition, detail) => { report.checks.push({ name, passed: !!condition, detail }); assert.ok(condition, `${name}: ${JSON.stringify(detail)}`); };
async function downloadText(download) { const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8'); }
async function backup(page) { await page.locator('#show-home').click(); const pending = page.waitForEvent('download'); await page.locator('#export-data').click(); return JSON.parse(await downloadText(await pending)); }
async function capture(page, name) {
  await page.evaluate(() => { document.getElementById('toast').hidden = true; window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(name);
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, font: document.fonts.check('14px SUIT'), images: [...document.images].filter(i => i.offsetWidth && (!i.complete || !i.naturalWidth)).map(i => i.src), clipped: [...document.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(el => { const r = el.getBoundingClientRect(); return el.offsetWidth && (r.right > innerWidth + 1 || r.left < -1); }).map(el => el.id || el.dataset.captureField) }));
  check(`${name}: no overflow, clipped fields or missing images`, metrics.width <= metrics.viewport + 1 && metrics.font && !metrics.images.length && !metrics.clipped.length, metrics);
}
async function person(page, name, group) {
  await page.locator('#add-person').click(); await page.locator('#new-person-name').fill(name); await page.locator('#new-person-group').selectOption(group);
  await page.locator('#person-form button[type=submit]').click();
}
async function log(page, values) {
  await page.locator('#tab-history').click();
  await page.locator('#care-log-event').selectOption(values.eventId || ''); await page.locator('#care-log-kind').selectOption(values.kind);
  await page.locator('#care-log-date').fill(values.date); await page.locator('#care-log-direction').selectOption(values.direction || 'sent');
  await page.locator('#care-log-amount').fill(values.amount == null ? '' : String(values.amount)); await page.locator('#care-log-note').fill(values.note || '');
  await page.locator('#care-log-form button[type=submit]').click();
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
    const page = await context.newPage(); await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/api/account')) report.missing.push({ status: response.status(), url: response.url() }); });
    await page.goto(base); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true'); await page.evaluate(() => document.fonts.ready);
    check('account storage status is visible without asking for external AI consent', await page.locator('#account-panel').isVisible() && await page.locator('#account-status').innerText() !== '');
    await person(page, '가상 지민', 'friend');
    await page.locator('#show-home').click();
    await page.locator('#capture-person').selectOption({ label: '가상 지민' });
    const source = '결혼식은 2026-10-10 오후 2시 30분이야.\n장소: 서울 웨딩홀 3층\n답장은 천천히 해도 괜찮아.\n커피보다 차를 좋아해요.';
    await page.locator('#capture-title').fill('예시 청첩장과 취향'); await page.locator('#capture-source').fill(source); await page.locator('#capture-extract').click();
    check('capture offers one dated event and source-backed preferences', await page.locator('[data-capture-event]').count() === 1 && await page.locator('[data-capture-memory]').count() === 2);
    check('capture leaves every extracted item unselected until review', await page.locator('[data-capture-selected]:checked').count() === 0);
    const candidate = page.locator('[data-capture-event]').first();
    check('wedding time and location are read from the source', await candidate.locator('[data-capture-field=time]').inputValue() === '14:30' && await candidate.locator('[data-capture-field=location]').inputValue() === '서울 웨딩홀 3층');
    await candidate.locator('[data-capture-field=title]').fill('지민 결혼식 · 확인한 일정'); await candidate.locator('[data-capture-selected]').check();
    await page.locator('[data-capture-memory]').first().locator('[data-capture-memory-text]').fill('답장은 천천히 해도 괜찮다는 이야기');
    for (const checkbox of await page.locator('[data-capture-memory] [data-capture-selected]').all()) await checkbox.check();
    await page.setViewportSize({ width: 375, height: 900 }); await capture(page, 'capture-review-375');
    await page.locator('#capture-save').click();
    check('reviewed event appears in the person notebook', (await page.locator('#event-list').innerText()).includes('지민 결혼식 · 확인한 일정'));
    await page.locator('#tab-history').click();
    const history = await page.locator('#person-history').innerText();
    check('confirmed memory is visible in the notebook', history.includes('답장은 천천히 해도 괜찮다는 이야기') && history.includes('커피보다 차'));
    const sourceDetails = page.locator('#person-history details').filter({ hasText: '예시 청첩장과 취향' }).first();
    if (await sourceDetails.count()) {
      if (!(await sourceDetails.getAttribute('open'))) await sourceDetails.locator('summary').click();
      check('saved original can be opened and read', (await sourceDetails.innerText()).includes('서울 웨딩홀 3층') && (await sourceDetails.innerText()).includes('2026-10-10'));
    } else {
      check('saved original can be read in the person notebook', history.includes('예시 청첩장과 취향') && history.includes('2026-10-10'));
    }
    await capture(page, 'saved-memory-source-375');
    await page.locator('#tab-events').click(); await page.locator('[data-edit-event]').first().click();
    await page.locator('.care-plan-details summary').click(); await page.locator('#event-care-action').selectOption('gift');
    await page.locator('#event-care-amount').fill('70000'); await page.locator('#event-care-note').fill('좋아하는 차를 준비하기'); await page.locator('#event-form button[type=submit]').click();
    await log(page, { kind: 'contact', date: '2026-10-05', note: '어제 안부 전화를 나눔' });
    await log(page, { kind: 'gift', date: '2026-10-05', direction: 'received', amount: 30000, note: '지난번 받은 차 선물' });
    await page.locator('#tab-message').click(); await page.locator('#generate-draft').click();
    const brief = await page.locator('#care-brief').innerText();
    check('preparation brief brings together confirmed memories, contact and separate budget and actual gifts', brief.includes('70,000') && brief.includes('30,000') && brief.includes('받은') && brief.includes('어제 안부') && brief.includes('커피보다 차'), brief);
    await capture(page, 'preparation-brief-375');
    const current = await backup(page);
    check('backup keeps group, selected source and actual records apart from the plan', current.people[0].group === 'friend' && current.sources[0].text === source && current.memories.length === 2 && current.activities.length === 2 && current.events[0].carePlan.amountWon === 70000 && current.activities.some(item => item.amountWon === 30000));
    await person(page, '가상 서연', 'family'); await page.locator('#show-home').click();
    await page.locator('#people-group-filter').selectOption('friend');
    check('family and friend filters use saved classifications', await page.locator('#people-list [data-person]').count() === 1 && (await page.locator('#people-list').innerText()).includes('가상 지민'));
    await page.locator('#people-group-filter').selectOption('all'); await page.locator('#people-search').fill('커피보다');
    check('search finds confirmed memory associated with a person', await page.locator('#people-list [data-person]').count() === 1 && (await page.locator('#people-list').innerText()).includes('가상 지민'));
    await page.locator('#people-search').fill('없는이름'); check('empty search gives feedback', await page.locator('#people-list [data-person]').count() === 0 && (await page.locator('#people-list').innerText()).length > 0);
    await page.locator('#people-search').fill('');
    await page.locator('#schedule-view').selectOption('calendar'); await page.locator('[data-calendar-date="2026-10-10"]').click();
    check('month calendar opens the selected day event', (await page.locator('#calendar-day-events').innerText()).includes('지민 결혼식 · 확인한 일정'));
    await capture(page, 'calendar-375');
    await page.locator('#calendar-next').click(); check('calendar month navigation changes year-month', (await page.locator('#calendar-label').innerText()).includes('11월'));
    await page.locator('#calendar-today').click();
    await page.locator('#people-list [data-person]').filter({ hasText: '가상 지민' }).click();
    await page.locator('#event-type').selectOption('wedding'); await page.locator('#event-date').fill('2026-10-01'); await page.locator('#event-title').fill('지난 결혼식 · 미처리 시험'); await page.locator('#event-form button[type=submit]').click();
    await page.locator('#show-home').click(); await page.locator('#schedule-view').selectOption('overdue');
    const overdue = page.locator('#overdue-list .home-card').filter({ hasText: '지난 결혼식 · 미처리 시험' });
    check('past one-time event remains discoverable until recorded', await overdue.count() === 1);
    await overdue.locator('[data-log-event]').click();
    check('past care action is prefilled with the actual occurrence', await page.locator('#care-log-date').inputValue() === '2026-10-01');
    await page.locator('#care-log-kind').selectOption('attend'); await page.locator('#care-log-note').fill('그날 참석했던 기록을 뒤늦게 남김'); await page.locator('#care-log-form button[type=submit]').click();
    await page.locator('#show-home').click(); await page.locator('#schedule-view').selectOption('overdue');
    check('recording the past occurrence clears that outstanding date', await page.locator('#overdue-list .home-card').filter({ hasText: '지난 결혼식 · 미처리 시험' }).count() === 0);
    const all = await backup(page);
    await page.locator('#delete-data').click(); await page.locator('#confirm-dialog [value=confirm]').click();
    await page.waitForFunction(() => document.getElementById('person-count').textContent === '0');
    await page.locator('#import-data').setInputFiles({ name: 'synthetic-care-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(all)) }); await page.locator('#confirm-dialog [value=confirm]').click();
    await page.waitForFunction(() => document.getElementById('person-count').textContent === '2');
    const restored = await backup(page);
    check('backup restore preserves groups, source-backed memories, plan and actual ledger', restored.people.some(item => item.group === 'family') && restored.people.some(item => item.group === 'friend') && restored.sources[0].text === source && restored.memories.length === 2 && restored.activities.length === 3 && restored.events.some(item => item.carePlan.amountWon === 70000));
    await page.locator('#schedule-view').selectOption('calendar'); await page.locator('[data-calendar-date="2026-10-10"]').click();
    await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'calendar-desktop');
    await page.locator('#schedule-view').selectOption('upcoming'); await capture(page, 'home-desktop');
    await page.locator('#people-list [data-person]').filter({ hasText: '가상 지민' }).click(); await page.locator('#tab-message').click(); await page.locator('#generate-draft').click(); await capture(page, 'preparation-desktop');
    check('no uncaught browser errors or missing application resources', report.errors.length === 0 && report.missing.length === 0, { errors: report.errors, missing: report.missing });
    await context.close();
  } finally {
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2)); await browser.close();
    console.log(JSON.stringify({ passed: report.checks.filter(item => item.passed).length, total: report.checks.length, output: out, errors: report.errors, missing: report.missing }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
