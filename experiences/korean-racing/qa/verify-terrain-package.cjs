// Verify the declared static package against source, then serve it with the
// same MIME types as server.mjs and inspect an actual fresh-browser startup.
// Usage: PLAYWRIGHT_MODULE=... node qa/verify-terrain-package.cjs <package> <report.json>
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const [packageInput, output] = process.argv.slice(2);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.wasm':'application/wasm','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
main().catch(error => {console.error(error); process.exitCode = 1;});
async function main() {
  if (!packageInput || !output) throw new Error('Provide package directory and report JSON path.');
  const root = path.resolve(packageInput), sources = path.resolve(__dirname, '../..');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'build-manifest.json'), 'utf8'));
  const report = {capturedAt:new Date().toISOString(), package:root, manifestGeneratedAt:manifest.generatedAt, byteCheck:{files:manifest.files.length, bytes:0, mismatches:[]}, pageErrors:[], consoleErrors:[], failedRequests:[], failedResponses:[], serverErrors:[], scriptResponses:[], workers:[]};
  report.manifestSha256 = createHash('sha256').update(await fs.readFile(path.join(root, 'build-manifest.json'))).digest('hex');
  report.terrainSources = Object.fromEntries(manifest.files.filter(entry => ['app.js','build-site.mjs','course.js','terrain-data.js','terrain-startup.js','terrain-worker.js','render-world.js','garage-core.js'].includes(entry.path)).map(entry => [entry.path,entry.sha256]));
  try {
    const previous = JSON.parse(await fs.readFile(output, 'utf8'));
    report.initialFailure = previous.initialFailure || (!previous.ok ? {capturedAt:previous.capturedAt, jsNetworkFailures:previous.jsNetworkFailures, serverErrors:previous.serverErrors, readinessError:previous.readinessError} : undefined);
    if (report.initialFailure?.jsNetworkFailures?.some(failure => failure.url.endsWith('/garage-core.js'))) report.packageCorrection = 'Added existing garage-core.js to the declared runtime input list; the original package omitted this garage.js dependency.';
  } catch {}
  for (const entry of manifest.files) {
    try {
      const [built, source] = await Promise.all([fs.readFile(path.join(root, entry.path)), fs.readFile(path.join(sources, entry.source))]);
      const sha256 = createHash('sha256').update(built).digest('hex');
      if (!built.equals(source) || built.length !== entry.bytes || sha256 !== entry.sha256) report.byteCheck.mismatches.push({path:entry.path, sourceEqual:built.equals(source), bytes:built.length, sha256, expectedSha256:entry.sha256});
      report.byteCheck.bytes += built.length;
    } catch (error) {report.byteCheck.mismatches.push({path:entry.path, error:String(error)});}
  }
  let browser, server;
  try {
    server = http.createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const target = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
        const relative = path.relative(root, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {response.writeHead(403).end(); return;}
        const data = await fs.readFile(target);
        response.writeHead(200, {'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'}).end(data);
      } catch (error) {
        report.serverErrors.push({url:request.url, error:String(error)});
        response.writeHead(404, {'Content-Type':'text/plain'}).end('Not found');
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    report.url = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({channel:'chrome', headless:true, args:['--enable-gpu', '--use-angle=d3d11']});
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('console', message => {if (message.type() === 'error') report.consoleErrors.push(message.text());});
    page.on('requestfailed', request => report.failedRequests.push({url:request.url(), resourceType:request.resourceType(), error:request.failure()?.errorText}));
    page.on('response', response => {
      const item = {url:response.url(), status:response.status(), resourceType:response.request().resourceType(), contentType:response.headers()['content-type']};
      if (response.status() >= 400) report.failedResponses.push(item);
      if (item.resourceType === 'script') report.scriptResponses.push(item);
    });
    page.on('worker', worker => report.workers.push(worker.url()));
    const startedAt = Date.now();
    const response = await page.goto(report.url, {waitUntil:'domcontentloaded', timeout:30000});
    report.navigation = {url:response?.url(), status:response?.status()};
    try {
      await page.waitForFunction(() => window.__racing?.snapshot?.().ready || window.__racingError, undefined, {timeout:10000});
    } catch (error) {report.readinessError = String(error);}
    report.observedReadyMs = Date.now() - startedAt;
    const state = await page.evaluate(() => ({snapshot:window.__racing?.snapshot?.() || null, racingError:window.__racingError || null, watchDisabled:document.getElementById('watch')?.disabled, loadingHidden:document.getElementById('loading')?.hidden, errorHidden:document.getElementById('error')?.hidden}));
    Object.assign(report, state);
    report.jsNetworkFailures = [...report.failedResponses, ...report.failedRequests].filter(request => request.resourceType === 'script' || /\.(?:m?js)(?:\?|$)/.test(request.url));
    report.ok = report.byteCheck.mismatches.length === 0 && state.snapshot?.ready === true && state.snapshot?.startup.terrainSource === 'worker' && !state.racingError && !report.pageErrors.length && !report.jsNetworkFailures.length;
  } catch (error) {
    report.ok = false; report.failure = String(error);
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    report.closed = {browser:true, server:true};
    await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ok:report.ok, byteCheck:report.byteCheck, startup:report.snapshot?.startup, pageErrors:report.pageErrors, consoleErrors:report.consoleErrors, jsNetworkFailures:report.jsNetworkFailures, failedResponses:report.failedResponses, serverErrors:report.serverErrors, failure:report.failure, readinessError:report.readinessError, closed:report.closed}, null, 2));
  if (!report.ok) process.exitCode = 1;
}
