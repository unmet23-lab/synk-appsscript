// 레이싱을 캐시 없이 처음 열 때 시작 단추(#watch)가 풀릴 때까지 무엇을 하는지 잰다.
// 받는 파일(크기·끝난 시각), 50ms 넘는 긴 작업, 함수별 CPU 시간(샘플링). Usage: node racing-profile.cjs <base> [desktop|phone]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base, deviceName = 'desktop'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  const context = await browser.newContext(deviceName === 'phone'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  const requests = [];
  page.on('requestfinished', async r => {
    const t = r.timing(); let size = 0;
    try { size = (await r.sizes()).responseBodySize; } catch {}
    requests.push({ url: r.url().replace(base, ''), end: t.startTime + t.responseEnd, start: t.startTime, size });
  });
  const t0 = Date.now();
  await page.goto(base + '/try/racing/', { waitUntil: 'load', timeout: 90000 });
  const loadMs = Date.now() - t0;
  await page.waitForSelector('#watch:not([disabled])', { timeout: 120000 });
  const readyAt = Date.now(), readyMs = readyAt - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const long = await page.evaluate(() => window.__long);
  console.log(`== ${deviceName}: load ${(loadMs / 1000).toFixed(1)}초, 시작 단추 ${(readyMs / 1000).toFixed(1)}초`);
  const before = requests.filter(r => r.end <= readyAt);
  const mb = n => (n / 1e6).toFixed(2) + 'MB';
  console.log(`받은 파일(단추 전) ${before.length}개 ${mb(before.reduce((s, r) => s + r.size, 0))}, 마지막 파일 끝 ${((Math.max(...before.map(r => r.end)) - t0) / 1000).toFixed(1)}초`);
  for (const r of [...before].sort((a, b) => b.size - a.size).slice(0, 10)) console.log(`  ${mb(r.size).padStart(7)}  끝 ${((r.end - t0) / 1000).toFixed(1).padStart(5)}초  ${r.url.slice(0, 80)}`);
  const kinds = {};
  for (const r of before) { const k = (r.url.match(/\.(\w+)(\?|$)/) || [, '기타'])[1]; kinds[k] = (kinds[k] || 0) + r.size; }
  console.log('  종류별:', Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${mb(v)}`).join(', '));
  const longSum = long.reduce((s, [, d]) => s + d, 0);
  console.log(`긴 작업 ${long.length}개 합계 ${(longSum / 1000).toFixed(1)}초, 큰 것: ${[...long].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, d]) => `${(s / 1000).toFixed(1)}초부터 ${d}ms`).join(', ')}`);
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  profile.samples.forEach((id, i) => {
    const cf = nodes.get(id).callFrame;
    const key = `${cf.functionName || '(익명)'} ${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`CPU 샘플 ${(total / 1000).toFixed(1)}초 중 함수별 자기 시간 상위:`);
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${(v / 1000).toFixed(2).padStart(6)}초  ${k.slice(0, 90)}`);
  await browser.close();
})();
