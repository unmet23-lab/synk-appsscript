const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// 재현: 칸(능력×난도×응답 꼴)의 상태를 능력 이름으로 말해 사실과 어긋나는 문장
const ROOT = __ROOT;
const strata = require(ROOT + '/strata/index.js');
const { topikMap } = require(ROOT + '/strata/topik-i.js');
const L = require(ROOT + '/atlas/learning.js');
const map = strata.createMap(topikMap());
const skill = 'ko.listening.detail';
const now = '2026-11-10T03:00:00.000Z';
const day = n => new Date(Date.parse(now) - n * 86400000).toISOString();
// 난도 1 · 단일선택에서 혼자 4번 연속 맞힘(서로 다른 계열)
const attempts = [1, 2, 3, 4].map(i => ({ eventId: `e${i}`, at: day(i), independent: true, assisted: false, verdict: 'correct', conceptIds: [],
  measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: `fam${i}` } }));
const summary = { asOf: now, attempts };
const profile = L.summarizeLearning({ summary, map });
const cand = (id, difficulty, responseFormat) => ({ id, skillIds: [skill], difficulty, modality: 'listening', responseFormat, itemKey: id, familyKey: id });
// (1) 같은 능력의 난도 2 새 문항만 남았을 때
let r = L.recommend({ profile, candidates: [cand('new-d2', 2, 'single-choice')] });
console.log('(1) 난도1 4연속 정답 뒤 난도2 →', r.state, '|', r.reason);
// (2) 같은 능력 · 같은 난도인데 응답 꼴만 다른 게임(action)
r = L.recommend({ profile, candidates: [cand('new-action', 1, 'action')] });
console.log('(2) 같은 능력 다른 응답 꼴 →', r.state, '|', r.reason);
// (3) 활동 추천: 목표 없음, 그 게임의 칸은 비어 있음
const act = L.recommendActivities({ profile, at: now, settings: {}, candidates: [{ id: 'game.x', minutes: 3, targets: [cand('t1', 1, 'action')] }] });
console.log('(3) 활동 추천 →', act.reasons, '|', act.reason);
// (4) 틀린 적이 있는 칸: 무엇을 몇 번 틀렸는지 문장에 있는가
const miss = [1, 2, 3].map(i => ({ eventId: `m${i}`, at: day(i), independent: true, assisted: false, verdict: i < 3 ? 'incorrect' : 'correct', conceptIds: ['ko.grammar.x'],
  measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: `mf${i}` } }));
const p2 = L.summarizeLearning({ summary: { asOf: now, attempts: miss }, map });
r = L.recommend({ profile: p2, candidates: [cand('again', 1, 'single-choice')] });
const cell = p2.skills.find(s => s.id === skill).levels[1].formats['single-choice'];
console.log('(4) 놓친 칸 →', r.state, '|', r.reason, '| Core가 가진 사실: n=' + cell.n, 'incorrect=' + cell.incorrect, 'lastAt=' + cell.lastAt, 'evidence=' + JSON.stringify(r.evidence));
