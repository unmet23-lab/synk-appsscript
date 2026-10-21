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

// 10-21부터 묻는 말에 대답·이어지는 말이 한 학습 항목(듣고 알맞게 대답하기)이라, 아틀라스는 둘 중 어느 쪽을 틀렸는지 가르지 않는다.
// 같은 점수의 말끼리는 문항 id 순이고, 두 종류가 판마다 섞이는 것은 composeRound가 맡는다(core.test.mjs).
test('추천: 대답을 여러 번 틀리면 듣고 알맞게 대답하기가 「조금 더 연습」이 되고, 결과에는 그 항목 한 줄이 다음 연습으로 나온다', () => {
  const g = coach();
  for (const id of ['f01', 'f02', 'f03', 'f04', 'f05']) { const x = createExchange(g, byId(id)); x.heard(true); x.confirm(byId(id).options[1]); }
  for (const id of ['r01', 'r02', 'r03', 'w01', 'w02']) { const x = createExchange(g, byId(id)); x.heard(true); x.confirm(byId(id).answer); }
  const ranked = rankItems(g, ITEMS);
  assert.ok(ranked?.order?.length > 0);
  assert.equal(ranked.skillId, 'ko.listening.response'); assert.equal(ranked.state, 'practice');
  const report = skillReport(g.summary(), { focusSkillId: ranked.skillId });
  assert.equal(report.length, 1);
  const { id, label, status, tone, n, correct } = report[0];
  assert.deepEqual({ id, label, status, tone, n, correct }, { id: 'ko.listening.response', label: '듣고 알맞게 대답하기', status: 'practice', tone: 'focus', n: 10, correct: 5 });
});

test('기록을 못 쓰는 곳에서도 게임은 멈추지 않는다(기록 거절은 null)', () => {
  const broken = { present: () => 'p1', delivery: () => { throw new Error('x'); }, help: () => { throw new Error('x'); }, answer: () => { throw new Error('x'); } };
  const x = createExchange(broken, byId('f03'));
  assert.equal(x.heard(true), null); assert.equal(x.help('replay'), null); assert.equal(x.confirm('잘 먹겠습니다.'), null);
});

// 몽글의 말·대답 카드·정답이 바뀌면 그 말의 판(learning.mjs ITEM_VERSION)을 올려야 한다(학습기준 §7-2). 판을 올린 뒤 이 표의 판과
// 지문(앞 12자리 해시)을 함께 바꾼다. 새 말은 판 1로 더한다. 설명·난도만 바꾸면 판은 그대로다(10-21 더함).
const CONTENT = {
  r01: [2, '1109fcb351b1'],
  r02: [1, '0a7ca90b22fd'],
  r03: [1, 'cc8f96192381'],
  r04: [1, 'a88e3d5e607d'],
  r05: [1, '7ec3063ee784'],
  r06: [1, '1b539f2505ea'],
  w01: [1, 'ecc1642d5265'],
  w02: [1, '9ac5692bf8e0'],
  w03: [1, 'd496a40566ff'],
  w04: [1, 'c44e6693b170'],
  w05: [1, '34164b1799a7'],
  w06: [1, '39c249511c7f'],
  w07: [1, '4fcf0eb91d80'],
  w08: [1, '67fbc453192d'],
  f01: [1, 'e543e536586d'],
  f02: [1, '141682ae6201'],
  f03: [1, '1a622561f107'],
  f04: [1, '9fd0c046a142'],
  f05: [1, '8597cd2e2e55'],
  f06: [1, 'e724f55a892f'],
  f07: [1, 'b2d765b7f32a'],
  f08: [1, 'c063536741ad'],
  f09: [1, 'e9c6f1725386'],
  f10: [1, '960f47fd682b'],
  f11: [1, 'd21c2aae794f'],
  f12: [1, '28e2a049fa76'],
  r07: [1, '6fbcc9583420'],
  r08: [1, '14bac0641ecd'],
  r09: [1, '9379d5f93c9a'],
  r10: [1, 'c240e0c58ebf'],
  w09: [1, '01f19d10e466'],
  w10: [1, '6aff93e434e8'],
  w11: [1, '2b2449268a21'],
  w12: [1, 'fbb22bb1d271'],
  w13: [1, '5c0de0caad4c'],
  f13: [1, '2f2ca661e181'],
  f14: [1, 'cd6621696365'],
  f15: [1, 'e1e32d264fc9'],
  f16: [1, 'f07c4e4097f7'],
  f17: [1, 'ba0926af2956'],
  f18: [1, '7da38ea80c96'],
  f19: [1, '501432080d65'],
  f20: [1, 'bb5ab5adc955'],
  f21: [1, 'ecafee3dce78'],
  f22: [1, '367508a9115b'],
  f23: [1, 'ba603a0b8342'],
};
test('문항 판: 말·대답 카드·정답을 바꾸면 판이 올라가고 계열은 그대로다', async () => {
  const crypto = await import('node:crypto');
  const digest = (x) => crypto.createHash('sha256').update(JSON.stringify([x.line, x.options, x.answer])).digest('hex').slice(0, 12);
  assert.deepEqual(Object.keys(CONTENT).sort(), ITEMS.map((x) => x.id).sort(), '새 말은 이 표에 판 1로 더한다');
  for (const x of ITEMS) {
    const [version, hash] = CONTENT[x.id];
    assert.equal(digest(x), hash, `${x.id}: 내용이 바뀌었으면 ITEM_VERSION에서 판을 올리고 이 표를 고친다`);
    assert.equal(itemMetadata(x).itemKey, `talk-rally.${x.id}.v${version}`, x.id);
    assert.equal(itemMetadata(x).familyKey, `talk-rally.${x.id}.v1`, x.id);
  }
});
// 학습 기록 난도는 검수 기준 §3의 언어 난도다. 게임 안 단계(원고 difficulty 2 — 처음 판·공 속도·「조금 어려운 말」)와 따로 둔다(10-21).
test('학습 기록 난도: 한마디 인사·물음은 1, 「-아/어 보다」를 묻는 r08만 2 — 게임 안 단계는 원고 그대로', () => {
  assert.deepEqual(ITEMS.filter((x) => itemMetadata(x).difficulty === 2).map((x) => x.id), ['r08']);
  assert.ok(ITEMS.filter((x) => x.difficulty === 2).length >= 15, '게임 안 「조금 어려운 말」 단계는 그대로');
});
