// 레이싱을 캐시 없이 처음 열 때 시작 단추(#watch)가 풀릴 때까지 잰다.
// Usage: node qa/first-run-profile.cjs <origin-or-page-url> [desktop|phone] [output.json]
// A bare origin retains /try/racing/; include the trailing slash to profile a local root.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { writeFile } = require('node:fs/promises');
const [input, deviceName = 'desktop', outputPath] = process.argv.slice(2);
if (!input || !['desktop', 'phone'].includes(deviceName)) {
  console.error('Usage: node qa/first-run-profile.cjs <origin-or-page-url> [desktop|phone] [output.json]');
  process.exitCode = 1;
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const target = new URL(input);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('The page URL must use HTTP or HTTPS.');
  if (input === target.origin) target.pathname = '/try/racing/';
  const pageUrl = target.href;
  const report = { version: 2, capturedAt: new Date().toISOString(), pageUrl, device: deviceName, cache: 'new browser/context', gpu: 'Chrome headless, --enable-gpu --use-angle=d3d11', pageErrors: [], consoleErrors: [], failedRequests: [], scriptResponses: [] };
  let browser, cdp, profiling = false, failure;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
    const context = await browser.newContext(deviceName === 'phone'
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__long = [];
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__long.push({ startMs: Math.round(e.startTime), durationMs: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
    });
    cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await cdp.send('Profiler.start');
    profiling = true;
    const requests = [], requestReads = [];
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText || 'unknown' }));
    page.on('response', response => {
      if (response.request().resourceType() === 'script') report.scriptResponses.push({ url: response.url(), status: response.status() });
    });
    page.on('requestfinished', request => {
      requestReads.push((async () => {
        const timing = request.timing(); let size = 0;
        try { size = (await request.sizes()).responseBodySize; } catch {}
        requests.push({ url: request.url(), end: timing.startTime + timing.responseEnd, start: timing.startTime, size });
      })());
    });
    const t0 = Date.now();
    const response = await page.goto(pageUrl, { waitUntil: 'load', timeout: 90000 });
    report.loadMs = Date.now() - t0;
    report.navigation = { url: response?.url(), status: response?.status(), ok: response?.ok() };
    await page.waitForSelector('#watch:not([disabled])', { timeout: 120000 });
    const readyAt = Date.now();
    report.readyMs = readyAt - t0;
    const { profile } = await cdp.send('Profiler.stop');
    profiling = false;
    const state = await page.evaluate(() => ({ longTasks: window.__long, snapshot: window.__racing?.snapshot?.(), racingError: window.__racingError || null }));
    report.longTasks = state.longTasks;
    report.snapshot = state.snapshot;
    report.racingError = state.racingError;
    await Promise.all(requestReads);
    const before = requests.filter(request => request.end <= readyAt);
    report.requestsBeforeReady = before.map(request => ({ url: request.url, startMs: request.start - t0, endMs: request.end - t0, bytes: request.size }));
    report.network = { count: before.length, bytes: before.reduce((sum, request) => sum + request.size, 0), lastEndMs: before.length ? Math.max(...before.map(request => request.end)) - t0 : null };
    report.longTaskSummary = { count: state.longTasks.length, totalMs: state.longTasks.reduce((sum, entry) => sum + entry.durationMs, 0), maxMs: Math.max(0, ...state.longTasks.map(entry => entry.durationMs)) };
    const nodes = new Map(profile.nodes.map(node => [node.id, node])), self = new Map();
    (profile.samples || []).forEach((id, index) => {
      const frame = nodes.get(id).callFrame;
      const key = JSON.stringify([frame.functionName || '(익명)', frame.url, frame.lineNumber + 1]);
      self.set(key, (self.get(key) || 0) + (profile.timeDeltas[index] || 0) / 1000);
    });
    report.cpuSelf = [...self.entries()].sort((a, b) => b[1] - a[1]).map(([key, selfMs]) => {
      const [functionName, url, line] = JSON.parse(key);
      return { functionName, url, line, selfMs: +selfMs.toFixed(3) };
    });
    report.cpuSampleMs = +report.cpuSelf.reduce((sum, entry) => sum + entry.selfMs, 0).toFixed(3);
    report.jsNetworkFailures = [...report.failedRequests.filter(request => request.resourceType === 'script' || /\.(?:m?js)(?:\?|$)/.test(request.url)), ...report.scriptResponses.filter(response => response.status >= 400)];
    report.ok = Boolean(report.navigation.ok && report.snapshot?.ready && !report.racingError && !report.pageErrors.length && !report.jsNetworkFailures.length);
    printReport(report);
  } catch (error) {
    failure = error;
    report.ok = false;
    report.failure = String(error);
  } finally {
    if (profiling) await cdp?.send('Profiler.stop').catch(() => {});
    await browser?.close();
    if (outputPath) await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
  if (!report.ok) throw new Error('The page did not pass first-run readiness/error checks. See the JSON report.');
}

function printReport(report) {
  const mb = n => (n / 1e6).toFixed(2) + 'MB';
  console.log(`== ${report.device}: load ${(report.loadMs / 1000).toFixed(1)}초, 시작 단추 ${(report.readyMs / 1000).toFixed(1)}초`);
  console.log(`받은 파일(단추 전) ${report.network.count}개 ${mb(report.network.bytes)}, 마지막 파일 끝 ${(report.network.lastEndMs / 1000).toFixed(1)}초`);
  for (const request of [...report.requestsBeforeReady].sort((a, b) => b.bytes - a.bytes).slice(0, 10)) console.log(`  ${mb(request.bytes).padStart(7)}  끝 ${(request.endMs / 1000).toFixed(1).padStart(5)}초  ${request.url.slice(0, 100)}`);
  const long = report.longTaskSummary;
  console.log(`긴 작업 ${long.count}개 합계 ${(long.totalMs / 1000).toFixed(1)}초, 최대 ${long.maxMs}ms`);
  console.log(`CPU 샘플 ${(report.cpuSampleMs / 1000).toFixed(1)}초 중 함수별 자기 시간 상위:`);
  for (const row of report.cpuSelf.slice(0, 18)) console.log(`  ${(row.selfMs / 1000).toFixed(2).padStart(6)}초  ${row.functionName} ${row.url.split('/').pop()}:${row.line}`);
  console.log(`시작 단계: ${JSON.stringify(report.snapshot?.startup)}`);
  console.log(`상태 ${report.navigation.status}, pageerror ${report.pageErrors.length}, JS 요청 실패 ${report.jsNetworkFailures.length}`);
}
