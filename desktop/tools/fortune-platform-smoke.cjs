'use strict';
// Hidden real Electron renderer QA. Account snapshots and preview IPC are
// synthetic; the web server is ephemeral and all other requests are blocked.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..'), artifacts = path.join(root, 'artifacts');
const prefix = 'SYNK_FORTUNE_PLATFORM_QA ', checkedOn = '2026-10-06';
const reportPath = path.join(artifacts, 'fortune-platform-20261006.json');

if (!process.versions.electron) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fortune-platform-'));
  try {
    const fixture = fs.readFileSync(path.join(__dirname, 'renderer-account-fixture.cjs'), 'utf8');
    if (!/productPreviewsAvailable:\[[^\]]*'fortune'[^\]]*\]/.test(fixture)) throw Error('Fortune fixture capability missing');
    fs.writeFileSync(path.join(profile, 'fortune-no-capability.cjs'), fixture.replace(/productPreviewsAvailable:\[[^\]]*\]/, 'productPreviewsAvailable:[]'));
    const result = require('node:child_process').spawnSync(require('electron'), [__filename, '--profile=' + profile], {
      cwd: root, windowsHide: true, encoding: 'utf8', timeout: 120000,
    });
    const line = result.stdout?.split(/\r?\n/).find(value => value.startsWith(prefix));
    const report = line ? JSON.parse(line.slice(prefix.length)) : { ok: false, error: result.error?.message || 'NO_RESULT', stderr: result.stderr?.slice(-1800) };
    fs.mkdirSync(artifacts, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ ok: report.ok, checks: report.checks?.length, failed: report.checks?.filter(check => !check.ok), error: report.error, consoleErrors: report.consoleErrors, blockedRequests: report.blockedRequests, reportPath }, null, 2) + '\n');
    if (!report.ok) process.exitCode = 1;
  } finally {
    if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('synk-fortune-platform-')) throw Error('Unsafe temporary profile');
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 });
  }
} else {
  const { app, BrowserWindow, protocol, session, Menu } = require('electron');
  const { createNativeContent } = require('../src/native-content.cjs');
  const { preferences } = require('../src/security.cjs');
  const profile = process.argv.find(value => value.startsWith('--profile='))?.slice(10);
  if (!profile || path.dirname(profile) !== os.tmpdir() || !path.basename(profile).startsWith('synk-fortune-platform-')) throw Error('Isolated profile required');
  app.enableSandbox();
  app.setPath('userData', profile);
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  protocol.registerSchemesAsPrivileged([{ scheme: 'synk-desktop', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
  app.whenReady().then(async () => {
    const checks = [], errors = [], blockedRequests = [], localRequests = [], openedLinks = [], windows = [];
    let server, allowedOrigin = null;
    const check = (name, ok, details = {}) => checks.push({ name, ok: !!ok, ...details });
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const run = (window, script) => window.webContents.executeJavaScript(script);
    const waitFor = async (window, script, label) => {
      for (let i = 0; i < 160; i++) { if (await run(window, script)) return; await pause(25); }
      throw Error(label + ' timeout');
    };
    const settle = async window => {
      await run(window, "document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");
      window.webContents.invalidate(); await pause(130);
    };
    const capture = async (window, name) => {
      await settle(window);
      await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); await pause(130);
      const target = path.join(artifacts, 'fortune-' + name + '-20261006.png');
      fs.mkdirSync(artifacts, { recursive: true });
      fs.writeFileSync(target, (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
      return target;
    };
    function createWindow(label, preload) {
      const isolated = session.fromPartition('fortune-platform-' + label);
      isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      isolated.setPermissionCheckHandler(() => false);
      isolated.protocol.handle('synk-desktop', createNativeContent({ appRoot: root }));
      isolated.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
        const local = allowedOrigin && new URL(details.url).origin === allowedOrigin;
        (local ? localRequests : blockedRequests).push(details.url); callback({ cancel: !local });
      });
      const window = new BrowserWindow({ width: 1280, height: 960, useContentSize: true, show: false, frame: false,
        webPreferences: { ...preferences(preload), session: isolated, backgroundThrottling: false } });
      window.webContents.setWindowOpenHandler(details => { openedLinks.push({ surface: label, url: details.url }); return { action: 'deny' }; });
      window.webContents.on('console-message', event => { if (event.level === 'error') errors.push({ surface: label, message: event.message }); });
      windows.push(window); return window;
    }
    const nativeInspect = window => run(window, `(()=>{const main=document.getElementById('main');return {
      pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,main.scrollWidth-main.clientWidth),
      imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0),
      overviewIds:[...document.querySelectorAll('#benefits-grid [data-benefit]')].map(n=>n.dataset.benefit),
      benefitsVisible:!document.getElementById('view-benefits').hidden,detailVisible:!document.getElementById('benefit-detail').hidden,
      focus:document.activeElement.id,launchCount:document.querySelectorAll('[data-benefit-preview]').length,
      libraryIds:[...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app),title:document.querySelector('#benefit-title')?.textContent||document.getElementById('benefits-title').textContent};})()`);
    const webInspect = window => run(window, `(()=>{const main=document.getElementById('page-content');return {
      pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,main.scrollWidth-main.clientWidth),
      imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0),
      benefitIds:[...document.querySelectorAll('.benefit-grid .benefit-art')].map(n=>n.getAttribute('href').split('/')[1]),
      heading:main.querySelector('h1')?.textContent,route:location.hash,previewLinks:[...main.querySelectorAll('a[href="http://127.0.0.1:4299/"]')].map(n=>({href:n.href,target:n.target,rel:n.rel})),
      libraryButtonCount:main.querySelectorAll('[data-action="save"]').length};})()`);
    const fits = info => !info.pageOverflow && !info.mainOverflow && info.imagesLoaded;
    const account = (generation, appIds) => ({ configured: true, status: 'signed-in', signedIn: true, sessionGeneration: generation,
      account: { synk_user_id: 'synthetic-fortune-member' }, library: { status: 'ready', appIds } });
    const overviewIds = 'care,fortune,rehearsal,family-album';
    try {
      Menu.setApplicationMenu(null);
      const native = createWindow('native', path.join(__dirname, 'renderer-account-fixture.cjs'));
      await native.loadURL('synk-desktop://platform/index.html');
      await waitFor(native, "document.documentElement.dataset.ready==='true'", 'Native renderer');
      for (const width of [1280, 390, 320]) {
        native.setContentSize(width, 960);
        await run(native, "document.querySelector('.nav-links [data-view=benefits]').click()"); await settle(native);
        let info = await nativeInspect(native);
        check('native-overview-' + width, fits(info) && info.benefitsVisible && !info.detailVisible && info.focus === 'benefits-title' && info.overviewIds.join(',') === overviewIds,
          { ...info, screenshot: await capture(native, 'platform-native-overview-' + width) });
        await run(native, "document.querySelector('#benefits-grid [data-benefit=fortune]').click()"); await settle(native);
        info = await nativeInspect(native);
        check('native-fortune-detail-' + width, fits(info) && info.benefitsVisible && info.detailVisible && info.focus === 'benefit-title' && !info.launchCount && info.libraryIds.join(',') === 'world' && info.title.includes('오늘의 운세'),
          { ...info, screenshot: await capture(native, 'platform-native-detail-' + width) });
        await run(native, "document.querySelector('.benefit-back').click()");
        check('native-back-' + width, await run(native, "!document.getElementById('benefits-overview').hidden&&document.getElementById('benefit-detail').hidden&&document.activeElement.id==='benefits-title'"));
        await run(native, "document.querySelector('.nav-links [data-view=library]').click();document.getElementById('search').value='운세';document.getElementById('search').dispatchEvent(new Event('input'))"); await settle(native);
        check('native-search-' + width, await run(native, "!document.getElementById('benefits-search').hidden&&JSON.stringify([...document.querySelectorAll('#benefits-search [data-benefit]')].map(n=>n.dataset.benefit))==='[\"fortune\"]'&&window.__synkFixture.calls().length===0"),
          { screenshot: await capture(native, 'platform-native-search-' + width) });
        await run(native, "document.querySelector('#benefits-search [data-benefit=fortune]').click()"); await settle(native);
        check('native-search-opens-detail-' + width, await run(native, "!document.getElementById('view-benefits').hidden&&document.getElementById('benefit-title').textContent.includes('오늘의 운세')&&document.querySelector('[data-benefit-preview]')===null"));
        await run(native, "document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))");
      }
      await run(native, 'window.__synkFixture.switchAccount(' + JSON.stringify(account(1, ['fortune'])) + ')'); await settle(native);
      check('native-entitlement-and-capability-enable-preview', await run(native, "document.querySelector('[data-benefit-preview=fortune]')!==null&&JSON.stringify([...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app))==='[\"fortune\"]'"));
      await run(native, "document.querySelector('[data-benefit-preview=fortune]').click()"); await settle(native);
      check('native-benefit-uses-existing-bridge', await run(native, "JSON.stringify(window.__synkFixture.calls())==='[\"product-preview:fortune\"]'"));
      await run(native, "document.querySelector('[data-app=fortune]').click()"); await settle(native);
      check('native-library-preview-action', await run(native, "document.getElementById('primary-action').dataset.action==='product-preview'&&!document.getElementById('primary-action').disabled"));
      await run(native, "document.getElementById('primary-action').click()"); await settle(native);
      check('native-library-uses-existing-bridge', await run(native, "JSON.stringify(window.__synkFixture.calls())==='[\"product-preview:fortune\",\"product-preview:fortune\"]'"));
      await run(native, "document.querySelector('.nav-links [data-view=benefits]').click();document.querySelector('#benefits-grid [data-benefit=fortune]').click();window.__synkStaleFortuneButton=document.querySelector('[data-benefit-preview=fortune]')");
      await run(native, 'window.__synkFixture.switchAccount(' + JSON.stringify(account(2, [])) + ')'); await settle(native);
      check('native-revocation-removes-action-keeps-public-detail', await run(native, "!document.getElementById('benefit-detail').hidden&&document.querySelector('[data-benefit-preview]')===null&&document.querySelectorAll('[data-app]').length===0&&document.getElementById('primary-action').disabled"));
      await run(native, "document.getElementById('benefit-detail').append(window.__synkStaleFortuneButton);window.__synkStaleFortuneButton.click();window.__synkStaleFortuneButton.remove()"); await settle(native);
      check('native-stale-action-cannot-launch-after-revocation', await run(native, 'window.__synkFixture.calls().length===2'));

      const withoutCapability = createWindow('without-capability', path.join(profile, 'fortune-no-capability.cjs'));
      await withoutCapability.loadURL('synk-desktop://platform/index.html');
      await waitFor(withoutCapability, "document.documentElement.dataset.ready==='true'", 'Capability fixture');
      await run(withoutCapability, 'window.__synkFixture.switchAccount(' + JSON.stringify(account(1, ['fortune'])) + ')');
      await run(withoutCapability, "document.querySelector('.nav-links [data-view=benefits]').click();document.querySelector('#benefits-grid [data-benefit=fortune]').click()"); await settle(withoutCapability);
      check('native-entitlement-without-capability-has-no-benefit-launch', await run(withoutCapability, "document.querySelector('[data-benefit-preview]')===null&&window.__synkFixture.calls().length===0"));
      await run(withoutCapability, "document.querySelector('[data-app=fortune]').click()");
      check('native-entitlement-without-capability-disables-library-launch', await run(withoutCapability, "document.getElementById('primary-action').disabled&&document.getElementById('primary-action').dataset.action==='none'&&window.__synkFixture.calls().length===0"));

      const { createServer } = await import(require('node:url').pathToFileURL(path.join(root, '..', 'experiences', 'learning-hub', 'server.mjs')).href);
      server = createServer();
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      allowedOrigin = 'http://127.0.0.1:' + server.address().port;
      const web = createWindow('web');
      await web.loadURL(allowedOrigin + '/synk-account/platform.html#benefits');
      await waitFor(web, "document.querySelectorAll('.benefit-grid .benefit-art').length===4", 'Web renderer');
      for (const width of [1280, 390, 320]) {
        web.setContentSize(width, 960);
        await run(web, "location.hash='benefits'");
        await waitFor(web, "document.querySelectorAll('.benefit-grid .benefit-art').length===4", 'Web benefits'); await settle(web);
        let info = await webInspect(web);
        check('web-overview-' + width, fits(info) && info.benefitIds.join(',') === overviewIds,
          { ...info, screenshot: await capture(web, 'platform-web-overview-' + width) });
        await run(web, "document.querySelector('.benefit-grid a[href=\"#benefits/fortune\"]').click()");
        await waitFor(web, "document.querySelector('.benefit-detail-hero.benefit-fortune')!==null", 'Web detail'); await settle(web);
        info = await webInspect(web);
        check('web-fortune-detail-' + width, fits(info) && info.heading === '무료 운세' && info.previewLinks.length === 1 && info.previewLinks[0].target === '_blank' && info.previewLinks[0].rel.includes('noopener') && !info.libraryButtonCount,
          { ...info, screenshot: await capture(web, 'platform-web-detail-' + width) });
        await run(web, "document.getElementById('platform-search').value='운세';document.getElementById('search-form').requestSubmit()");
        await waitFor(web, "location.hash==='#discover'&&document.querySelectorAll('.benefit-grid .benefit-art').length===1", 'Web search'); await settle(web);
        info = await webInspect(web);
        check('web-search-' + width, fits(info) && info.benefitIds.join(',') === 'fortune',
          { ...info, screenshot: await capture(web, 'platform-web-search-' + width) });
        await run(web, "document.querySelector('.benefit-grid a[href=\"#benefits/fortune\"]').click()");
        await waitFor(web, "document.querySelector('.benefit-detail-hero.benefit-fortune')!==null", 'Web search detail');
        check('web-search-opens-detail-' + width, await run(web, "document.querySelector('.benefit-detail-hero h1').textContent==='무료 운세'"));
      }
      await run(web, "document.querySelector('a[href=\"http://127.0.0.1:4299/\"]').click()"); await pause(100);
      check('web-preview-target-is-4299-no-app-launched', openedLinks.length === 1 && openedLinks[0].surface === 'web' && openedLinks[0].url === 'http://127.0.0.1:4299/', { openedLinks });
      check('all-windows-remain-hidden', windows.every(window => !window.isVisible()));
      check('no-external-network-or-console-errors', !blockedRequests.length && !errors.length, { allowedLocalRequests: localRequests.length });
      const report = { ok: checks.every(item => item.ok), checkedOn,
        scope: 'Hidden Electron native platform and ephemeral learning-hub web platform at 1280/390/320. Synthetic library.fortune entitlement/capability checks, existing preview bridge, revocation, public benefit/search navigation and loopback 4299 link only. No live account, real app launch, paid AI, external request or deployment.',
        checks, consoleErrors: errors, blockedRequests, localRequestCount: localRequests.length, openedLinks, visibleWindowsOpened: false, realAccountLoginStarted: false, realProductLaunched: false, temporaryServerClosed: false };
      windows.forEach(window => window.destroy());
      await new Promise(resolve => server.close(resolve)); server = null; report.temporaryServerClosed = true;
      process.stdout.write(prefix + JSON.stringify(report) + '\n'); app.exit(report.ok ? 0 : 1);
    } catch (error) {
      windows.forEach(window => { if (!window.isDestroyed()) window.destroy(); });
      if (server) await new Promise(resolve => server.close(resolve));
      process.stdout.write(prefix + JSON.stringify({ ok: false, error: error.message, checkedOn, checks, consoleErrors: errors, blockedRequests, localRequestCount: localRequests.length, openedLinks, temporaryServerClosed: true }) + '\n'); app.exit(1);
    }
  });
}
