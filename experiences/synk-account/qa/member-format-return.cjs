'use strict';

const { accountFor, declarationsFor, formats } = require('../../../desktop/tools/member-format-fixture.cjs');

async function verifyFormatReturn({ browser, fixture, url, check }) {
  const asOf = new Date(Date.now() - 300000).toISOString();
  const declarations = declarationsFor(asOf);
  const visits = [
    { name: 'four formats', formats: formats.slice(0, 4), days: 4 },
    { name: 'add speaking', formats, days: 5 },
    { name: 'new tab', formats, days: 5, reopen: true },
    { name: 'speak on three days', formats: ['spoken', 'spoken', 'spoken'], days: 3, spoken: true },
    { name: 'opt out', formats, off: true },
  ];
  const topic = '[data-insight-facet-row="learning-topic:sit-travel-order"]';
  const response = '[data-insight-facet-row="practice-response"]';
  const explicit = id => '[data-insight-row="' + id + '"] .mi2-value';
  for (const width of [390, 1440]) {
    let account;
    const f = await fixture(browser, true, { width, webSummary: () => account });
    let page = f.page;
    f.state.understanding.replace('A', declarations);
    try {
      for (const visit of visits) {
        account = accountFor(visit.formats, asOf, !visit.off);
        if (visit.reopen) { await page.close(); page = await f.context.newPage(); }
        const callIndex = f.state.calls.length;
        if (page.url() === 'about:blank') await page.goto(url);
        else await page.reload();
        await page.locator(explicit('topics')).filter({ hasText: 'AI 도구 활용' }).first().waitFor();
        const prefix = width + 'px ' + visit.name + ' ';
        if (visit.off) {
          check(prefix + 'hides learning observations', await page.locator(topic).count() === 0);
        } else {
          await page.locator(explicit('support')).filter({ hasText: '단계별' }).first().waitFor();
          const expected = visit.days + '일 동안 ' + visit.days + '번';
          await page.locator(topic).filter({ hasText: expected }).waitFor();
          check(prefix + 'keeps order practice', (await page.locator(topic).innerText()).includes('주문'));
        }
        if (visit.spoken) {
          await page.locator(response).filter({ hasText: '3일 동안 3번' }).waitFor();
          const text = await page.locator(response).innerText();
          check(prefix + 'asks about repeated speaking', text.includes('말로 답하기') && text.includes('이런 문제가 나에게 편한가요?'));
        } else {
          check(prefix + 'does not infer a preferred format', await page.locator(response).count() === 0);
        }
        const calls = f.state.calls.slice(callIndex);
        check(prefix + 'reads fresh Atlas evidence without a write',
          calls.some(call => call.query?.includes('view=atlas')) && !calls.some(call => call.method === 'POST'));
        check(prefix + 'fits the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
    } finally {
      await f.context.close();
    }
  }
}

module.exports = { verifyFormatReturn };
