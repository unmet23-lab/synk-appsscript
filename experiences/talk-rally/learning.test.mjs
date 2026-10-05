import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ITEMS } from './content.mjs';
import { itemMetadata, candidates, rankItems, createExchange, skillReport, GAME_ID } from './learning.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/topik-i.js').topikMap());
let clock = Date.parse('2026-10-03T09:00:00Z');
function coach(store = new Map()) {
  return createGame({ gameId: GAME_ID, map, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    clock: () => new Date(clock += 60000).toISOString() });
}
const byId = (id) => ITEMS.find((x) => x.id === id);

test('문항 정보: 듣기·보기 하나 고르기·음성 필요, 학습 항목은 Strata에 있는 것', () => {
  const m = itemMetadata(byId('f01'));
  assert.equal(m.modality, 'listening'); assert.equal(m.responseFormat, 'single-choice'); assert.equal(m.audioRequired, true);
  assert.equal(m.itemKey, 'talk-rally.f01.v1'); assert.equal(m.familyKey, m.itemKey);
  const ids = new Set(map.allNodes().map((n) => n.id));
  for (const x of ITEMS) assert.ok(ids.has(x.skill), `${x.skill}는 Strata 능력`);
  assert.equal(candidates(ITEMS).length, ITEMS.length);
});

test('끝까지 들은 말에 받아친 대답 = 혼자 해낸 응답(맞음·틀림 그대로)', () => {
  const g = coach();
  const a = createExchange(g, byId('f01')); a.heard(true); const ra = a.confirm('고마워요.');
  const b = createExchange(g, byId('f02')); b.heard(true); const rb = b.confirm('축하해요.');
  assert.equal(ra.verdict, 'correct'); assert.equal(ra.independent, true);
  assert.equal(rb.verdict, 'incorrect'); assert.equal(rb.independent, true);
  assert.equal(a.confirm('고마워요.'), null, '한 말에 답은 한 번만');
});

test('소리를 못 들었으면(heard false) 그 답은 평가하지 않는다', () => {
  const g = coach();
  const x = createExchange(g, byId('w01')); x.heard(false);
  const r = x.confirm('시장에 가요.');
  assert.equal(r.verdict, 'unassessed');
});

test('공이 기다리는 동안 다시 듣기·글로 보기를 쓰면 도움을 받은 응답, 그만두면 평가하지 않음', () => {
  const g = coach();
  const x = createExchange(g, byId('w02')); x.heard(true); x.help('replay');
  const r = x.confirm('토요일에 만나요.');
  assert.equal(r.verdict, 'correct'); assert.equal(r.assisted, true); assert.equal(r.independent, false);
  const y = createExchange(g, byId('w03')); y.heard(true);
  assert.equal(y.cancel().verdict, 'unassessed');
  assert.throws(() => createExchange(g, byId('w04')).confirm('아무 말'), /보기에서/);
});

test('추천: 이어지는 말을 계속 틀리면 그쪽이 다음 연습으로 앞에 온다', () => {
  const g = coach();
  for (const id of ['f01', 'f02', 'f03', 'f04', 'f05']) { const x = createExchange(g, byId(id)); x.heard(true); x.confirm(byId(id).options[1]); }
  for (const id of ['r01', 'r02', 'r03', 'w01', 'w02']) { const x = createExchange(g, byId(id)); x.heard(true); x.confirm(byId(id).answer); }
  const ranked = rankItems(g, ITEMS);
  assert.ok(ranked?.order?.length > 0);
  assert.equal(ranked.skillId, 'ko.listening.main');
  const report = skillReport(g.summary(), { focusSkillId: ranked.skillId });
  assert.equal(report.length, 2);
  assert.equal(report.find((r) => r.id === 'ko.listening.main').tone, 'focus');
});

test('기록을 못 쓰는 곳에서도 게임은 멈추지 않는다(기록 거절은 null)', () => {
  const broken = { present: () => 'p1', delivery: () => { throw new Error('x'); }, help: () => { throw new Error('x'); }, answer: () => { throw new Error('x'); } };
  const x = createExchange(broken, byId('f03'));
  assert.equal(x.heard(true), null); assert.equal(x.help('replay'), null); assert.equal(x.confirm('잘 먹겠습니다.'), null);
});
