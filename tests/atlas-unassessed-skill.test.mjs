// 「채점 안 함」 시도만 쌓이는 능력을 Core가 어떻게 읽는지 고정한다(Atlas × WORLD 2단계 E, 2026-11-08 —
// docs/_ops/qa/atlas-world-engine-20261108/E_말하기.md §4-1). WORLD 말하기 연습처럼 판정하지 않는 활동을 지도에 올리면 Core는 그 능력을
// 언제까지나 「모름(unseen)」으로 읽는다. 이 시험은 atlas/를 바꾸지 않은 채 그 읽기가 추천을 어떻게 움직이는지 묶는다:
// 근거 · 급한 줄 · 재확인을 만들지 않고, 문항 열쇠(target)가 있을 때만 「방금 낸 문항은 뒤로」를 받으며, 단계가 하나뿐인 능력에
// 난도 2 · 3을 적으면 아래 단계의 혼자 해냄이 영원히 없어 감점이 풀리지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMap } = require('../strata');
const { createGame } = require('../atlas/game-learning.js');
const { worldMapData } = require('../strata/world-map.js');

const DAY = 86400000;
// 시험 안의 말하기 마디(이름만 E와 같다 — Core 규칙만 본다). 공식 수준은 [초급, 초급, 중급, 중급, 고급, 고급].
const TYPES = [['answer', 1, 's1-weekend'], ['roleplay', 1, 's2-cafe'], ['narrate', 2, 's3-birthday'], ['respond', 2, 's4-festival'], ['interpret', 3, 's5-bike'], ['opinion', 3, 's6-phone']];
function speakingMap() {
  const data = worldMapData();
  data.sources['speaking-test'] = { path: 'tests/atlas-unassessed-skill.test.mjs', sha256: 'a'.repeat(64) };
  for (const [name] of TYPES) data.nodes.push({ id: `ko.speaking.${name}`, kind: 'skill', label_ko: `말하기 ${name}`, domain: 'speaking', level: null,
    difficulty: { authored: null, measured: null, n: 0 }, source_refs: [{ source: 'speaking-test', selector: name }] });
  data.map_ver += ':speaking-test';
  return createMap(data);
}
function bench() {
  let t = Date.parse('2026-11-08T03:00:00Z');
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const clock = () => new Date(t += 1000).toISOString(), map = speakingMap();
  const on = gameId => createGame({ gameId, map, storage, clock, followups: true });
  return { on, clock, wait: days => { t += days * DAY; } };
}
const item = (i, difficulty = 1) => ({ id: `speaking-${TYPES[i][2]}`, itemKey: `speaking.${TYPES[i][2]}`, familyKey: `speaking.${TYPES[i][2]}`,
  skillId: `ko.speaking.${TYPES[i][0]}`, modality: 'speaking', difficulty, responseFormat: 'spoken', audioRequired: false });
const target = (i, difficulty = 1) => ({ id: `speaking-${TYPES[i][2]}`, skillIds: [`ko.speaking.${TYPES[i][0]}`], difficulty, modality: 'speaking',
  responseFormat: 'spoken', itemKey: `speaking.${TYPES[i][2]}`, familyKey: `speaking.${TYPES[i][2]}`, conceptIds: [] });
const speakingSkill = (summary, i = 0) => summary.skills.find(s => s.id === `ko.speaking.${TYPES[i][0]}`);
// 처음 보는 읽기 문항 둘을 혼자 맞힌 학생(읽기 세부 칸이 「확인 중」).
function readTwo(b) {
  const coach = b.on('world-practice');
  for (const n of [1, 2]) { const p = coach.present({ id: `r${n}`, itemKey: `reading.detail.${n}`, familyKey: `reading.detail.${n}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' }); coach.answer(p, { correct: true, assessable: true }); }
}
// 「채점 안 함」 시도 n번(한 판, 시도 번호 1..n). help가 있으면 첫 시도 전에 그 도움.
function unassessed(coach, i, n, help = null) {
  const pid = coach.present(item(i));
  if (help) coach.help(pid, help);
  for (let k = 1; k <= n; k++) coach.answer(pid, { correct: null, assessable: false, attemptNo: k });
  return pid;
}

test('채점 안 함만 쌓인 능력은 몇 번 · 얼마가 지나도 unseen이고 근거 · 재확인이 없다', () => {
  const b = bench(), speak = b.on('world-speaking'), home = b.on('world-home');
  unassessed(speak, 0, 10, 'answer'); b.wait(9); unassessed(speak, 0, 5, 'hint');
  const skill = speakingSkill(home.summary()), cell = skill.levels[1].formats.spoken;
  assert.deepEqual([skill.status, skill.priority, skill.n, skill.lastAt, skill.assisted], ['unseen', 0.65, 0, null, 0]);
  assert.equal(cell.unassessed, 15, '채점 안 한 시도는 칸에 그 수로만 남는다');
  assert.deepEqual([cell.evidence, cell.reasonEvidence], [[], []]);
  b.wait(60);
  assert.equal(speakingSkill(home.summary()).status, 'unseen', '오래 지나도 「다시 볼 때(review)」가 되지 않는다 — lastAt은 혼자 낸 답에서만 온다');
  assert.deepEqual(home.followups().items.filter(row => row.gameId === 'world-speaking'), [], '판정 없는 시도는 재확인 앵커가 아니다');
});

test('채점 안 한 시도를 아무리 쌓아도 다른 능력의 상태는 그대로다', () => {
  const plain = bench(); readTwo(plain);
  const mixed = bench(); readTwo(mixed);
  const speak = mixed.on('world-speaking');
  for (let i = 0; i < TYPES.length; i++) unassessed(speak, i, 3, 'text');
  const others = summary => summary.skills.filter(s => s.domain !== 'speaking').map(({ id, status, priority, n, correct, incorrect, assisted }) => ({ id, status, priority, n, correct, incorrect, assisted }));
  assert.deepEqual(others(mixed.on('world-home').summary()), others(plain.on('world-home').summary()));
});

test('그 능력을 겨누는 후보는 급한 줄에 서지 않고, 근거를 지어내는 이유를 말하지 않는다', () => {
  const b = bench(); readTwo(b);
  const speak = b.on('world-speaking'), home = b.on('world-home');
  unassessed(speak, 0, 15);
  b.wait(9); // 읽기 칸이 7일을 넘겨 「다시 볼 때」
  const reading = { id: 'read-detail', minutes: 5, targets: [{ id: 'tr', skillIds: ['ko.reading.detail'], difficulty: 1, modality: 'reading', responseFormat: 'single-choice', itemKey: 'reading.detail.9', familyKey: 'reading.detail.9', conceptIds: [] }], goals: ['exam'] };
  const speaking = [0, 1].map(i => ({ id: `topik-speaking-${i + 1}`, minutes: 3, targets: [target(i)], goals: ['exam'], audioRequired: true }));
  const r = home.recommendActivities([...speaking, reading], { settings: { goals: ['exam'] }, at: b.clock() });
  assert.equal(r.selected.id, 'read-detail', '다시 볼 읽기 칸이 먼저 — 모름인 말하기는 그것을 앞지르지 못한다');
  for (const row of r.assessments.filter(a => a.id.startsWith('topik-speaking-'))) {
    assert.equal(row.state, 'unseen');
    assert.deepEqual(row.reasons, ['goal.declared'], '목표가 맞으면 목표 한 줄뿐 — practice.* · review.due가 없다');
  }
  const alone = home.recommendActivities([speaking[0]], { settings: { goals: [] }, at: b.clock() });
  assert.deepEqual([alone.reasons, alone.basis, alone.reason], [['practice.unseen'], 'cold-start', '아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.'],
    '목표가 안 맞으면 Core 기본 문장(지금 판과 같다 — 이유 한 줄은 다음 단계 J)');
});

test('문항 열쇠(target)가 있을 때만 방금 낸 문항이 뒤로 간다 — 열쇠 없는 후보는 이력을 못 본다', () => {
  const b = bench(), speak = b.on('world-speaking'), home = b.on('world-home');
  // 이름 차례: 열쇠 없는 1번(a-) · 열쇠 있는 1번(b-) · 열쇠 있는 2번(c-) — 점수가 같으면 이 차례로 선다.
  const candidates = [{ id: 'a-speaking-1-none', minutes: 3, targets: [], goals: ['exam'] }, { id: 'b-speaking-1', minutes: 3, targets: [target(0)], goals: ['exam'] },
    { id: 'c-speaking-2', minutes: 3, targets: [target(1)], goals: ['exam'] }];
  const order = () => home.recommendActivities(candidates, { settings: { goals: ['exam'] }, at: b.clock() }).assessments.map(a => a.id);
  assert.deepEqual(order(), ['a-speaking-1-none', 'b-speaking-1', 'c-speaking-2'], '아무것도 안 했을 때는 셋이 같은 점수');
  unassessed(speak, 0, 15);
  assert.deepEqual(order(), ['a-speaking-1-none', 'c-speaking-2', 'b-speaking-1'], '방금 낸 1번은 열쇠가 있을 때만 맨 뒤(−0.45 · −0.10)');
  // 다른 문항이 네 번 넘게 보이면 「방금」이 풀려도 「낸 적 있음」(−0.10)은 남는다.
  const games = b.on('world-practice');
  for (let n = 3; n <= 7; n++) { const p = games.present({ id: `r${n}`, itemKey: `reading.detail.${n}`, familyKey: `reading.detail.${n}`, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice' }); games.answer(p, { correct: true, assessable: true }); }
  assert.deepEqual(order(), ['a-speaking-1-none', 'c-speaking-2', 'b-speaking-1']);
});

test('단계가 하나뿐인 능력에 난도 2 · 3을 적으면 감점이 풀리지 않는다 — 난도 1이면 여섯이 고르게 돈다', () => {
  // 말하기 여섯 후보를 매주 다 넘기고 Core가 고른 하나를 「채점 안 함」으로 한다(다른 연습 없는 학생), 8주.
  function weeks(band) {
    const b = bench(), speak = b.on('world-speaking'), home = b.on('world-home'), picks = [];
    const difficulty = i => band ? TYPES[i][1] : 1;
    const candidates = TYPES.map((_, i) => ({ id: `topik-speaking-${i + 1}`, minutes: [3, 3, 4, 4, 5, 5][i], targets: [target(i, difficulty(i))], goals: ['exam'], audioRequired: true }));
    for (let week = 0; week < 8; week++) {
      const i = Number(home.recommendActivities(candidates, { settings: { goals: ['exam'] }, at: b.clock() }).selected.id.split('-').pop()) - 1;
      picks.push(i + 1);
      const pid = speak.present(item(i, difficulty(i))); speak.answer(pid, { correct: null, assessable: false });
      b.wait(7);
    }
    return picks;
  }
  const flat = weeks(false), banded = weeks(true);
  assert.deepEqual([...flat.slice(0, 6)].sort(), [1, 2, 3, 4, 5, 6], `난도 1: 여섯 주에 여섯 유형이 한 번씩(${flat.join('→')})`);
  assert.ok(!banded.includes(6), `난도 = 수준: 고급 하나는 8주 동안 차례가 오지 않는다(${banded.join('→')}) — 아래 단계의 혼자 해냄이 영원히 없어서`);
});
