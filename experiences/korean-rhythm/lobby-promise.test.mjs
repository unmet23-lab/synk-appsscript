// 말의 리듬 입구의 안내와 실제 시작 곡: 기록은 실제 Atlas 경로로만 쌓고, 화면은 실제 app.mjs를 돈다(소리·무대 그리기만 가짜).
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

const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata');
const map = createMap(require('../../strata/maps/topik-i.json'));
const source = fs.readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
const app = `(async()=>{'use strict';${source.replace(/^import .*;\r?$/gm, '')}\nglobalThis.__page={backToRoom};\n})()`;

async function mount(coach, storage) {
  const elements = new Map();
  const element = () => ({ children: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, listeners: new Map(), textContent: '', setAttribute() {}, querySelectorAll() { return []; },
    addEventListener(name, fn) { this.listeners.set(name, fn); }, append(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; }, focus() {}, click() { return this.listeners.get('click')?.(); } });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const document = { getElementById: get, createElement: element, querySelectorAll: () => [], addEventListener() {}, body: element() };
  const context = { TRACKS, LEVELS, RoundState, rhythmItem, RHYTHM_CANDIDATES, missedRhythm, returnLine, assignmentTracks, assignmentTrack, rhythmTargetLabel, FLOW_RHYTHM, timingObservation, timingSummary, nextTrackLine, rhythmSupport, josa,
    createSupplementalPanel: options => createSupplementalPanel({ ...options, document }), recordTrialStarted() {}, document, localStorage: storage,
    MusicPlayer: class { stop() {} }, Stage: class { resize() {} }, SynkLearning: { createGame: () => coach }, SynkPlayAccount: { ready: async () => {} },
    matchMedia: () => ({ matches: false }), setTimeout: () => 1, clearTimeout() {}, addEventListener() {}, scrollTo() {}, cancelAnimationFrame() {}, confirm: () => true };
  context.window = context;
  await vm.runInNewContext(app, context, { filename: 'korean-rhythm/app.mjs' });
  return { press: id => get(id).click(), back: () => context.__page.backToRoom(), tracks: () => get('track-grid').children, selected: () => context.synkRhythm.snapshot().track, reason: () => get('recommendation-reason').textContent };
}
function history() {
  const rows = new Map(), storage = { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)) };
  const coach = createGame({ gameId: 'korean-rhythm', map, storage });
  const play = (t, s, correct, { help = null, skip = false } = {}) => {
    const pid = coach.present(rhythmItem(t, { sourceIndex: s, variant: 0 })); coach.delivery(pid, { audio: 'completed' }); if (help) coach.help(pid, help);
    return coach.answer(pid, skip ? { correct: null, assessable: false, reason: 'unanswered' } : { correct, assessable: true });
  };
  return { coach, storage, play };
}
const missed = () => { const h = history(); h.play(2, 1, false); h.play(2, 2, false); h.play(2, 3, true); return h; };
const planOf = coach => missedRhythm(coach, { songsOnly: false });
const rec = coach => coach.recommend(RHYTHM_CANDIDATES, { audioAvailable: true });
/** 안내가 약속한 곡이 선택돼 있고, 그 곡의 실제 첫 문제가 안내한 문제다. */
function promised(page, coach) {
  const plan = planOf(coach);
  assert.equal(plan.target.item.kind, 'song');
  assert.equal(page.selected(), plan.target.item.trackId, page.reason());
  assert.ok(page.reason().includes(`‘${TRACKS[plan.target.item.trackId].title}’의 첫 문제도`), page.reason());
  const round = new RoundState(TRACKS[page.selected()], 'easy', 1, { lead: plan.target.item.sourceIndex });
  assert.equal(rhythmItem(page.selected(), [...round.questions].sort((a, b) => a.time - b.time)[0]).familyKey, plan.target.meta.familyKey);
}
// 첫 문제를 또 놓치면 안내가 남고 맞춤 곡이 옮겨 간다: 공개본에서 잰 ‘네 시’ → ‘초록’과 같은 꼴이다.
function moveSong(h) {
  const first = planOf(h.coach).target.item;
  h.play(first.trackId, first.sourceIndex, false);
  assert.notEqual(planOf(h.coach).target.item.trackId, first.trackId, '시험 기록은 맞춤 곡을 옮겨야 한다');
}

for (const [name, go] of [
  ['잠깐 멈춤 → 처음으로', page => page.press('leave-button')],
  ['결과 → 처음으로', page => page.press('back-button')],
  ['결과 → 우리 동네에 닿지 않을 때', page => page.back()],
  ['곡 준비 실패', async page => { await page.press('start-button'); }],
]) test(`기본 경로 ${name}: 안내와 실제 시작 곡·첫 문제가 같다`, async () => {
  const h = missed(), page = await mount(h.coach, h.storage);
  promised(page, h.coach); moveSong(h);
  await go(page); promised(page, h.coach);
});

test('직접 고른 곡은 어느 길로 돌아와도 그대로이고, 안내는 그 곡으로 시작한다고 말하며 맞춤 첫 문제를 약속하지 않는다', async () => {
  const h = missed(), page = await mount(h.coach, h.storage), target = planOf(h.coach).target.item.trackId, mine = (target + 1) % TRACKS.length;
  page.tracks()[mine].click();
  assert.equal(page.selected(), mine);
  const title = TRACKS[mine].title, other = TRACKS[target].title, says = () => { assert.ok(page.reason().includes(`직접 고른 ‘${title}’`), page.reason()); assert.ok(page.reason().includes(`‘${other}’`)); assert.ok(!page.reason().includes('의 첫 문제도'), page.reason()); };
  says();
  for (const go of [() => page.press('leave-button'), () => page.press('back-button'), () => page.back()]) { go(); assert.equal(page.selected(), mine); says(); }
  page.tracks()[target].click(); assert.equal(page.selected(), target); promised(page, h.coach);
});

test('‘다른 곡 고르기’는 추천 곡을 다시 고르고, 그 뒤의 처음으로는 기본 경로를 따른다', async () => {
  const h = missed(), page = await mount(h.coach, h.storage), target = planOf(h.coach).target.item.trackId;
  page.tracks()[(target + 1) % TRACKS.length].click();
  page.press('other-song'); promised(page, h.coach);
  moveSong(h); page.press('leave-button'); promised(page, h.coach);
});

test('맞춤이 없을 때 직접 고른 곡과 추천 곡을 구분하고, 받침에 맞는 말을 쓴다', async () => {
  const h = history(), page = await mount(h.coach, h.storage), first = page.selected(), base = page.reason();
  const mine = (first + 1) % TRACKS.length, a = TRACKS[mine].title, b = TRACKS[first].title;
  page.tracks()[mine].click();
  assert.equal(page.reason(), `직접 고른 ‘${a}’${josa(a, '으로', '로')} 시작해요. 추천 곡은 ‘${b}’${josa(b, '이에요', '예요')}. ${base}`);
  page.tracks()[first].click(); assert.equal(page.reason(), base);
  assert.deepEqual(TRACKS.map(t => `${t.title}${josa(t.title, '으로', '로')}`), ['초록으로', '해안선으로', '네 시로']);
  assert.deepEqual(TRACKS.map(t => `${t.title}${josa(t.title, '이에요', '예요')}`), ['초록이에요', '해안선이에요', '네 시예요']);
});

test('직접 고른 곡이 맞춤 곡과 다르면 그 문장에도 단정 표현과 답이 없다', () => {
  const lines = Object.entries({ detail: 2, negation: 0, reason: 1, condition: 2 }).flatMap(([pattern, trackId]) => TRACKS.map((_, chosenTrack) => returnLine({ why: `${pattern}를 놓친 적이 있어요.`, target: { item: { kind: 'song', trackId } } }, { chosenTrack })));
  for (const line of lines) { assert.doesNotMatch(line, /틀렸|틀린|모르|못하|약해|부족|undefined/, line); assert.match(line, /놓친 적이 있어요\./); }
  assert.equal(returnLine({ why: 'x.', target: { item: { kind: 'supplemental' } } }, { chosenTrack: 1 }), returnLine({ why: 'x.', target: { item: { kind: 'supplemental' } } }), '보충 연습 안내는 곡과 상관없이 참이다');
  assert.equal(returnLine({ why: 'x.', target: { item: { kind: 'song', trackId: 1 } } }, { chosenTrack: 1 }), returnLine({ why: 'x.', target: { item: { kind: 'song', trackId: 1 } } }));
});

test('처음 방문은 첫 추천 곡을 고르고, 과제는 과제 곡만 말하며 처음으로에서도 그대로다', async () => {
  const h = history(), page = await mount(h.coach, h.storage);
  assert.equal(page.selected(), rec(h.coach).selected.trackId); assert.equal(page.reason(), rec(h.coach).reason);
  const m = rhythmItem(2, { sourceIndex: 0 }), target = { ...m, familyKeys: [m.familyKey], requiredAttempts: 1 }, t = missed(); t.coach.assignment = () => target;
  const assigned = await mount(t.coach, t.storage);
  assert.equal(assigned.selected(), 2); assert.match(assigned.reason(), /이번 목표/);
  assigned.press('leave-button'); assert.equal(assigned.selected(), 2); assert.match(assigned.reason(), /이번 목표/);
});

test('도움·미응답은 맞춤을 만들지 않고, 두 오답 뒤 한 번 맞히면 남고 두 번 맞히면 풀린다', async () => {
  const helped = history(); helped.play(2, 1, false, { help: 'replay' }); helped.play(2, 2, false, { help: 'replay' }); helped.play(2, 3, null, { skip: true });
  assert.equal(planOf(helped.coach), null);
  const none = await mount(helped.coach, helped.storage); assert.doesNotMatch(none.reason(), /놓친 적이 있어요/);
  const h = missed(); assert.ok(planOf(h.coach));
  h.play(2, 4, true); assert.equal(planOf(h.coach), null);
  const clear = await mount(h.coach, h.storage);
  assert.doesNotMatch(clear.reason(), /놓친 적이 있어요/); assert.equal(clear.selected(), rec(h.coach).selected.trackId);
});

test('화면 코드: 입구로 돌아오는 길은 모두 직접 고른 곡이 아니면 추천 곡을 고르고, 고른 곡이 맞춤 곡일 때만 관문을 옮긴다', () => {
  assert.doesNotMatch(source, /show\('lobby'\);\s*renderRecommendation\(\)/);
  assert.equal((source.match(/show\('lobby'\);\s*renderRecommendation\(!trackChosen\)/g) || []).length, 4);
  assert.match(source, /lead = missed\?\.target\.item\.kind === 'song' && missed\.target\.item\.trackId === track\.id/);
});
