// 환승 러시의 실제 묶음(atlas-learning.js)으로 본다: 60문항 전부의 기록 · 초급과 중급 근거의 분리 · 기존 묶음과 함께 쓰는 계정 호스트 · 재방문 입구.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { reviewItems } from './review-items.mjs';
import { practiceStarts, journeyFrom, reviewDecisions } from './journeys.mjs';
import { GAME_ID, decisionMeta, missedPractice, entryNote, patternOfFamily, preferJourney, RETURN_PATTERNS, reviewedKey } from './learning.mjs';
import { buildJourney } from './journeys.mjs';

const require = createRequire(import.meta.url);
const { createWorldLearningHost } = require('../../account/world-learning-host.js');
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
function load(rel, host = null) {
  const context = vm.createContext({ crypto: globalThis.crypto, structuredClone, TextEncoder, TextDecoder, setTimeout, clearTimeout, console, AbortController, DOMException });
  if (host) { context.window = context; context.SYNKLearningHost = host; context.location = { origin: 'https://synk.im', protocol: 'https:' }; }
  vm.runInContext(read(rel), context);
  return { api: context.SynkLearning, value: (v) => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(v))})`, context) };
}
// 게임은 묶음과 같은 창에서 부른다: 시험도 값을 그 창의 객체로 넘긴다(Trail이 선택 기록의 원형을 본다).
const realm = new WeakMap();
function coachOf(rel, options, host = null) { const { api, value } = load(rel, host), coach = api.createGame(options); realm.set(coach, value); return coach; }
const memory = () => { const rows = new Map(); return { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: (k) => rows.delete(k) }; };
const clockFrom = (at = '2026-11-05T00:00:00Z') => { let tick = Date.parse(at); return () => new Date(tick += 1000).toISOString(); };
const plain = (value) => JSON.parse(JSON.stringify(value));
const game = (storage = memory(), id = GAME_ID) => coachOf('./atlas-learning.js', { gameId: id, storage, clock: clockFrom() });
const skillCell = (summary, id) => { const row = summary.skills.find((s) => s.id === id); return row ? Object.values(row.levels).flatMap((l) => Object.values(l.formats)).reduce((n, f) => n + f.n, 0) : null; };

function answer(coach, meta, correct, { help = null, audio = 'completed', assessable = true, selectedId = correct ? 'subway.right' : 'subway.left', reason } = {}) {
  const pid = coach.present(plain(meta));
  coach.delivery(pid, { audio });
  if (help) coach.help(pid, help);
  return coach.answer(pid, realm.get(coach)({ correct, assessable, ...(reason ? { reason } : {}), ...(selectedId ? { choice: { selectedId, correctId: 'subway.right' } } : {}) }));
}
const metaOf = (level, id) => { const row = practiceStarts(level).get(id); assert.ok(row, id); return decisionMeta(row.decision); };

test('공개 60문항 전부: 출제 · 전달 · 응답 · 다시 읽기, 기계 키는 ASCII, 문항 원고는 그대로', () => {
  const rows = reviewItems();
  assert.equal(rows.length, 60);
  const storage = memory(), coach = game(storage);
  for (const row of rows) {
    for (const key of [row.id, row.itemKey, row.familyKey]) assert.match(key, /^[a-zA-Z0-9_.:-]{1,120}$/);
    const result = answer(coach, row, true, { selectedId: row.correctId.replace(/^.*\./, 'subway.'), reason: undefined });
    assert.equal(result.verdict, 'correct', row.id);
    assert.equal(answer(game(), row, false).independent, true, `처음 듣고 혼자 답한 근거: ${row.id}`);
  }
  const reopened = game(storage), events = reopened.events();
  for (const type of ['practice.presented', 'practice.delivery', 'practice.attempted']) assert.equal(events.filter((e) => e.type === type).length, 60, type);
  assert.deepEqual(new Set(events.filter((e) => e.type === 'practice.presented').map((e) => e.itemKey)), new Set(rows.map((r) => r.itemKey)));
});

test('중급 13문항의 근거는 초급 칸에 합쳐지지 않고, 기존 TOPIK I 묶음은 그대로 건너뛴다', () => {
  const rows = reviewItems(), storage = memory(), coach = game(storage);
  const ko2 = rows.filter((r) => r.skillId.startsWith('ko2.')), ko = rows.filter((r) => !r.skillId.startsWith('ko2.'));
  assert.equal(ko2.length, 13);
  for (const row of ko2) answer(coach, row, false);
  const summary = coach.summary();
  assert.ok(skillCell(summary, 'ko2.listening.detail') > 0);
  assert.equal(skillCell(summary, 'ko.listening.detail'), 0);
  assert.ok(ko.length === 47);
  const other = coachOf('../korean-racing/atlas-learning.js', { gameId: 'korean-racing', storage, clock: clockFrom('2026-11-05T01:00:00Z') });
  const read = other.summary();
  assert.equal(read.storage.available, true);
  assert.equal(read.skills.some((s) => s.id.startsWith('ko2.')), false);
  assert.equal(skillCell(read, 'ko.listening.detail'), 0);
  assert.throws(() => other.present(plain(ko2[0])), /invalid measured item/, '공통 묶음의 식별자 · 지도 검사는 그대로다');
  assert.throws(() => coach.present({ ...plain(ko[0]), itemKey: 'subway-rush.fork.청량리.jongno3.v1' }), /invalid measured item/);
});

test('옮기기 전 키의 검수 판정이 이어지고, 다른 문항의 키는 그대로다', () => {
  const verdicts = new Map(JSON.parse(read('../topik-items/review/existing-verdicts.json')).items.map((row) => [row.itemKey, row]));
  const moved = reviewItems().filter((row) => reviewedKey(row.itemKey) !== row.itemKey);
  assert.equal(moved.length, 4);
  for (const row of moved) {
    assert.match(row.itemKey, /^subway-rush\.fork\.cheongnyangni\.[a-z0-9]+\.v1$/);
    assert.equal(row.familyKey, 'subway-rush.fork.cheongnyangni.v1');
    assert.equal((verdicts.get(row.itemKey) || verdicts.get(reviewedKey(row.itemKey))).verdict, 'pass');
    assert.match(row.script.at(-1).text, /청량리 방면이에요/, '표시 · 음성 문장은 그대로');
  }
});

test('계정 호스트: 기존 묶음이 계정 기록을 맡고 이 게임의 묶음만 중급을 받는다', async () => {
  const rows = new Map(), storage = { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: (k) => rows.delete(k) };
  const posted = [], engine = load('../korean-racing/atlas-learning.js').api.engine;
  const transport = { get: async ({ revision }) => ({ ok: true, events: [], cursor: 0, hasMore: false, revision }), post: async ({ revision, events }) => { posted.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; } };
  const host = createWorldLearningHost({ accountKey: 'synthetic-account', revision: 1, storage, transport, guard() {}, connected: true, engine });
  const coach = coachOf('./atlas-learning.js', { gameId: GAME_ID, storage: memory(), clock: clockFrom() }, host);
  for (const row of reviewItems()) answer(coach, row, true, { selectedId: row.correctId.replace(/^.*\./, 'subway.') });
  coach.flush();
  await host.retry();
  for (let i = 0; i < 200 && posted.filter((e) => e.type === 'practice.attempted').length < 60; i++) await new Promise((res) => setTimeout(res, 20));
  assert.equal(posted.filter((e) => e.type === 'practice.attempted').length, 60);
  assert.equal(posted.filter((e) => e.type === 'practice.presented' && e.measure.skillId.startsWith('ko2.')).length, 13);
  assert.equal(host.status().phase === 'blocked', false);
  host.stop();
});

test('추천이 살아 있다: 초급 · 중급 후보 모두 예외 없이 아틀라스가 고른 판을 앞세운다', () => {
  for (const level of ['basic', 'busy']) {
    const coach = game(), journeys = Array.from({ length: 12 }, (_, i) => buildJourney({ seed: 101 + i * 7919, level }));
    const items = [...new Map(journeys.flatMap((j) => j.decisions).filter((d) => d.assessable).map((d) => [d.id, d])).values()].map((d) => { const m = decisionMeta(d); return { id: m.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: [], audioRequired: true }; });
    const picked = coach.recommend(plain(items), { audioAvailable: true });
    assert.equal(picked.status, 'ready');
    assert.ok(preferJourney(coach, journeys).decisions.some((d) => `${GAME_ID}.${d.id}` === picked.selected.id));
  }
});

test('맞춤 판의 첫 문항은 그 결정이고, 첫 안내는 그 결정 앞에서 들었을 길 안내다(검수 맥락과 같다, 이미 내린 출구 판은 앞 안내 없음)', () => {
  const reviewed = new Map(reviewDecisions().map((r) => [r.decision.id, r]));
  for (const level of ['basic', 'busy']) for (const row of practiceStarts(level).values()) {
    const journey = journeyFrom(row), first = journey.decisions[0];
    assert.equal(first.id, row.decision.id);
    assert.equal(first.assessable, true);
    if (first.kind === 'exit') assert.equal(journey.opening, null, first.id);
    else assert.ok(reviewed.get(first.id).context.some((line) => line.voice === journey.opening.voice), first.id);
    assert.equal(journey.decisions.at(-1).kind, 'exit');
  }
  const all = new Set([...practiceStarts('basic').keys(), ...practiceStarts('busy').keys()]);
  assert.deepEqual(new Set(reviewDecisions().map((r) => r.decision.id)), all, '모든 변형을 첫 문항으로 낼 수 있다');
});

test('출구 맞춤 판 15개 전수: 도착한 역에서 시작하고 그 역에 내리라는 안내 없이 출구 안내가 첫 소리다', () => {
  const rows = (level) => [...practiceStarts(level).values()].filter((row) => row.decision.kind === 'exit');
  assert.equal(rows('basic').length, 8); assert.equal(rows('busy').length, 7);
  for (const level of ['basic', 'busy']) for (const row of rows(level)) {
    const journey = journeyFrom(row), [first] = journey.decisions;
    assert.equal(journey.start, first.station, first.id);
    assert.equal(journey.opening, null, first.id);
    assert.equal(journey.focus, first.id);
    assert.equal(first.assessable, true);
    assert.ok(/exit|closed/.test(patternOfFamily(decisionMeta(first).familyKey)), first.id);
    const firstSound = first.lead || first.line_;   // 앱은 lead, 안내 차례로 튼다
    assert.ok(/번 출구/.test(firstSound.text), first.id);
    assert.ok(!/내리세요|까지 가세요|갈아타세요/.test(firstSound.text + first.line_.text), first.id);
  }
});

test('다른 맞춤 판의 첫 안내는 출발역에서 내리거나 출발역까지 가라고 하지 않는다', () => {
  for (const level of ['basic', 'busy']) for (const row of practiceStarts(level).values()) {
    const journey = journeyFrom(row);
    if (!journey.opening) continue;
    assert.ok(!journey.opening.text.includes(`${journey.start}에서 내리세요`) && !journey.opening.text.includes(`${journey.start}까지 가세요`), row.decision.id + ' ' + journey.opening.text);
  }
});

test('서로 다른 내릴 역 문항 둘을 혼자 놓치면 짚은 단서를 말하고, 같은 유형의 새 문항이 실제 첫 평가다', () => {
  const coach = game();
  answer(coach, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: 'subway.right' });
  answer(coach, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: 'subway.left' });
  const plan = missedPractice(coach, 'basic');
  assert.equal(plan.patternId, 'off');
  assert.match(plan.why, /‘내리실 문은’ 뒤에 나오는 문 쪽/);
  const first = plan.journey.decisions[0];
  assert.equal(patternOfFamily(decisionMeta(first).familyKey), 'off');
  assert.ok(![decisionMeta(first).familyKey].some((f) => plan.missedFamilies.includes(f)), '새 문항');
  assert.equal(coach.exposure(plain(decisionMeta(first))).seen, false);
  const line = entryNote(coach, plan);
  assert.match(line, /놓친 적이 있어요/);
  assert.doesNotMatch(line, /왼쪽|오른쪽|\d번/, '정답 쪽을 미리 말하지 않는다');
  const station = game();
  answer(station, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: 'subway.stay' });
  answer(station, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: 'subway.stay' });
  assert.match(missedPractice(station, 'basic').why, /역 이름을 놓쳐/);
  const mixed = game();
  answer(mixed, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: 'subway.stay' });
  answer(mixed, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: 'subway.left' });
  assert.equal(missedPractice(mixed, 'basic').why, RETURN_PATTERNS.off.why);
});

test('회복하면 해제: 예고한 유형을 혼자 맞히면 놓침 안내가 사라진다', () => {
  const coach = game();
  answer(coach, metaOf('basic', 'exit.1'), false); answer(coach, metaOf('basic', 'exit.2'), false);
  let plan = missedPractice(coach, 'basic');
  assert.equal(plan.patternId, 'exit');
  answer(coach, plan.target.meta, true);
  plan = missedPractice(coach, 'basic');
  assert.equal(plan?.patternId, 'exit', '최근 셋 중 둘을 놓쳤으면 아직 남는다');
  answer(coach, plan.target.meta, true);
  assert.equal(missedPractice(coach, 'basic'), null);
  assert.doesNotMatch(entryNote(coach) || '', /놓친/);
});

test('놓침으로 말하지 않는 경우: 한 번만 틀림 · 도움 · 소리 실패 · 평가 불가 · 같은 문항 되풀이 · 다른 게임 · 다른 기기 기록 · 첫 방문', () => {
  const first = game();
  assert.equal(missedPractice(first, 'basic'), null);
  assert.equal(entryNote(first), null);
  assert.equal(missedPractice(null, 'basic'), null);
  assert.equal(entryNote(null), null);

  const once = game();
  answer(once, metaOf('basic', 'exit.1'), false);
  assert.equal(missedPractice(once, 'basic'), null);
  assert.equal(entryNote(once), null);

  const helped = game();
  answer(helped, metaOf('basic', 'exit.1'), false, { help: 'replay' }); answer(helped, metaOf('basic', 'exit.2'), false, { help: 'text' });
  assert.equal(missedPractice(helped, 'basic'), null);
  assert.match(entryNote(helped), /다시 듣기나 글 보기/);
  assert.doesNotMatch(entryNote(helped), /놓친/);

  const audio = game();
  answer(audio, metaOf('basic', 'exit.1'), false, { audio: 'failed' }); answer(audio, metaOf('basic', 'exit.2'), false, { audio: 'failed' });
  assert.equal(missedPractice(audio, 'basic'), null);
  assert.match(entryNote(audio), /소리가 끊긴/);
  assert.doesNotMatch(entryNote(audio), /놓친/);

  const unassessed = game(), guess = metaOf('basic', 'stop.chungjeongno.pass.left');
  const recorded = answer(unassessed, { ...guess, id: `${GAME_ID}.stop.ahyeon.pass.left`, itemKey: `${GAME_ID}.stop.ahyeon.pass.left.v1`, familyKey: `${GAME_ID}.stop.ahyeon.pass.v1` }, true, { assessable: false });
  assert.equal(recorded.verdict, 'unassessed');
  assert.equal(unassessed.events().filter((e) => e.type === 'practice.attempted').length, 1, '응답이 빠지지 않는다');
  assert.equal(entryNote(unassessed), null);

  const same = game();
  answer(same, metaOf('basic', 'exit.1'), false); answer(same, metaOf('basic', 'exit.1'), false);
  assert.equal(missedPractice(same, 'basic'), null, '같은 계열을 되풀이해 근거를 부풀리지 않는다');

  const storage = memory(), other = game(storage, 'korean-rhythm');
  answer(other, metaOf('basic', 'exit.1'), false); answer(other, metaOf('basic', 'exit.2'), false);
  const here = game(storage);
  assert.equal(missedPractice(here, 'basic'), null);
  assert.equal(entryNote(here), null);

  const incomplete = coachOf('./atlas-learning.js', { gameId: GAME_ID, storage: memory(), clock: clockFrom(), historyComplete: false });
  answer(incomplete, metaOf('basic', 'exit.1'), false); answer(incomplete, metaOf('basic', 'exit.2'), false);
  assert.equal(missedPractice(incomplete, 'basic'), null);
  assert.equal(entryNote(incomplete), null);
});

test('혼자 맞힌 기록은 사실만 말하고, 중급 오답은 초급 입구에서 말하지 않는다', () => {
  const solo = game();
  answer(solo, metaOf('basic', 'exit.1'), true); answer(solo, metaOf('basic', 'exit.2'), true);
  assert.equal(missedPractice(solo, 'basic'), null);
  assert.match(entryNote(solo), /안내 2개를 처음 듣고 도움 없이 맞혔어요/);

  const busy = game();
  answer(busy, metaOf('busy', 'busy.exit.3.4'), false); answer(busy, metaOf('busy', 'busy.exit.1.2'), false);
  assert.equal(missedPractice(busy, 'basic'), null);
  const plan = missedPractice(busy, 'busy');
  assert.equal(plan.patternId, 'closed');
  assert.equal(plan.journey.level, 'busy');
  assert.match(decisionMeta(plan.journey.decisions[0]).skillId, /^ko2\./);
  assert.equal(skillCell(busy.summary(), 'ko.listening.detail'), 0);
  assert.equal(busy.summary().skills.find((s) => s.id === 'ko2.listening.detail').levels[1].formats['single-choice'].incorrect, 2);
});

// 내릴 역 구체화는 공통 판정이 내준 최근 독립 근거(plan.evidenceIds)의 오답과 그 선택 사실만 읽는다.
const OFF_DOOR = /‘내리실 문은’ 뒤에 나오는 문 쪽/, OFF_STATION = /역 이름을 놓쳐/;
const off = (id, level = 'basic') => metaOf(level, `stop.${id}.off.left`);
const offWhyOf = (coach, level = 'basic') => { const plan = missedPractice(coach, level); assert.equal(plan?.patternId, 'off'); return plan.why; };

test('재현: 선택 없는 독립 오답 둘 뒤의 도움 받은 문 쪽 오답은 구체 원인이 되지 않는다(다시 열어도 같다)', () => {
  const storage = memory(), coach = game(storage);
  const a = answer(coach, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: null });
  const b = answer(coach, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: null });
  const helped = answer(coach, metaOf('basic', 'stop.cityhall.off.right'), false, { help: 'replay', selectedId: 'subway.left' });
  assert.equal(a.independent && b.independent, true);
  assert.equal(helped.independent, false);
  const plan = missedPractice(coach, 'basic');
  assert.equal(plan.patternId, 'off');
  assert.equal(plan.evidenceIds.length, 2, '도움 받은 응답은 근거에 없다');
  assert.equal(plan.why, RETURN_PATTERNS.off.why);
  assert.doesNotMatch(plan.why, OFF_DOOR);
  assert.equal(offWhyOf(game(storage)), RETURN_PATTERNS.off.why);
});

test('소리가 끊긴 응답의 선택도 구체 원인이 되지 않고, 소리를 끝까지 들은 같은 선택만 구체 원인이 된다', () => {
  const failed = game();
  answer(failed, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: null });
  answer(failed, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: null });
  answer(failed, metaOf('basic', 'stop.cityhall.off.right'), false, { audio: 'failed', selectedId: 'subway.stay' });
  assert.equal(offWhyOf(failed), RETURN_PATTERNS.off.why);

  const completed = game();
  answer(completed, metaOf('basic', 'stop.cityhall.off.left'), false, { audio: 'completed', selectedId: 'subway.right' });
  answer(completed, metaOf('basic', 'stop.jongno5.off.right'), false, { audio: 'completed', selectedId: 'subway.left' });
  assert.match(offWhyOf(completed), OFF_DOOR);
});

test('도움 받은 다른 쪽 선택은 독립 근거의 구체화를 가로채지 못한다', () => {
  const coach = game();
  answer(coach, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: 'subway.right' });
  answer(coach, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: 'subway.left' });
  answer(coach, metaOf('basic', 'stop.cityhall.off.right'), false, { help: 'text', selectedId: 'subway.stay' });
  assert.match(offWhyOf(coach), OFF_DOOR);
});

test('최근 근거 밖의 예전 오답은 구체화를 가로채지 못하고, 최근 근거의 정답은 원인으로 세지 않는다', () => {
  const older = game();
  answer(older, off('cityhall', 'busy'), false, { selectedId: 'subway.stay' });
  answer(older, off('jongno3', 'busy'), false, { selectedId: 'subway.right' });
  answer(older, off('euljiro3', 'busy'), false, { selectedId: 'subway.left' });
  answer(older, off('jongno5', 'busy'), false, { selectedId: 'subway.right' });
  assert.match(offWhyOf(older, 'busy'), OFF_DOOR);

  // 같은 계열을 다시 만난 응답은 도움이 없어도 독립 근거가 아니다. 계열로 훑으면 이 선택이 근거의 역 쪽 오답을 가린다.
  const repeated = game();
  answer(repeated, metaOf('basic', 'stop.cityhall.off.left'), false, { selectedId: 'subway.stay' });
  answer(repeated, metaOf('basic', 'stop.jongno5.off.right'), false, { selectedId: 'subway.stay' });
  const again = answer(repeated, metaOf('basic', 'stop.cityhall.off.right'), false, { selectedId: 'subway.left' });
  assert.equal(again.independent, false);
  assert.equal(missedPractice(repeated, 'basic').evidenceIds.length, 2);
  assert.match(offWhyOf(repeated), OFF_STATION);

  const station = game();
  answer(station, off('cityhall', 'busy'), false, { selectedId: 'subway.left' });
  answer(station, off('jongno3', 'busy'), false, { selectedId: 'subway.stay' });
  answer(station, off('euljiro3', 'busy'), false, { selectedId: 'subway.stay' });
  answer(station, off('jongno5', 'busy'), false, { selectedId: 'subway.stay' });
  assert.match(offWhyOf(station, 'busy'), OFF_STATION);

  const recovered = game();
  answer(recovered, off('cityhall'), false, { selectedId: 'subway.right' });
  answer(recovered, off('jongno5'), false, { selectedId: 'subway.left' });
  answer(recovered, off('jongno3'), true, { selectedId: 'subway.stay' });
  assert.match(offWhyOf(recovered), OFF_DOOR);
});

test('근거 안에 선택 없는 오답 · 문과 역의 혼재 · 모르는 선택이 있으면 유형 안내로 둔다', () => {
  for (const picks of [[null, 'subway.left'], ['subway.stay', null], ['subway.stay', 'subway.left'], ['subway.left', 'subway.unknown']]) {
    const coach = game();
    answer(coach, off('cityhall'), false, { selectedId: picks[0] });
    answer(coach, off('jongno5'), false, { selectedId: picks[1] });
    assert.equal(offWhyOf(coach), RETURN_PATTERNS.off.why, String(picks));
  }
});

test('다른 게임의 선택은 이 게임의 구체화에 들어오지 않는다', () => {
  const storage = memory(), other = game(storage, 'korean-rhythm');
  answer(other, off('dongdaemun'), false, { selectedId: 'subway.right' });
  const here = game(storage);
  answer(here, off('cityhall'), false, { selectedId: null });
  answer(here, off('jongno5'), false, { selectedId: null });
  assert.equal(offWhyOf(here), RETURN_PATTERNS.off.why);
});

test('구체 안내도 두 번 회복하면 해제된다', () => {
  const coach = game();
  answer(coach, off('cityhall'), false, { selectedId: 'subway.right' });
  answer(coach, off('jongno5'), false, { selectedId: 'subway.left' });
  let plan = missedPractice(coach, 'basic');
  assert.match(plan.why, OFF_DOOR);
  answer(coach, plan.target.meta, true);
  plan = missedPractice(coach, 'basic');
  assert.match(plan.why, OFF_DOOR, '최근 셋 중 둘을 놓쳤으면 아직 남는다');
  answer(coach, plan.target.meta, true);
  assert.equal(missedPractice(coach, 'basic'), null);
  assert.doesNotMatch(entryNote(coach) || '', /놓친/);
});

const FIVE = Object.freeze([
  ['off', 'basic', 'stop.cityhall.off.left', 'stop.jongno5.off.right'],
  ['pass', 'basic', 'stop.chungjeongno.pass.left', 'stop.jongno3.pass.left'],
  ['exit', 'basic', 'exit.1', 'exit.2'],
  ['closed', 'busy', 'busy.exit.3.4', 'busy.exit.1.2'],
  ['service', 'busy', 'busy.short.right', 'busy.delay.1to2'],
]);
for (const [pattern, level, first, second] of FIVE) {
  test(`${pattern}: 서로 다른 두 문항을 혼자 놓치면 예고하고, 한 번 · 정답 · 도움 · 소리 실패는 놓침으로 말하지 않는다`, () => {
    const missed = game();
    answer(missed, metaOf(level, first), false, { selectedId: null });
    answer(missed, metaOf(level, second), false, { selectedId: null });
    const plan = missedPractice(missed, level);
    assert.equal(plan.patternId, pattern);
    assert.equal(plan.why, RETURN_PATTERNS[pattern].why);
    assert.match(plan.why, /^전에 /, '저장 근거는 여러 판에 걸칠 수 있다');
    assert.equal(patternOfFamily(decisionMeta(plan.journey.decisions[0]).familyKey), pattern);
    assert.equal(entryNote(missed, plan), `${plan.why} ${plan.next}`);

    const once = game();
    answer(once, metaOf(level, first), false);
    assert.equal(missedPractice(once, level), null);
    assert.equal(entryNote(once), null);

    const right = game();
    answer(right, metaOf(level, first), true); answer(right, metaOf(level, second), true);
    assert.equal(missedPractice(right, level), null);
    assert.equal(entryNote(right), '지금까지 안내 2개를 처음 듣고 도움 없이 맞혔어요.');

    const helped = game();
    answer(helped, metaOf(level, first), false, { help: 'replay' }); answer(helped, metaOf(level, second), false, { help: 'text' });
    assert.equal(missedPractice(helped, level), null);
    assert.equal(entryNote(helped), '전에 다시 듣기나 글 보기를 쓴 안내가 있었어요. 이번에는 먼저 끝까지 듣고 골라 보세요.');

    const failed = game();
    answer(failed, metaOf(level, first), false, { audio: 'failed' }); answer(failed, metaOf(level, second), false, { audio: 'failed' });
    assert.equal(missedPractice(failed, level), null);
    assert.equal(entryNote(failed), '전에 소리가 끊긴 안내가 있었어요. 틀린 것으로 세지 않았어요. 소리를 확인하고 다시 들어 보세요.');
  });
}

test('맞힌 응답에 쓴 도움 · 끊긴 소리도 틀렸다고 말하지 않고, 어떤 안내도 「지난 판」으로 단정하지 않는다', () => {
  const helped = game();
  answer(helped, metaOf('basic', 'exit.1'), true, { help: 'replay' });
  assert.match(entryNote(helped), /^전에 다시 듣기나 글 보기/);
  const failed = game();
  answer(failed, metaOf('basic', 'exit.1'), true, { audio: 'failed' });
  assert.match(entryNote(failed), /^전에 소리가 끊긴/);
  assert.doesNotMatch(read('./learning.mjs'), /지난 판/);
});
