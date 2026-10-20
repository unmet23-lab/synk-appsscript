// Real headless Chrome check of the company service worker's push handling, with no push provider or subscription.
// CDP ServiceWorker.deliverPushMessage hands the worker plain data (encryption is the browser's job and is covered by
// the RFC 8291 test in tests/web-push.test.mjs); the page then reads the notifications the worker actually showed.
// Usage: node tools/company-messenger/qa/notification-sw-push.mjs [worker file]   (MESSENGER_PLAYWRIGHT overrides Playwright)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MESSENGER_PLAYWRIGHT || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const worker = process.argv[2] || fileURLToPath(new URL('../../../docs/마케팅/온라인마케팅지도/engagement/company/public/notification-sw.js', import.meta.url));
const server = createServer((req, res) => {
  if (req.url === '/notification-sw.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(readFileSync(worker)); return; }
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><meta charset="utf-8"><title>worker</title><script>navigator.serviceWorker.register("/notification-sw.js",{scope:"/",updateViaCache:"none"});</script>'); return; }
  res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
// localhost is a secure context, so the worker and notifications work without TLS.
const origin = `http://localhost:${server.address().port}`, steps = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.grantPermissions(['notifications'], { origin });
  const page = await context.newPage(), cdp = await context.newCDPSession(page), registrations = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', event => registrations.push(...event.registrations));
  await cdp.send('ServiceWorker.enable');
  await page.goto(origin + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const current = () => registrations.find(row => row.scopeURL === origin + '/' && !row.isDeleted);
  for (let i = 0; i < 100 && !current(); i++) await new Promise(resolve => setTimeout(resolve, 50));
  const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ tag: n.tag, renotify: n.renotify, vibrate: [...n.vibrate], title: n.title, body: n.body, data: n.data })));
  const deliver = async (label, data) => {
    const before = JSON.stringify(await shown());
    await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId: current().registrationId, data });
    let list = [];
    for (let i = 0; i < 100; i++) { list = await shown(); if (JSON.stringify(list) !== before || i > 20) break; await new Promise(resolve => setTimeout(resolve, 50)); }
    steps.push({ label, notifications: list });
  };
  await deliver('empty push', '');
  await deliver('call marker while a work notice is shown', '{"kind":"call"}');
  await deliver('call marker with extra fields', '{"kind":"call","body":"PRIVATE CALLER","title":"고객 이름"}');
  await deliver('not JSON', 'not json at all');
} finally { await browser.close(); server.close(); }
const fixed = { title: 'SYNK', body: '확인할 새 업무가 있어요' };
const work = { tag: 'synk-work-notifications', renotify: false, vibrate: [], ...fixed, data: { kind: 'synk-work-notifications' } };
const call = { tag: 'synk-call-invitations', renotify: true, vibrate: [300, 150, 300, 150, 300], ...fixed, data: { kind: 'synk-call-invitations' } };
const byTag = list => [...list].sort((a, b) => a.tag.localeCompare(b.tag));
console.log(JSON.stringify(steps, null, 2));
assert.deepEqual(steps[0].notifications, [work]);
for (const step of steps.slice(1)) assert.deepEqual(byTag(step.notifications), [call, work], step.label);
assert.doesNotMatch(JSON.stringify(steps), /PRIVATE|고객/);
console.log('ok: empty push -> work notice; call marker -> its own renotify notice beside it; text stays fixed');
