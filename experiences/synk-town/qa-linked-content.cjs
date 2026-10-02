// Ephemeral loopback fixture; tests rendered controls, not injected learning answers.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { pathToFileURL } = require('node:url');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-runner-ui-')));
const checks = [], errors = [], windows = []; let server;
const output = path.join(__dirname, 'qa'); fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, pass) => { checks.push({ name, ok: !!pass }); if (!pass) throw Error(name); };
const js = (target, source) => (target.webContents || target).executeJavaScript(source, true);
async function wait(target, source) { for (let i = 0; i < 240; i++) { if (await js(target, source)) return; await delay(100); } throw Error('Timeout ' + source); }
function windowFor(role) { const win = new BrowserWindow({ show: false, width: 1280, height: 1000, webPreferences: { partition: `qa-town-${role}-${Date.now()}`, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); windows.push(win); return win; }
app.whenReady().then(async () => { try {
  const { createLinkedServer } = await import(pathToFileURL(path.join(__dirname, '../teacher-world/linked-server.mjs')).href);
  server = await createLinkedServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function post(route, payload, token) { const response = await fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) }); const value = await response.json(); if (!response.ok) throw Error(value.error || route); return value; }
  const teacher = await post('/api/teacher/session', { key: server.ownerKey });
  const link = await post('/api/links', { classId: 'class-local', name: 'Town UI fixture' }, teacher.token);
  const world = windowFor('world'); await world.loadURL(origin + '/synk-account/local-world.html'); await wait(world, `!!document.getElementById('local-join-button')`);
  await js(world, `document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);
  await wait(world, `document.documentElement.dataset.localWorld==='connected'&&!!document.querySelector('[data-kind=practice][data-id=town-reading]')`);
  await js(world, `document.querySelector('[data-kind=practice][data-id=town-reading]').click();document.querySelector('[data-world-action=start-game]').click()`);
  await wait(world, `!!document.querySelector('#world-games iframe')?.src.includes('/synk-town/linked.html')`);
  let town; for (let i = 0; i < 100; i++) { town = world.webContents.mainFrame.frames.find(f => f.url.includes('/synk-town/linked.html')); if (town) break; await delay(100); }
  await wait(town, `!!document.querySelector('[data-command=CHOOSE]')`);
  check('linked-town-uses-own-world-scope', await js(town, `document.getElementById('scope-label').textContent.includes('내 생활')`));
  await js(town, `[...document.querySelectorAll('[data-command=CHOOSE]')].find(b=>b.textContent==='안이 좋아요').click()`);
  await wait(town, `!!document.querySelector('[data-command=NEXT]:not(:disabled)')`); await js(town, `document.querySelector('[data-command=NEXT]').click()`);
  await wait(town, `!!document.querySelector('[data-command=PLACE]:not(:disabled)')`); await js(town, `document.querySelector('[data-command=PLACE]').click()`);
  await wait(town, `!!document.querySelector('[data-command=SIGN_START]:not(:disabled)')`);
  check('FT10-life-does-not-create-learning-evidence', server.snapshot().learners[0].town.state.placement && server.snapshot().learners[0].evidence.length === 0);
  await js(town, `document.querySelector('[data-command=SIGN_START]').click()`);
  await wait(town, `!!document.querySelector('[data-command=SIGN_NEXT]:not(:disabled)')`); await js(town, `document.querySelector('[data-command=SIGN_NEXT]').click()`);
  await wait(town, `!!document.querySelector('[data-command=SIGN_PICTURE]:not(:disabled)')`); await js(town, `document.querySelector('[data-command=SIGN_PICTURE]').click()`);
  await wait(town, `!!document.querySelector('[data-command=SIGN_PLACE]:not(:disabled)')`); await js(town, `document.querySelector('[data-command=SIGN_PLACE]').click()`);
  await wait(town, `!document.getElementById('reading-open').disabled`); await delay(350);
  check('FT51-life-remains-outside-language-score', !!server.snapshot().learners[0].town.state.sign.placedId && server.snapshot().learners[0].evidence.length === 0);
  await js(town, `document.getElementById('reading-open').click()`); await wait(town, `document.getElementById('reading-dialog').open`);
  await js(town, `document.getElementById('reading-hint').click();document.querySelector('[data-answer="1"]').click()`);
  await wait(town, `!document.getElementById('reading-next').hidden`);
  check('Town-reading-hint-is-not-independent', await js(town, `document.getElementById('reading-feedback').textContent.includes('도움')`));
  for (const answer of [2, 0]) { await js(town, `document.getElementById('reading-next').click();document.querySelector('[data-answer="${answer}"]').click()`); await wait(town, `!document.getElementById('reading-next').hidden`); }
  await delay(1200); check('three-reading-answers-reach-teacher-state', server.snapshot().learners[0].evidence.filter(e => e.skillId.startsWith('ko.reading.')).length === 3);
  world.setSize(390, 900); await delay(350);
  await js(world, `document.querySelector('#world-games iframe').scrollIntoView({behavior:'instant',block:'start'})`);
  await wait(world, `document.querySelector('#world-games iframe').getBoundingClientRect().top < 10`);
  await delay(250); fs.writeFileSync(path.join(output, 'linked-town-mobile.png'), (await world.webContents.capturePage()).toPNG());
  check('Town-reading-dialog-no-mobile-horizontal-overflow', await js(town, `document.getElementById('reading-dialog').scrollWidth<=document.getElementById('reading-dialog').clientWidth+2`));

  const runner = windowFor('runner'); await runner.loadURL(origin + '/korean-runner/'); await wait(runner, `typeof document.getElementById('listening-check').onclick==='function'`);
  await js(runner, `document.getElementById('listening-check').click()`); await wait(runner, `document.getElementById('listening-check-dialog').open`);
  check('runner-cannot-answer-before-audio-completion', await js(runner, `[...document.querySelectorAll('#check-choices button')].every(b=>b.disabled)`));
  await wait(runner, `!!document.querySelector('#check-choices button:not(:disabled)')`);
  check('runner-before-answer-does-not-show-spoken-transcript', await js(runner, `document.getElementById('check-feedback').textContent===''&&!document.getElementById('listening-check-dialog').textContent.includes('오른쪽 길로 가세요.')`));
  await js(runner, `document.getElementById('check-replay').click()`); check('runner-replay-locks-answers-again', await js(runner, `[...document.querySelectorAll('#check-choices button')].every(b=>b.disabled)`));
  await wait(runner, `!!document.querySelector('#check-choices button:not(:disabled)')`);
  const choose = `[...document.querySelectorAll('#check-choices button')].find(b=>['오른쪽 길로 가기','뛰지 않고 그대로 달리기','뛰어넘은 뒤 오른쪽으로 가기'].includes(b.textContent)).click()`;
  await js(runner, choose); check('runner-replay-feedback-is-assisted', await js(runner, `document.getElementById('check-feedback').textContent.includes('도움')`));
  for (let i = 0; i < 2; i++) { await js(runner, `document.getElementById('check-next').click()`); await wait(runner, `!!document.querySelector('#check-choices button:not(:disabled)')`); await js(runner, choose); }
  check('runner-three-real-MP3-checks-complete', await js(runner, `document.getElementById('check-next').textContent==='확인 마치기'`));
  runner.setSize(390, 840); await delay(250); fs.writeFileSync(path.join(output, 'linked-runner-mobile.png'), (await runner.webContents.capturePage()).toPNG());
  check('runner-dialog-fits-mobile', await js(runner, `document.getElementById('listening-check-dialog').scrollWidth<=document.getElementById('listening-check-dialog').clientWidth+2`));
  await js(runner, `document.getElementById('check-next').click()`);
  await js(runner, `document.getElementById('listening-check').click()`); await wait(runner, `!!document.querySelector('#check-choices button:not(:disabled)')`);
  await js(runner, `document.getElementById('sound').click()`);
  check('runner-mute-interrupts-check-and-requires-replay', await js(runner, `[...document.querySelectorAll('#check-choices button')].every(b=>b.disabled)&&document.getElementById('check-status').textContent.includes('멈췄어요')`));
  await js(runner, `document.getElementById('check-close').click()`);
  const broken = windowFor('audio-failure'); broken.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*/assets/voice/*.mp3'] }, (_details, callback) => callback({ cancel: true }));
  await broken.loadURL(origin + '/korean-runner/'); await wait(broken, `typeof document.getElementById('listening-check').onclick==='function'`); await js(broken, `document.getElementById('listening-check').click()`);
  await wait(broken, `document.getElementById('check-status').textContent.includes('불러오지 못했어요')`);
  check('runner-MP3-failure-blocks-language-answer', await js(broken, `[...document.querySelectorAll('#check-choices button')].every(b=>b.disabled)&&!document.getElementById('check-replay').disabled`));
} catch (error) { errors.push(error.stack || String(error)); }
finally { const result = { ok: errors.length === 0, isolated: true, checks, errors }; fs.writeFileSync(path.join(output, 'linked-content-ui.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); for (const win of windows) win.destroy(); server?.close(); app.exit(result.ok ? 0 : 1); } });
