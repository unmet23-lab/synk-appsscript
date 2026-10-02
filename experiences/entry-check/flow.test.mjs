import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES } from './content.mjs';
import { FLOW_ENTRY, FLOW_WORDS, MAGNIFIER_AFTER, magnifierAfter, caseMetadata, answerPayload } from './learning.mjs';

// 돋보기 시점(순간 맞춤)이 한 사람에 맞춰 움직이고, 가장 이른 칸에 갇히지 않는지 실제 엔진으로 본다.
const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const CASES = VENUES.flatMap((v) => v.cases);
const setup = () => {
  let t = Date.parse('2026-10-03T09:00:00Z');
  const store = new Map();
  return createGame({ gameId: 'entry-check', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    clock: () => new Date(t += 30000).toISOString() });
};
// 손님 한 명: 돋보기가 이미 나와 있었으면(auto) 답 전에 도움으로 남긴다.
const guest = (coach, flow, c, { correct, helped = false, ms = 9000 }) => {
  const pid = flow.present(caseMetadata(c));
  if (helped) coach.help(pid, 'hint');
  return flow.answer(pid, answerPayload(correct), { latencyMs: ms });
};

test('돋보기: 처음은 누를 때만, 막히면 한 칸씩 일찍', () => {
  const coach = setup(), flow = coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  assert.equal(flow.settings().values.magnifier, '누르면');
  assert.equal(magnifierAfter(flow), null);
  guest(coach, flow, CASES[0], { correct: false });
  assert.equal(flow.settings().values.magnifier, '머뭇거리면');
  assert.equal(MAGNIFIER_AFTER.머뭇거리면, 'stuck');
  assert.equal(magnifierAfter(flow), 40000, '혼자 바르게 답한 기록이 쌓이기 전에는 엔진 기본값');
});

test('돋보기: 바로 나오는 칸에서도 연달아 해내면 늦출지 묻는다(갇히지 않는다)', () => {
  const coach = setup(), flow = coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  guest(coach, flow, CASES[0], { correct: false });
  guest(coach, flow, CASES[1], { correct: true, helped: true, ms: 15000 });
  assert.equal(flow.settings().values.magnifier, '바로', '도움과 함께만 해내면 가장 이른 칸까지 온다');
  assert.equal(magnifierAfter(flow), 0);
  // 바로 나오는 칸에서는 모든 답이 도움 받은 답이다. 그래도 네 번 연달아 해내면 묻는다.
  for (const c of CASES.slice(2, 5)) guest(coach, flow, c, { correct: true, helped: true });
  assert.equal(flow.offerLessHelp().offer, false);
  guest(coach, flow, CASES[5], { correct: true, helped: true });
  const offer = flow.offerLessHelp();
  assert.equal(offer.offer, true);
  assert.equal(offer.reason, 'steady-with-help');
  const change = flow.acceptLessHelp();
  assert.equal(change.line.text, FLOW_WORDS['accepted-less-help']);
  assert.equal(flow.settings().values.magnifier, '머뭇거리면');
  flow.end();
  assert.equal(coach.live(FLOW_ENTRY, { words: FLOW_WORDS }).settings().values.magnifier, '머뭇거리면', '다음 근무도 거기서 이어 간다');
});

test("돋보기: '머뭇거리면'은 그 사람이 혼자 바르게 답해 온 시간에 맞춘다", () => {
  const coach = setup(), flow = coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  guest(coach, flow, CASES[0], { correct: false });
  assert.equal(flow.settings().values.magnifier, '머뭇거리면');
  // 천천히 꼼꼼히 읽는 사람: 돋보기 없이 20초쯤 걸려 바르게 찍는다.
  for (const c of CASES.slice(1, 6)) guest(coach, flow, c, { correct: true, ms: 20000 });
  assert.equal(magnifierAfter(flow), 50000, '20초 × 2.5: 꼼꼼한 사람을 12초에 끊지 않는다');
  const quick = setup(), q = quick.live(FLOW_ENTRY, { words: FLOW_WORDS });
  guest(quick, q, CASES[0], { correct: false });
  for (const c of CASES.slice(1, 6)) guest(quick, q, c, { correct: true, ms: 4000 });
  assert.equal(magnifierAfter(q), 10000, '빠른 사람은 더 일찍 돕는다');
});

test('돋보기: 피곤한 날의 이른 시작은 그날만이다', () => {
  const coach = setup();
  coach.setToday('tired');
  const tired = coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  assert.equal(tired.intro().code, 'start.tired');
  assert.equal(tired.intro().line.text, '오늘은 더 어렵게 하지 않을게요.');
  assert.equal(tired.settings().values.magnifier, '머뭇거리면', '피곤한 날은 한 칸 일찍 연다');
  tired.end();
  coach.setToday(null);
  const next = coach.live(FLOW_ENTRY, { words: FLOW_WORDS });
  assert.equal(next.settings().values.magnifier, '누르면', '다음 날은 원래 자리에서');
  assert.equal(next.intro().line, null, '이어 가는 날은 따로 말하지 않는다');
});
