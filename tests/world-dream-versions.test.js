// 꿈 장면 두 판(아이돌 · 배우)이 Atlas와 꼬이지 않는 조건(docs/시즌1_이야기지도_20261104.md 3-4, 2026-11-08).
// Atlas는 꿈을 모른다 — 같은 칸을 쓰면 같은 답에 같은 판정 · 재확인 · 추천이 나오고, 칸을 가르거나 두 판을 다 후보로 넘기면 꼬인다.
// 문항 꼴은 드라마 learning-entry.cjs open()과 같다(혼자 해 봄 = 난도 2 · 말하기 · 소리 칸 없음, 게임 ID drama-s1, 지도 ko-speaking).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../atlas/game-learning.js');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/ko-speaking.json'));

const GAME = 'drama-s1', DAY = 86400000, START = Date.parse('2026-12-01T01:00:00Z');
const SKILLS = ['ko.speaking.greet', 'ko.speaking.promise', 'ko.speaking.explain', 'ko.speaking.status', 'ko.speaking.thank'];
function bench() {
  let now = START; const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const game = gameId => createGame({ gameId, map, storage, clock: () => new Date(now += 1000).toISOString(), followups: true });
  return { game, wait: days => { now += days * DAY; }, at: () => new Date(now).toISOString() };
}
const line = (id, skillId, { family = id, difficulty = 2 } = {}) => ({ id: `${GAME}.transfer.${id}`, itemKey: id, familyKey: family, skillId,
  modality: 'speaking', difficulty, responseFormat: 'spoken', audioRequired: false });
const say = (coach, item, correct = true) => coach.answer(coach.present(item), { correct, assessable: true });
const target = item => ({ id: item.itemKey, skillIds: [item.skillId], difficulty: item.difficulty, modality: 'speaking', responseFormat: 'spoken', familyKeys: [item.familyKey], itemKey: item.itemKey });
const activity = (id, items) => ({ id, minutes: 3, targets: items.map(target), goals: ['expression'], audioRequired: false });
const pick = (coach, b, candidates) => coach.recommendActivities(candidates, { settings: { goals: ['expression'], audioAvailable: true }, at: b.at() });
// 사건 ID는 판마다 임의값이다 — 지우고 꿈 이름도 지운 뒤 견준다.
const plain = value => JSON.stringify(value).replace(/"[a-z0-9]{6,}-[0-9a-z]+-[0-9a-z]{6,}"/g, '"ID"').replace(/idol|actor/g, 'DREAM');
const random = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// 꿈 장면 일곱(회 · 능력 칸 · 난도, 지도 3-4 표)과 공통 줄기를 같은 답으로 지나간다.
const SCENES = [[2, 0, 2], [4, 1, 2], [5, 2, 2], [7, 0, 3], [7, 3, 3], [8, 2, 3], [8, 4, 3]];
function season(dream, seed) {
  const next = random(seed), b = bench(), coach = b.game(GAME), picks = [];
  SCENES.forEach(([episode, skill, difficulty], i) => {
    say(coach, line(`common.e${episode}.s${i}`, SKILLS[(skill + 1) % SKILLS.length]), next() > 0.3);
    for (let n = 0; n < 3; n++) say(coach, line(`e${episode}.${dream}.s${i}.l${n}`, SKILLS[skill], { difficulty }), next() > 0.35);
    b.wait(1 + Math.floor(next() * 5));
    const after = SCENES[i + 1];
    const candidates = [activity(`common.next.${i}`, [line(`common.next.${i}`, SKILLS[(skill + 2) % SKILLS.length])]),
      ...(after ? [activity(`dream.${dream}.${i + 1}`, [line(`e${after[0]}.${dream}.s${i + 1}.l0`, SKILLS[after[1]], { difficulty: after[2] })])] : [])];
    picks.push(pick(coach, b, candidates).selected?.id ?? null);
  });
  return { skills: coach.summary().skills.filter(s => SKILLS.includes(s.id)),
    followups: coach.followups().items.map(r => [r.window, r.status, r.outcome, r.measure.skillId, r.measure.difficulty, r.kind]), picks };
}

test('every skill the dream scenes plan to use is a speaking skill of the drama map', () => {
  for (const id of SKILLS) assert.equal(map.getNode(id)?.domain, 'speaking', id);
});

test('two dream versions on the same cells give the same verdicts, follow-ups and next pick', () => {
  for (let seed = 1; seed <= 40; seed++) assert.equal(plain(season('idol', seed)), plain(season('actor', seed)), `seed ${seed}`);
});

test('the engine does not know dreams: only the host keeps a student on their version', () => {
  const b = bench(), coach = b.game(GAME);
  say(coach, line('e2.idol.s0.l0', SKILLS[0]), false); b.wait(1);
  const other = activity('dream.actor.e2', [line('e2.actor.s0.l0', SKILLS[0])]), own = activity('dream.idol.e4', [line('e4.idol.s1.l0', SKILLS[1])]);
  assert.equal(pick(coach, b, [other, own]).selected.id, 'dream.actor.e2', 'both versions offered: Core picks by need, not by dream');
  assert.equal(pick(coach, b, [own]).selected.id, 'dream.idol.e4', 'own version only');
});

// 아이돌 판 줄을 풀고 일주일 뒤 꿈을 바꿔 배우 판의 줄을 푼다(같은 능력의 다음 장면 · 다음 시즌 판이 이 경로다).
function changeDream(options = {}, gameB = GAME) {
  const b = bench(), first = b.game(GAME);
  say(first, line('e2.idol.s0.l0', SKILLS[0])); b.wait(7.5);
  const then = gameB === GAME ? first : b.game(gameB);
  say(then, line('next.actor.l0', SKILLS[0], options));
  const rows = then.followups().items, d7 = rows.find(r => r.gameId === GAME && r.window === 'd7');
  return { cells: rows.length / 3, d7: [d7.status, d7.outcome] };
}

test('after a dream change, a new line of the same cell continues the follow-up', () => {
  assert.deepEqual(changeDream(), { cells: 1, d7: ['observed', 'independent-correct'] });
});

test('after a dream change, the same words in the same family are not counted as a new follow-up', () => {
  assert.deepEqual(changeDream({ family: 'e2.idol.s0.l0' }), { cells: 1, d7: ['due', null] });
});

test('a harder later scene of the same ability is its own cell, not a follow-up of the easier one', () => {
  assert.deepEqual(changeDream({ difficulty: 3 }), { cells: 2, d7: ['due', null] });
});

test('a version that differs in difficulty or game id splits the cell and breaks the follow-up', () => {
  assert.deepEqual(changeDream({ difficulty: 1 }), { cells: 2, d7: ['due', null] });
  assert.deepEqual(changeDream({}, `${GAME}-actor`), { cells: 2, d7: ['due', null] });
});

// 칸 상한 고침(README §8 결함 ①) 뒤에 통과해야 한다 — 지금 엔진은 다른 게임이 24칸을 채우면 드라마 줄을 못 만든다.
test('drama follow-ups survive a ledger whose other games already hold the anchor cap', { todo: '칸 상한 고침 뒤 todo를 뗀다 — atlas-world-engine-20261108 README §8 결함 ①' }, () => {
  const b = bench(), other = b.game('other-game');
  // 드라마 말고 소리 칸이 없는 능력(읽기 7 + 쓰기 3) × 난도 셋에서 앵커 칸 24개를 채운다.
  const cells = map.allNodes().filter(n => n.kind === 'skill' && ['reading', 'writing'].includes(n.domain)).flatMap(n => [1, 2, 3].map(difficulty => [n, difficulty]));
  assert.ok(cells.length >= 24, `${cells.length} cells`);
  cells.slice(0, 24).forEach(([node, difficulty], i) => say(other, { id: `other.${i}`, itemKey: `other.${i}`, familyKey: `other.${i}`, skillId: node.id, modality: node.domain, difficulty, responseFormat: 'single-choice', audioRequired: false }));
  other.flush?.();
  const coach = b.game(GAME);
  say(coach, line('e2.idol.s0.l0', SKILLS[0]));
  assert.ok(coach.followups().items.some(r => r.gameId === GAME), 'a drama anchor exists');
});

test('cue-card lines (difficulty 1, not assessable) neither anchor nor stand in for a new-situation follow-up', () => {
  const b = bench(), coach = b.game(GAME), card = id => line(id, SKILLS[0], { difficulty: 1 });
  const read = id => coach.answer(coach.present(card(id)), { correct: true, assessable: false });
  read('e2.idol.card.l0'); say(coach, line('e2.idol.s0.l0', SKILLS[0]));
  b.wait(7.5);
  read('e7.idol.card.l0');
  const rows = coach.followups().items;
  assert.equal(rows.length / 3, 1, 'only the new-situation line anchors');
  assert.equal(rows[0].measure.difficulty, 2);
  assert.deepEqual(rows.filter(r => r.window === 'd7').map(r => [r.status, r.outcome]), [['due', null]]);
});
