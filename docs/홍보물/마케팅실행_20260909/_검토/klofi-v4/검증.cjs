'use strict';

// File/string and isolated Node VM tests only. Never launches a browser or plays media.
// Writes only player-check.json beside this file; both collection copies are read-only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const collection = path.resolve(__dirname, '../..');
const repo = path.resolve(collection, '../../..');
const publicSource = path.resolve(repo, '../SYNK-marketing-share-20260909/source');
const reportPath = path.join(__dirname, 'player-check.json');
const checks = [];
const observations = [];
const title = '오늘 밤 제일 환한 사람';

async function check(scope, name, fn) {
  try {
    const detail = await fn();
    checks.push({scope, name, pass: true, ...(detail === undefined ? {} : {detail})});
  } catch (error) {
    checks.push({scope, name, pass: false, error: error.message});
  }
}

const read = filename => fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '');
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function attributes(tag) {
  const result = Object.create(null);
  const source = tag.replace(/^<[^\s>]+/, '').replace(/\/?>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(re)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function scriptsIn(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
}

function playerHarness(script, rejectPlay = false) {
  const callbacks = {film: Object.create(null), start: Object.create(null)};
  let playCalls = 0;
  const add = (target, type, callback) => {
    assert.equal(typeof callback, 'function');
    (callbacks[target][type] ||= []).push(callback);
  };
  const film = {
    muted: true, volume: 0.2, currentTime: 17,
    addEventListener(type, callback) { add('film', type, callback); },
    play() {
      playCalls++;
      return rejectPlay ? Promise.reject(new Error('Simulated playback denial')) : Promise.resolve();
    },
  };
  const status = {textContent: 'initial'};
  const start = {addEventListener(type, callback) { add('start', type, callback); }};
  const elements = {'listening-film': film, 'listen-status': status, 'listen-start': start};
  const context = vm.createContext({document: {
    getElementById(id) { assert.ok(elements[id], `Unexpected element: ${id}`); return elements[id]; },
  }}, {codeGeneration: {strings: false, wasm: false}});
  vm.runInContext(script, context, {timeout: 1000, filename: 'extracted-listening-player.js'});
  assert.equal(callbacks.start.click?.length, 1, 'Expected one click handler');
  assert.equal(callbacks.film.ended?.length, 1, 'Expected one ended handler');
  assert.equal(callbacks.film.error?.length, 1, 'Expected one error handler');
  assert.equal(playCalls, 0, 'Script must not start playback on load');
  return {film, status, playCalls: () => playCalls,
    click: () => callbacks.start.click[0](),
    ended: () => callbacks.film.ended[0](),
    error: () => callbacks.film.error[0](),
  };
}

async function checkSrt(scope, filename) {
  await check(scope, 'srt-full-duration-and-no-instrumental-claim', () => {
    const srt = read(filename);
    const cues = [...srt.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g)];
    assert.ok(cues.length > 0, 'No SRT cues');
    const seconds = (cue, offset) => Number(cue[offset]) * 3600 + Number(cue[offset + 1]) * 60 + Number(cue[offset + 2]) + Number(cue[offset + 3]) / 1000;
    assert.equal(seconds(cues[0], 1), 0, 'SRT must begin at the track start');
    assert.equal(seconds(cues.at(-1), 5), 61.6, 'SRT must end at 61.6 seconds');
    for (const cue of cues) assert.ok(seconds(cue, 1) < seconds(cue, 5) && seconds(cue, 5) <= 61.6, 'Invalid SRT cue interval');
    assert.ok(srt.includes(title), 'SRT title mismatch');
    assert.doesNotMatch(srt, /무\s*보컬|보컬\s*(?:없|없는|없이)|가사\s*(?:없|없는|없이)|instrumental|no\s+vocals|vocals?\s*free|үггүй|дуу\s*хоолойгүй/i);
    return {cues: cues.length, endSeconds: 61.6};
  });
}

async function checkPage(scope, directory, isPublic) {
  let html;
  await check(scope, 'html-readable', () => { html = read(path.join(directory, 'index.html')); });
  if (html === undefined) return;
  const scripts = scriptsIn(html);
  await check(scope, 'exactly-one-player-script', () => {
    assert.equal(scripts.length, 1, 'Expected exactly one inline script');
    assert.match(scripts[0], /listen-start/);
    assert.match(scripts[0], /listening-film/);
  });
  await check(scope, 'video-controls-without-muted-or-autoplay', () => {
    const videos = [...html.matchAll(/<video\b[^>]*>/gi)];
    assert.equal(videos.length, 1);
    const attrs = attributes(videos[0][0]);
    assert.equal(attrs.id, 'listening-film');
    assert.ok(Object.hasOwn(attrs, 'controls'));
    assert.ok(!Object.hasOwn(attrs, 'muted'));
    assert.ok(!Object.hasOwn(attrs, 'autoplay'));
    assert.match(attrs.src, /^video\.mp4(?:\?|$)/);
  });
  await check(scope, 'start-button-and-accessible-status', () => {
    const buttons = [...html.matchAll(/<button\b[^>]*>/gi)].map(x => attributes(x[0])).filter(x => x.id === 'listen-start');
    assert.equal(buttons.length, 1);
    const statusTag = [...html.matchAll(/<[^/!][^>]*>/g)].map(x => attributes(x[0])).find(x => x.id === 'listen-status');
    assert.equal(statusTag?.role, 'status');
  });
  await check(scope, 'title-and-61-6-second-copy', () => {
    assert.match(html, new RegExp(`<title>\\s*${escapeRe(title)}\\s*</title>`, 'i'));
    assert.match(html, new RegExp(`<h1>\\s*${escapeRe(title)}\\s*</h1>`, 'i'));
    assert.match(html, /61\.6초/);
    assert.match(html, /1분\s*1\.6초/);
  });
  await check(scope, 'note-link-and-note-title', () => {
    const links = [...html.matchAll(/<a\b[^>]*>/gi)].map(x => attributes(x[0]));
    assert.ok(links.some(x => decodeURIComponent(x.href || '').split(/[?#]/)[0] === '감상노트.md'));
    const note = read(path.join(directory, '감상노트.md'));
    assert.match(note, new RegExp(`^# ${escapeRe(title)}(?:\\r?\\n|$)`));
    assert.match(note, /61\.6초/);
  });
  if (isPublic) await check(scope, 'no-posting-guide-or-local-paths', () => {
    assert.doesNotMatch(html, /게시\s*준비|업로드안내\.md|계정\s*상태/);
    assert.doesNotMatch(html, /(?:\b[A-Za-z]:[\\/]|file:\/\/|\\\\localhost\\|\/Users\/|\/home\/)/i);
  });
  if (scripts.length === 1) {
    await check(scope, 'vm-success-unmutes-and-restarts', async () => {
      const h = playerHarness(scripts[0]);
      await h.click();
      assert.equal(h.playCalls(), 1);
      assert.equal(h.film.muted, false);
      assert.equal(h.film.volume, 1);
      assert.equal(h.film.currentTime, 0);
      assert.match(h.status.textContent, /전곡.*재생하고 있습니다/);
    });
    await check(scope, 'vm-denial-shows-manual-play-guidance', async () => {
      const h = playerHarness(scripts[0], true);
      await h.click();
      assert.equal(h.playCalls(), 1);
      assert.match(h.status.textContent, /플레이어의 재생 버튼/);
      assert.doesNotMatch(h.status.textContent, /재생하고 있습니다/);
    });
    await check(scope, 'vm-ended-offers-replay', () => {
      const h = playerHarness(scripts[0]); h.ended();
      assert.match(h.status.textContent, /한 곡이 끝났습니다/);
      assert.match(h.status.textContent, /다시/);
      assert.equal(h.playCalls(), 0);
    });
    await check(scope, 'vm-error-offers-download', () => {
      const h = playerHarness(scripts[0]); h.error();
      assert.match(h.status.textContent, /불러오지 못했습니다/);
      assert.match(h.status.textContent, /영상 받기 링크/);
      assert.equal(h.playCalls(), 0);
    });
  }
}

async function main() {
  await check('source', 'title-duration-and-new-mongolian-flag', () => {
    const data = JSON.parse(read(path.join(collection, '원고/콘텐츠원고.json')));
    const entry = data.items.find(item => item.id === '01-lab-youtube');
    assert.ok(entry, 'Missing 01-lab-youtube entry');
    assert.equal(entry.title, title);
    assert.equal(entry.music.title, title);
    assert.equal(entry.music.duration, 61.6);
    // These are the actual review-status fields, not a top-level item property.
    assert.equal(data.languageReview?.newMongolian, true, 'languageReview.newMongolian must be true');
    assert.equal(entry.languageStatus?.newMongolian, true, '01.languageStatus.newMongolian must be true');
  });
  await checkPage('generated', path.join(collection, '01-lab-youtube'), false);
  await checkPage('public', path.join(publicSource, '01-lab-youtube'), true);
  await checkSrt('generated', path.join(collection, '01-lab-youtube/자막.srt'));
  const publicSrt = path.join(publicSource, '01-lab-youtube/자막.srt');
  if (fs.existsSync(publicSrt)) await checkSrt('public', publicSrt);
  else observations.push('Public SRT is not distributed; generated SRT is required and checked.');
  await check('copies', 'same-player-script', () => {
    const generated = scriptsIn(read(path.join(collection, '01-lab-youtube/index.html')));
    const published = scriptsIn(read(path.join(publicSource, '01-lab-youtube/index.html')));
    assert.deepEqual(published, generated);
  });
}

main().catch(error => checks.push({scope: 'runner', name: 'unexpected-error', pass: false, error: error.message})).finally(() => {
  const failed = checks.filter(item => !item.pass);
  const report = {checkedAt: new Date().toISOString(), pass: failed.length === 0,
    method: 'File/string assertions and isolated Node VM with stubbed DOM and play Promise',
    browserQA: false, realMediaPlayback: false, screenshots: false, mediaHashOrFrameQARepeated: false,
    summary: {total: checks.length, passed: checks.length - failed.length, failed: failed.length}, observations, checks};
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({report: path.relative(repo, reportPath), ...report.summary, pass: report.pass, failures: failed}, null, 2));
  process.exitCode = report.pass ? 0 : 1;
});
