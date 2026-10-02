// Real WORLD frames answering the selected authored items. Setup uses isolated API fixtures.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { pathToFileURL } = require('node:url');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'synk-content-target-')));
const checks = [], errors = [], windows = []; let server;
const output = path.join(__dirname, 'qa'); fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const js = (target, code) => (target.webContents || target).executeJavaScript(code, true);
const check = (name, ok) => { checks.push({ name, ok: !!ok }); if (!ok) throw Error(name); };
async function until(fn, label) { for (let i = 0; i < 280; i++) { if (await fn()) return; await delay(100); } throw Error('Timeout ' + label); }
const wait = (target, code) => until(() => js(target, code), code);
function windowFor(role) { const window = new BrowserWindow({ show: false, width: 1280, height: 1000, webPreferences: { partition: `qa-target-${role}-${Date.now()}`, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); windows.push(window); return window; }
app.whenReady().then(async () => { try {
  const { createLinkedServer } = await import(pathToFileURL(path.join(__dirname, '../teacher-world/linked-server.mjs')).href);
  const { READING_CHECKS, readingMetadata } = await import(pathToFileURL(path.join(__dirname, 'understanding.mjs')).href);
  const { LISTENING_CHECKS, checkMetadata } = await import(pathToFileURL(path.join(__dirname, '../korean-runner/listening-check.mjs')).href);
  server = await createLinkedServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function post(route, payload, token) { const response = await fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) }); const value = await response.json(); if (!response.ok) throw Error(`${route}: ${value.code || value.error}`); return value; }
  const teacher = await post('/api/teacher/session', { key: server.ownerKey });
  const link = await post('/api/links', { classId: 'class-local', name: '목표 문항 UI fixture' }, teacher.token);
  const world = windowFor('world'); await world.loadURL(origin + '/synk-account/local-world.html'); await wait(world, `!!document.getElementById('local-join-button')`);
  await js(world, `document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);
  await wait(world, `document.documentElement.dataset.localWorld==='connected'`);
  const learnerId = server.snapshot().learners[0].id;
  async function play(contentId, skillId, difficulty, wrong, label) {
    const created = await post('/api/assignments', { classId: 'class-local', learnerIds: [learnerId], contentId,
      title: label, target: { skillId, difficulty, responseFormat: 'single-choice' }, dueAt: new Date(Date.now() + 86400000).toISOString(), reason: '새 문항 목표 검증', idempotencyKey: label }, teacher.token);
    const assignmentId = created.assignment.id, assignment = server.snapshot().assignments.find(row => row.id === assignmentId);
    const target = assignment.targets[learnerId], isTown = contentId === 'town-reading', gamePath = isTown ? '/synk-town/linked.html' : '/korean-runner/';
    await js(world, `document.querySelector('[data-world-action=back]')?.click();document.querySelector('[data-world-action=refresh]')?.click()`);
    await wait(world, `!!document.querySelector('[data-kind=assignment][data-id="${assignmentId}"]')`);
    await js(world, `document.querySelector('[data-kind=assignment][data-id="${assignmentId}"]').click();document.querySelector('[data-world-action=start-game]').click()`);
    let frame;
    await until(async () => { frame = world.webContents.mainFrame.frames.find(f => f.url.includes(gamePath)); return !!frame; }, 'new game frame');
    const open = isTown ? 'reading-open' : 'listening-check', dialog = isTown ? 'reading-dialog' : 'listening-check-dialog';
    await wait(frame, `typeof document.getElementById('${open}')?.onclick==='function' && !document.getElementById('${open}').disabled`);
    await wait(world, `window.SYNKLearningHost?.status().complete===true`);
    await js(frame, `document.getElementById('${open}').click()`); await wait(frame, `document.getElementById('${dialog}').open`);
    if (label === 'town-detail-first') {
      world.setSize(390, 900); await delay(300);
      await js(world, `document.documentElement.style.scrollBehavior='auto';document.querySelector('#world-games iframe').scrollIntoView({behavior:'instant',block:'start'})`);
      await wait(world, `!document.querySelector('#world-games iframe').hidden && document.querySelector('#world-games iframe').getBoundingClientRect().top >= -1 && document.querySelector('#world-games iframe').getBoundingClientRect().top < 10`);
      fs.writeFileSync(path.join(output, 'targeted-town-mobile.png'), (await world.webContents.capturePage()).toPNG());
      check('Town-mobile-dialog-is-visible-and-does-not-overflow', await js(frame, `document.getElementById('reading-dialog').scrollWidth<=document.getElementById('reading-dialog').clientWidth+2`));
      world.setSize(1280, 1000); await delay(150);
    }
    const shown = [];
    for (let i = 0; i < target.requiredAttempts; i++) {
      const selector = isTown ? '#reading-choices button' : '#check-choices button';
      await wait(frame, `!!document.querySelector('${selector}:not(:disabled)')`);
      const id = await js(frame, `document.getElementById('${dialog}').dataset.item`), item = (isTown ? READING_CHECKS : LISTENING_CHECKS).find(row => row.id === id);
      if (!item) throw Error('Unknown authored question'); const metadata = isTown ? readingMetadata(item) : checkMetadata(item); shown.push(metadata.familyKey);
      check(`${label}-question-${i + 1}-matches-server-target`, target.skillId === metadata.skillId && target.difficulty === metadata.difficulty && target.familyKeys.includes(metadata.familyKey) && target.itemKeys.includes(metadata.itemKey));
      const answer = wrong ? (item.correct + 1) % item.choices.length : item.correct;
      await js(frame, `document.querySelectorAll('${selector}')[${answer}].click()`);
      const next = isTown ? 'reading-next' : 'check-next'; await wait(frame, `!document.getElementById('${next}').hidden`);
      if (i < target.requiredAttempts - 1) await js(frame, `document.getElementById('${next}').click()`);
    }
    await until(() => !!server.snapshot().submissions.find(row => row.assignmentId === assignmentId), 'actual answers delivered');
    const submission = server.snapshot().submissions.find(row => row.assignmentId === assignmentId);
    check(`${label}-three-valid-answers-reach-teacher`, submission.total === 3 && submission.correct === (wrong ? 0 : 3));
    check(`${label}-first-exposures-remain-independent`, submission.independent === 3);
    await js(world, `document.querySelector('[data-world-action=stop-game]')?.click()`); await delay(200);
    return shown;
  }
  for (const skill of ['detail', 'negation', 'sequence']) {
    const first = await play('town-reading', `ko.reading.${skill}`, 1, true, `town-${skill}-first`);
    const next = await play('town-reading', `ko.reading.${skill}`, 1, false, `town-${skill}-followup`);
    check(`town-${skill}-followup-uses-three-new-passages`, next.length === 3 && next.every(id => !first.includes(id)));
  }
  for (const skill of ['detail', 'negation', 'sequence']) await play('runner-listening', `ko.listening.${skill}`, skill === 'sequence' ? 2 : 1, false, `runner-${skill}`);
  const assignments = server.snapshot().assignments; check('all-nine-assigned-rounds-complete-with-27-real-answers', server.snapshot().submissions.length === 9 && assignments.length === 9);
} catch (error) { errors.push(error.stack || String(error)); }
finally { const result = { ok: !errors.length, isolated: true, checks, errors }; fs.writeFileSync(path.join(output, 'targeted-content-ui.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); for (const window of windows) window.destroy(); server?.close(); app.exit(result.ok ? 0 : 1); } });
