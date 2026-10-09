'use strict';
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const home = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4296';
const checks = [], results = [], errors = [];
function check(name, ok) { assert.ok(ok, name); checks.push({ name, passed: true }); }
let source = fs.readFileSync(path.join(home, 'scene-v3.mjs'), 'utf8');
// Exercise the exact scene without changing the app's current renderer source.
source = "import { createContactLight } from '/contact-light-v6.mjs';\n" + source;
source = source.replace('const backdrop = makeLandscape(scene, materials);', 'const backdrop = makeLandscape(scene, materials); const contact = createContactLight({renderer,scene,camera,quality:initialQuality,mobile:isMobile()});');
source = source.replaceAll(/renderer\.render\(scene,\s*camera\)/g, 'contact.render()');
source = source.replace('avatar.dispose();', 'contact.dispose(); avatar.dispose();');
source = source.replace('const api = { setOutfit,', 'const api = { contact, skyOnly:value=>{world.visible=!value;backdrop.group.visible=!value;}, rawRender:()=>renderer.render(scene,camera), engineState:()=>({target:renderer.getRenderTarget()===null,autoClear:renderer.autoClear,background:!!scene.background,override:scene.overrideMaterial===null}), setOutfit,');
const html = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}#scene{height:100dvh;width:100%}</style><main id="scene"></main><script type="module">import{mountHomeScene}from'/scene-ao-v6-study.mjs';window.study=await mountHomeScene(document.querySelector('#scene'),{reducedMotion:true});study.setOutfit('scarf-apron');</script></html>`;
async function canvasPixels(page) {
  return page.evaluate(async () => { const canvas = document.querySelector('canvas'), image = new Image(); image.src = canvas.toDataURL(); await image.decode(); const target = document.createElement('canvas'); target.width = canvas.width; target.height = canvas.height; const ctx = target.getContext('2d'); ctx.drawImage(image, 0, 0); return { width: target.width, height: target.height, bytes: Array.from(ctx.getImageData(0, 0, target.width, target.height).data) }; });
}
function compare(a, b) {
  let sum = 0, sky = 0, skyN = 0, opaque = 0, dark = 0;
  for (let i = 0; i < a.bytes.length; i += 4) {
    const x = i / 4 % a.width, y = Math.floor(i / 4 / a.width);
    const d = (Math.abs(a.bytes[i] - b.bytes[i]) + Math.abs(a.bytes[i + 1] - b.bytes[i + 1]) + Math.abs(a.bytes[i + 2] - b.bytes[i + 2])) / 3;
    sum += d; if (b.bytes[i + 3] === 255) opaque++;
    if (x > a.width * .50 && x < a.width * .68 && y < a.height * .025) { sky += d; skyN++; }
    if ((a.bytes[i] + a.bytes[i + 1] + a.bytes[i + 2]) - (b.bytes[i] + b.bytes[i + 1] + b.bytes[i + 2]) > 12) dark++;
  }
  return { meanAbsoluteRGB: sum / (a.width * a.height), skyMeanAbsoluteRGB: sky / skyN, opaqueRatio: opaque / (a.width * a.height), darkenedPixelRatio: dark / (a.width * a.height) };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height, dpr] of [['pc', 1280, 720, 1], ['phone', 390, 465, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' }), page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/scene-ao-v6-study.mjs', r => r.fulfill({ contentType: 'text/javascript', body: source }));
      await page.route('**/__contact-v6', r => r.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(base + '/__contact-v6');
      await page.waitForFunction(() => window.study?.metrics().frameCount > 0, null, { timeout: 60000 });
      await page.waitForTimeout(200);
      const boot = await page.evaluate(() => study.contact.metrics());
      check(name + ' default quality policy', boot.enabled === (name === 'pc'));
      await page.evaluate(() => { study.contact.setQuality('light'); study.contact.render(); });
      const direct = await canvasPixels(page);
      await page.screenshot({ path: path.join(__dirname, name + '-direct.png') });
      const off = await page.evaluate(() => study.contact.metrics());
      check(name + ' direct mode has no extra targets', !off.enabled && off.estimatedTargetBytes === 0);
      await page.evaluate(() => { study.contact.setQuality('detail'); study.contact.render(); });
      const contact = await canvasPixels(page);
      await page.screenshot({ path: path.join(__dirname, name + '-contact.png') });
      const active = await page.evaluate(() => study.contact.metrics()), delta = compare(direct, contact);
      check(name + ' full resolution beauty and capped half resolution AO', active.beautySize[0] === direct.width && active.aoSize[0] <= direct.width / 2 + 1 && Math.max(...active.aoSize) <= 960);
      await page.evaluate(() => { study.skyOnly(true); study.contact.setQuality('light'); study.contact.render(); });
      const skyDirect = await canvasPixels(page);
      await page.evaluate(() => { study.contact.setQuality('detail'); study.contact.render(); });
      const skyDelta = compare(skyDirect, await canvasPixels(page));
      await page.evaluate(() => { study.skyOnly(false); study.contact.render(); });
      check(name + ' AO leaves sky and gamma unchanged within one RGB level', skyDelta.meanAbsoluteRGB < 1);
      check(name + ' output alpha stays opaque', delta.opaqueRatio === 1);
      const timings = await page.evaluate(() => { const out = {}; for (const quality of ['light', 'balanced', 'detail']) { study.contact.setQuality(quality); const values = []; for (let i = 0; i < 11; i++) { study.contact.render(); if (i > 1) values.push(study.contact.metrics().cpuSubmissionMs); } values.sort((a, b) => a - b); out[quality] = { medianMs: values[4], metrics: study.contact.metrics() }; } return out; });
      const state = await page.evaluate(() => study.engineState());
      check(name + ' renderer/scene state restored', Object.values(state).every(Boolean));
      await page.evaluate(() => { study.setTime('sunset'); study.contact.render(); });
      await page.screenshot({ path: path.join(__dirname, name + '-sunset.png') });
      const photo = await page.evaluate(async () => { const before = study.contact.metrics(); const data = study.capture({ highResolution: true }); const image = new Image(); image.src = data; await image.decode(); return { width: image.width, height: image.height, before, after: study.contact.metrics(), state: study.engineState() }; });
      check(name + ' high-resolution photo restores target size', photo.before.beautySize.join() === photo.after.beautySize.join() && Math.max(photo.width, photo.height) <= 1920 && Object.values(photo.state).every(Boolean));
      await page.evaluate(() => { study.contact.setQuality('light'); study.contact.render(); });
      check(name + ' switching off releases render targets', (await page.evaluate(() => study.contact.metrics())).estimatedTargetBytes === 0);
      await page.evaluate(() => study.dispose());
      check(name + ' dispose removes canvas and owns no targets', await page.evaluate(() => !document.querySelector('canvas') && study.contact.metrics().disposed && study.contact.metrics().estimatedTargetBytes === 0));
      results.push({ name, delta, skyDelta, boot, active, timings, photo }); await context.close();
    }
    check('no page or shader errors', errors.length === 0);
    fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, results, errors, limitation: 'Headless Edge, synthetic viewport. CPU submission is not GPU time or physical-device performance. Visual acceptance still requires image review.' }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, results: results.map(({ name, delta, timings }) => ({ name, delta, timings })), errors }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
