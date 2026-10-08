'use strict';
// Isolated synthetic browser profiles; no personal conversations or paid calls.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:4296';
const out = __dirname;
const report = { checks: [], screens: [], errors: [], missing: [], at: new Date().toISOString() };
const check = (name, condition, detail) => { report.checks.push({ name, passed: !!condition, detail }); assert.ok(condition, name + ': ' + JSON.stringify(detail)); };
async function shot(page, name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.locator('#toast').waitFor({ state: 'hidden' }); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); report.screens.push(name); }
async function layout(page, name) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, images: [...document.images].filter(i => i.offsetWidth > 0 && (!i.complete || i.naturalWidth === 0)).map(i => i.src), font: document.fonts.check('14px SUIT'), clippedInputs: [...document.querySelectorAll('#workspace input,#workspace select,#workspace textarea')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 10 && r.height > 10 && r.right > document.getElementById('workspace').getBoundingClientRect().right - 1; }).map(el => el.id) }));
  check(name + ' has no overflow or broken images', metrics.scrollWidth <= metrics.width + 1 && metrics.images.length === 0 && metrics.clippedInputs.length === 0, metrics);
}
async function downloadText(download) { const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8'); }

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', res => { if (res.status() >= 400) report.missing.push({ status: res.status(), url: res.url() }); });
    await page.goto(base); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true'); await page.evaluate(() => document.fonts.ready);
    check('empty by default', await page.locator('#home-empty').isVisible());
    await layout(page, 'desktop empty'); await shot(page, 'desktop-empty');
    await page.locator('#home-empty-add').click();
    await page.locator('#new-person-name').fill('지민');
    await page.locator('#new-person-relationship').fill('친구');
    await page.locator('#person-form button[type=submit]').click();
    await page.locator('#tab-conversation').click();
    await page.locator('#conversation-text').fill('나: 생일 축하해! 오늘 좋은 하루 보내 ㅋㅋ\n상대: 감사합니다. 다음 주에 뵙겠습니다.');
    await page.locator('#split-conversation').click();
    check('speaker separation does not mix recipient words', !(await page.locator('#self-text').inputValue()).includes('감사합니다') && (await page.locator('#other-text').inputValue()).includes('감사합니다'));
    await page.locator('#speaker-confirm').check(); await page.locator('#analyze-tone').click();
    check('tone observation displayed', await page.locator('#tone-result').isVisible());
    await page.locator('#preference-formality').selectOption('casual');
    await page.locator('#preference-emoji').check();
    await page.locator('#preference-confirm').check();
    await page.locator('#preference-form button[type=submit]').click();
    const nextDate = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000)));
    await page.locator('#event-date').fill(nextDate); await page.locator('#event-title').fill('지민 생일');
    await page.locator('#event-form button[type=submit]').click();
    await page.locator('#tab-events').click();
    check('saved birthday shown', (await page.locator('#event-list').innerText()).includes('지민 생일'));
    const calendarPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /다음 일정 달력 저장/ }).first().click();
    const calendar = await calendarPromise; const ics = await downloadText(calendar);
    check('calendar export has actual future occurrence and alarms', calendar.suggestedFilename() === 'synk-care.ics' && ics.includes(nextDate.replaceAll('-', '')) && ics.includes('BEGIN:VALARM'));
    await page.locator('#tab-message').click(); await page.locator('#generate-draft').click();
    check('confirmed casual emoji preference applied', /축하해.*🎂/u.test(await page.locator('#draft-text').inputValue()));
    const custom = '지민아, 생일 축하해! 오늘 네가 좋아하는 것들로 가득하길 🎂';
    await page.locator('#draft-text').fill(custom); await page.locator('#review-message').click();
    check('edited draft reviewed before copy', (await page.locator('#message-review').innerText()).length > 0);
    await page.locator('#draft-confirm').check(); await page.locator('#copy-draft').click();
    check('edited draft copied', await page.evaluate(() => navigator.clipboard.readText()) === custom);
    await page.locator('#persist-toggle').check();
    await shot(page, 'desktop-message');
    await page.locator('#complete-event').click();
    check('completion recorded', Number(await page.locator('#complete-count').innerText()) === 1);
    await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    check('opt-in persists person and completion', Number(await page.locator('#person-count').innerText()) === 1 && Number(await page.locator('#complete-count').innerText()) === 1);
    const raw = await page.evaluate(() => localStorage.getItem('synk.care.local.v1'));
    check('raw dialogue is excluded from saved state', !raw.includes('다음 주에 뵙겠습니다'));
    const jsonPromise = page.waitForEvent('download'); await page.locator('#export-data').click();
    const jsonFile = await jsonPromise; const exportText = await downloadText(jsonFile);
    check('JSON contains edited message and no audio bytes', jsonFile.suggestedFilename() === 'synk-care.json' && exportText.includes(custom) && !exportText.includes('audioBase64'));
    await page.locator('#people-list [data-person]').first().click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#tab-events').click(); await layout(page, 'mobile events ' + width); await shot(page, 'mobile-events-' + width);
      await page.locator('#tab-conversation').click(); await layout(page, 'mobile conversation ' + width);
    }
    await page.locator('#show-home').click();
    await page.locator('#delete-data').click(); await page.locator('#confirm-dialog button[value=confirm]').click();
    await page.waitForFunction(() => document.getElementById('person-count').textContent === '0');
    check('delete clears data and storage', Number(await page.locator('#person-count').innerText()) === 0 && await page.evaluate(() => localStorage.getItem('synk.care.local.v1')) === null);
    await page.locator('#sample-button').click();
    check('demo clearly labelled', await page.locator('#sample-banner').isVisible());
    await shot(page, 'mobile-demo-320');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#people-list [data-person]').first().click();
    await page.locator('#tab-conversation').click();
    await page.locator('#input-audio-tab').click();
    await page.locator('#audio-file').setInputFiles(path.resolve(__dirname, '../../korean-rhythm/audio-source/raw/t0q0r.mp3'));
    await page.locator('#audio-consent').check(); await page.locator('#transcribe-button').click();
    await page.waitForFunction(() => document.getElementById('transcript-text').value.includes('도서관'), null, { timeout: 100000 });
    check('recording transcribes through actual UI', (await page.locator('#transcript-text').inputValue()).includes('내일은 바빠서 오늘'));
    await page.locator('#use-transcript').click();
    check('transcript requires speaker verification', !(await page.locator('#speaker-confirm').isChecked()) && await page.locator('#self-text').inputValue() === '');
    await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    check('without opt-in demo does not persist', Number(await page.locator('#person-count').innerText()) === 0);
    await page.locator('#sample-button').click();
    await page.locator('#people-list [data-person]').first().click();
    await page.locator('#tab-message').click(); await page.locator('#generate-draft').click(); await page.locator('#draft-confirm').check();
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => new Promise(resolve => { window.finishCopy = resolve; }) }));
    await page.locator('#copy-draft').click(); await page.waitForFunction(() => typeof window.finishCopy === 'function');
    await page.locator('#delete-data').click(); await page.locator('#confirm-dialog button[value=confirm]').click();
    await page.waitForFunction(() => document.getElementById('person-count').textContent === '0');
    check('deletion clears hidden conversation DOM', await page.locator('#conversation-text').inputValue() === '' && await page.locator('#self-text').inputValue() === '' && await page.locator('#other-text').inputValue() === '');
    await page.evaluate(() => window.finishCopy());
    const erasedPromise = page.waitForEvent('download'); await page.locator('#export-data').click();
    const erased = JSON.parse(await downloadText(await erasedPromise));
    check('late clipboard response cannot resurrect deleted data', erased.people.length === 0 && erased.drafts.length === 0);
    await context.close();

    const notifications = await browser.newContext();
    await notifications.addInitScript(() => { window.delivered = []; class StubNotification { static permission = 'granted'; static requestPermission() { return Promise.resolve('granted'); } constructor(title) { window.delivered.push(title); } } Object.defineProperty(window, 'Notification', { configurable: true, value: StubNotification }); });
    const np = await notifications.newPage(); await np.goto(base); await np.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await np.locator('#sample-button').click(); await np.locator('#persist-toggle').check();
    await np.locator('#people-list [data-person]').first().click(); await np.locator('#tab-events').click();
    const dateNow = await np.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    await np.locator('#event-date').fill(dateNow); await np.locator('#event-title').fill('오늘 시험 일정'); await np.locator('#event-form button[type=submit]').click();
    check('due reminder is delivered when permission granted', await np.evaluate(() => window.delivered.filter(title => title.includes('오늘 시험 일정')).length) === 1);
    await np.reload(); await np.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    check('persisted reminder is not redelivered on reload', await np.evaluate(() => window.delivered.length) === 0);
    await np.locator('#people-list [data-person]').first().click();
    await np.evaluate(() => Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value() { throw new DOMException('Synthetic quota limit', 'QuotaExceededError'); } }));
    await np.locator('#edit-person').click(); await np.locator('#new-person-name').fill('저장 실패 시험'); await np.locator('#person-form button[type=submit]').click();
    check('failed save keeps visible recovery guidance', (await np.locator('#storage-description').innerText()).includes('저장') && (await np.locator('#storage-description').innerText()).includes('JSON'));
    await notifications.close();
    check('no runtime errors', report.errors.length === 0, report.errors);
    check('no missing resources', report.missing.length === 0, report.missing);
  } finally {
    await fs.writeFile(path.join(out, 'ui-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ passed: report.checks.filter(c => c.passed).length, checks: report.checks.length, screens: report.screens }));
})().catch(error => { console.error(error); process.exitCode = 1; });
