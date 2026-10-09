const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
  try {
    for (const [name, width, height] of [['desktop', 1400, 720], ['mobile', 390, 465]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: name === 'mobile' ? 2 : 1, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route('**/__finish-capture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>html,body{margin:0}#scene{width:100vw;height:100vh}</style><main id="scene"></main><script type="module">const{mountHomeScene}=await import("/scene-v3.mjs");window.study=await mountHomeScene(document.querySelector("#scene"),{reducedMotion:true});study.setOutfit("scarf-apron");</script>' }));
      await page.goto('http://127.0.0.1:4296/__finish-capture'); await page.waitForFunction(() => window.study?.metrics().frameCount > 0, null, { timeout: 60000 });
      await page.waitForTimeout(350); await page.screenshot({ path: path.join(__dirname, name + '.png') });
      await page.evaluate(() => study.setTime('sunset')); await page.waitForTimeout(350); await page.screenshot({ path: path.join(__dirname, name + '-sunset.png') });
      results.push({ name, errors, metrics: await page.evaluate(() => study.metrics()) }); await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(__dirname, 'capture.json'), JSON.stringify(results, null, 2)); console.log(results.map(({ name, errors }) => ({ name, errors })));
})().catch(error => { console.error(error); process.exit(1); });
