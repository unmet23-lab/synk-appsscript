'use strict';
// Isolated guest browser QA: local static sound only, real O/X buttons, no paid/account requests.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SYNK_OPENING_QA_URL || 'http://127.0.0.1:4307';
const probe = process.argv.includes('--probe'), landscapeFirst = process.argv.includes('--landscape-first'), out = path.join(__dirname, 'maru-v4');
const checks = [], samples = [], errors = [], blocked = [], resources = [], shots = [];
const check = (name, passed, details) => checks.push({ name, passed: !!passed, details });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let page, frame, context, browser;
function save() { fs.writeFileSync(path.join(out, `rhythm-${probe ? 'probe' : 'result'}.json`), JSON.stringify({ date: '2026-10-10', base, probe, landscapeFirst, checks, failures: checks.filter(x => !x.passed), samples, errors, blocked, resources, shots, scope: 'Isolated guest Edge, existing local MP3 decode/playback. Full run does not seek or accelerate music; ordinary rhythm notes use the existing QA input hook, listening answers use actual pointer buttons. Viewport emulation is not physical-device rotation, latency, heat, or audible listening proof.' }, null, 2) + '\n'); }
async function shot(name) { const file = path.join(out, `rhythm-${probe ? 'probe-' : ''}${name}.jpg`); await page.screenshot({ path: file, type: 'jpeg', quality: 85 }); shots.push(file); }
async function state() { return frame.evaluate(() => { const { notes, ...audio } = window.synkRhythm.snapshot(); return { ...window.__rhythm.state(), audio, wallet: JSON.parse(localStorage.getItem('SYNK_PLAY_COLLECTION_V1') || 'null') }; }); }
async function sample(name, screenshot = true) {
  const data = await frame.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const shown = el => el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const ids = ['stage', 'phrase-card', 'pad-0', 'pad-1', 'pause-button', 'pause-dialog', 'resume-button'];
    const boxes = Object.fromEntries(ids.filter(id => shown(document.getElementById(id))).map(id => [id, rect(document.getElementById(id))]));
    const touchTargets = [...document.querySelectorAll('.game-bar button,#phrase-card button,#pause-dialog button')].filter(shown).map(el => ({ id: el.id, text: el.textContent.trim(), ...rect(el) }));
    const canvas = document.getElementById('stage');
    const { notes, ...audio } = window.synkRhythm.snapshot();
    return { ...window.__rhythm.state(), width: innerWidth, height: innerHeight, timeOrigin: performance.timeOrigin, sameCanvas: window.__rotationCanvas === canvas, sameAudio: window.__rotationAudio === window.synkRhythm.audio(), audio, boxes, touchTargets, overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight, canvas: { width: canvas.width, height: canvas.height, dpr: Math.min(devicePixelRatio, 2) }, pads: [0, 1].map(i => { const b = document.getElementById(`pad-${i}`), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { disabled: b.disabled, reachable: hit === b || b.contains(hit) }; }), modal: document.getElementById('pause-dialog').open, questionText: document.getElementById('q-say').textContent };
  });
  samples.push({ name, ...data });
  check(`${name}: same iframe document/canvas/audio context`, data.timeOrigin === await frame.evaluate(() => window.__rotationTimeOrigin) && data.sameCanvas && (data.screen !== 'game' || data.sameAudio));
  check(`${name}: no gameplay scroll overflow`, data.overflowX <= 1 && (data.screen !== 'game' || data.overflowY <= 1), { x: data.overflowX, y: data.overflowY });
  if (data.screen === 'game') {
    check(`${name}: auxiliary controls retain 44px touch targets`, data.touchTargets.every(r => r.width >= 44 && r.height >= 44), data.touchTargets);
    check(`${name}: canvas backing follows layout`, Math.abs(data.canvas.width - data.boxes.stage.width * data.canvas.dpr) <= 2 && Math.abs(data.canvas.height - data.boxes.stage.height * data.canvas.dpr) <= 2, data.boxes.stage);
    check(`${name}: O/X controls inside viewport`, ['pad-0', 'pad-1'].every(id => { const r = data.boxes[id]; return r.x >= 0 && r.y >= 0 && r.right <= data.width + 1 && r.bottom <= data.height + 1 && r.height >= 44; }), data.boxes);
    if (!data.modal) check(`${name}: O/X button centers are unobscured`, data.pads.every(p => p.reachable), data.pads);
    if (data.boxes['phrase-card'] && !data.modal) {
      const q = data.boxes['phrase-card'];
      check(`${name}: question does not cover controls`, ['pad-0', 'pad-1'].every(id => { const p = data.boxes[id]; return q.right <= p.x || q.x >= p.right || q.bottom <= p.y || q.y >= p.bottom; }), data.boxes);
    }
  }
  if (screenshot) await shot(name);
  return data;
}
async function rotate(name, landscape, screenshot = true) { await page.setViewportSize(landscape ? { width: 740, height: 320 } : { width: 320, height: 740 }); await sleep(200); return sample(name, screenshot); }
async function pauseRotate(name) {
  await frame.locator('#pause-button').click(); await frame.waitForFunction(() => document.getElementById('pause-dialog').open);
  const before = await state(); await rotate(`${name}-pause-landscape`, true); await rotate(`${name}-pause-portrait`, false);
  const after = await state(); check(`${name}: paused music time and score stay fixed`, after.paused && after.audio.audioState === 'suspended' && Math.abs(after.time - before.time) < .05 && after.score === before.score, { before: before.time, after: after.time });
  await frame.locator('#resume-button').click(); await frame.waitForFunction(() => !window.__rhythm.state().paused); await sleep(200); const resumed = await state(); check(`${name}: resumes same music clock`, resumed.time > after.time && resumed.audio.audioState === 'running');
}
async function start(landscapeFirst) {
  context = await browser.newContext({ viewport: landscapeFirst ? { width: 740, height: 320 } : { width: 320, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await context.route('**/*', route => { const r = route.request(), u = new URL(r.url()); if (!['GET', 'HEAD'].includes(r.method()) || !['127.0.0.1', 'localhost'].includes(u.hostname)) { blocked.push({ method: r.method(), url: r.url() }); return route.abort(); } return route.continue(); });
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) resources.push({ url: r.url(), status: r.status() }); });
  await page.goto(`${base}/brand-opening/home.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('.adventure-button').click(); await page.locator('[data-game="rhythm"]').click();
  await page.locator('.game-frame').evaluate(el => { el.src = '../korean-rhythm/?qa'; });
  const handle = await page.locator('.game-frame').elementHandle(); frame = await handle.contentFrame(); await frame.waitForFunction(() => !!window.__rhythm);
  await frame.evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan([]); });
  await frame.locator('#start-button').click(); await frame.waitForFunction(() => window.__rhythm.state().screen === 'game' && !window.__rhythm.state().loading && window.__rhythm.state().time > 0, null, { timeout: 30000 });
  await frame.evaluate(() => { window.__rotationCanvas = document.getElementById('stage'); window.__rotationAudio = window.synkRhythm.audio(); window.__rotationTimeOrigin = performance.timeOrigin; });
  await sample(landscapeFirst ? 'landscape-first-start' : 'portrait-first-start');
}
(async () => {
  fs.mkdirSync(out, { recursive: true }); browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await start(landscapeFirst); const initial = await state(); check('Five questions and empty guest wallet before play', initial.questions.length === 5 && Object.keys(initial.wallet?.rewardedRounds || {}).length === 0);
    await pauseRotate('opening');
    const answered = new Set(), listening = new Set(); let lastRotation = -99, rotation = 0;
    if (probe) await frame.evaluate(t => window.__rhythm.seek(t), initial.questions[0].showTime - .3);
    while ((await state()).screen === 'game') {
      let s = await state();
      if (s.time - lastRotation >= 12 && !s.phase) { lastRotation = s.time; await rotate(`beats-rotation-${++rotation}`, rotation % 2 === 1); }
      for (let i = 0; i < s.questions.length; i++) {
        const q = s.questions[i];
        if (s.time >= q.showTime && s.time < q.voiceEnd && !listening.has(i)) {
          listening.add(i); console.log(`Listening question ${i + 1} at ${s.time.toFixed(2)}s`);
          const before = s; await rotate(`q${i + 1}-listening-landscape`, true); const after = await state();
          check(`q${i + 1}: audio and question schedule continue through rotation`, after.time >= before.time && after.time - before.time < 3 && after.questions[i].state === 'pending' && after.audio.audioState === 'running', { before: before.time, after: after.time });
          await frame.locator('#pad-0').click({ force: true }); const early = await state(); check(`q${i + 1}: listening tap does not answer`, early.questions[i].state === 'pending');
          if (i === 0) { await pauseRotate('narration'); await rotate('q1-resumed-landscape', true); }
          if (i === 1 || probe) { await frame.locator('#q-text-btn').click(); await sample(`q${i + 1}-text-landscape`); }
        }
        if (s.time >= q.answerOpen + .05 && s.time < q.closeTime && !answered.has(i)) {
          answered.add(i);
          // A JPEG capture can consume the two-second input window on a busy QA host.
          // Rotate and use the actual button first; record its answered view afterwards.
          await page.setViewportSize(i % 2 === 0 ? { width: 740, height: 320 } : { width: 320, height: 740 });
          const before = await state(), lane = q.answer === 'O' ? 0 : 1;
          await frame.locator(`#pad-${lane}`).click();
          await frame.waitForFunction(index => window.__rhythm.state().questions[index].state === 'answered', i, { timeout: 6000 });
          const after = await state(); check(`q${i + 1}: actual O/X pointer answer persists`, after.questions[i].correct && after.questions[i].delivered === 'completed', { ...after.questions[i], buttonTime: before.time });
          await sample(`q${i + 1}-answer-${i % 2 ? 'portrait' : 'landscape'}`);
          await rotate(`q${i + 1}-answered-return`, i % 2 !== 0); const returned = await state(); check(`q${i + 1}: answered response not duplicated/reset`, returned.questions[i].state === 'answered' && returned.questions[i].response === after.questions[i].response && returned.questions.filter(x => x.state === 'answered').length === after.questions.filter(x => x.state === 'answered').length);
          if (probe) { await shot('probe-finish'); save(); console.log(JSON.stringify({ failures: checks.filter(x => !x.passed), out }, null, 2)); return; }
        }
      }
      save(); await sleep(80);
    }
    await frame.waitForFunction(() => !document.getElementById('r-coins').textContent.includes('계산'), null, { timeout: 5000 });
    const result = await state(); await shot('complete-portrait'); check('Natural full-song completion: all five narration/answers complete', result.screen === 'results' && result.questions.every(q => q.correct && q.delivered === 'completed'), result.questions);
    const wallet = result.wallet, rounds = Object.keys(wallet?.rewardedRounds || {}); check('Exactly one guest reward for this completed round', rounds.length === 1 && rounds[0].startsWith('rhythm:'), wallet);
    for (let i = 0; i < 4; i++) { await rotate(`result-rotation-${i + 1}`, i % 2 === 0); const s = await state(); check(`result-rotation-${i + 1}: reward is unchanged`, JSON.stringify(s.wallet) === JSON.stringify(wallet)); }
    await frame.locator('#back-button').click(); await frame.waitForFunction(() => window.__rhythm.state().screen === 'lobby'); await shot('back-to-game-lobby');
    await page.locator('#panel-close').click(); check('Return to WORLD disposes only completed game iframe', await page.locator('.game-frame').count() === 0); await page.waitForFunction(() => !document.querySelector('.scene-video').paused); await shot('back-to-world'); await context.close();
    await start(true); await rotate('landscape-start-to-portrait', false); await rotate('landscape-start-return', true); await pauseRotate('landscape-start');
    check('No console errors or failed static assets', errors.length === 0 && resources.length === 0, { errors, resources }); check('No external or mutation calls attempted', blocked.length === 0, blocked);
  } catch (error) { check('Browser flow completes', false, error.stack); if (page) await shot('failure').catch(() => {}); }
  finally { save(); await browser.close(); }
  console.log(JSON.stringify({ passed: checks.filter(x => x.passed).length, failures: checks.filter(x => !x.passed), out }, null, 2)); assert.equal(checks.filter(x => !x.passed).length, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
