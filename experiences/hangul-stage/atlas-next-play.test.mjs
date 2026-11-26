// 한글 만나기의 새 길(Atlas 재설계 단계 4 · 4-7 — 단계4_계획 §26-8) — atlas-next-play.mjs.
// 진짜 엔진 코치를 가짜 입구로 셸의 문(createGameDoor)에 넣고 틀 창의 키트로 열어 문을 거친 그대로 돈다(인수 복제 · 겉 닫힘까지).
// 나눔(엔진은 글자만) · 꼴 · 난도 · 새 글자 몫 · 직전 글자 · 소리 실패 · 다시 · 판 길이 · 짝 맞추기 · 떠남 · 오류는 code로만.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
import { openNext } from './kit/atlas-next.mjs';
import { BANKS, createHangul, openHangul, reasonOf, setLength, shapeOf } from './atlas-next-play.mjs';
import { SETTINGS, answer, emptyProgress, finishSession, letterOf, meet, metIds, newCount, nextLetters, planSession, readProgress } from './core.mjs';
import { GAME_ID, itemMetadata } from './learning.mjs';
import { createPack } from './pack.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const readJson = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const INDEX = readJson('../../packages/atlas/map/index.json');
const UNITS = readJson('../../packages/atlas/map/units.json');
const pack = createPack(readJson('../../strata/hangul.json'));
const T0 = Date.UTC(2026, 10, 2, 1, 0, 0); // 서울 10시
const HOUR = 3_600_000, DAY = 24 * HOUR;
const ALL = pack.letters.map(l => l.id);
const CORE = pack.units.filter(u => u.core !== false).flatMap(u => u.letters);

let stores = 0;
async function realCoach(clock, port = atlas.memoryPort()) {
  stores += 1;
  const coach = atlas.createCoach({ gameId: GAME_ID, mapData: { index: INDEX, units: UNITS }, dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:hangul-test-${process.pid}-${stores}`, now: () => clock.t } });
  await coach.ready;
  return { coach, port };
}
// 셸 창 코치를 지켜보는 겉 — 부른 차례와 인수 · 결과를 적는다(문은 이 객체의 메서드를 부른다).
function spied(coach, fake = {}) {
  const calls = [];
  const spy = { calls };
  for (const name of ['recommend', 'present', 'help', 'delivery', 'answer', 'summary', 'due', 'itemUnits', 'startSet', 'finishSet'])
    spy[name] = (...args) => { const row = [name, args]; calls.push(row); row.push((fake[name] ?? coach[name]).apply(coach, args)); return row[2]; };
  return spy;
}
// 문을 거쳐 연 새 길 하나.
async function opened({ t = T0, fake = {} } = {}) {
  const clock = { t };
  const { coach, port } = await realCoach(clock);
  const spy = spied(coach, fake);
  let retire = null;
  const entry = { gameCoach: async () => spy, retired: (_made, fn) => { retire = fn; return () => {}; }, ended() {} };
  const later = [];
  const door = createGameDoor({ entry, gameId: GAME_ID, later: fn => later.push(fn) });
  const listeners = [];
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, location: { hostname: 'synk.im', search: '' }, addEventListener: (type, fn) => listeners.push([type, fn]) };
  const hangul = createHangul(await openNext({ win, gameId: GAME_ID, banks: [...BANKS] }), { win });
  return { clock, coach, port, spy, door, hangul, listeners, retire: () => { retire({ reason: 'account' }); for (const fn of later.splice(0)) fn(); },
    close: () => { door.dispose(); for (const fn of later.splice(0)) fn(); },
    // 틀을 떠난다 — pagehide를 건 차례대로 부른 뒤 셸의 다음 차례(판 닫기)가 돈다.
    leave: () => { for (const [type, fn] of listeners) if (type === 'pagehide') fn(); for (const fn of later.splice(0)) fn(); } };
}
const rows = async ({ coach, port }) => {
  await coach.finishSet({ record: false }).folded;
  return (await port.read()).filter(row => row.value?.kind === 'event').map(row => row.value.event).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
};
const shown = list => list.filter(e => e.type === 'practice.presented');
const iso = clock => new Date(clock.t).toISOString();
const open = (game, progress, more = {}) => game.hangul.session({ progress, pack, now: iso(game.clock), sessionNo: 0, ...more });
// 문항 하나를 낸다(app.mjs와 같은 차례 — 제시 · 전달 · 답). 돌려주는 값은 제시 번호.
function put(game, item, { correct = true, sound = true } = {}) {
  const { recorder } = game.hangul;
  game.clock.t += 4000;
  if (item.type === 'match') {
    for (const card of item.cards) {
      const pid = recorder.present(item, card.letter);
      recorder.delivered(pid, sound);
      game.clock.t += 1500;
      recorder.answer(pid, card.letter === item.target.letter ? correct : true);
    }
    return null;
  }
  const pid = recorder.present(item);
  if (item.type !== 'see_pick') recorder.delivered(pid, sound);
  game.clock.t += 3000;
  recorder.answer(pid, correct);
  return pid;
}
// 회차 하나를 끝까지 — correct(item, n)이 거짓이면 틀린다. 돌려주는 값은 낸 걸음과 새 진도.
function play(game, progress, { sessionNo = 0, correct = () => true, sound = () => true, more = {} } = {}) {
  const run = open(game, progress, { sessionNo, ...more });
  const items = [], steps = [];
  let p = progress, independent = 0, step;
  while ((step = run.step())) {
    steps.push(step);
    if (step.kind === 'meet') { p = meet(p, [step.letter], iso(game.clock)); continue; }
    const { item } = step;
    const ok = correct(item, items.length);
    items.push(item);
    put(game, item, { correct: ok, sound: sound(item, items.length - 1) });
    p = answer(p, { focus: item.focus, correct: ok, at: iso(game.clock), sessionId: `${run.plan.day}#${sessionNo}`, word: !!item.word });
    if (ok) independent += 1;
  }
  run.end();
  return { progress: finishSession(p, { day: run.plan.day, sessionNo, total: items.length, independent }), plan: run.plan, steps, items };
}
// 글자를 다 만난 사람의 진도 — 제품 기록만(엔진 기억은 따로 쌓는다).
const metAll = (ids, { difficulty = 2, ratio = 0.85 } = {}) => {
  const p = meet(emptyProgress(), ids, new Date(T0 - 10 * DAY).toISOString());
  return { ...p, difficulty, recent: Array.from({ length: 20 }, (_, i) => ({ ok: i < Math.round(20 * ratio) })), demoSeen: [] };
};
// 엔진에 글자 기억을 쌓는다 — 글자마다 보고 고르기 하나를 맞힌다(지난 날).
function teach(game, ids, { daysAgo = 9, correct = () => true } = {}) {
  const now = game.clock.t;
  game.clock.t = now - daysAgo * DAY;
  for (const id of ids) {
    const item = { type: 'see_pick', target: { letter: id, text: id }, options: [{ text: 'a' }, { text: 'b' }], skill: 'ko.hangul.read', difficulty: 1 };
    const pid = game.coach.present(itemMetadata(item));
    game.clock.t += 2000;
    game.coach.answer(pid, { correct: correct(id), assessable: true });
    game.clock.t += 2000;
  }
  game.coach.finishSet({ record: false });
  game.clock.t = now;
}
const letters = list => list.map(item => item.target.letter);

test('은행 이름은 셸의 게임 은행 표와 같다 · 문이 null이면 옛 길(null)이고, RUN_ENDED는 그대로 던진다 · 문도 깃발도 없으면 null', async () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS[GAME_ID]]);
  const win = give => { const top = { SYNKAtlasGame: { open: give } }; return { parent: top, top, location: { hostname: 'synk.im', search: '' }, addEventListener() {} }; };
  const asked = [];
  assert.equal(await openHangul({ win: win(async options => { asked.push(options); return null; }) }), null);
  assert.deepEqual(asked, [{ gameId: GAME_ID, banks: ['hangul-stage'] }]);
  await assert.rejects(openHangul({ win: win(async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); }) }), error => error.code === 'RUN_ENDED');
  const alone = { location: { hostname: 'synk.im', search: '?atlas=next' }, addEventListener() {} };
  alone.parent = alone.top = alone;
  assert.equal(await openHangul({ win: alone }), null);
});

test('첫 회차 — 새 글자 만나기 카드와 확인 두 문항(제품 차례)이 먼저이고, 판은 첫 제시 전에 제시 수의 위 끝으로 한 번 열려 회차 전체가 판 하나다 · 끝에 기록 없이 닫는다', async () => {
  const game = await opened();
  const { plan, steps, items } = play(game, emptyProgress());
  assert.deepEqual(plan.fresh, ['v-a', 'v-eo', 'v-o']);
  assert.equal(plan.reason.kind, 'new');
  assert.deepEqual(plan.steps, [], '문항은 하나씩 정한다');
  assert.equal(items.length, SETTINGS.amount, '분량만큼');
  assert.deepEqual(steps.filter(s => s.kind === 'meet').map(s => s.letter), plan.fresh);
  const checks = items.filter(i => i.check);
  assert.deepEqual(checks.map(i => [i.target.letter, i.type]), [['v-a', 'listen_pick'], ['v-a', 'see_pick'], ['v-eo', 'listen_pick'], ['v-eo', 'see_pick'], ['v-o', 'listen_pick'], ['v-o', 'see_pick']],
    '첫 글자는 비교할 글자가 생긴 뒤에 확인한다');
  assert.deepEqual(items.map(i => i.n), items.map((_, i) => i + 1));
  assert.equal(new Set(items.map(i => i.id)).size, items.length);
  const names = game.spy.calls.map(([name]) => name).filter(name => ['startSet', 'present', 'finishSet'].includes(name));
  assert.equal(names[0], 'startSet');
  assert.equal(names.filter(name => name === 'startSet').length, 1);
  assert.deepEqual(game.spy.calls.find(([name]) => name === 'startSet')[1], [{ length: SETTINGS.amount + 6 }]);
  assert.equal(setLength(5), 11);
  assert.deepEqual(game.spy.calls.at(-1).slice(0, 2), ['finishSet', [{ record: false }]]);
  const list = shown(await rows(game));
  assert.equal(new Set(list.map(e => e.setId)).size, 1, '회차 하나가 판 하나');
  for (const item of checks) assert.equal(list.find(e => e.itemKey === itemMetadata(item).itemKey).arm, 'host', '확인 문항은 제품 차례');
  game.door.dispose();
});

test('나눔 — 간격표(진도의 step · due)를 바꿔도 새 길 회차는 같다 · 밀린 수와 이유 한 줄의 글자는 코치 due()에서 온다(2회차 P2-4)', async () => {
  const ids = CORE.slice(0, 12);
  const seen = [];
  for (const due of ['2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z']) {
    const game = await opened();
    teach(game, ids.slice(0, 4));
    const base = metAll(ids);
    const p = { ...base, letters: Object.fromEntries(Object.entries(base.letters).map(([id, l], i) => [id, { ...l, due, step: i % 6 }])) };
    const { plan, items } = play(game, p);
    seen.push({ fresh: plan.fresh, reviews: plan.reviews, reason: plan.reason, items: items.map(i => [i.type, i.target, i.options ?? i.pieces ?? i.cards, i.difficulty]) });
    game.door.dispose();
  }
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(seen[0].reviews.length, 3, '새 글자가 있으면 셋까지');
  assert.ok(seen[0].reviews.every(id => ids.slice(0, 4).includes(id)), '돌아온 글자만 복습 자리에 선다');
  // 몫 — 밀린 수가 다르면 새 글자 수가 다르다(정답률 0.85: 다섯까지 둘, 그 위는 하나).
  const p = metAll(ids);
  const shape = count => shapeOf(p, pack, { now: new Date(T0).toISOString(), scope: 'device', sessionNo: 0, due: ids.slice(0, count) });
  assert.deepEqual([2, 5, 6].map(count => shape(count).fresh.length), [newCount(readProgress(p), 2), newCount(readProgress(p), 5), newCount(readProgress(p), 6)]);
  assert.deepEqual([shape(5).fresh.length, shape(6).fresh.length], [2, 1]);
  // 엔진만 아는 글자(제품이 만나지 않은 글자)도 밀린 수에는 들지만 복습 자리에는 서지 않는다.
  const far = shapeOf(p, pack, { now: new Date(T0).toISOString(), scope: 'device', sessionNo: 0, due: ALL.slice(-6) });
  assert.deepEqual([far.fresh.length, far.reviewSlots], [1, 0]);
});

test('이유 한 줄 — 「다시 볼 글자」는 첫 걸음이 복습일 때 · 「헷갈린 글자예요」는 그 문항이 헷갈린 짝의 두 글자를 묻는 짝 문항일 때만 · 첫 걸음이 복습이 아니면 돌아온 글자를 말하지 않는다(검수 Fable F1) · 돌아온 글자 · 헷갈린 짝은 칩으로 보이지 않는다(검수 -d GA1)', () => {
  const now = new Date(T0).toISOString();
  const p = { ...metAll(CORE.slice(0, 6), { ratio: 0.5 }), pairs: { 'v-a|v-eo': { wrong: 2, lastAt: new Date(T0 - DAY).toISOString() } } };
  const shape = shapeOf(p, pack, { now, scope: 'device', sessionNo: 0, due: ['v-a', 'v-eo', 'v-o'] });
  assert.deepEqual([shape.plan.reason, shape.plan.reviews, shape.fresh], [null, [], []], '뼈대만으로는 말하지 않는다');
  const review = (type, letter, options = []) => ({ kind: 'item', review: true, item: { type, target: { letter }, options: options.map(id => ({ letter: id })) } });
  const pair = reasonOf(shape, pack, review('pair', 'v-eo', ['v-eo', 'v-a']));
  assert.deepEqual([pair.kind, pair.letters, pair.finals], ['pair', [], []], '짝 문항의 두 글자를 미리 보이지 않는다');
  const other = reasonOf(shape, pack, review('pair', 'v-o', ['v-o', 'v-u']));
  assert.deepEqual([other.kind, other.letters], ['due', []], '헷갈린 적 없는 짝이면 돌아온 글자 줄 — 그 글자(첫 문항의 답)는 보이지 않는다');
  assert.deepEqual([reasonOf(shape, pack, review('see_pick', 'v-a')).kind, reasonOf(shape, pack, review('see_pick', 'v-a')).letters], ['due', []]);
  // 새 글자가 있으면 그 글자만 칩으로 보인다(만나기 카드가 먼저 가르친다). 돌아온 글자는 섞여 있어도 보이지 않는다.
  const withNew = shapeOf({ ...metAll(CORE.slice(0, 6), { ratio: 0.9 }), amount: 10 }, pack, { now, scope: 'device', sessionNo: 0, due: ['v-a'] });
  assert.ok(withNew.fresh.length > 0, '새 글자가 있는 회차');
  const mixed = reasonOf(withNew, pack, review('see_pick', 'v-a'));
  assert.deepEqual([mixed.kind, mixed.letters], ['mixed', withNew.fresh.map(id => pack.byId.get(id).glyph)]);
  assert.ok(!mixed.letters.includes('ㅏ'), '첫 복습 문항의 답은 칩에 없다');
  assert.equal(reasonOf(shape, pack, { kind: 'item', item: review('see_pick', 'v-a').item }).kind, 'practice', '복습 자리가 아닌 문항');
  assert.equal(reasonOf(shape, pack, null).kind, 'practice');
});

test('헷갈린 짝 — 두 글자가 모두 돌아왔으면 첫 복습을 짝 문항 꼴로 먼저 묻는다 · 한 글자만 돌아왔거나 돌아오지 않았으면 꼴 규칙 그대로다', async () => {
  const ids = CORE.slice(0, 8);
  const pairs = { 'v-a|v-eo': { wrong: 2, lastAt: new Date(T0 - DAY).toISOString() } };
  const first = async (old, { weak = true } = {}) => {
    const game = await opened();
    teach(game, old, { daysAgo: 20 }); // 기억은 시간 차례대로 쌓는다
    teach(game, ids.filter(id => !old.includes(id)), { daysAgo: 1 });
    const { steps } = play(game, { ...metAll(ids, { ratio: 0.85 }), amount: 10, ...(weak ? { pairs } : {}) });
    game.door.dispose();
    return steps[0];
  };
  const both = await first(['v-a', 'v-eo', 'c-g']);
  assert.deepEqual([both.review, both.item.type], [true, 'pair']);
  for (const old of [['v-a', 'c-g', 'c-n'], ['c-g', 'c-n', 'v-o']]) {
    const [withPair, without] = [await first(old), await first(old, { weak: false })];
    assert.equal(withPair.item.type, without.item.type, old.join());
  }
});

test('이유 한 줄의 글자는 회차가 실제로 묻는 글자다 — 밀린 글자가 스물을 넘어 엔진이 살릴 수 있는 것부터 고르는 날에도 칩은 첫 복습 글자이고, 복습 글자 목록은 선 복습 문항 그대로다(검수 Fable F1)', async () => {
  const glyph = id => pack.byId.get(id).glyph;
  for (const [count, daysAgo, ratio] of [[30, 20, 0.75], [30, 20, 0.97], [8, 6, 0.85]]) {
    const game = await opened();
    const ids = CORE.slice(0, count);
    teach(game, ids, { daysAgo });
    if (count > 20) assert.ok(game.coach.due().length > 20, '밀린 글자가 스물을 넘는다');
    const { plan, steps } = play(game, { ...metAll(ids, { ratio }), amount: 10 });
    const reviewed = steps.filter(s => s.review).map(s => s.item.target.letter);
    assert.ok(reviewed.length > 0 && steps[0].review, `${count} · ${ratio}: 첫 걸음이 복습`);
    assert.deepEqual(plan.reviews, reviewed);
    // 새 글자가 모두 받침이면 지금 판처럼 「새 받침」 줄이다(돌아온 글자를 말하지 않는다).
    // 칩은 새 글자만이다 — 첫 복습 문항의 답(돌아온 글자)을 미리 보이지 않는다(검수 -d GA1).
    const want = { due: [], mixed: plan.fresh.map(glyph), new: plan.reason.finalOnly ? plan.fresh.map(glyph) : null }[plan.reason.kind];
    assert.deepEqual(plan.reason.letters, want, `${count} · ${ratio} · ${plan.reason.kind}`);
    assert.ok(!plan.reason.letters.includes(glyph(reviewed[0])), '첫 복습 문항의 답은 칩에 없다');
    game.door.dispose();
  }
});

test('고르기 — 후보는 정한 꼴에서 만난 글자마다 하나이고 직전 글자는 없다 · 난도는 단에서 온다 · 엔진이 고른 문항은 그 후보 그대로 제시된다(arm adaptive)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 14);
  teach(game, ids);
  const { items } = play(game, metAll(ids, { ratio: 0.5 }));
  const asked = game.spy.calls.filter(([name]) => name === 'recommend').map(([, args]) => args[0]);
  assert.ok(asked.length >= items.length, '문항마다 묻는다');
  for (const list of asked) {
    const families = list.map(c => c.familyKey.split('.')[2]);
    assert.equal(new Set(families).size, families.length, '글자마다 하나');
    for (const c of list) assert.ok(c.difficulty <= 2, '단 2까지');
  }
  const list = shown(await rows(game));
  const adaptive = list.filter(e => e.arm === 'adaptive');
  assert.ok(adaptive.length >= 8, `엔진이 고른 문항 ${adaptive.length}`);
  for (const item of items) {
    const meta = itemMetadata(item, item.type === 'match' ? item.target.letter : null);
    const event = list.find(e => e.itemKey === meta.itemKey);
    assert.equal(event.difficulty, item.difficulty);
    assert.deepEqual(event.units, [`ko.hangul.${item.target.letter}`]);
  }
  for (let i = 1; i < items.length; i += 1) assert.notEqual(items[i].target.letter, items[i - 1].target.letter, '같은 글자가 바로 다시 나오지 않는다');
  game.door.dispose();
});

test('꼴 — 회차 꼴 규칙(만들기 3 · 짝 맞추기 2 · 짝 고르기 2 · 가르쳐 주기 1, 같은 꼴 세 번까지)이 지켜지고, 꼴을 다 만난 학습자의 3일 뒤 판이 한 꼴로 쏠리지 않는다(1회차 P2-4)', async () => {
  for (const amount of [10, 15]) {
    const game = await opened();
    teach(game, ALL, { daysAgo: 12 });
    const { items } = play(game, { ...metAll(ALL, { ratio: 0.5, difficulty: 3 }), amount });
    assert.equal(items.length, amount);
    const count = type => items.filter(i => i.type === type).length;
    assert.ok(count('build') <= 3 && count('match') <= 2 && count('pair') <= 2 && count('teach') <= 1, items.map(i => i.type).join(' '));
    for (let i = 3; i < items.length; i += 1) assert.ok(new Set(items.slice(i - 3, i + 1).map(x => x.type)).size > 1, '같은 꼴은 세 번까지');
    assert.ok(new Set(items.map(i => i.type)).size >= 4);
    game.door.dispose();
  }
});

test('새 글자 — 돌아온 것이 많은 날에도 회차마다 새 글자가 서고 복습은 셋까지다(1회차 P2-5)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 20);
  teach(game, ids, { daysAgo: 20 });
  const { plan, steps } = play(game, metAll(ids, { ratio: 0.75 }));
  assert.ok(game.coach.due().length > 0);
  assert.equal(plan.fresh.length, 1);
  assert.equal(plan.reviews.length, 3);
  const at = steps.findIndex(s => s.kind === 'meet');
  assert.equal(steps.slice(0, at).filter(s => s.kind === 'item').length, 3, '복습 셋 뒤에 새 글자');
  // 만나기 전 글자는 후보 · 보기 · 조각 · 카드 어디에도 나오지 않고, 확인 문항은 1단이다(단은 2).
  const known = new Set(ids);
  const used = item => (item.options ? item.options.map(o => o.letter) : item.cards ? item.cards.map(c => c.letter) : [...item.pieces.consonants, ...item.pieces.vowels, ...(item.pieces.finals ?? [])]).filter(Boolean);
  for (const step of steps) {
    if (step.kind === 'meet') { known.add(step.letter); continue; }
    if (step.item.word) continue;
    for (const id of used(step.item)) assert.ok(known.has(id), `만나기 전 글자 ${id}`);
  }
  const [firstAsk] = game.spy.calls.filter(([name]) => name === 'recommend').map(([, args]) => args[0].map(c => c.familyKey.split('.')[2]));
  assert.ok(firstAsk.every(id => ids.includes(id)), '복습 후보는 만난 글자뿐이다');
  const checks = steps.filter(s => s.item?.check).map(s => s.item);
  assert.deepEqual(checks.map(i => [i.type, i.difficulty]), [['listen_pick', 1], ['see_pick', 1]]);
  game.door.dispose();
});

test('새 글자 — 정답률 0.75 · 0.85로 하루 한 회차씩 풀면 핵심 글자를 다 만나는 날이 지금 판과 나흘 넘게 다르지 않다', { timeout: 120_000 }, async () => {
  for (const [acc, seed] of [[0.75, 1], [0.85, 2]]) {
    const randomOf = () => { let a = seed; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
    const coreDay = p => CORE.every(id => letterOf(p, id).state !== 'unmet');
    const game = await opened();
    let rand = randomOf(), p = emptyProgress(), next = null;
    for (let d = 0; d < 50 && next == null; d += 1) {
      game.clock.t = T0 + d * DAY;
      p = play(game, p, { correct: () => rand() < acc }).progress;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (coreDay(p)) next = d;
    }
    rand = randomOf(); p = emptyProgress();
    let now = null;
    for (let d = 0; d < 50 && now == null; d += 1) {
      const at = new Date(T0 + d * DAY).toISOString(), plan = planSession(p, pack, { now: at });
      let ok = 0, total = 0;
      for (const step of plan.steps) {
        if (step.kind === 'meet') { p = meet(p, [step.letter], at); continue; }
        const good = rand() < acc;
        p = answer(p, { focus: step.item.focus, correct: good, at, sessionId: plan.day, word: !!step.item.word });
        total += 1; if (good) ok += 1;
      }
      p = finishSession(p, { day: plan.day, sessionNo: 0, total, independent: ok });
      if (coreDay(p)) now = d;
    }
    assert.ok(next != null && now != null && Math.abs(next - now) <= 4, `${acc}: 새 길 ${next}일 · 지금 판 ${now}일`);
    game.door.dispose();
  }
});

test('다시 — 놓친 글자는 엔진의 「다시」로 한 단 쉽게 다시 서고, 맞히면 단이 돌아온다 · 제품의 다시 내기와 겹치지 않는다 · 「다시」는 글자마다 두 번까지다(1회차 P1-3 · 2회차 P2-2)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 14);
  teach(game, ids);
  const run = open(game, { ...metAll(ids, { ratio: 0.5, difficulty: 2 }), amount: 15 });
  const items = [];
  let step, target = null;
  while ((step = run.step())) {
    const { item } = step;
    items.push(item);
    if (!target) target = item.target.letter; // 첫 복습 글자를 늘 놓친다
    put(game, item, { correct: item.target.letter !== target });
  }
  run.end();
  const at = items.map((item, i) => [item, i]).filter(([item]) => item.target.letter === target);
  assert.equal(at[0][0].difficulty >= 1, true);
  assert.equal(at.length, 3, `놓친 글자가 처음 하나 + 「다시」 둘: ${letters(items)}`);
  for (const [item] of at.slice(1)) assert.equal(item.difficulty, 1, '단 − 1로 짓는다');
  for (let i = 1; i < at.length; i += 1) assert.ok(at[i][1] - at[i - 1][1] >= 3, '다른 문항 둘 뒤에');
  const list = shown(await rows(game)).filter(e => Date.parse(e.at) >= T0 && e.reason?.target === `ko.hangul.${target}`);
  assert.deepEqual(list.map(e => e.reason.code), ['unit.due', 'unit.retry', 'unit.retry'], '엔진의 「다시」로 적힌다');
  // 놓친 뒤 오래 쉬었다가(30분 넘게 · 새벽 4시를 넘겨) 이어 풀어도 같은 판이고 「다시」가 남는다(검수 GB1).
  for (const pause of [31 * 60_000, 18 * HOUR]) {
    const rest = await opened();
    teach(rest, ids);
    const later = open(rest, { ...metAll(ids, { ratio: 0.5, difficulty: 2 }), amount: 15 });
    const seen = [];
    let missed = null;
    while ((step = later.step())) {
      const { item } = step;
      seen.push(item.target.letter);
      if (!missed) { missed = item.target.letter; put(rest, item, { correct: false }); rest.clock.t += pause; continue; }
      put(rest, item, { correct: item.target.letter !== missed });
    }
    later.end();
    assert.equal(seen.filter(id => id === missed).length, 3, `쉰 시간 ${pause}`);
    const sets = new Set(shown(await rows(rest)).filter(e => Date.parse(e.at) >= T0).map(e => e.setId));
    assert.equal(sets.size, 1, `쉰 시간 ${pause}`);
    rest.door.dispose();
  }
  assert.ok(list.every(e => e.arm === 'adaptive'));
  // 맞히면 그 글자의 단이 돌아온다.
  const again = await opened();
  teach(again, ids);
  const second = open(again, { ...metAll(ids, { ratio: 0.5, difficulty: 2 }), amount: 15 });
  let missed = null, back = null;
  while ((step = second.step())) {
    const { item } = step;
    if (!missed) { missed = item.target.letter; put(again, item, { correct: false }); continue; }
    if (item.target.letter === missed) back = item;
    put(again, item);
  }
  second.end();
  assert.ok(back, '「다시」가 섰다');
  const asked = again.spy.calls.filter(([name]) => name === 'recommend').map(([, args]) => args[0].find(c => c.familyKey.endsWith(`.${missed}`) && !/\.(pair|match)\./.test(c.familyKey))?.difficulty).filter(Boolean);
  assert.deepEqual([asked[0], asked.includes(1), asked.at(-1)], [2, true, 2], '놓치면 1, 맞힌 뒤에는 2');
  game.door.dispose();
  again.door.dispose();
});

test('회차 길이 — 짝 맞추기가 든 회차(분량 5 · 10 · 15)에서도 회차 가운데 새 판이 열리지 않고, 기다리던 「다시」가 회차 끝까지 남는다(2회차 P2-1)', async () => {
  for (const amount of SETTINGS.amounts) for (const difficulty of [2, 3]) {
    const game = await opened();
    const ids = CORE.slice(0, 12);
    teach(game, ids);
    const { items } = play(game, { ...metAll(ids, { ratio: 0.5, difficulty }), amount }, { correct: (_item, n) => n % 3 !== 0 });
    assert.equal(items.length, amount);
    const list = shown(await rows(game)).filter(e => Date.parse(e.at) >= T0);
    assert.equal(new Set(list.map(e => e.setId)).size, 1, `분량 ${amount} · 단 ${difficulty}`);
    assert.equal(list.length, items.reduce((n, item) => n + (item.type === 'match' ? item.cards.length : 1), 0));
    if (amount === 15) assert.ok(items.filter(i => i.type === 'match').length === 2, '짝 맞추기 두 판이 든 회차를 본다');
    game.door.dispose();
  }
});

test('짝 맞추기 — 겨눈 글자가 먼저 제시되어 고른 줄이 그 제시에 적히고, 나머지 카드는 제품 차례다 · 카드마다 제시 하나 · 화면 차례로 불러도 같다', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 12);
  teach(game, ids);
  const { items } = play(game, { ...metAll(ids, { ratio: 0.5, difficulty: 3 }), amount: 15 });
  const matches = items.filter(i => i.type === 'match');
  assert.ok(matches.length && matches.every(m => m.cards.length === 4));
  assert.ok(matches.some(m => m.cards[0].letter !== m.target.letter), '겨눈 글자가 첫 카드가 아닌 판을 본다');
  const list = shown(await rows(game));
  for (const m of matches) {
    const events = m.cards.map(c => list.find(e => e.itemKey === itemMetadata(m, c.letter).itemKey));
    assert.equal(new Set(events.map(e => e.id)).size, 4, '카드마다 제시 하나');
    const target = list.find(e => e.itemKey === itemMetadata(m, m.target.letter).itemKey);
    assert.equal(target.arm, 'adaptive');
    for (const e of events) if (e !== target) assert.equal(e.arm, 'host');
    assert.ok(events.every(e => e.difficulty === 2), '짝 맞추기의 난도는 2까지');
  }
  game.door.dispose();
});

test('소리 — 소리가 끝까지 나지 않은 문항 뒤에는 보고 고르기이고(제품 차례도), 소리가 나면 풀린다 · 같은 글자가 바로 돌아오지 않는다(소리 실패 다섯 번 — 1회차 P2-6 · 2회차 P2-3)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 12);
  teach(game, ids);
  // 듣는 문항의 소리가 다섯 번 나지 않는다 — 실패마다 다음 문항은 보고 고르기이고, 그 문항에서 소리가 나면 풀려 다음 듣는 문항이 선다(검수 GB2).
  const run = open(game, { ...metAll(ids, { ratio: 0.5 }), amount: 15 });
  const items = [];
  let step, failures = 0, owed = false;
  while ((step = run.step())) {
    const { item } = step;
    const before = items.at(-1);
    items.push(item);
    if (before) assert.notEqual(item.target.letter, before.target.letter, '같은 글자가 바로 돌아오지 않는다');
    if (owed) { assert.equal(item.type, 'see_pick', '소리가 안 난 뒤'); owed = false; put(game, item); run.sounded(); continue; }
    if (item.type !== 'see_pick' && failures < 5) {
      failures += 1; owed = true; game.clock.t += 4000;
      const pids = item.type === 'match' ? item.cards.map(c => game.hangul.recorder.present(item, c.letter)) : [game.hangul.recorder.present(item)];
      for (const pid of pids) game.hangul.recorder.delivered(pid, false);
      for (const pid of pids) game.hangul.recorder.leave(pid);
      continue;
    }
    put(game, item);
  }
  run.end();
  assert.equal(failures, 5, items.map(i => i.type).join(' '));
  // 답한 뒤에 끊긴 소리(다음 문항으로 넘어감)는 소리 실패가 아니다.
  const other = await opened();
  teach(other, ids);
  const next = open(other, { ...metAll(ids, { ratio: 0.5 }), amount: 15 });
  const types = [];
  while ((step = next.step())) {
    const { item } = step;
    types.push(item.type);
    other.clock.t += 4000;
    if (item.type === 'match') { put(other, item); continue; }
    const pid = other.hangul.recorder.present(item);
    other.hangul.recorder.answer(pid, true);
    other.hangul.recorder.delivered(pid, false);
  }
  next.end();
  assert.ok(new Set(types).size >= 4, types.join(' '));
  // 새 글자 확인도 소리가 안 난 뒤에는 보고 고르기 하나다.
  const fresh = await opened();
  const first = open(fresh, emptyProgress());
  first.step(); first.step();
  const check = first.step().item;
  const pid = fresh.hangul.recorder.present(check);
  fresh.hangul.recorder.delivered(pid, false);
  fresh.hangul.recorder.leave(pid);
  const then = [];
  while ((step = first.step())) if (step.kind === 'item') then.push(step.item);
  assert.ok(then.every(i => i.type === 'see_pick'), then.map(i => i.type).join(' '));
  first.end();
  // 짝 맞추기에서 앞 카드의 소리가 끊겨도 뒤 카드의 소리가 나면 실패로 남지 않는다.
  const cards = await opened();
  teach(cards, ids);
  const last = open(cards, { ...metAll(ids, { ratio: 0.5 }), amount: 15 });
  const after = [];
  let matched = 0;
  while ((step = last.step())) {
    const { item } = step;
    if (matched) after.push(item.type);
    if (item.type !== 'match') { put(cards, item); continue; }
    matched += 1;
    cards.clock.t += 4000;
    const pids = item.cards.map(c => cards.hangul.recorder.present(item, c.letter));
    cards.hangul.recorder.delivered(pids[0], false);
    for (const one of pids.slice(1)) cards.hangul.recorder.delivered(one, true);
    for (const one of pids) cards.hangul.recorder.answer(one, true);
  }
  last.end();
  assert.ok(matched > 0 && after.some(type => type !== 'see_pick'), after.join(' '));
  assert.notDeepEqual(after.filter(type => type !== 'see_pick'), []);
  for (const g of [game, other, fresh, cards]) g.door.dispose();
});

test('할 것이 없으면(idle) 제품 차례다 — 채우기를 엔진 문항으로 내지 않는다 · 낱말 문항은 후보가 아니라 제품 차례로만 나온다 · 같은 낱말이 바로 다시 나오지 않는다', async () => {
  const game = await opened();
  const ids = [...CORE];
  teach(game, ids, { daysAgo: 0.02 }); // 방금 다 맞혔다 — 돌아온 것이 없다
  const p = { ...metAll(ids, { difficulty: 3, ratio: 0.5 }), amount: 15 };
  const words = [];
  for (let sessionNo = 0; sessionNo < 3; sessionNo += 1) {
    const { plan, items } = play(game, p, { sessionNo });
    assert.deepEqual([plan.reason.kind, plan.reviews, items.length], ['practice', [], 15]);
    for (let i = 1; i < items.length; i += 1) assert.notDeepEqual(items[i].target, items[i - 1].target);
    words.push(...items.filter(i => i.word));
  }
  assert.ok(words.length > 0);
  for (const [name, args, result] of game.spy.calls) if (name === 'recommend') {
    assert.ok(args[0].every(c => !/\.w/.test(c.familyKey)), '낱말은 후보가 아니다');
    assert.notEqual(result.status, 'ready', '이 장면에는 할 것이 없다');
  }
  // 제품 차례다. 제품이 우연히 엔진의 채우기 후보와 같은 문항을 지으면 그 제시만 채우기로 적힌다(드묾).
  const list = shown(await rows(game)).filter(e => Date.parse(e.at) >= T0);
  const fillers = list.filter(e => e.arm !== 'host');
  assert.ok(fillers.every(e => e.arm === 'filler') && fillers.length <= 2, `채우기로 적힌 제시 ${fillers.length}`);
  game.door.dispose();
});

test('제품이 만났지만 엔진 기억이 없는 글자(동의를 끈 계정 · 비운 뒤)는 엔진이 새것으로 세운다(1회차 P3-3 — 뜻한 동작)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 10);
  const { plan, items } = play(game, metAll(ids, { ratio: 0.5 }));
  assert.deepEqual(plan.reviews, [], '돌아온 글자가 없다');
  const list = shown(await rows(game));
  const picked = items.filter(i => !i.word).map(i => list.find(e => e.itemKey === itemMetadata(i, i.type === 'match' ? i.target.letter : null).itemKey));
  assert.ok(picked.some(e => e.arm === 'adaptive' && e.reason.code === 'unit.new'));
  game.door.dispose();
});

test('levels 밖 난도의 문항은 제시가 던져도 기록 없이 낸다(2회차 P3-1) · 계열 단위로 새지 않는다', async () => {
  const game = await opened();
  const run = open(game, metAll(CORE.slice(0, 6)));
  const item = { type: 'pair', target: { letter: 'v-a', text: '아' }, options: [{ text: '아' }, { text: '어' }], skill: 'ko.hangul.sound', difficulty: 3, focus: ['v-a'] };
  assert.equal(game.hangul.recorder.present(item), null);
  for (const fn of ['delivered', 'answer', 'leave', 'replay', 'helped', 'shown']) assert.doesNotThrow(() => game.hangul.recorder[fn](null, true));
  run.end();
  assert.deepEqual(shown(await rows(game)), []);
  game.door.dispose();
});

test('그만두기 · 틀을 떠남 — 답하지 않은 제시를 unanswered로 닫고 판을 기록 없이 닫는다 · 판 기록(set.decided · completed)은 남지 않는다', async () => {
  for (const way of ['end', 'pagehide', 'next']) {
    const game = await opened();
    const ids = CORE.slice(0, 8);
    teach(game, ids);
    const run = open(game, metAll(ids, { ratio: 0.5 }));
    const { item } = run.step();
    const pids = item.type === 'match' ? item.cards.map(c => game.hangul.recorder.present(item, c.letter)) : [game.hangul.recorder.present(item)];
    if (way === 'end') run.end();
    else if (way === 'pagehide') game.leave();
    else open(game, metAll(ids, { ratio: 0.5 }), { sessionNo: 1 }); // 닫지 않은 앞 회차가 있으면 새 회차가 먼저 닫는다
    const list = await rows(game);
    const answers = list.filter(e => e.type === 'practice.attempted' && pids.includes(e.presentationId));
    assert.deepEqual(answers.map(e => e.verdict), pids.map(() => 'unassessed'), way);
    assert.ok(game.spy.calls.some(([name, args]) => name === 'finishSet' && args[0]?.record === false), way);
    assert.ok(!list.some(e => e.type === 'decision.made' || e.type === 'experience.completed'));
    run.end();
    game.door.dispose();
  }
});

test('겉이 닫히면(RUN_ENDED) 회차는 제품 차례로 기록 없이 끝까지 간다 · 판을 다시 정하면 retired이고 그 회차는 기록하지 않는다', async () => {
  for (const way of ['close', 'retire']) {
    const game = await opened();
    const ids = CORE.slice(0, 10);
    teach(game, ids);
    const run = open(game, metAll(ids, { ratio: 0.5 }));
    put(game, run.step().item);
    const before = game.spy.calls.filter(([name]) => name === 'present').length;
    if (way === 'close') game.close(); else game.retire();
    let n = 1, step, last = null;
    while ((step = run.step())) {
      n += 1;
      assert.notEqual(step.item.target.letter ?? step.item.target.text, last);
      last = step.item.target.letter ?? step.item.target.text;
      assert.equal(game.hangul.recorder.present(step.item, step.item.target.letter), null);
    }
    assert.equal(n, 10, way);
    run.end();
    assert.equal(game.spy.calls.filter(([name]) => name === 'present').length, before, '닫힌 뒤에는 적지 않는다');
    assert.equal(game.hangul.retired, way === 'retire');
    game.door.dispose();
  }
});

test('겉이 닫힌 것을 한 번 보거나 판을 다시 정하면 그 겉을 더 부르지 않는다', () => {
  const item = { type: 'see_pick', target: { letter: 'v-a', text: '아' }, options: [{ text: '아' }, { text: '어' }], skill: 'ko.hangul.read', difficulty: 1, focus: ['v-a'] };
  for (const way of ['ended', 'retired', 'broken']) {
    let calls = 0, retire = null;
    const fail = () => { calls += 1; throw Object.assign(new Error(way), { code: way === 'ended' ? 'RUN_ENDED' : 'BROKEN' }); };
    const hangul = createHangul({ onRetired: fn => { retire = fn; }, present: way === 'retired' ? () => { calls += 1; return 'p'; } : fail }, { win: null });
    if (way === 'retired') retire({ reason: 'account' });
    assert.equal(hangul.recorder.present(item), null);
    assert.equal(hangul.recorder.present(item), null);
    assert.equal(calls, { ended: 1, retired: 0, broken: 2 }[way], way);
  }
});

test('고르기가 던져도(RUN_ENDED 밖의 오류) 그 문항만 제품 차례로 가고 기록은 이어진다', async () => {
  const game = await opened({ fake: { recommend() { throw new Error('고르기 실패'); } } });
  const ids = CORE.slice(0, 10);
  teach(game, ids);
  const { items } = play(game, metAll(ids, { ratio: 0.5 }));
  assert.equal(items.length, 10);
  const list = shown(await rows(game)).filter(e => Date.parse(e.at) >= T0);
  assert.ok(list.length >= 10 && list.every(e => e.arm === 'host'));
  game.door.dispose();
});

test('졸업한 뒤 — 몸풀기 분량(다섯)이고, 남은 글자(된소리 · 겹모음)는 이어서 만난다 · 이유 한 줄은 지금 판과 같은 갈래다', async () => {
  const game = await opened();
  teach(game, CORE, { daysAgo: 15 });
  const p = { ...metAll(CORE, { ratio: 0.5 }), amount: 15, graduated: { at: '2026-11-01T00:00:00.000Z', day: '2026-11-01' } };
  const { plan, items } = play(game, p);
  assert.deepEqual([plan.warmup, plan.reason.kind, plan.fresh.length, items.length], [true, 'warmup', 0, SETTINGS.warmup]);
  const more = shapeOf({ ...p, recent: Array.from({ length: 20 }, () => ({ ok: true })) }, pack, { now: new Date(T0).toISOString(), scope: 'device', sessionNo: 0, due: [] });
  assert.deepEqual(more.fresh, nextLetters(readProgress(p), pack, 2), '졸업 뒤에도 새 글자를 이어서 만난다');
  assert.ok(metIds(readProgress(p), pack).length < ALL.length);
  game.door.dispose();
});

test('도움 — 다시 듣기 · 천천히 다시 듣기 · 시범이 답을 보임이 그 제시의 도움(replay · hint · answer)으로 적힌다(검수 카본 B1)', async () => {
  const game = await opened();
  const ids = CORE.slice(0, 8);
  teach(game, ids);
  const run = open(game, metAll(ids, { ratio: 0.5 }));
  const { item } = run.step();
  const pid = item.type === 'match' ? game.hangul.recorder.present(item, item.target.letter) : game.hangul.recorder.present(item);
  game.clock.t += 1000; game.hangul.recorder.replay(pid);
  game.clock.t += 1000; game.hangul.recorder.helped(pid);
  game.clock.t += 1000; game.hangul.recorder.shown(pid);
  game.clock.t += 1000; game.hangul.recorder.answer(pid, true);
  run.end();
  const list = await rows(game);
  assert.deepEqual(list.filter(e => e.type === 'practice.helped' && e.presentationId === pid).map(e => e.helpId), ['replay', 'hint', 'answer']);
  game.door.dispose();
});
