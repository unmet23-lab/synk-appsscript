import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJourney, reviewDecisions } from './journeys.mjs';
import { allMeetingItems } from './people.mjs';
import { reviewItems } from './review-items.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import { GAME_ID, decisionMeta, meetingMeta, answerPayload, createExchange, preferJourney } from './learning.mjs';
import { PLAN_ITEMS } from './plan-items.mjs';

function fakeCoach({ selected = null, throws = false } = {}) {
  const calls = [];
  return {
    calls,
    present(meta) { calls.push(['present', meta.id]); return 'p1'; },
    delivery(pid, d) { calls.push(['delivery', d]); },
    help(pid, kind) { calls.push(['help', kind]); },
    answer(pid, p) { calls.push(['answer', p]); if (throws) throw Error('저장 막힘'); return 'ok'; },
    recommend(items) { calls.push(['recommend', items.length]); return selected ? { status: 'ready', selected: { id: selected } } : { status: 'none' }; },
  };
}

test('능력 id: 첫 등굣길은 ko.*, 바쁜 아침의 새 안내는 ko2.*이고 문항 키가 겹치지 않는다', () => {
  const seen = new Map();
  for (const { decision: d } of reviewDecisions()) {
    const m = decisionMeta(d);
    assert.ok(m.itemKey.startsWith(`${GAME_ID}.`) && m.itemKey.endsWith('.v1'), m.itemKey);
    assert.ok(m.familyKey.startsWith(`${GAME_ID}.`), m.familyKey);
    assert.ok(/^ko2?\.listening\./.test(m.skillId), m.skillId);
    if (d.id.startsWith('busy.')) assert.equal(m.skillId, 'ko2.listening.detail', d.id);
    else assert.ok(m.skillId.startsWith('ko.') || d.grade === 'busy', d.id);
    assert.equal(m.modality, 'listening'); assert.equal(m.audioRequired, true); assert.equal(m.responseFormat, 'single-choice');
    if (seen.has(m.itemKey)) assert.equal(seen.get(m.itemKey), d.line_.text, `같은 문항 키에 다른 문장: ${m.itemKey}`);
    seen.set(m.itemKey, d.line_.text);
  }
  assert.ok(seen.size >= 40, `변형 ${seen.size}개`);
});

test('찍어도 맞는 그대로는 평가하지 않는 응답으로 닫는다', () => {
  const j = buildJourney({ seed: 11 });
  for (let seed = 1; seed < 400; seed++) {
    const d = buildJourney({ seed }).decisions.find((x) => x.kind === 'stop' && !x.assessable);
    if (!d) continue;
    const p = answerPayload({ correct: true, assessable: d.assessable, selectedId: 'subway.stay', correctId: 'subway.stay', reason: 'guessable' });
    assert.equal(p.assessable, false); assert.equal(p.reason, 'guessable');
    return;
  }
  assert.fail(`근거 아닌 그대로를 못 찾음(${j.seed})`);
});

test('고른 칸은 기계 ID로만 남는다', () => {
  const p = answerPayload({ correct: false, assessable: true, selectedId: 'subway.left', correctId: 'subway.right' });
  assert.deepEqual(p.choice, { selectedId: 'subway.left', correctId: 'subway.right' });
  assert.ok(!JSON.stringify(p).match(/[가-힣]/), '기록에 화면 글이 없다');
});

test('기록 차례: 제시 → 전달 → 도움 → 답, 끊긴 소리는 failed, 닫힌 뒤에는 아무것도 안 남긴다', () => {
  const coach = fakeCoach();
  const ex = createExchange(coach, decisionMeta(buildJourney({ seed: 3 }).decisions[0]));
  ex.heard(true); ex.heard(false);   // 전달은 한 번만
  ex.help('replay');
  ex.answer({ correct: true, assessable: true });
  ex.help('text'); ex.answer({ correct: false, assessable: true }); ex.cancel();
  assert.deepEqual(coach.calls.map((c) => c[0]), ['present', 'delivery', 'help', 'answer']);
  assert.deepEqual(coach.calls[1][1], { audio: 'completed' });
  const failed = fakeCoach(); const e2 = createExchange(failed, decisionMeta(buildJourney({ seed: 3 }).decisions[0])); e2.heard(false);
  assert.deepEqual(failed.calls[1][1], { audio: 'failed' });
});

test('기록이 막혀도 게임은 멈추지 않고, 아틀라스가 없어도 된다', () => {
  const ex = createExchange(fakeCoach({ throws: true }), decisionMeta(buildJourney({ seed: 5 }).decisions[0]));
  assert.doesNotThrow(() => ex.answer({ correct: true, assessable: true }));
  const none = createExchange(null, decisionMeta(buildJourney({ seed: 5 }).decisions[0]));
  assert.doesNotThrow(() => { none.heard(true); none.help('text'); none.answer({ correct: true, assessable: true }); none.cancel(); });
});

test('만남 문항은 직장인 · 여행객뿐이고 지도에 있는 능력이다', () => {
  const items = allMeetingItems();
  assert.ok(items.length >= 8);
  for (const it of items) {
    const m = meetingMeta(it.item);
    assert.ok(/^ko\.listening\.(detail|negation)$/.test(m.skillId), m.skillId);
    assert.ok(/^meet\.(worker|traveler)\./.test(it.item.id), it.item.id);
  }
});

test('다음 판 복습: 아틀라스가 고른 문항이 든 여정을 앞세우고, 못 고르면 첫 후보', () => {
  const journeys = Array.from({ length: 12 }, (_, i) => buildJourney({ seed: 100 + i * 7919 }));
  const target = journeys[7].decisions.find((d) => d.assessable && !journeys[0].decisions.some((x) => x.id === d.id)) || journeys[7].decisions.find((d) => d.assessable);
  const chosen = preferJourney(fakeCoach({ selected: `${GAME_ID}.${target.id}` }), journeys);
  assert.ok(chosen.decisions.some((d) => d.id === target.id));
  assert.equal(preferJourney(fakeCoach(), journeys), journeys[0]);
  assert.equal(preferJourney(null, journeys), journeys[0]);
  assert.equal(preferJourney({ recommend() { throw Error('막힘'); } }, journeys), journeys[0]);
});

const bundle = (game) => {
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(new URL(`../${game}/atlas-learning.js`, import.meta.url), 'utf8'), context);
  return context.SynkLearning;
};
const memory = () => { const rows = new Map(); return { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)), removeItem: (k) => rows.delete(k) }; };

test('실제 게임 묶음: 낼 수 있는 문항 모두가 제시 · 전달 · 답까지 기록되고, 3~4급 근거가 ko2.*로 남는다', () => {
  const metas = [...reviewDecisions().map(({ decision: d }) => decisionMeta(d)), ...allMeetingItems().map(({ item }) => meetingMeta(item))];
  const unique = [...new Map(metas.map((m) => [m.itemKey, m])).values()];
  assert.ok(unique.length >= 60, String(unique.length));
  let tick = Date.parse('2026-11-05T00:00:00Z');
  const coach = bundle('subway-rush').createGame({ gameId: GAME_ID, storage: memory(), clock: () => new Date(tick += 1000).toISOString() });
  for (const m of unique) {
    assert.ok(/^[a-zA-Z0-9_.:-]{1,120}$/.test(m.itemKey) && /^[a-zA-Z0-9_.:-]{1,120}$/.test(m.familyKey), `기계 이름은 영문 · 숫자만: ${m.itemKey} ${m.familyKey}`);
    assert.ok(!/undefined/.test(m.itemKey + m.familyKey), m.itemKey);
    const pid = coach.present(m);
    coach.delivery(pid, { audio: 'completed' });
    coach.answer(pid, { correct: true, assessable: true });
  }
  const upper = coach.summary().skills.find((s) => s.id === 'ko2.listening.detail');
  assert.ok(upper?.n > 0, '바쁜 아침 근거가 요약에 있다');
});

test('TOPIK II 능력은 이 게임 묶음에만 있고 다른 게임 묶음은 TOPIK I 지도 그대로다', () => {
  assert.ok(bundle('subway-rush').SKILLS.some((n) => n.id === 'ko2.listening.detail'));
  assert.ok(!bundle('blank-slice').SKILLS.some((n) => /^ko2\./.test(n.id || '')));
});

test('계획 후보 표는 근거로 세는 결정 전부와 같다', () => {
  const want = reviewDecisions().map(({ decision: d }) => ({ id: d.id, family: d.family, skillId: d.skillId, difficulty: d.difficulty })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual([...PLAN_ITEMS], want);
  for (const item of PLAN_ITEMS) assert.ok(reviewDecisions().some(({ decision: d }) => decisionMeta(d).itemKey === decisionMeta(item).itemKey), item.id);
});

test('내는 문항은 모두 2중 검수를 통과했다', () => {
  const verdicts = new Map(JSON.parse(fs.readFileSync(new URL('../topik-items/review/existing-verdicts.json', import.meta.url), 'utf8')).items.map((row) => [row.itemKey, row.verdict]));
  const items = reviewItems();
  assert.ok(items.length >= 50);
  for (const item of items) assert.equal(verdicts.get(item.itemKey), 'pass', item.itemKey);
});
