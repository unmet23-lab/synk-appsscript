import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { VENUES } from './content.mjs';
import { composeShift } from './core.mjs';
import { caseMetadata, caseCandidates, rankCases, recommendVenue, answerPayload, skillReport, assignmentCases } from './learning.mjs';

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

test('free-shift ranking only offers ordinary authored guests, while WORLD keeps explicitly assigned confirmations', () => {
  const lib = VENUES.find(v => v.id === 'library'), base = lib.cases.filter(c => !c.followupOnly), reserved = lib.cases.filter(c => c.followupOnly);
  let offered = null;
  const ranked = rankCases({ recommend(candidates) {
    offered = candidates;
    return { status: 'ready', selected: candidates[0], alternatives: candidates.slice(1), focusSkillId: candidates[0].skillIds[0], reason: '기본 손님 순서' };
  } }, lib.cases);
  assert.deepEqual(offered.map(c => c.caseId), base.map(c => c.id));
  assert.deepEqual(ranked.order, base.map(c => c.id));
  assert.equal(rankCases({ recommend() { assert.fail('확인용만 있는 자유 근무는 추천하지 않는다'); } }, reserved), null);
  const item = reserved[0], meta = caseMetadata(item);
  assert.deepEqual(assignmentCases(lib.cases, { ...meta, familyKeys: [meta.familyKey], itemKeys: [meta.itemKey], requiredAttempts: 1 }), [item]);
});

test('free-shift venue recommendation and reported target count exclude confirmation-only inventory', () => {
  const venues = VENUES.filter(v => ['library', 'museum'].includes(v.id));
  let offered = null;
  const result = recommendVenue({ recommend(candidates) {
    offered = candidates;
    return { status: 'ready', selected: candidates.find(c => c.caseId === 'library-03'), focusSkillId: 'ko.reading.condition', reason: '조건 읽기 연습' };
  } }, venues.map(v => v.id));
  assert.equal(offered.length, 17);
  assert.ok(offered.every(c => !byId(c.caseId).followupOnly));
  assert.equal(result.venueId, 'museum'); assert.equal(result.count, 5);
});

test('문항 정보: 지도에 있는 읽기 항목·고정 키·한 개 고르기 형식', () => {
  const ids = new Set(map.allNodes().map((n) => n.id));
  const keys = new Set();
  for (const c of all) {
    const m = caseMetadata(c);
    assert.ok(ids.has(m.skillId), m.skillId);
    assert.equal(m.modality, 'reading'); assert.equal(m.responseFormat, 'single-choice'); assert.equal(m.audioRequired, false);
    assert.match(m.itemKey, /^entry-check\.[a-z]+-\d\d\.v\d+$/); assert.equal(m.familyKey, `entry-check.${c.id}.v1`);
    assert.equal(m.difficulty, 2, '학습 기록 난도는 손님 모두 2(10-21 검수 판정)');
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
  for (const c of lib.cases.filter((x) => !x.followupOnly && x.skill === 'ko.reading.condition')) assert.ok(shift.includes(c), `${c.id}가 근무에 들어온다`);
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

// 손님의 서류·짐·말·정답이 바뀌면 그 손님의 판(learning.mjs ITEM_VERSION)을 올려야 한다(학습기준 §7-2). 판을 올린 뒤 이 표의 판과
// 지문(앞 12자리 해시)을 함께 바꾼다. 새 손님은 판 1로 더한다. 해설·난도만 바꾸면 판은 그대로다(10-21 문항 검수 고침 때 더함).
const CONTENT = {
  'pool-01': [1, 'eb07490d5fb8'],
  'pool-09': [1, '7fc6b46ae1fe'],
  'pool-12': [1, 'd2a967e88a5b'],
  'pool-02': [1, '241f2d0b3b36'],
  'pool-10': [1, '54a825d50e92'],
  'pool-13': [1, '35aa2a332c1f'],
  'pool-03': [1, '92290e34d775'],
  'pool-11': [1, '896091e902ca'],
  'pool-04': [1, 'a6d80d55c3fa'],
  'pool-14': [2, 'f20ec956112c'],
  'pool-05': [1, '990a90f1a991'],
  'pool-06': [1, '71c3b2d235b6'],
  'pool-07': [1, 'af22d63634ce'],
  'pool-08': [1, '6ff4ca2fbe68'],
  'library-01': [1, 'cc8b2394f601'],
  'library-02': [1, '6b3edd075ce7'],
  'library-10': [1, '55d3e1f948fa'],
  'library-03': [1, '88f66ff99556'],
  'library-04': [1, '588e77a164b9'],
  'library-11': [1, 'f0b6aa0db8e8'],
  'library-05': [1, '26114fad3050'],
  'library-06': [1, 'e7406642f735'],
  'library-07': [1, '75c97bf5ec20'],
  'library-08': [1, '1bcfb25f6d0f'],
  'library-09': [1, '3b81013de1b1'],
  'museum-01': [1, '2cea56de6ec7'],
  'museum-09': [1, 'f45b290f6c4b'],
  'museum-02': [1, '348e9b339250'],
  'museum-10': [1, '90b2af267b45'],
  'museum-03': [1, '3c81ef152c24'],
  'museum-11': [1, 'db0c08164890'],
  'museum-04': [1, '176d288802e0'],
  'museum-05': [1, '700d26426276'],
  'museum-06': [1, '8bb786143637'],
  'museum-07': [1, 'd4707187cca7'],
  'museum-08': [1, '8578308f1921'],
  'concert-01': [1, 'dd801e39c104'],
  'concert-10': [1, '67f2d913af73'],
  'concert-02': [1, 'a49ee4e06de7'],
  'concert-11': [1, 'd4d2af3fb7d3'],
  'concert-03': [1, '814f21341c82'],
  'concert-12': [3, '83990fc7af45'],
  'concert-04': [1, 'afbe10e44fe1'],
  'concert-05': [1, '3a2f1bfff4ef'],
  'concert-13': [1, '51dcea6cbcb3'],
  'concert-06': [1, 'b3b432c8c3b2'],
  'concert-07': [1, 'e2ed187b8202'],
  'concert-14': [1, '035526a6870e'],
  'concert-08': [1, '6caf8c325e5e'],
  'concert-09': [1, '71cbd103be7f'],
};
test('문항 판: 손님의 서류·짐·말·정답을 바꾸면 판이 올라가고 계열은 그대로다', () => {
  const digest = (c) => crypto.createHash('sha256').update(JSON.stringify([c.who, c.at, c.doc, c.items, c.line, c.answer])).digest('hex').slice(0, 12);
  assert.deepEqual(Object.keys(CONTENT).sort(), all.map((c) => c.id).sort(), '새 손님은 이 표에 판 1로 더한다');
  for (const c of all) {
    const [version, hash] = CONTENT[c.id];
    assert.equal(digest(c), hash, `${c.id}: 내용이 바뀌었으면 ITEM_VERSION에서 판을 올리고 이 표를 고친다`);
    assert.equal(caseMetadata(c).itemKey, `entry-check.${c.id}.v${version}`, c.id);
    assert.equal(caseMetadata(c).familyKey, `entry-check.${c.id}.v1`, c.id);
  }
});
