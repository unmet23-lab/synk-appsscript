'use strict';

// Static HTML/source assertions + isolated Node VM. No browser, Sites checkout,
// media playback, screenshots, or source mutations. Only menu-check.json is written.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const collection = path.resolve(__dirname, '../..');
const repo = path.resolve(collection, '../../..');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const checks = [];
const reportFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'menu-check.json');

async function check(scope, name, callback) {
  try { const detail = await callback(); checks.push({scope, name, pass: true, ...(detail === undefined ? {} : {detail})}); }
  catch (error) { checks.push({scope, name, pass: false, error: error.message}); }
}
function attrs(tag) {
  const out = Object.create(null);
  for (const m of tag.replace(/^<[^\s>]+/, '').replace(/\/?>$/, '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map(m => attrs(m[0]));
const scripts = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const radioScripts = html => scripts(html).filter(s => /getElementById\(['"]radio-room['"]\)/.test(s));
const dialogBlock = html => html.match(/<dialog\b[^>]*id="radio-room"[^>]*>[\s\S]*?<\/dialog>/i)?.[0];

// Execute the exact existing sanitizer snippets with in-memory read/write stubs.
// Never import its top-level module, which owns filesystem copy operations.
function sanitizedCopies(home, detail) {
  const code = read(path.join(collection, '_검토/공유준비.cjs'));
  const preStart = code.indexOf('const excluded=');
  const homeStart = code.indexOf("let home=clean(read('index.html'));");
  const homeEnd = code.indexOf('const ids=', homeStart);
  const detailStart = code.indexOf(" let s=read(id+'/index.html');");
  const endMarker = "write(id+'/index.html',s);";
  const detailEnd = code.indexOf(endMarker, detailStart) + endMarker.length;
  assert.ok(preStart >= 0 && homeStart > preStart && homeEnd > homeStart && detailStart > homeEnd && detailEnd > detailStart, 'Sanitizer layout changed; review extraction before use');
  const outputs = {};
  const inputs = {'index.html': home, '01-lab-youtube/index.html': detail};
  const context = vm.createContext({
    read(name) { assert.ok(Object.hasOwn(inputs, name), `Unexpected sanitizer read: ${name}`); return inputs[name]; },
    write(name, value) { assert.ok(Object.hasOwn(inputs, name), `Unexpected sanitizer write: ${name}`); outputs[name] = value; },
    copy(name) { assert.equal(name, 'execution.css'); },
  }, {codeGeneration: {strings: false, wasm: false}});
  vm.runInContext(code.slice(preStart, homeStart) + code.slice(homeStart, homeEnd) + "\nconst id='01-lab-youtube';\n" + code.slice(detailStart, detailEnd), context, {timeout: 1000});
  return {home: outputs['index.html'], detail: outputs['01-lab-youtube/index.html']};
}

function harness(html, options = {}) {
  const radio = radioScripts(html);
  assert.equal(radio.length, 1);
  let focus = null;
  const target = name => ({name, listeners: Object.create(null), focusCount: 0,
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    emit(type, event = {}) { return (this.listeners[type] || []).map(fn => fn(event)); },
    async trigger(type, event = {}) { await Promise.all(this.emit(type, event)); },
    focus() { this.focusCount++; focus = this; },
  });
  const videos = tags(html, 'video').map((a, i) => {
    const v = Object.assign(target(a.id || `video-${i}`), {id: a.id, paused: true, muted: true, volume: 0.2, currentTime: 17, playCalls: 0, pauseCalls: 0});
    v.pause = () => { v.paused = true; v.pauseCalls++; };
    v.play = () => {
      v.playCalls++;
      if (options.reject && v.id === 'listening-film') return Promise.reject(new Error('Simulated playback denial'));
      v.paused = false; v.emit('play');
      if (options.pending && v.id === 'listening-film') return new Promise(resolve => { v.resolvePlay = resolve; });
      return Promise.resolve();
    };
    return v;
  });
  const film = videos.find(v => v.id === 'listening-film');
  assert.ok(film);
  const room = Object.assign(target('room'), {open: false, modalCalls: 0});
  room.showModal = () => { room.open = true; room.modalCalls++; };
  room.close = () => { if (room.open) { room.open = false; room.emit('close'); } };
  // Model native dialog cancel -> default close, not a real browser Escape test.
  room.escape = () => {
    const event = {defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }};
    room.emit('cancel', event);
    if (!event.defaultPrevented) room.close();
  };
  const openers = tags(html, 'button').filter(a => Object.hasOwn(a, 'data-radio-open')).map((a, i) => target(`opener-${i}`));
  const close = target('close'), start = target('start'), status = {textContent: 'initial'};
  const ids = {'radio-room': room, 'listening-film': film, 'listen-status': status, 'listen-start': start, 'radio-close': close};
  const context = vm.createContext({document: {
    getElementById(id) { assert.ok(ids[id], `Unexpected element ${id}`); return ids[id]; },
    querySelectorAll(selector) { if (selector === 'video') return videos; if (selector === '[data-radio-open]') return openers; throw Error(`Unexpected selector ${selector}`); },
  }}, {codeGeneration: {strings: false, wasm: false}});
  vm.runInContext(radio[0], context, {timeout: 1000, filename: 'extracted-radio-menu.js'});
  return {room, film, videos, others: videos.filter(v => v !== film), openers, close, start, status, focus: () => focus};
}

async function pageChecks(scope, html, kind, canonicalScript) {
  await check(scope, 'one-current-radio-script-and-closed-native-dialog', () => {
    assert.deepEqual(radioScripts(html), [canonicalScript]);
    const rooms = tags(html, 'dialog'); assert.equal(rooms.length, 1);
    assert.equal(rooms[0].id, 'radio-room'); assert.equal(rooms[0]['aria-labelledby'], 'radio-title');
    assert.ok(!Object.hasOwn(rooms[0], 'open'));
    const close = tags(html, 'button').find(a => a.id === 'radio-close');
    assert.ok(close && Object.hasOwn(close, 'autofocus'));
  });
  await check(scope, 'radio-film-and-cover-only-inside-dialog', () => {
    const dialog = dialogBlock(html); assert.ok(dialog);
    const inside = tags(dialog, 'video'); assert.equal(inside.length, 1); assert.equal(inside[0].id, 'listening-film');
    assert.equal(inside[0].preload, 'none'); assert.ok(Object.hasOwn(inside[0], 'controls'));
    const outside = html.replace(dialog, '');
    assert.ok(!tags(outside, 'video').some(a => a.id === 'listening-film'));
    assert.ok(!tags(outside, 'img').some(a => kind === 'home' ? /^01-lab-youtube\//.test(a.src || '') : /upload-\d+\.jpg/.test(a.src || '')));
  });
  await check(scope, 'all-video-controls-none-preload-no-autoplay', () => {
    for (const a of tags(html, 'video')) { assert.ok(Object.hasOwn(a, 'controls')); assert.equal(a.preload, 'none'); assert.ok(!Object.hasOwn(a, 'autoplay')); assert.ok(!Object.hasOwn(a, 'muted')); }
  });
  await check(scope, 'menu-button-labels-targets-and-status', () => {
    const buttons = tags(html, 'button').filter(a => Object.hasOwn(a, 'data-radio-open'));
    assert.ok(buttons.length > 0);
    for (const a of buttons) { assert.equal(a['aria-haspopup'], 'dialog'); assert.equal(a['aria-controls'], 'radio-room'); assert.equal(a.type, 'button'); }
    assert.match(html, /id="listen-status" role="status"/);
    assert.match(dialogBlock(html), /오늘 밤 제일 환한 사람/);
    assert.match(dialogBlock(html), /1분 1\.6초/);
  });
  await check(scope, 'vm-load-and-menu-open-never-autoplay', async () => {
    const h = harness(html); assert.equal(h.room.open, false); assert.ok(h.videos.every(v => v.playCalls === 0));
    h.others.forEach(v => { v.paused = false; });
    await h.openers[0].trigger('click');
    assert.equal(h.room.open, true); assert.equal(h.room.modalCalls, 1);
    assert.ok(h.videos.every(v => v.playCalls === 0)); assert.ok(h.others.every(v => v.paused));
  });
  await check(scope, 'vm-play-success-and-close-button-pause-focus', async () => {
    const h = harness(html); const opener = h.openers.at(-1);
    await opener.trigger('click'); await h.start.trigger('click');
    assert.equal(h.film.playCalls, 1); assert.equal(h.film.paused, false);
    assert.equal(h.film.muted, false); assert.equal(h.film.volume, 1); assert.equal(h.film.currentTime, 0);
    assert.match(h.status.textContent, /전곡.*재생하고 있습니다/);
    await h.close.trigger('click'); assert.equal(h.room.open, false); assert.equal(h.film.paused, true); assert.equal(h.focus(), opener);
  });
  await check(scope, 'vm-native-cancel-default-close-pause-focus', async () => {
    const h = harness(html); await h.openers[0].trigger('click'); await h.start.trigger('click');
    h.room.escape(); assert.equal(h.room.open, false); assert.equal(h.film.paused, true); assert.equal(h.focus(), h.openers[0]);
  });
  await check(scope, 'vm-play-denial-guidance', async () => {
    const h = harness(html, {reject: true}); await h.openers[0].trigger('click'); await h.start.trigger('click');
    assert.equal(h.film.playCalls, 1); assert.match(h.status.textContent, /플레이어의 재생 버튼/); assert.doesNotMatch(h.status.textContent, /재생하고 있습니다/);
  });
  await check(scope, 'vm-ended-and-error-guidance', async () => {
    const h = harness(html); await h.film.trigger('ended'); assert.match(h.status.textContent, /한 곡이 끝났습니다/);
    await h.film.trigger('error'); assert.match(h.status.textContent, /불러오지 못했습니다/); assert.match(h.status.textContent, /영상 받기 링크/);
  });
  await check(scope, 'vm-close-while-play-promise-pending', async () => {
    const h = harness(html, {pending: true}); await h.openers[0].trigger('click');
    const pending = h.start.trigger('click'); await h.close.trigger('click');
    h.film.resolvePlay(); await pending;
    assert.equal(h.film.paused, true); assert.equal(h.room.open, false); assert.equal(h.focus(), h.openers[0]); assert.doesNotMatch(h.status.textContent, /재생하고 있습니다/);
  });
  await check(scope, 'vm-closed-dialog-cannot-keep-radio-playing', async () => {
    const h = harness(html); await h.film.play(); assert.equal(h.film.paused, true);
  });
  await check(scope, 'vm-any-video-play-pauses-every-other-video', async () => {
    const h = harness(html); await h.openers[0].trigger('click');
    for (const active of h.videos) { await active.play(); assert.equal(active.paused, false); assert.ok(h.videos.filter(v => v !== active).every(v => v.paused), `Audio overlap after ${active.name}`); }
    return {videos: h.videos.length};
  });
  if (kind === 'home') await check(scope, 'intro-craft-film-and-19-account-entries-retained', () => {
    const header = html.match(/<header class="collection-intro">[\s\S]*?<\/header>/)?.[0]; assert.ok(header);
    const craft = tags(header, 'video').filter(a => a.id === 'craft-film'); assert.equal(craft.length, 1);
    assert.equal(craft[0].src, 'assets/craft-film-4k.mp4'); assert.equal(craft[0].preload, 'none'); assert.match(header, /4K/);
    assert.match(header, /기존 체험 일정 안내까지 담은 브랜드 필름 전체/);
    const entries = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(m => m[0]).filter(s => /\bentry\b/.test(attrs(s.match(/^<[^>]*>/)[0]).class || ''));
    assert.equal(entries.length, 19);
    const ids = JSON.parse(read(path.join(collection, '원고/콘텐츠원고.json'))).items.map(x => x.id); assert.equal(new Set(ids).size, 19);
    for (const id of ids) { assert.ok(entries.some(s => s.includes(`href="${id}/index.html"`)), `Missing account ${id}`); assert.ok(fs.existsSync(path.join(collection, id, 'index.html'))); }
    const radioEntry = entries.find(s => /\bradio-entry\b/.test(s)); assert.ok(radioEntry); assert.equal(tags(radioEntry, 'img').length, 0); assert.equal(tags(radioEntry, 'video').length, 0);
  });
}

async function main() {
  const home = read(path.join(collection, 'index.html'));
  const detail = read(path.join(collection, '01-lab-youtube/index.html'));
  const helper = require(path.join(collection, '감상메뉴.cjs'));
  const music = JSON.parse(read(path.join(collection, '원고/콘텐츠원고.json'))).items.find(x => x.id === '01-lab-youtube').music;
  const canonicalScript = radioScripts(helper.detail('<video id="listening-film"></video><h2>지금 흐르는 한 곡</h2><h2>게시 준비</h2>', music))[0]; assert.ok(canonicalScript);
  await pageChecks('generated-home', home, 'home', canonicalScript);
  await pageChecks('generated-detail', detail, 'detail', canonicalScript);
  let sanitized;
  await check('sanitizer', 'execute-exact-clean-and-cut-in-memory', () => { sanitized = sanitizedCopies(home, detail); assert.ok(sanitized.home && sanitized.detail); });
  if (sanitized) {
    await pageChecks('sanitized-home-in-memory', sanitized.home, 'home', canonicalScript);
    await pageChecks('sanitized-detail-in-memory', sanitized.detail, 'detail', canonicalScript);
    await check('sanitizer', 'private-guide-removed-dialog-script-survives', () => {
      assert.doesNotMatch(sanitized.detail, /게시 준비|업로드안내\.md|\b[A-Za-z]:[\\/]/);
      assert.deepEqual(radioScripts(sanitized.home), radioScripts(home)); assert.deepEqual(radioScripts(sanitized.detail), radioScripts(detail));
    });
  }
  await check('styles', 'new-presentation-css-stays-in-loom', () => {
    const source = read(path.join(collection, '감상메뉴.cjs'));
    assert.doesNotMatch(source, /<style\b|\sstyle=/i);
    assert.doesNotMatch(home + detail, /<style\b/i);
    const loom = require(path.join(repo, 'tools/lib/loom.js'));
    assert.ok(read(path.join(collection, 'execution.css')).includes(loom.마케팅실행().trim()), 'Generated CSS differs from current Loom');
    const css = loom.마케팅실행();
    assert.match(css, /\.radio-room:not\(\[open\]\)\{display:none\}/);
    assert.match(css, /button\.download\{[^}]*min-height:44px/);
    assert.ok(css.includes(`.download:focus-visible{outline:2px solid ${loom.정본().색['Coral 3']}`), 'Light-surface focus ring must use canonical Coral 3');
    assert.match(css, /max-height:calc\(100dvh - 32px\)/);
    assert.match(css, /@media\(max-width:900px\).*?intro-feature\{grid-template-columns:1fr/);
  });
}

main().catch(error => checks.push({scope: 'runner', name: 'unexpected-error', pass: false, error: error.message})).finally(() => {
  const failures = checks.filter(c => !c.pass);
  const report = {checkedAt: new Date().toISOString(), pass: failures.length === 0,
    method: 'Static HTML/source assertions and Node VM; exact sanitizer snippets evaluated with in-memory IO stubs',
    browserQA: false, nativeEscapeTestedInBrowser: false, realMediaPlayback: false, screenshots: false, sitesCheckoutAccessed: false,
    interfaceReview: {
      mode: 'full-with-requested-read-only-boundary', framework: 'Generated HTML and native dialog', styling: 'Existing Loom CSS only',
      coverage: [
        {category: 'Typography', evidence: 'Loom diff: inherited fonts and responsive title sizes', result: 'No new font system; actual wrapping and readability unverified'},
        {category: 'Surfaces', evidence: 'Loom diff and static checks: dialog size/overflow, 44px button, Coral 3 focus ring', result: 'No remaining actionable source finding; rendered hit areas unverified'},
        {category: 'Animations', evidence: 'No new CSS animation; dialog close and media play states modeled in VM', result: 'No animation introduced; native keyboard and focus trap unverified'},
        {category: 'Icons', evidence: 'Text-labeled open/close controls; no new custom icon set', result: 'No applicable icon change'},
        {category: 'Performance', evidence: 'All video preload=none, autoplay absent, mutual pause and closed-room guards', result: 'VM/static checks recorded below; network and media load unverified'},
      ],
      consideredButRejected: [
        {candidate: 'Add a custom Escape key handler', reason: 'Native dialog cancel/default-close already reaches the close handler; duplicating keyboard handling is unnecessary'},
        {candidate: 'Animate the dialog or autoplay the intro', reason: 'The requested menu is deliberately closed and silent until user action; extra motion is outside scope'},
      ],
      verdict: failures.length ? 'Needs changes within tested scope' : 'Approve within static and VM scope only',
    },
    limitations: ['Escape uses a modeled native cancel/default-close sequence; actual browser focus trap and keyboard behavior are unverified.', 'Media bytes, 4K resolution, full film content, playback/download behavior and visual layout are not tested here.'],
    summary: {total: checks.length, passed: checks.length - failures.length, failed: failures.length}, checks};
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({report: path.relative(repo, reportFile), ...report.summary, pass: report.pass, failures}, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
