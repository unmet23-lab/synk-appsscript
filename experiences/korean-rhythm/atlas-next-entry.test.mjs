// 말의 리듬 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs 본문을 가짜 DOM에서 돌린다(app-learning.test.mjs와 같은
// 틀 — 소리 · 무대 그리기만 가짜, 동적 import 한 자리만 시험의 싣개로 바꾼다).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 때(모듈 첫 실행) 불리고, 옛 코치에 닿는 차례가 4-6d 앞의 app.mjs와
//            같다(짓는 때 원래 파일과 이 파일을 같은 틀에서 돌려 견준 값). 새 길 모듈을 싣지 않는다.
//   문이 있고 open이 null이면 기다린 뒤 옛 길로 정상 시작, RUN_ENDED면 옛 길을 열지 않고 안내 없이 논다.
//   문이 진짜 엔진 코치를 주면 그 겉으로 연다 — 입구의 추천 곡과 이유 한 줄, 곡 하나(제시 · 전달 · 도움 · 답 · 순간 맞춤 · 판 끝), 새 문장 확인.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { TRACKS, LEVELS, RoundState } from './core.mjs';
import { rhythmItem, RHYTHM_CANDIDATES, assignmentTracks, assignmentTrack, rhythmTargetLabel, FLOW_RHYTHM, timingObservation, timingSummary, nextTrackLine, missedRhythm, returnLine } from './personalization.mjs';
import { rhythmSupport } from '../brand-opening/game-tutor-support.mjs';
import { createSupplementalPanel } from './supplemental-player.mjs';
import { josa } from './kit/josa.mjs';
import { nextDoor, devFlag, ended } from './kit/atlas-next.mjs';
import { createGameDoor } from '../synk-world-app/world-atlas-game.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata');
const strata = createMap(require('../../strata/maps/topik-i.json'));
const atlas = await import('../../packages/atlas/src/index.mjs');
const readJson = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const INDEX = readJson('../../packages/atlas/map/index.json');
const UNITS = readJson('../../packages/atlas/map/units.json');
const WORDS = readJson('../../packages/atlas/map/words.json');

const SOURCE = fs.readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const LOADER = "import('./atlas-next-play.mjs')";
const BODY = SOURCE.replace(LOADER, '__loadNext()');
const APP = `(async()=>{'use strict';${BODY.replace(/^import .*;$/gm, '')}\n})()`;
const IMPORTED = [...SOURCE.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'[^']+';$/gm)].flatMap(m => m[1].split(',').map(name => name.trim()).filter(Boolean));

// 무엇이든 받아 주는 DOM 조각 — 쓴 값은 남고(textContent · hidden · classList), 단추의 click은 건 함수를 부른다.
function element(tag = 'div') {
  const classes = new Set();
  return {
    tag, children: [], dataset: {}, style: {}, listeners: new Map(), textContent: '', innerHTML: '', hidden: false, disabled: false, open: false,
    classList: { add: (...n) => n.forEach(x => classes.add(x)), remove: (...n) => n.forEach(x => classes.delete(x)), toggle: (n, on) => ((on ?? !classes.has(n)) ? classes.add(n) : classes.delete(n)), contains: n => classes.has(n) },
    setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], querySelector: () => element(), focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
    addEventListener(name, fn) { this.listeners.set(name, fn); }, append(...c) { this.children.push(...c); }, after() {}, prepend() {}, replaceChildren(...c) { this.children = c; },
    click() { return this.listeners.get('click')?.({ detail: 1 }); }, scrollIntoView() {},
  };
}
const storageOf = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };

// 옛 코치(진짜 옛 엔진)를 지켜본다 — 부른 메서드 이름과 syncPort 읽기를 차례대로 적는다.
function watchedOld(log) {
  const real = createGame({ gameId: 'korean-rhythm', map: strata, storage: storageOf() });
  return new Proxy(real, {
    get(target, name) {
      const value = target[name];
      if (name === 'syncPort') log.push('syncPort');
      if (typeof value !== 'function') return value;
      return (...args) => { log.push(name); return value.apply(target, args); };
    },
  });
}

// 소리 · 무대 흉내 — 곡의 시각은 시험이 정하고, 문장 소리가 끝나는 때 전달을 알린다(audio.mjs의 onDelivery와 같은 꼴).
class FakeMusic {
  constructor({ onDelivery }) { this.onDelivery = onDelivery; this.time = -5; this.state = 'running'; this.enabled = true; this.questions = []; this.reviews = []; FakeMusic.last = this; }
  prepare(_track, questions) { this.questions = questions; return Promise.resolve('buffer'); }
  start() {} stop() {} hit() {} setSound() {} seek() {}
  pause() { return Promise.resolve(); } resume() { return Promise.resolve(); }
  review(voice) { this.reviews.push(voice); return FakeMusic.failReview-- > 0 ? Promise.reject(new Error('끊김')) : Promise.resolve(); }
  get context() { return null; }
}
class FakeStage { constructor() { this.ready = Promise.resolve(); this.frames = 0; } resize() {} draw() {} reset() {} hit() {} judgeAt() { return null; } }

let boots = 0;
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). search: 주소의 물음(?qa — 자동 치기 고리).
// wait: false면 본문이 끝나기를 기다리지 않고 돌려준다(done — 코치를 받는 동안의 입구를 본다).
async function boot({ door = null, search = '', load = () => import('./atlas-next-play.mjs'), wait = true } = {}) {
  boots += 1;
  const log = [];
  const created = [];
  const loads = [];
  const elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const document = { getElementById: $, createElement: tag => element(tag), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: element(), documentElement: { dataset: {} } };
  const storage = storageOf();
  const frames = [];
  const listeners = [];
  const old = watchedOld(log);
  const up = door ? { SYNKAtlasGame: door } : undefined;
  let perf = 1000;
  const context = {
    TRACKS, LEVELS, RoundState, rhythmItem, RHYTHM_CANDIDATES, missedRhythm, returnLine, assignmentTracks, assignmentTrack, rhythmTargetLabel,
    FLOW_RHYTHM, timingObservation, timingSummary, nextTrackLine, rhythmSupport, josa, nextDoor, devFlag, ended, recordTrialStarted() {},
    createSupplementalPanel: options => createSupplementalPanel({ ...options, document, audioFactory: () => ({ pause() {}, play: async () => {} }) }),
    MusicPlayer: FakeMusic, Stage: FakeStage, document, localStorage: storage, location: { hostname: 'synk.im', search, pathname: '/korean-rhythm/' },
    parent: up, top: up,
    SynkLearning: { createGame: options => { log.push('createGame'); created.push(options); return old; } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); }, status: () => ({}) },
    __loadNext: () => { loads.push('atlas-next-play'); return load(); },
    matchMedia: () => ({ matches: false }), setTimeout: () => 1, clearTimeout() {}, scrollTo() {}, confirm: () => true, console,
    addEventListener: (type, fn) => listeners.push([type, fn]), requestAnimationFrame: fn => (frames.push(fn), frames.length), cancelAnimationFrame() {},
    performance: { now: () => perf }, crypto: { getRandomValues: a => { a[0] = 20261119 + boots; return a; } }, AudioContext: class {},
  };
  context.window = context;
  assert.deepEqual(IMPORTED.filter(name => !(name in context)), [], 'app.mjs가 부르는 이름을 이 틀이 준다');
  const done = vm.runInNewContext(APP, context, { filename: 'korean-rhythm/app.mjs' });
  if (wait) await done;
  // 곡 하나를 끝까지 돌린다(?qa 자동 치기 — plan: 문장마다 right · wrong · none). texted: 글로 볼 문장 번호.
  async function playSong({ plan, texted = new Set() } = {}) {
    await $('start-button').click();
    const music = FakeMusic.last;
    const round = context.__rhythm;
    round.autoplay(true); round.plan(plan);
    const sent = new Set();
    for (let t = -2; frames.length; t += 0.05) {
      music.time = t; perf += 50;
      for (const q of music.questions) if (!sent.has(q) && t >= q.voiceEnd) { sent.add(q); music.onDelivery(q, { audio: 'completed' }); }
      const frame = frames.pop(); frames.length = 0;
      frame(perf);
      const active = context.synkRhythm.snapshot().questions?.findIndex(q => t >= q.showTime && t < q.voiceEnd && q.state === 'pending');
      if (active >= 0 && texted.has(active)) { texted.delete(active); $('q-text-btn').click(); }
      if (t > 600) throw new Error('곡이 끝나지 않는다');
    }
    return music;
  }
  return { log, created, loads, $, storage, listeners, context, playSong, done };
}

// 4-6d 앞의 app.mjs가 시작할 때 옛 코치에 닿는 차례(같은 틀 · 빈 기록에서 잰 값 — 끝의 만남 읽기는 며칠 뒤 확인 대화와 같은 출처 대화).
const OLD_START = ['account.ready', 'createGame', 'syncPort', 'recommend', 'summary', 'events', 'summary', 'summary', 'events', 'followups', ...Array(34).fill('exposure')];

test('app.mjs 원문 — 키트만 정적으로 싣고, 새 길 모듈은 문 · 개발 깃발이 있을 때 한 자리에서 동적으로 싣는다. 옛 코치는 지금 인수 그대로', () => {
  const statics = [...SOURCE.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map(m => m[1]);
  assert.ok(statics.includes('./kit/atlas-next.mjs'), '키트는 정적으로(맨 위는 정의뿐)');
  assert.ok(!statics.some(s => s.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  const code = SOURCE.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.equal(code.match(/atlas-next-play/g).length, 1, '새 길 모듈을 부르는 자리는 하나');
  assert.equal(code.split(LOADER).length, 2, '그 자리는 동적 import');
  assert.ok(!SOURCE.includes("'/atlas/"), '게임은 입구를 스스로 부르지 않는다(개발 깃발 길은 키트가)');
  assert.equal(SOURCE.match(/createGame\(/g).length, 1);
  assert.ok(SOURCE.includes("coach = globalThis.SynkLearning?.createGame({ gameId: 'korean-rhythm', storage: localStorage, followups:true }) || null;"), '옛 코치는 지금 인수 그대로');
  assert.ok(SOURCE.includes('if (atlasNext) nextOpening = openNextCoach(); else openOldCoach();'), '문이 없으면 그 자리에서 동기로');
});

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고 새 길 모듈을 싣지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, OLD_START);
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage', 'followups']);
  assert.equal(page.created[0].gameId, 'korean-rhythm');
  assert.equal(page.created[0].storage, page.storage, '이 창의 localStorage');
  assert.equal(page.created[0].followups, true);
  assert.deepEqual(page.loads, [], '새 길 모듈을 싣지 않는다');
  assert.equal(page.$('reset-learning').hidden, false, '꺼진 판은 기록 지우기를 그대로 둔다');
  assert.match(page.$('learning-scope').textContent, /이 브라우저에 저장돼요/);
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const page = await boot({ door: { open: async request => { asked.push(request); return null; } } });
  assert.deepEqual(asked, [{ gameId: 'korean-rhythm', banks: ['korean-rhythm'] }]);
  assert.deepEqual(page.loads, ['atlas-next-play'], '문이 있을 때만 새 길 모듈을 부른다');
  assert.deepEqual(page.log, OLD_START, '옛 길은 지금과 같은 차례');
  assert.equal(page.created[0].storage, page.storage);
  assert.ok(page.$('recommendation-reason').textContent.length > 0, '입구의 추천 안내를 그린다');
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 논다 — 다른 실패도 옛 길을 열지 않는다', async () => {
  // 셸 창의 오류는 틀에서 instanceof Error가 거짓이다 — 코드만 있는 객체로 흉내 낸다.
  const page = await boot({ door: { open: async () => { throw { code: 'RUN_ENDED' }; } } });
  assert.deepEqual(page.log, ['account.ready'], '위 창의 옛 학습 호스트(createGame)를 부르지 않는다');
  assert.equal(page.$('learning-scope').textContent, '', '「학습 기록을 연결하지 못했어요」 안내도 없다');
  assert.equal(page.$('recommendation-reason').textContent, '');
  assert.equal(page.$('reset-learning').hidden, true);
  const broken = await boot({ door: { open: async () => { throw { code: 'MAP_FAILED' }; } } });
  assert.deepEqual(broken.log, ['account.ready'], '새 길로 정해진 판에 옛 길을 열지 않는다');
  assert.match(broken.$('learning-scope').textContent, /연결하지 못했어요/);
});

// 진짜 엔진 코치(손님 · 메모리 저장소)를 가짜 입구로 셸의 문에 넣는다 — 부른 차례와 인수 · 결과를 적는다.
const COACH_METHODS = ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'];
let stores = 0;
// startSet: 코치 판 열기 첩자를 둔다(지금 엔진에는 없다 — 설계 주인 11-19 밤에 승인한 꼴: { opened, setId }). 적기만 하고 판은 첫 제시가 연다.
async function shellCoach({ startSet = false } = {}) {
  stores += 1;
  const clock = { t: Date.UTC(2026, 10, 19, 1) };
  const port = atlas.memoryPort();
  const coach = atlas.createCoach({
    gameId: 'korean-rhythm', mapData: { index: INDEX, units: UNITS, words: WORDS }, dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:korean-rhythm-entry-${process.pid}-${stores}`, now: () => clock.t },
  });
  await coach.ready;
  const calls = [];
  const spy = { calls };
  for (const name of COACH_METHODS) spy[name] = (...args) => { const row = [name, args]; calls.push(row); row.push(coach[name](...args)); return row[2]; };
  if (startSet) spy.startSet = (options) => { const row = ['startSet', [options], { opened: true, setId: `spy-${calls.length}` }]; calls.push(row); return row[2]; };
  // 가짜 입구 — 판을 다시 정하면(retire) 그 코치의 겉이 닫힌다(셸 world-atlas-next.mjs retired).
  const retirers = new Map();
  const entry = {
    asked: 0,
    gameCoach: async () => { entry.asked += 1; return spy; },
    retired: (made, fn) => { retirers.set(made, fn); return () => retirers.delete(made); },
    retire: () => retirers.get(spy)?.({ reason: 'account' }),
  };
  const door = createGameDoor({ entry, gameId: 'korean-rhythm', later: fn => fn() });
  const events = async () => { await coach.finishSet({ record: false }).folded; return (await port.read()).filter(row => row.value?.kind === 'event').map(row => row.value.event); };
  return { coach, spy, calls, door, entry, clock, events };
}

test('문이 진짜 코치를 주면 그 겉으로 연다 — 옛 코치 없음, 추천 곡은 곡 문항 전체에서 고른 문항이 든 곡, 이유는 코치의 한 줄', async () => {
  const shell = await shellCoach();
  const page = await boot({ door: shell.door.api });
  assert.equal(page.created.length, 0, '새 길이면 옛 코치를 만들지 않는다');
  assert.deepEqual(page.log, ['account.ready']);
  const recommends = shell.calls.filter(([name]) => name === 'recommend');
  assert.ok(recommends.length >= 1);
  const [, [items, options], result] = recommends.at(-1);
  assert.equal(items.length, 30, '곡 셋 × 문장 다섯 × 주장 변형 둘');
  assert.deepEqual(options, { set: { length: 5, newLimit: 15 } }, '곡 하나가 판 하나(5) · 새것 한도 3n');
  assert.equal(result.status, 'ready');
  assert.equal(page.context.synkRhythm.snapshot().track, Number(result.selected.itemKey.match(/:t(\d)q/)[1]), '고른 문항이 든 곡을 고른다');
  assert.equal(page.$('recommendation-reason').textContent, result.why.line);
  assert.equal(page.$('reset-learning').hidden, true, '새 길은 기록 지우기를 쓰지 않는다');
  assert.ok(!shell.calls.some(([name]) => name === 'present'), '입구는 고르기만 한다');
  shell.door.dispose();
});

test('코치를 받는 동안 — 곡 고르기와 단추는 먼저 서고, 추천 · 기록 안내는 비고, 기록 지우기는 숨는다(코치를 부르지 않는다)', async () => {
  const shell = await shellCoach();
  let release;
  const gate = new Promise(resolve => (release = resolve));
  const door = { open: async request => { await gate; return shell.door.api.open(request); } };
  const page = await boot({ door, wait: false });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(page.$('track-grid').children.length, TRACKS.length, '곡 고르기는 먼저 그린다');
  assert.ok(page.$('start-button').listeners.has('click'), '시작 단추는 먼저 선다');
  assert.equal(page.$('recommendation-reason').textContent, '');
  assert.equal(page.$('learning-scope').textContent, '');
  assert.equal(page.$('reset-learning').hidden, true);
  assert.deepEqual(shell.calls, [], '받기 전에는 코치를 부르지 않는다');
  assert.deepEqual(page.log, ['account.ready']);
  release();
  await page.done;
  const [, , result] = shell.calls.find(([name]) => name === 'recommend');
  assert.equal(page.$('recommendation-reason').textContent, result.why.line, '받은 뒤 추천과 이유를 그린다');
  assert.match(page.$('learning-scope').textContent, /WORLD 계정/);
  shell.door.dispose();
});

test('판을 다시 정하면 그 곡은 기록 없이 잇고, 다음 곡을 열 때 문을 다시 연다 — 새 겉이면 다시 기록한다', async () => {
  const shell = await shellCoach();
  const page = await boot({ door: shell.door.api, search: '?qa' });
  assert.equal(shell.entry.asked, 1);
  shell.entry.retire();
  const count = shell.calls.length;
  page.$('back-button').click(); // 입구를 다시 그려도 닫힌 겉은 부르지 않는다
  assert.equal(shell.calls.length, count);
  assert.equal(page.$('recommendation-reason').textContent, '');
  await page.playSong({ plan: ['right', 'right', 'right', 'right', 'right'] });
  assert.equal(shell.entry.asked, 2, '다음 곡을 열 때 문을 다시 연다');
  const song = shell.calls.slice(count).map(([name]) => name);
  // 코치를 받는 사이 지은 보면(게임 차례) — 첫 문장 앞에서 앞 판을 닫고 이 곡의 판을 연다.
  assert.deepEqual(song.slice(0, 4), ['live', 'itemUnits', 'finishSet', 'recommend']);
  assert.equal(song.filter(name => name === 'present').length, 5, 'retire 뒤 다음 곡도 다시 기록된다');
  assert.equal(song.filter(name => name === 'answer').length, 5);
  shell.door.dispose();
});

test('새 길로 곡 하나 — 문장마다 낸 변형 · 제시 · 전달 · 도움 · 답의 차례, 박자만 순간 맞춤, 곡 끝 finishSet, 새 문장 확인의 다시 듣기는 도움', async () => {
  const shell = await shellCoach();
  const page = await boot({ door: shell.door.api, search: '?qa' });
  const before = shell.calls.length;
  const music = await page.playSong({ plan: ['right', 'wrong', 'none', 'right', 'right'], texted: new Set([3]) });
  const song = shell.calls.slice(before);
  const names = song.map(([name]) => name);
  const round = page.context.synkRhythm.snapshot();
  const questions = music.questions;
  assert.equal(questions.length, 5);

  // 곡을 열 때: 앞 판을 닫고 문장마다 주장 변형 둘 가운데 recommend — 고른 변형으로 보면을 짓는다.
  assert.deepEqual(song[0].slice(0, 2), ['finishSet', [{ record: false }]]);
  const planned = song.slice(1, 6);
  planned.forEach(([name, [items, options], result], i) => {
    assert.equal(name, 'recommend');
    assert.deepEqual(items.map(item => item.id), [`t${round.track}q${i}v0`, `t${round.track}q${i}v1`]);
    assert.deepEqual(options, { set: { length: 5, newLimit: 15 } });
    if (result.status !== 'none') assert.equal(questions[i].id, result.selected.id, '엔진이 고른 변형으로 보면을 짓는다');
  });

  // 박자는 제시 없이 관찰하고, 듣기 O·X 답은 순간 맞춤을 움직이지 않는다.
  assert.equal(names.filter(name => name === 'live').length, 1, '곡마다 순간 맞춤 하나(판정 폭)');
  const live = song.find(([name]) => name === 'live');
  assert.equal(live[1][0].id, 'korean-rhythm.timing');

  // 곡 안의 기록 — 문장마다 제시(그 앞에 그 문장 변형 둘의 recommend) · 전달 · (글로 보기) · 답 · 정답 보기.
  const rows = await shell.events();
  const shown = rows.filter(e => e.type === 'practice.presented');
  const songShown = shown.slice(0, 5);
  assert.deepEqual(songShown.map(e => e.itemKey), questions.map(q => rhythmItem(round.track, q).itemKey), '곡의 차례대로');
  assert.equal(new Set(songShown.map(e => e.setId)).size, 1, '곡 하나가 판 하나');
  for (const [i, e] of songShown.entries()) {
    const kids = rows.filter(x => x.presentationId === e.id);
    const kinds = kids.map(x => (x.type === 'practice.helped' ? `helped:${x.helpId}` : x.type));
    // 넷째 문장은 듣는 동안 「글로 보기」를 눌렀다(소리가 끝나기 전의 도움).
    assert.deepEqual(kinds, [...(i === 3 ? ['helped:text'] : []), 'practice.delivery', 'practice.attempted', 'helped:answer'], e.itemKey);
    const attempt = kids.find(x => x.type === 'practice.attempted');
    assert.equal(attempt.verdict, ['correct', 'incorrect', 'unassessed', 'correct', 'correct'][i], e.itemKey);
    if (i === 2) assert.equal(attempt.reason, 'unanswered');
    assert.ok(['adaptive', 'filler', 'host'].includes(e.arm));
  }
  // 낸 문장 앞의 recommend가 그 변형을 고르면 엔진이 고른 제시, 아니면 게임 차례(host).
  const confirms = song.filter(([name], at) => name === 'recommend' && song[at + 1]?.[0] === 'present');
  assert.equal(confirms.length, 5);
  confirms.forEach(([, , result], i) => {
    const engine = result.status !== 'none' && result.selected.itemKey === songShown[i].itemKey;
    assert.equal(songShown[i].arm === 'host', !engine, songShown[i].itemKey);
  });
  const lastAnswer = names.lastIndexOf('answer');
  const finished = names.indexOf('finishSet', 1);
  assert.deepEqual([names[lastAnswer + 1], finished], ['help', lastAnswer + 2], '곡 끝 — 마지막 답과 정답 보기 뒤에 판을 닫는다');
  assert.deepEqual(song[finished][1], [{ record: false }], '기록 없이(판 기록은 셸 몫)');
  assert.equal(names.filter(name => name === 'finishSet').length, 2, '곡을 열 때 앞 판 하나, 곡 끝 하나');

  // 판 끝 — 다음 곡 추천은 코치의 한 줄, 혼자 처음 맞힌 수는 근거가 선 뒤에 다시 쓴다.
  const nextAt = names.indexOf('recommend', finished);
  assert.ok(nextAt > finished, '판 끝에 다음 곡을 고른다');
  const next = song[nextAt][2];
  assert.equal(next.status, 'ready');
  assert.equal(page.$('r-next-reason').textContent, nextTrackLine(TRACKS[Number(next.selected.itemKey.match(/:t(\d)q/)[1])].title, next.why.line));
  await new Promise(resolve => setTimeout(resolve, 20));
  // 처음 만난 문장에 도움 없이 낸 판정된 답 — 첫째(맞음) · 둘째(틀림) · 다섯째(맞음). 셋째는 답하지 않았고, 넷째는 글로 본 뒤의 답이다.
  // 그 수는 저장 뒤 근거가 서야 알므로 판 끝에서 근거를 기다렸다가 다시 쓴다.
  assert.match(page.$('result-learning-note').textContent, /새로 답한 3개/);

  // 새 문장 확인 — 소리가 끊기면 「다시 듣기」는 같은 제시의 도움(replay)이고, 답은 한 번.
  FakeMusic.failReview = 1;
  const count = shell.calls.length;
  await page.$('recall-button').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(page.$('recall-button').textContent, '다시 듣기');
  await page.$('recall-button').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  page.$('recall-options').children[0].click();
  const recall = shell.calls.slice(count).map(([name, args]) => [name, name === 'help' ? args[1] : name === 'delivery' ? args[1].audio : undefined]);
  // 새 문장 확인은 정해진 판 — 첫 제시 앞에서 앞 판(판 끝의 다음 곡 고르기가 연 판)을 닫고 판 길이(은행에 있는 확인 문장 수)를 센다.
  // 지금 엔진에는 startSet이 없어 첫 제시가 코치의 기본 판을 연다.
  assert.deepEqual(recall.filter(([name]) => name !== 'recommend' && name !== 'summary' && name !== 'due'), [
    ['finishSet', undefined], ...Array(5).fill(['itemUnits', undefined]),
    ['itemUnits', undefined], ['present', undefined], ['delivery', 'failed'], ['help', 'replay'], ['delivery', 'completed'], ['answer', undefined], ['help', 'answer'],
  ]);
  // 판이 도는 동안 입구의 추천 곡은 판 옵션 없이 고른다 — 곡의 판 옵션을 넘기면 코치가 판을 새로 열어 확인 문장의 제시가 닫힌다.
  const peeks = shell.calls.slice(count).filter(([name]) => name === 'recommend');
  assert.ok(peeks.length >= 1);
  for (const [, [, options]] of peeks) assert.deepEqual(options, {});
  const after = await shell.events();
  const recallShown = after.filter(e => e.type === 'practice.presented').at(-1);
  assert.equal(recallShown.itemKey, rhythmItem(round.track, questions[0], { recall: true }).itemKey);
  assert.equal(recallShown.arm, 'host', '새 문장 확인은 게임 차례');
  assert.notEqual(recallShown.setId, songShown[0].setId, '새 문장 확인은 곡과 다른 판');
  assert.equal(after.filter(e => e.type === 'practice.attempted' && e.presentationId === recallShown.id).length, 1, '답은 한 번');
  shell.door.dispose();
});
test('정해진 판(app.mjs 차례) — 새 문장 확인은 첫 확인 문장 앞에서, 보충 연습은 첫 대화 앞에서 앞 판을 닫고 startSet({ length: n })을 한 번 부른다', async () => {
  const shell = await shellCoach({ startSet: true });
  const page = await boot({ door: shell.door.api, search: '?qa' });
  const music = await page.playSong({ plan: ['right', 'right', 'right', 'right', 'right'] });
  const questions = music.questions;
  const count = shell.calls.length;
  // 새 문장 확인 다섯 — 문장마다 듣고 O를 누른다.
  for (let i = 0; i < questions.length; i++) {
    await page.$('recall-button').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    page.$('recall-options').children[0].click();
  }
  // 결과의 보충 연습 — 단추를 누르면 첫 대화를 낸다.
  const panel = page.$('supplemental-practice');
  panel.children.find(node => node.textContent === '보충 연습').click();
  const later = shell.calls.slice(count);
  const sets = later.map(([name]) => name).filter(name => ['startSet', 'present', 'finishSet'].includes(name));
  assert.deepEqual(sets, ['finishSet', 'startSet', ...Array(5).fill('present'), 'finishSet', 'startSet', 'present'], '판마다 앞 판을 닫고 첫 제시 앞에서 한 번');
  assert.deepEqual(later.filter(([name]) => name === 'startSet').map(([, [options]]) => options), [{ length: 5 }, { length: 3 }], 'n = 확인 문장 수 · 보충 연습 대화 수');
  // 판이 도는 동안 추천 곡은 판 옵션 없이 고른다.
  const peeks = later.filter(([name]) => name === 'recommend');
  assert.ok(peeks.length >= questions.length, '확인 문장의 답마다 입구 추천을 다시 그린다');
  for (const [, [, options]] of peeks) assert.deepEqual(options, {});
  // 보충 연습을 닫는다 — 답하지 않은 대화는 판정 못 한 답으로 남는다(판이 그사이 바뀌지 않았다).
  panel.children.find(node => node.textContent === '보충 연습 닫기').click();
  const rows = await shell.events();
  const shown = rows.filter(e => e.type === 'practice.presented');
  const recalls = shown.slice(5, 10);
  assert.deepEqual(recalls.map(e => e.itemKey), questions.map(q => rhythmItem(page.context.synkRhythm.snapshot().track, q, { recall: true }).itemKey));
  assert.equal(new Set(recalls.map(e => e.setId)).size, 1, '새 문장 확인 다섯이 한 판');
  for (const e of recalls) assert.equal(rows.filter(x => x.type === 'practice.attempted' && x.presentationId === e.id).length, 1, e.itemKey);
  const practice = shown.at(-1);
  assert.notEqual(practice.setId, recalls[0].setId, '보충 연습은 다른 판');
  assert.equal(rows.filter(x => x.type === 'practice.attempted' && x.presentationId === practice.id).length, 1, '닫을 때의 판정 못 한 답이 남는다');
  shell.door.dispose();
});
