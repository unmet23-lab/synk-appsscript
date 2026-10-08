'use strict';
// Isolated Chrome, synthetic people and native-account responses only. The card
// renderer is real; only font readiness is held to make its race deterministic.
// This does not use the user's browser, production login, or any paid service.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { requestSpec } = require('../../../desktop/src/account-requests.cjs');
const base = process.env.CARE_QA_ORIGIN || 'http://127.0.0.1:4296';
const out = path.join(__dirname, 'engine-races-20261006');
const report = { synthetic: true, at: new Date().toISOString(), origin: base, checks: [], errors: [] };
function check(name, value, detail) { report.checks.push({ name, passed: !!value, ...(detail ? { detail } : {}) }); assert.ok(value, name); }
const ready = page => page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
const synced = page => page.waitForFunction(() => document.getElementById('account-status').textContent.includes('계정에 저장했어요'));

(async () => {
  const model = await import('../model.mjs');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const observe = page => page.on('pageerror', error => report.errors.push(error.message));
  try {
    const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
    const page = await guestContext.newPage(); observe(page);
    await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
    await page.goto(base); await ready(page); await page.locator('#sample-button').click();
    await page.locator('[data-person]').first().click(); await page.locator('#tab-history').click();
    await page.locator('#care-log-note').fill('합성 QA: 첫 사람과 함께한 기억');
    await page.locator('#care-log-form button[type=submit]').click();
    await page.locator('#memory-card-builder summary').click(); await page.locator('[data-card-selected]').first().check();
    await page.evaluate(() => {
      const originalLoad = document.fonts.load.bind(document.fonts);
      window.__holdCardFonts = true; window.__cardCompletions = 0;
      const waiting = new Promise(resolve => { window.__releaseCardFonts = () => { window.__holdCardFonts = false; resolve(); }; });
      document.fonts.load = async (...args) => { if (window.__holdCardFonts) await waiting; return originalLoad(...args); };
      const originalBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        return originalBlob.call(this, blob => { window.__cardCompletions++; callback(blob); }, ...args);
      };
    });
    await page.locator('#preview-memory-card').click();
    await page.waitForFunction(() => document.getElementById('preview-memory-card').disabled);
    await page.locator('[data-person]').nth(1).click();
    await page.evaluate(() => window.__releaseCardFonts());
    await page.waitForFunction(() => window.__cardCompletions >= 1);
    check('A card finishing after person B is selected never opens A preview', !await page.locator('#memory-card-dialog').isVisible());
    check('switching people during card generation releases the preview button', !await page.locator('#preview-memory-card').isDisabled());
    await page.locator('#tab-history').click(); await page.locator('#care-log-note').fill('합성 QA: 두 번째 사람과 함께한 기억');
    await page.locator('#care-log-form button[type=submit]').click();
    await page.locator('#memory-card-builder summary').click(); await page.locator('[data-card-selected]').first().check();
    await page.locator('#preview-memory-card').click(); await page.locator('#memory-card-dialog').waitFor({ state: 'visible' });
    check('person B can create a fresh real PNG after stale person A finishes', await page.evaluate(() => window.__cardCompletions === 2 && document.getElementById('memory-card-preview').src.startsWith('blob:')));
    await guestContext.close();

    let state = { ...model.emptyState(), people: [model.makePerson({ id: 'synthetic1', name: '합성 인물' })] }, revision = 1;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
    await context.exposeBinding('__careRaceRequest', async (_source, action, body) => {
      const spec = requestSpec(action, body || {}, 'synthetic', 'platform'); assert.equal(spec.path, 'synk-care');
      if (action !== 'careLoad') {
        if (spec.body.expected_revision !== revision) return { ok: false, error: { code: 'REVISION_CONFLICT', status: 409 }, revision };
        state = action === 'careDelete' ? null : model.importBackup(spec.body.state); revision++;
      }
      return { ok: true, scope: 'synk-care', accountId: 'synthetic-race-account', revision, updatedAt: null, state };
    });
    await context.addInitScript(() => {
      const status = () => ({ configured: true, signedIn: true, status: 'signed-in', sessionGeneration: 1, account: { synk_user_id: 'synthetic-race-account', display_name: '합성 QA 계정' }, error: null });
      window.synkProduct = Object.freeze({ getEnvironment: async () => ({ clientId: 'care', synthetic: true }), authStatus: async () => status(), onAuthChanged: () => () => {}, accountRequest: (action, body) => window.__careRaceRequest(action, body) });
    });
    const accountPage = await context.newPage(); observe(accountPage);
    await accountPage.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
    await accountPage.goto(base); await ready(accountPage); await synced(accountPage);
    await accountPage.locator('[data-person]').first().click(); await accountPage.locator('#tab-history').click();
    await accountPage.locator('.followup-add summary').click(); await accountPage.locator('#followup-title').fill('아직 저장하지 않은 다음 안부');
    state = { ...state, people: [...state.people, model.makePerson({ id: 'synthetic2', name: '다른 기기의 합성 인물' })] }; revision++;
    await accountPage.locator('#account-refresh').click();
    check('account refresh requests confirmation before replacing an unsaved follow-up', await accountPage.locator('#confirm-dialog').isVisible());
    check('follow-up remains intact while refresh confirmation is pending', await accountPage.locator('#followup-title').inputValue() === '아직 저장하지 않은 다음 안부');
    await accountPage.locator('#confirm-dialog [value=cancel]').click();
    check('cancelling refresh preserves the unsaved follow-up and existing notebook', await accountPage.locator('#followup-title').inputValue() === '아직 저장하지 않은 다음 안부' && await accountPage.locator('[data-person]').count() === 1);
    await accountPage.locator('#account-refresh').click(); await accountPage.locator('#confirm-dialog [value=confirm]').click();
    await accountPage.waitForFunction(() => document.querySelectorAll('[data-person]').length === 2); await synced(accountPage);
    check('confirmed refresh replaces the notebook and clears the old form', await accountPage.locator('#followup-title').inputValue() === '');
    await accountPage.locator('[data-person]').first().click(); await accountPage.locator('#tab-history').click();
    await accountPage.locator('#memory-card-builder summary').click(); await accountPage.locator('#memory-card-title').fill('아직 저장하지 않은 카드 제목');
    state = { ...state, people: state.people.map(person => ({ ...person, notes: '합성 원격 변경' })) }; revision++;
    await accountPage.locator('#account-refresh').click();
    check('account refresh also guards an unsaved memory card title', await accountPage.locator('#confirm-dialog').isVisible() && await accountPage.locator('#memory-card-title').inputValue() === '아직 저장하지 않은 카드 제목');
    await accountPage.locator('#confirm-dialog [value=cancel]').click();
    check('no browser runtime errors in these synthetic races', report.errors.length === 0, report.errors);
    await context.close();
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close(); report.passed = report.checks.filter(item => item.passed).length; report.total = report.checks.length;
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ synthetic: true, passed: report.passed, total: report.total, failure: report.failure || null, result: path.join(out, 'result.json') }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
