'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { chromium } = require('playwright');
const { inspectCardLayouts } = require('../../tools/lib/계정지면검사.cjs');

async function inspectCollection(base) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const root = fs.realpathSync(base);
  const server = http.createServer((request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const target = fs.realpathSync(path.resolve(root, '.' + pathname));
      const relative = path.relative(root, target);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.statSync(target).isFile()) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(target).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await context.route('**/*', route => {
      const url = route.request().url();
      return url.startsWith(origin + '/') || url.startsWith('data:') ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [], results = [];
    page.on('pageerror', error => errors.push(error.message));
    const { items } = JSON.parse(fs.readFileSync(path.join(root, '콘텐츠원고.json'), 'utf8'));
    for (const item of items) {
      await page.goto(`${origin}/${encodeURIComponent(item.id)}/cards.html?export`, { waitUntil: 'load' });
      await page.evaluate(async () => {
        await Promise.all([document.fonts.load('800 48px "SUIT Variable"', '한국어'), document.fonts.load('600 48px "Inter Tight"', 'Өөрийн үг')]);
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode()));
      });
      const checks = await page.evaluate(inspectCardLayouts);
      if (checks.length !== item.cards.length) throw new Error(`Card count differs: ${item.id}`);
      results.push(...checks.map((check, index) => ({ id: item.id, index: index + 1, ...check })));
    }
    return { cards: results.length, errors, results };
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

module.exports = { inspectCollection };
