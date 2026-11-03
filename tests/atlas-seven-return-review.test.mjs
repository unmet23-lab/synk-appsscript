// 재방문 맞춤 연습 검수(atlas-seven-return-20261103) B1…B8의 회귀 시험. 합성 기록은 실제 Atlas 공개 경로로만 만들고,
// 결과 화면의 단추는 진짜 브라우저에서 눌러 어느 부탁이 열리는지 본다. 브라우저가 없는 곳에서는 브라우저 시험만 건너뛴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const REPO = path.resolve(import.meta.dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(REPO, 'experiences', rel)).href);
const require = createRequire(path.join(REPO, 'x.js')), { createGame } = require('./atlas/game-learning.js'), { createMap } = require('./strata/index.js');
const map = createMap(require('./strata/topik-i').topikMap());
const memory = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const newCoach = (gameId) => createGame({ gameId, map, storage: memory() });

const { EPISODE } = await load('story-classroom/story.mjs');
const { missionMetadata, missedStory } = await load('story-classroom/learning.mjs');
const { supportedPractice } = await load('story-classroom/supported-practice.mjs');
const { ITEMS: RALLY_ITEMS } = await load('talk-rally/content.mjs');
const { composeRound: rallyRound } = await load('talk-rally/core.mjs');
const { itemMetadata: rallyMeta, missedPractice: rallyMissed, patternOfItem, hasEarlierRecord } = await load('talk-rally/learning.mjs');
const { rhythmItem, missedRhythm, returnLine: rhythmLine, RETURN_PATTERNS } = await load('korean-rhythm/personalization.mjs');
const { supplementalItems } = await load('korean-rhythm/supplemental.mjs');
const { missedPatterns } = await load('play-common/kit/return-practice.mjs');

const MISSIONS = new Map([...EPISODE.acts.flatMap((a) => a.missions), ...EPISODE.review].map((m) => [m.id, m]));
function storyTry(coach, id, correct, { help = ['replay'] } = {}) {
  const pid = coach.present(missionMetadata(MISSIONS.get(id)));
  for (const h of help) coach.help(pid, h);
  return coach.answer(pid, { correct, assessable: true, attemptNo: 1 });
}
function hear(coach, meta, correct) {
  const pid = coach.present(meta);
  coach.delivery(pid, { audio: 'completed' });
  return coach.answer(pid, { correct, assessable: true });
}

/* ── B3: 약한 제안이 거슬러 올라가지 않는다 ── */
test('B3 이야기: 약한 제안을 다시 하고 나면 그 앞 부탁으로 9→8→… 거슬러 권하지 않는다', () => {
  const coach = newCoach('story-classroom'), ids = [...MISSIONS.keys()];
  for (const id of ids) storyTry(coach, id, true);
  const last = ids.at(-1), offer = supportedPractice(coach);
  assert.equal(offer.strength, 'gentle'); assert.equal(offer.missionId, last);
  storyTry(coach, last, true);
  assert.equal(supportedPractice(coach), null);
});
test('B3 이야기: 다시 하다가 힌트를 받아 행이 빠져도 앞 부탁을 되살리지 않고, 그 뒤 새로 만난 부탁은 권한다', () => {
  const coach = newCoach('story-classroom');
  for (const id of ['cleanup-snacks', 'clue-flowers']) storyTry(coach, id, true);
  storyTry(coach, 'clue-flowers', true, { help: ['hint'] });
  assert.equal(supportedPractice(coach), null);
  storyTry(coach, 'surprise-cake', true);
  assert.equal(supportedPractice(coach).missionId, 'surprise-cake');
});

/* ── B5: 보충 연습의 오답을 곡의 오답이라 하지 않는다 ── */
const SUPPLY = supplementalItems({ purpose: 'practice' });
const supplyOf = (skill, difficulty) => {
  const seen = new Set();
  return SUPPLY.filter((row) => row.skillId === `ko.listening.${skill}` && row.difficulty === difficulty && !seen.has(row.familyKey) && seen.add(row.familyKey));
};
test('B5 말의 리듬: 곡에서만 놓치면 「지난 곡에서」 그대로다', () => {
  const coach = newCoach('korean-rhythm');
  [[0, 0], [0, 1], [1, 1]].forEach(([t, i], at) => hear(coach, rhythmItem(t, { sourceIndex: i, variant: 0 }), at === 2));
  const plan = missedRhythm(coach);
  assert.equal(plan.why, RETURN_PATTERNS.detail.why);
  assert.match(rhythmLine(plan), /^지난 곡에서/);
});
test('B5 말의 리듬: 보충 연습에서만 놓치거나 곡과 섞이면 「지난 곡」이라 하지 않는다', () => {
  const rows = supplyOf('detail', 1);
  assert.ok(rows.length >= 3, '보충 연습 세부 문항');
  const only = newCoach('korean-rhythm');
  rows.slice(0, 3).forEach((row, at) => hear(only, row, at === 2));
  let plan = missedRhythm(only);
  assert.equal(plan.patternId, 'detail');
  assert.match(plan.why, /^지난 듣기 연습에서 .*놓친 적이 있어요\.$/);
  assert.doesNotMatch(rhythmLine(plan), /지난 곡/);
  const mixed = newCoach('korean-rhythm');
  hear(mixed, rhythmItem(0, { sourceIndex: 0, variant: 0 }), false); hear(mixed, rows[0], false); hear(mixed, rows[1], true);
  plan = missedRhythm(mixed);
  assert.equal(plan.patternId, 'detail');
  assert.doesNotMatch(rhythmLine(plan), /지난 곡/);
});
test('B5 말의 리듬: 곡에 한 문항뿐인 조건은 보충 연습이 섞여야 생기므로 「지난 곡」이라 하지 않는다', () => {
  const rows = supplyOf('condition', 2);
  assert.ok(rows.length >= 2, '보충 연습 조건 문항');
  const coach = newCoach('korean-rhythm');
  hear(coach, rhythmItem(2, { sourceIndex: 0, variant: 0 }), false); hear(coach, rows[0], false); hear(coach, rows[1], false);
  const plan = missedRhythm(coach);
  assert.equal(plan.patternId, 'condition');
  assert.doesNotMatch(plan.why, /지난 곡/);
});

/* ── B6: 처음 판 + 난도 2 lead ── */
test('B6 말 랠리: 다른 기기의 기록을 받은 처음 판도 난도 2 맞춤 문항이 진짜 첫 공이다', () => {
  // 그 종류의 쉬운 말을 다른 기기에서 다 놓쳤으면 아직 안 만난 말은 난도 2뿐이다
  const pattern = 'wh', coach = newCoach('talk-rally');
  RALLY_ITEMS.filter((x) => patternOfItem(x) === pattern && x.difficulty === 1).forEach((item) => hear(coach, rallyMeta(item), false));
  const plan = rallyMissed(coach);
  assert.equal(plan.patternId, pattern); assert.equal(plan.target.item.difficulty, 2);
  const round = rallyRound(RALLY_ITEMS, { firstTime: true, lead: plan.target.id });
  assert.equal(round[0].id, plan.target.id);
  assert.equal(round.length, 12); assert.equal(new Set(round.map((x) => x.id)).size, 12);
  const kinds = round.reduce((n, x) => ({ ...n, [x.kind]: (n[x.kind] || 0) + 1 }), {});
  assert.ok(Object.values(kinds).every((n) => n >= 4), JSON.stringify(kinds));
  assert.ok(round.slice(1).every((x) => x.difficulty === 1), '나머지는 처음 판 약속대로 쉬운 말');
});
test('B6 말 랠리: lead가 없는 처음 판은 그대로 쉬운 말부터다', () => {
  const round = rallyRound(RALLY_ITEMS, { firstTime: true });
  assert.ok(round.every((x) => x.difficulty === 1));
});

/* ── 이미 본 부탁을 맞힌 뒤 같은 권유를 되풀이하지 않는다 ── */
test('다시 읽기: 이미 본 부탁을 첫 시도에 맞히면 같은 근거로 또 권하지 않지만, 칸 상태는 그대로이고 틀리거나 답 도움을 받으면 권유가 남는다', () => {
  const missed = () => { const coach = newCoach('story-classroom'); storyTry(coach, 'cleanup-paper', false, { help: [] }); storyTry(coach, 'review-paper', false, { help: [] }); return coach; };
  const cells = (coach) => JSON.stringify(coach.summary().skills.map((s) => [s.id, Object.values(s.levels).flatMap((l) => Object.values(l.formats).map((c) => [c.status, c.n, c.correct]))]));
  const done = missed(), before = cells(done);
  assert.equal(missedStory(done).target.id, 'review-paper'); assert.equal(missedStory(done).repeat, true);
  const reread = storyTry(done, 'review-paper', true, { help: [] });
  assert.equal(reread.independent, false);
  assert.equal(missedStory(done), null);
  assert.equal(cells(done), before, '근거 엔진 판정은 바뀌지 않는다');
  const heard = missed(); storyTry(heard, 'review-paper', true);
  assert.equal(missedStory(heard), null, '기본 읽어 주기로 맞힌 것도 다시 읽은 것이다');
  for (const help of [['hint'], ['answer'], ['replay', 'hint']]) {
    const helped = missed(); storyTry(helped, 'review-paper', true, { help });
    assert.equal(missedStory(helped)?.target.id, 'review-paper', help.join());
  }
  const wrong = missed(); storyTry(wrong, 'review-paper', false, { help: [] });
  assert.equal(missedStory(wrong)?.target.id, 'review-paper');
  const other = missed(); storyTry(other, 'cleanup-paper', true, { help: [] });
  assert.equal(missedStory(other)?.target.id, 'review-paper', '권한 그 부탁이 아니면 끄지 않는다');
});
test('다시 읽기: 끈 뒤에도 다른 종류의 새 독립 오답이 쌓이면 그 추천이 나오고, 그 종류의 새 부탁 권유는 그대로다', () => {
  const coach = newCoach('story-classroom');
  storyTry(coach, 'cleanup-paper', false, { help: [] }); storyTry(coach, 'review-paper', false, { help: [] });
  storyTry(coach, 'review-paper', true, { help: [] });
  assert.equal(missedStory(coach), null);
  storyTry(coach, 'cleanup-snacks', false, { help: [] }); storyTry(coach, 'clue-flowers', false, { help: [] }); storyTry(coach, 'surprise-cake', true, { help: [] });
  const plan = missedStory(coach);
  assert.equal(plan.patternId, 'detail'); assert.equal(plan.repeat, false); assert.equal(plan.target.id, 'review-snacks');
  // 근거를 만든 오답이 다시 읽기보다 나중이면 그 부탁은 다시 권한다
  const later = newCoach('story-classroom');
  storyTry(later, 'review-paper', false, { help: [] });
  const family = missionMetadata(MISSIONS.get('cleanup-paper')).familyKey;
  assert.equal(missedStory(later), null);
  storyTry(later, 'cleanup-paper', false, { help: [] });
  assert.equal(missedStory(later).missedFamilies.at(-1), family);
  assert.equal(missedStory(later).target.id, 'cleanup-paper');
});

/* ── 말 랠리: 새 기기의 연습 공 ── */
test('말 랠리 입구: 연습 공을 아직 안 한 사람에게만 맞춤 공이 연습 공 다음이라고 말한다', () => {
  const code = readFileSync(path.join(REPO, 'experiences/talk-rally/app.mjs'), 'utf8');
  assert.ok(code.includes("`${plan.why} ${plan.next}` + (progress.practiced ? '' : ' 연습 공을 마치면 바로 나와요.')"));
  assert.doesNotMatch(' 연습 공을 마치면 바로 나와요.', /틀렸|틀린|모르|못하|약해|부족/);
  assert.match(code, /if \(!progress\.practiced\) \{ state\.practice = true;/, '안내의 조건이 실제 연습 공 조건과 같다');
});

/* ── B8: 같은 문항으로는 근거가 두 개가 되지 않는다(Trail 계약을 실제 경로로 확인) ── */
test('B8 Trail 계약: 같은 family의 재시도·변형·겹친 제시·다른 형식은 독립 근거가 하나뿐이라 맞춤 연습이 생기지 않는다', () => {
  const rows = (coach, gameId, ofFamily) => missedPatterns({ coach, gameId, patterns: { x: { minEvidence: 1 } }, patternOfFamily: (f) => (ofFamily(f) ? 'x' : null) });
  const paper = missionMetadata(MISSIONS.get('cleanup-paper'));
  const again = newCoach('story-classroom');
  for (let i = 0; i < 3; i++) storyTry(again, 'cleanup-paper', false, { help: [] });
  assert.equal(missedStory(again), null);
  assert.deepEqual(rows(again, 'story-classroom', (f) => f === paper.familyKey), []);
  const variants = newCoach('korean-rhythm');
  for (const q of [{ sourceIndex: 2, variant: 0 }, { sourceIndex: 2, variant: 1 }]) hear(variants, rhythmItem(0, q), false);
  hear(variants, rhythmItem(0, { sourceIndex: 2 }, { recall: true }), false);
  assert.equal(missedRhythm(variants), null);
  const overlap = newCoach('story-classroom'), first = overlap.present(paper), second = overlap.present(paper);
  overlap.answer(first, { correct: false, assessable: true, attemptNo: 1 }); overlap.answer(second, { correct: false, assessable: true, attemptNo: 1 });
  assert.equal(missedStory(overlap), null);
  const formats = newCoach('story-classroom');
  for (const meta of [paper, { ...paper, itemKey: `${paper.itemKey}:other`, responseFormat: 'binary-choice' }, { ...paper, itemKey: `${paper.itemKey}:hard`, difficulty: 3 }]) {
    const pid = formats.present(meta); formats.answer(pid, { correct: false, assessable: true, attemptNo: 1 });
  }
  assert.equal(missedStory(formats), null);
  const evidence = formats.summary().skills.flatMap((s) => Object.values(s.levels).flatMap((l) => Object.values(l.formats).flatMap((c) => c.evidence || [])));
  const attempts = formats.events().filter((e) => e.type === 'practice.attempted').map((e) => e.id);
  assert.equal(evidence.filter((id) => attempts.includes(id)).length, 1);
});

/* ── 브라우저: 결과 화면의 단추가 말한 부탁을 연다(B1·B2), 입구의 약한 제안(B3·B4), 사라지는 단추의 초점(B7) ── */
let chromium = null, browser = null, base = null, server = null;
try {
  ({ chromium } = require(require.resolve('playwright', { paths: [REPO, process.env.SYNK_QA_NODE_MODULES].filter(Boolean) })));
  browser = await chromium.launch({ channel: process.env.SYNK_QA_BROWSER || 'chrome', headless: true });
  ({ server } = await load('story-classroom/server.mjs'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
} catch { await browser?.close(); browser = null; }
const skip = browser ? false : '브라우저 없음';
test.after(async () => { await browser?.close(); await new Promise((resolve) => (server?.listening ? server.close(resolve) : resolve())); });

// 저장소 상실과 과제는 공개 경로(coach)의 대답만 바꾼다. 게임이 듣는 알림도 같은 구독으로 보낸다.
const HARNESS = () => {
  let real;
  window.__listeners = [];
  // Atlas가 돌려주는 객체는 얼어 있어 Proxy로 감쌀 수 없다: 같은 함수를 담은 새 객체에서 세 가지만 바꾼다.
  const wrapCoach = (coach) => ({ ...coach,
    summary: () => (window.__lost ? { ...coach.summary(), storage: { available: false } } : coach.summary()),
    assignment: () => window.__target || coach.assignment?.() || null,
    syncPort: { ...coach.syncPort, subscribe: (fn) => { window.__listeners.push(fn); return coach.syncPort.subscribe(fn); } } });
  Object.defineProperty(globalThis, 'SynkLearning', { configurable: true,
    get: () => real,
    set: (value) => { real = { ...value, createGame: (...a) => wrapCoach(value.createGame(...a)) }; } });
  window.__loseStorage = () => { window.__lost = true; for (const fn of window.__listeners) fn({ kind: 'storage-error' }); };
};

/** plays: [mission, 맞음, help?]. 앱이 열리기 전에 같은 저장소에 실제 기록을 남긴다. */
async function seed(page, plays) {
  await page.goto(`${base}/__seed`);
  await page.addScriptTag({ url: '/atlas-learning.js' });
  await page.evaluate(async (plays) => {
    const { missionMetadata } = await import('/learning.mjs'), { EPISODE } = await import('/story.mjs');
    const all = [...EPISODE.acts.flatMap((a) => a.missions), ...EPISODE.review];
    const g = SynkLearning.createGame({ gameId: 'story-classroom', storage: localStorage });
    for (let i = 0; i < 100 && !g.syncPort.canPersist(); i++) await new Promise((r) => setTimeout(r, 40));
    if (!g.syncPort.canPersist()) throw new Error('Atlas writer unavailable');
    for (const [id, correct, help] of plays) {
      const pid = g.present(missionMetadata(all.find((m) => m.id === id)));
      for (const h of help || []) g.help(pid, h);
      g.answer(pid, { correct, assessable: true, attemptNo: 1 });
    }
    g.flush(); g.dispose();
  }, plays);
}
async function fresh(plays = [], { target = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(HARNESS);
  if (target) await page.addInitScript((value) => { window.__target = value; }, target);
  if (plays.length) await seed(page, plays);
  return { ctx, page, errors };
}
const openApp = async (page) => { await page.goto(`${base}/?qa&reading=1`); await page.waitForFunction(() => window.__story && !document.querySelector('#lobby').hidden); };
const state = (page) => page.evaluate(() => window.__story.state());
const visible = (page, sel) => page.locator(sel).isVisible();
const label = (page, sel) => page.locator(`${sel} span`).first().innerText();
const reason = (page) => page.locator('#r-next-reason').innerText();
/** 지금 판을 결과 화면까지 진짜 경로로 푼다. */
async function finish(page, { limit = 240000, hintOn = null } = {}) {
  const until = Date.now() + limit;
  let hinted = false;
  for (;;) {
    const s = await state(page);
    if (s.screen === 'results') return s;
    assert.ok(Date.now() < until, `결과 화면까지 못 감: ${s.phase}`);
    if (s.busy) { await page.waitForTimeout(30); continue; }
    if (s.active === hintOn && !hinted && ['play', 'review'].includes(s.phase)) { hinted = true; await page.click('#hint'); }
    if (['play', 'review'].includes(s.phase)) await page.evaluate(() => window.__story.solve());
    else await page.evaluate(() => window.__story.advance());
  }
}
const opened = async (page) => { const s = await state(page); return { screen: s.screen, ids: s.missions.map((m) => m.id) }; };
/** 지금 판이 그 부탁 하나를 여는 연습인지(그 부탁과 앞 순서로 필요한 부탁만). */
async function assertPracticeOf(page, id) {
  await page.waitForFunction(() => document.querySelector('#results').hidden);
  const now = await opened(page);
  assert.equal(now.screen, 'game');
  assert.ok(now.ids.includes(id), `${id} ∉ ${now.ids}`);
  while (!['play', 'review'].includes((await state(page)).phase)) await page.evaluate(() => window.__story.advance());
  // 순서가 있는 부탁은 게임 규칙대로 앞 순서 부탁을 먼저 하고 나서 그 부탁으로 넘어간다
  for (const needed of MISSIONS.get(id).requires || []) {
    assert.equal((await state(page)).active, needed);
    await page.evaluate(() => window.__story.solve());
    await page.waitForFunction(() => !window.__story.state().busy);
  }
  assert.equal((await state(page)).active, id);
  assert.equal(await page.locator('#ask-kicker').innerText(), '연습할 부탁');
  assert.equal(await page.locator('#ask-line').getAttribute('data-text'), MISSIONS.get(id).text);
  assert.equal(await page.locator('#g-scene').innerText(), '연습');
}

test('B1 이야기 한 판 결과: 놓친 부탁을 말하면 그 단추가 있고 눌러서 그 부탁이 열린다(이미 본 부탁이어도 그대로). 연습 뒤에는 B2 단추', { skip, timeout: 300000 }, async () => {
  const { ctx, page, errors } = await fresh([['cleanup-paper', false], ['review-paper', false]]);
  try {
    await openApp(page);
    await page.click('#start');
    await finish(page, { hintOn: 'review-paper' });   // 힌트를 받은 판은 다시 읽어 맞힌 것으로 치지 않아 권유가 남는다
    assert.equal(await page.locator('#r-title').innerText(), '이야기 끝!');
    assert.match(await reason(page), /놓친 부탁 바로 연습/);
    assert.equal(await label(page, '#r-practice'), '놓친 부탁 바로 연습');
    assert.equal(await label(page, '#again'), '이야기 처음부터');
    assert.equal(await visible(page, '#r-story'), false);
    assert.match(await page.locator('#r-practice').getAttribute('class'), /coral/);
    assert.match(await page.locator('#again').getAttribute('class'), /cream/);
    await page.click('#r-practice');
    await assertPracticeOf(page, 'review-paper');
    await finish(page);
    // 방금 한 부탁이 곧 권할 부탁: 같은 일을 하는 단추를 둘 두지 않고, 틀린 약속이 없다
    assert.equal(await page.locator('#r-title').innerText(), '연습 끝!');
    assert.doesNotMatch(await reason(page), /처음부터 읽|바뀐 부탁도 다시|놓친 부탁 바로 연습/);
    assert.equal(await visible(page, '#r-practice'), false);
    assert.equal(await label(page, '#again'), '방금 한 부탁 다시');
    assert.equal(await label(page, '#r-story'), '이야기 시작');
    await page.click('#again');
    await assertPracticeOf(page, 'review-paper');
    await finish(page);
    await page.click('#r-story');
    await page.waitForFunction(() => window.__story.state().screen === 'game');
    const story = await state(page);
    assert.equal(story.phase, 'opening');
    assert.equal(await page.locator('#g-scene').innerText(), '시작');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('B2 한 장면 연습 결과: 권하는 다른 부탁 · 하던 이야기 이어 하기 · 방금 한 부탁 다시가 각각 말한 곳을 열고 하던 이야기는 보존된다', { skip, timeout: 180000 }, async () => {
  const { ctx, page, errors } = await fresh();
  try {
    // 먼저 이야기를 조금 하다가 멈춘다(이어 하기 저장본)
    await openApp(page);
    await page.click('#start');
    await page.waitForFunction(() => window.__story.state().screen === 'game');
    await page.evaluate(() => { window.__story.advance(); window.__story.advance(); });
    const before = await state(page);
    await page.click('#pause'); await page.click('#quit');
    // 그다음 놓친 기록이 생긴 상태로 다시 연다: 세부 부탁을 먼저 권하고, 그걸 맞히면 다음으로 부정 부탁을 권한다
    // 연습은 그 장면의 부탁을 다 풀어야 끝나므로 다음으로 권할 부탁은 다른 장면에 둔다
    await seed(page, [['review-cake', false], ['clue-letter', false], ['surprise-ribbon', false], ['cleanup-snacks', false], ['clue-flowers', false], ['surprise-cake', true]]);
    await openApp(page);
    assert.equal(await visible(page, '#resume'), true);
    await page.click('#practice-missed');
    await assertPracticeOf(page, 'review-snacks');
    await finish(page);
    assert.equal(await page.locator('#r-title').innerText(), '연습 끝!');
    assert.match(await reason(page), /놓친 부탁 바로 연습/);
    assert.doesNotMatch(await reason(page), /처음부터 읽/);
    assert.equal(await label(page, '#r-practice'), '놓친 부탁 바로 연습');
    assert.equal(await label(page, '#r-story'), '하던 이야기 이어 하기');
    assert.equal(await label(page, '#again'), '방금 한 부탁 다시');
    await page.click('#again');
    await assertPracticeOf(page, 'review-snacks');
    await finish(page);
    await page.click('#r-practice');
    await assertPracticeOf(page, 'surprise-ribbon');
    await finish(page);
    assert.equal(await visible(page, '#r-practice'), false);
    assert.match(await page.locator('#r-story').getAttribute('class'), /coral/);
    assert.match(await reason(page), /하던 이야기를 이어서/);
    await page.click('#r-story');
    await page.waitForFunction(() => window.__story.state().screen === 'game');
    const after = await state(page);
    assert.deepEqual([after.phase, after.line], [before.phase, before.line], '하던 자리 그대로');
    assert.equal(await page.locator('#g-scene').innerText(), '시작');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('B1·B2 들으며 놓친 사람: 결과에서 권한 다른 부탁을 그 단추가 연다', { skip, timeout: 120000 }, async () => {
  const replay = ['replay'], { ctx, page, errors } = await fresh([['clue-letter', false, replay], ['surprise-ribbon', false, replay], ['review-cake', false, replay]]);
  try {
    await openApp(page);
    assert.equal(await page.locator('#support-go').getAttribute('data-mission'), 'review-cake');
    await page.click('#support-go');
    await assertPracticeOf(page, 'review-cake');
    await finish(page);
    assert.match(await reason(page), /한 번 더 해 볼까요/);
    assert.equal(await page.locator('#r-practice').getAttribute('data-mission'), 'surprise-ribbon');
    await page.click('#r-practice');
    await assertPracticeOf(page, 'surprise-ribbon');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('다시 읽기 브라우저: 권한 부탁을 맞히고 나면 입구가 같은 부탁을 다시 권하지 않고, 결과의 자발적 다시 하기·이야기·새 오답의 추천은 남는다', { skip, timeout: 120000 }, async () => {
  const { ctx, page, errors } = await fresh([['cleanup-paper', false], ['review-paper', false]]);
  try {
    await openApp(page);
    assert.equal(await visible(page, '#practice-missed'), true);
    assert.match(await page.locator('#l-reason').innerText(), /놓친 부탁 바로 연습/);
    await page.click('#practice-missed');
    await assertPracticeOf(page, 'review-paper');
    await finish(page);
    assert.equal(await visible(page, '#r-practice'), false);
    assert.doesNotMatch(await reason(page), /놓친|해냈|나아졌|회복/);
    assert.equal(await label(page, '#again'), '방금 한 부탁 다시');
    assert.equal(await label(page, '#r-story'), '이야기 시작');
    await page.click('#r-home');
    await page.waitForFunction(() => !document.querySelector('#lobby').hidden);
    assert.equal(await visible(page, '#practice-missed'), false, '같은 탭의 입구');
    assert.doesNotMatch(await page.locator('#l-reason').innerText(), /놓친 부탁 바로 연습/);
    await openApp(page);
    assert.equal(await visible(page, '#practice-missed'), false, '다음 방문의 입구');
    assert.doesNotMatch(await page.locator('#l-reason').innerText(), /놓친 부탁 바로 연습/);
    assert.equal(await visible(page, '#support-go'), false);
    await seed(page, [['cleanup-snacks', false], ['clue-flowers', false], ['surprise-cake', true]]);
    await openApp(page);
    assert.equal(await visible(page, '#practice-missed'), true, '새 독립 오답의 추천');
    await page.click('#practice-missed');
    await assertPracticeOf(page, 'clue-flowers');   // 앞 연습 장면에서 review-snacks도 만나 새 부탁이 없다
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('B2 과제 결과: 이어 하기나 맞춤 연습을 꺼내지 않고 목표 부탁을 다시 연다', { skip, timeout: 120000 }, async () => {
  const meta = await page_meta('cleanup-snacks');
  const { ctx, page, errors } = await fresh([['cleanup-paper', false], ['review-paper', false]], { target: { ...meta, familyKeys: [meta.familyKey], itemKeys: [meta.itemKey], requiredAttempts: 1 } });
  try {
    await openApp(page);
    await page.click('#start');
    await finish(page);
    assert.equal(await visible(page, '#r-practice'), false);
    assert.equal(await visible(page, '#r-story'), false);
    assert.equal(await label(page, '#again'), '한 번 더 놀기');
    assert.doesNotMatch(await reason(page), /처음부터 읽|바뀐 부탁도 다시/);
    await page.click('#again');
    await page.waitForFunction(() => window.__story.state().screen === 'game');
    assert.ok((await opened(page)).ids.includes('cleanup-snacks'));
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
function page_meta(id) { return missionMetadata(MISSIONS.get(id)); }

test('B3·B4 입구의 약한 제안: 눌러 다시 하고 돌아오면 앞 부탁을 권하지 않고, 그만두고 돌아와도 같은 부탁을 다시 권하지 않는다', { skip, timeout: 120000 }, async () => {
  const replay = ['replay'], plays = [['cleanup-snacks', true, replay], ['cleanup-paper', true, replay], ['clue-flowers', true, replay]];
  {
    const { ctx, page, errors } = await fresh(plays);
    try {
      await openApp(page);
      assert.equal(await page.locator('#support-go').getAttribute('data-mission'), 'clue-flowers');
      await page.click('#support-go');
      await assertPracticeOf(page, 'clue-flowers');
      await page.click('#pause'); await page.click('#quit');
      await page.waitForFunction(() => !document.querySelector('#lobby').hidden);
      assert.equal(await visible(page, '#support-go'), false, 'B4: 그만두고 돌아온 입구');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
  {
    const { ctx, page, errors } = await fresh(plays);
    try {
      await openApp(page);
      await page.click('#support-go');
      await assertPracticeOf(page, 'clue-flowers');
      await finish(page);
      await page.click('#r-home');
      await page.waitForFunction(() => !document.querySelector('#lobby').hidden);
      assert.equal(await visible(page, '#support-go'), false, 'B3: 앞 부탁으로 거슬러 가지 않는다');
      await openApp(page);
      assert.equal(await visible(page, '#support-go'), false, 'B3: 다시 열어도');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
});

test('B7 쓰기 권한을 잃어 추천 단추가 사라지면 초점이 입구는 시작, 결과는 다시 하기 단추로 옮겨 간다', { skip, timeout: 120000 }, async () => {
  const replay = ['replay'], plays = [['clue-letter', false, replay], ['surprise-ribbon', false, replay], ['review-cake', false, replay]];
  const active = (page) => page.evaluate(() => document.activeElement?.id);
  {
    const { ctx, page, errors } = await fresh(plays);
    try {
      await openApp(page);
      await page.focus('#support-go');
      await page.evaluate(() => window.__loseStorage());
      await page.waitForFunction(() => document.querySelector('#support-offer').hidden);
      assert.equal(await active(page), 'start');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
  {
    const { ctx, page, errors } = await fresh(plays);
    try {
      await openApp(page);
      await page.click('#support-go');
      await assertPracticeOf(page, 'review-cake');
      await finish(page);
      await page.focus('#r-practice');
      await page.evaluate(() => window.__loseStorage());
      await page.waitForFunction(() => document.querySelector('#r-practice').hidden);
      assert.equal(await active(page), 'again');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
});

/* ── Fable P2·P3: 결과 안내는 실제 단추를 가리키고, 옛 기록은 한 줄로만 말한다 ── */
test('결과 안내: 맞춤 약속은 그 판을 여는 단추 이름으로만 말한다', () => {
  const text = (rel) => readFileSync(path.join(REPO, 'experiences', rel), 'utf8');
  const rally = text('talk-rally/app.mjs'), entry = text('entry-check/app.mjs');
  assert.match(text('talk-rally/index.html'), /id="r-again"[^>]*><span>다음 판 시작</);
  assert.ok(rally.includes('‘다음 판 시작’의 첫 공도') && !rally.includes('다음 판 첫 공도'));
  assert.match(rally, /\$\('#r-daily-again'\)\.onclick = \(\) => \{ stopLine\(\); startRound\('daily'\); \};/, '하루 도전 다시 하기는 맞춤 첫 공이 없는 판');
  assert.match(text('entry-check/index.html'), /id="r-next"[^>]*><span>추천 근무 시작</);
  assert.ok(entry.includes('‘추천 근무 시작’에 그런 손님이') && !entry.includes('다음 근무에도'), '같은 근무지 다시는 약속에서 뺀다');
});
test('옛 기록 한 줄: 이 게임에서 혼자 답한 옛 칸의 기록만 알아보고, 새 칸·다른 게임·도움·모르는 문항은 아니다', () => {
  const item = RALLY_ITEMS.find((x) => x.id === 'r01'), old = { ...rallyMeta(item), skillId: 'ko.listening.detail' };
  const earlier = newCoach('talk-rally'); hear(earlier, old, true);
  assert.equal(hasEarlierRecord(earlier), true);
  const current = newCoach('talk-rally'); hear(current, rallyMeta(item), false);
  assert.equal(hasEarlierRecord(current), false, '지금 칸은 표가 말한다');
  const storage = memory(), other = createGame({ gameId: 'other-public-game', map, storage }); hear(other, old, true); other.dispose?.();
  assert.equal(hasEarlierRecord(createGame({ gameId: 'talk-rally', map, storage })), false, '다른 게임');
  const helped = newCoach('talk-rally'), pid = helped.present(old); helped.delivery(pid, { audio: 'completed' }); helped.help(pid, 'answer'); helped.answer(pid, { correct: true, assessable: true });
  assert.equal(hasEarlierRecord(helped), false, '도움');
  const unknown = newCoach('talk-rally'); hear(unknown, { ...old, id: 'talk-rally.gone', itemKey: 'talk-rally.gone.v1', familyKey: 'talk-rally.gone.v1' }, true);
  assert.equal(hasEarlierRecord(unknown), false, '알아볼 수 없는 문항');
  assert.equal(hasEarlierRecord(null), false);
});
