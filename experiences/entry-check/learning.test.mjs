import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES } from './content.mjs';
import { composeShift } from './core.mjs';
import { caseMetadata, caseCandidates, rankCases, recommendVenue, answerPayload, skillReport } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
let clock = Date.parse('2026-10-02T09:00:00Z');
function coach(store = new Map()) {
  return createGame({ gameId: 'entry-check', map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(clock += 60000).toISOString() });
}
const all = VENUES.flatMap((v) => v.cases);
const byId = (id) => all.find((c) => c.id === id);
const play = (g, c, correct, { hint = false } = {}) => { const pid = g.present(caseMetadata(c)); if (hint) g.help(pid, 'hint'); return g.answer(pid, answerPayload(correct)); };

test('문항 정보: 지도에 있는 읽기 항목·고정 키·한 개 고르기 형식', () => {
  const ids = new Set(map.allNodes().map((n) => n.id));
  const keys = new Set();
  for (const c of all) {
    const m = caseMetadata(c);
    assert.ok(ids.has(m.skillId), m.skillId);
    assert.equal(m.modality, 'reading'); assert.equal(m.responseFormat, 'single-choice'); assert.equal(m.audioRequired, false);
    assert.match(m.itemKey, /^entry-check\.[a-z]+-\d\d\.v1$/);
    assert.ok(!keys.has(m.itemKey)); keys.add(m.itemKey);
  }
  assert.doesNotThrow(() => coach().recommend(caseCandidates(all)), '모든 후보가 엔진 검사를 통과한다');
});

test('실제 엔진: 첫 응답 정답은 혼자 해낸 기록, 힌트 뒤 정답은 아니다', () => {
  const g = coach();
  assert.equal(play(g, byId('pool-01'), true).independent, true);
  assert.equal(play(g, byId('pool-03'), true, { hint: true }).independent, false);
  const wrong = play(g, byId('pool-02'), false);
  assert.equal(wrong.verdict, 'incorrect');
  const s = g.summary();
  assert.equal(s.storage.available, true);
  assert.ok(s.independent >= 2, '혼자 푼 기록이 공통 요약에 남는다');
});

test('실제 엔진: 같은 학습 항목을 거듭 놓치면 그 항목의 손님이 근무 앞쪽으로 온다', () => {
  const g = coach();
  // 아틀라스는 학습 항목 × 언어 난도 × 응답 형식별로 본다. 같은 난도(2)의 조건 읽기만 세 번 틀리고, 세부 정보 읽기(난도 1)는 네 번 혼자 맞힌다
  for (const id of ['pool-05', 'pool-06', 'museum-03']) play(g, byId(id), false);
  for (const id of ['pool-01', 'pool-04', 'library-01', 'library-02']) play(g, byId(id), true);
  const lib = VENUES.find((v) => v.id === 'library');
  const ranked = rankCases(g, lib.cases);
  assert.ok(ranked, '추천을 받는다');
  const top = byId(ranked.order[0]);
  assert.equal(top.skill, 'ko.reading.condition', '보충이 필요한 조건 읽기 손님이 첫 순위');
  assert.match(ranked.reason, /조건/);
  const shift = composeShift(lib, { ranked: ranked.order });
  for (const c of lib.cases.filter((x) => x.skill === 'ko.reading.condition')) assert.ok(shift.includes(c), `${c.id}가 근무에 들어온다`);
  const report = skillReport(g.summary());
  const cond = report.find((r) => r.id === 'ko.reading.condition');
  assert.equal(cond.status, 'practice');
  assert.equal(cond.tone, 'focus');
});

test('실제 엔진: 기록이 반대인 두 학생은 다음 근무지 추천이 다르다', () => {
  const a = coach(), b = coach();
  for (const id of ['pool-02', 'pool-07', 'library-06']) play(a, byId(id), false);         // 부정 읽기를 놓침
  for (const id of ['pool-05', 'pool-06', 'museum-03']) play(a, byId(id), true);
  for (const id of ['pool-05', 'pool-06', 'museum-03', 'museum-05']) play(b, byId(id), false); // 조건 읽기를 놓침
  for (const id of ['pool-02', 'pool-07', 'library-06']) play(b, byId(id), true);
  const venues = ['pool', 'library', 'museum', 'concert'];
  const ra = recommendVenue(a, venues), rb = recommendVenue(b, venues);
  assert.equal(ra.skillId, 'ko.reading.negation');
  assert.equal(rb.skillId, 'ko.reading.condition');
  assert.notEqual(ra.reason, rb.reason);
});

test('실제 엔진: 돋보기 뒤 정답은 혼자 해낸 기록으로 세지 않고, 새 문항의 혼자 정답만 근거가 된다', () => {
  const g = coach();
  for (const id of ['pool-05', 'pool-06', 'museum-03']) play(g, byId(id), false);
  const at = () => { const s = g.summary().skills.find((x) => x.id === 'ko.reading.condition').levels[2].formats['single-choice']; return { status: s.status, n: s.n }; };
  assert.deepEqual(at(), { status: 'practice', n: 3 });
  play(g, byId('library-03'), true, { hint: true });
  assert.deepEqual(at(), { status: 'practice', n: 3 }, '도움 받은 정답은 n에 들어가지 않는다');
  play(g, byId('library-04'), true);
  assert.equal(at().n, 4, '새 문항의 혼자 정답은 근거가 된다');
  play(g, byId('library-04'), true);
  assert.equal(at().n, 4, '같은 문항을 다시 맞혀도 새 근거로 세지 않는다');
});

test('아틀라스를 못 쓰면 원고 순서로 진행한다', () => {
  assert.equal(rankCases(null, VENUES[0].cases), null);
  assert.equal(recommendVenue(null, ['pool']), null);
  const broken = { recommend() { throw new Error('storage'); } };
  assert.equal(rankCases(broken, VENUES[0].cases), null);
  assert.deepEqual(skillReport(null), []);
});
