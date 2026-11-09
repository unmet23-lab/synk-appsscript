const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// 재현: Core 요약에는 「무엇을 몇 번 놓쳤나」가 이미 있다 — Vellum 문장만 그것을 받지 않는다
const ROOT = __ROOT;
const strata = require(ROOT + '/strata/index.js');
const { topikMap } = require(ROOT + '/strata/topik-i.js');
const L = require(ROOT + '/atlas/learning.js');
const V = require(ROOT + '/atlas/vellum.js');
const map = strata.createMap(topikMap());
const grammar = map.allNodes().filter(n => n.kind === 'grammar_point');
const g = grammar.find(n => /세요|시/.test(n.label_ko)) || grammar[0];
const now = '2026-11-10T03:00:00.000Z', day = n => new Date(Date.parse(now) - n * 86400000).toISOString();
const skill = 'ko.reading.grammar';
const attempts = [3, 2, 1].map((d, i) => ({ eventId: `m${i}`, at: day(d), independent: true, assisted: false, verdict: i < 2 ? 'incorrect' : 'correct', conceptIds: [g.id],
  measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: `mf${i}` } }));
const summary = { asOf: now, attempts };
const profile = { ...L.summarizeLearning({ summary, map }), concepts: L.summarizeConcepts({ summary, map }) };
const c = profile.concepts[0], f = c.formats['single-choice'];
console.log('Core가 아는 사실 →', JSON.stringify({ concept: c.label, kind: c.kind, status: c.status, n: f.n, incorrect: f.incorrect, lastAt: f.lastAt, evidence: f.evidence }));
const r = L.recommend({ profile, candidates: [{ id: 'x', skillIds: [skill], difficulty: 1, modality: 'reading', responseFormat: 'single-choice', itemKey: 'x', familyKey: 'x', conceptIds: [g.id] }] });
console.log('Vellum이 말하는 것 →', r.reason);
console.log('learningReason 입력 칸 →', V.learningReason.toString().split('\n')[0]);
