// 검수 재현 스크립트(2026-10-06). 엔진 본체(domain·interpretation·ask·temper-outcomes)를 시험 밖 입력으로 눌러 본 결과를 그대로 출력한다. 아래 「엔진 경계」의 근거.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
'use strict';
const path = require('path');
const repo = path.resolve(__dirname, '../../../../..');
const Domain = require(path.join(repo, 'atlas/domain'));
const Interp = require(path.join(repo, 'atlas/interpretation'));
const Ask = require(path.join(repo, 'atlas/ask'));
const Outcomes = require(path.join(repo, 'atlas/temper-outcomes'));

const out = [];
const show = (name, fn) => { try { out.push(name + ' => ' + JSON.stringify(fn())); } catch (e) { out.push(name + ' => THROW ' + e.message); } };

const scope = { domain: 'SHIFT', workspace: 'w', subject: 's' };
const contract = { id: 'c', version: '1', purpose: 'p', fields: [
  { id: 'format', kind: 'enum', values: ['a', 'b'], minIndependent: 2, maxAgeDays: 30 },
  { id: 'days', kind: 'number', range: [0, 30], tolerance: 0.5 },
  { id: 'remote', kind: 'boolean' },
], criteria: [
  { id: 'fit', field: 'format', feature: 'format', weight: 4 },
] };
const ref = { id: 'c', version: '1', purpose: 'p' };
const dec = (id, field, value, at, extra = {}) => ({ id, contract: ref, scope, field, value, source: 'declared', at, ...extra });
const obs = (id, field, value, at, extra = {}) => ({ id, contract: ref, scope, field, value, source: 'observed', independentKey: id, quality: 'usable', at, ...extra });
const f = (r, id = 'format') => { const x = r.fields.find(i => i.id === id); return { status: x.status, value: x.value, usable: x.usable, independent: x.independent, evidence: x.evidence }; };

// A. 만료된 선언 뒤에 새 관측이 충분히 쌓인 경우
show('A1 만료 선언 + 그 뒤 새 관측 3건', () => {
  const r = Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [
    dec('d', 'format', 'a', '2026-08-01T00:00:00Z'),
    obs('o1', 'format', 'b', '2026-10-01T00:00:00Z'), obs('o2', 'format', 'b', '2026-10-02T00:00:00Z'), obs('o3', 'format', 'b', '2026-10-03T00:00:00Z'),
  ] });
  return { field: f(r), needsCheck: r.needsCheck };
});
show('A2 철회 뒤 새 관측 3건', () => {
  const r = Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [
    dec('d', 'format', null, '2026-09-20T00:00:00Z'),
    obs('o1', 'format', 'b', '2026-10-01T00:00:00Z'), obs('o2', 'format', 'b', '2026-10-02T00:00:00Z'), obs('o3', 'format', 'b', '2026-10-03T00:00:00Z'),
  ] });
  return { field: f(r), needsCheck: r.needsCheck };
});
// B. 근거 없는 추천: 기준이 모두 비필수이고 사실이 하나도 없을 때
show('B1 사실 없음 → decide', () => {
  const r = Domain.decide({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [], candidates: [{ id: 'z', features: { format: 'a' } }, { id: 'y', features: { format: 'b' } }] });
  return { status: r.status, selected: r.selected, ranked: r.ranked.map(x => [x.id, x.score]) };
});
// C. 숫자 중앙값: 짝수 표본·허용 오차 0
show('C1 숫자 [10, 12] 허용 오차 0.5', () => f(Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [obs('n1', 'days', 10, '2026-10-01T00:00:00Z'), obs('n2', 'days', 12, '2026-10-01T00:00:00Z')] }), 'days'));
show('C2 숫자 [10, 10.4]', () => f(Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [obs('n1', 'days', 10, '2026-10-01T00:00:00Z'), obs('n2', 'days', 10.4, '2026-10-01T00:00:00Z')] }), 'days'));
show('C3 숫자 [10, 10.4, 30] → 중앙값 10.4, 지지 2/3=0.667 < 0.67', () => f(Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [obs('n1', 'days', 10, '2026-10-01T00:00:00Z'), obs('n2', 'days', 10.4, '2026-10-01T00:00:00Z'), obs('n3', 'days', 30, '2026-10-01T00:00:00Z')] }), 'days'));
show('C4 enum 2:1 → 0.667 < 0.67 기본 합의', () => f(Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [obs('e1', 'format', 'a', '2026-10-01T00:00:00Z'), obs('e2', 'format', 'a', '2026-10-01T00:00:00Z'), obs('e3', 'format', 'b', '2026-10-01T00:00:00Z')] })));
// D. 같은 시각 같은 독립 키로 값이 같은 두 관측, 그리고 시각 표기만 다른 같은 순간
show('D1 Z 와 +00:00 표기', () => f(Domain.understand({ contract, scope, at: '2026-10-05T00:00:00Z', observations: [obs('e1', 'format', 'a', '2026-10-01T00:00:00Z'), obs('e2', 'format', 'a', '2026-10-01T09:00:00+09:00')] })));
// E. at 이 ISO 가 아닌 문자열
show('E1 at="2026-10-05"', () => f(Domain.understand({ contract, scope, at: '2026-10-05', observations: [dec('d', 'format', 'a', '2026-10-01')] })));
show('E2 at="Oct 5 2026"', () => f(Domain.understand({ contract, scope, at: 'Oct 5 2026', observations: [dec('d', 'format', 'a', '2026-10-01T00:00:00Z')] })));
// F. supersedes 가 아직 접수 전인 판을 가리킬 때의 과거 조회
show('F1 정정이 접수되기 전 시점 조회', () => f(Domain.understand({ contract, scope, at: '2026-10-02T00:00:00Z', observations: [
  obs('o1', 'format', 'a', '2026-10-01T00:00:00Z'), obs('o1b', 'format', 'b', '2026-10-01T12:00:00Z', { supersedes: 'o1', recordedAt: '2026-10-03T00:00:00Z', independentKey: 'o1' }), obs('o2', 'format', 'a', '2026-10-01T00:00:01Z')] })));

// G. Interpretation: 정상 호스트 흐름에서 resolve 가 던지는 경우 찾기
const icontract = { id: 'pc', version: '1', purpose: 'purchase', fields: [{ id: 'os', kind: 'enum', values: ['win', 'mac'] }, { id: 'ram', kind: 'number', range: [4, 128] }], criteria: [] };
const iscope = { domain: 'LAB', workspace: 'pc', subject: 'u' };
const text = '저는 맥을 써요. 램은 16GB 예요. 😀 윈도우는 안 써요.';
const src = (id, at, extra = {}) => ({ id, scope: iscope, at, text, actor: 'self', ...extra });
const span = (sourceId, quote) => { const start = text.indexOf(quote); return { sourceId, start, end: start + quote.length, quote }; };
const prop = (id, field, value, sourceId, quote, extra = {}) => ({ id, field, value, subject: 'self', stance: 'current', evidence: [span(sourceId, quote)], ...extra });
const base = { contract: icontract, scope: iscope };
show('G1 확인 → 원문 제외 → 같은 필드 새 원문 확인', () => {
  const s1 = src('s1', '2026-10-05T00:00:00Z'), p1 = prop('p1', 'os', 'mac', 's1', '맥을 써요');
  const r1 = Interp.review({ ...base, sources: [s1], proposals: [p1], reviews: [], id: 'r1', proposalId: 'p1', action: 'confirm', at: '2026-10-05T00:01:00Z' });
  const s1x = { ...s1, excludedAt: '2026-10-05T00:02:00Z' };
  const s2 = src('s2', '2026-10-05T00:03:00Z'), p2 = prop('p2', 'os', 'win', 's2', '윈도우');
  const r2 = Interp.review({ ...base, sources: [s1x, s2], proposals: [p1, p2], reviews: [r1], id: 'r2', proposalId: 'p2', action: 'confirm', at: '2026-10-05T00:04:00Z' });
  const res = Interp.resolve({ ...base, sources: [s1x, s2], proposals: [p1, p2], reviews: [r1, r2], at: '2026-10-05T00:05:00Z' });
  return { os: f(res.understanding, 'os'), states: res.proposals.map(p => [p.id, p.status, p.reasons]) };
});
show('G2 확인 뒤 같은 제안을 거절(활성) → 다시 확인', () => {
  const s1 = src('s1', '2026-10-05T00:00:00Z'), p1 = prop('p1', 'os', 'mac', 's1', '맥을 써요');
  const pk = { ...base, sources: [s1], proposals: [p1] };
  const r1 = Interp.review({ ...pk, reviews: [], id: 'r1', proposalId: 'p1', action: 'confirm', at: '2026-10-05T00:01:00Z' });
  const r2 = Interp.review({ ...pk, reviews: [r1], id: 'r2', proposalId: 'p1', action: 'reject', at: '2026-10-05T00:02:00Z' });
  const mid = Interp.resolve({ ...pk, reviews: [r1, r2], at: '2026-10-05T00:02:30Z' });
  const r3 = Interp.review({ ...pk, reviews: [r1, r2], id: 'r3', proposalId: 'p1', action: 'confirm', at: '2026-10-05T00:03:00Z' });
  const res = Interp.resolve({ ...pk, reviews: [r1, r2, r3], at: '2026-10-05T00:04:00Z' });
  return { mid: f(mid.understanding, 'os'), end: f(res.understanding, 'os') };
});
show('G3 확인 시각 == 원문 시각 == at', () => {
  const s1 = src('s1', '2026-10-05T00:00:00Z'), p1 = prop('p1', 'ram', 16, 's1', '16GB');
  const pk = { ...base, sources: [s1], proposals: [p1] };
  const r1 = Interp.review({ ...pk, reviews: [], id: 'r1', proposalId: 'p1', action: 'confirm', at: '2026-10-05T00:00:00Z' });
  return f(Interp.resolve({ ...pk, reviews: [r1], at: '2026-10-05T00:00:00Z' }).understanding, 'ram');
});
show('G4 원문 수명이 지난 뒤 resolve (확인은 유효 기간 안)', () => {
  const s1 = src('s1', '2026-09-01T00:00:00Z'), p1 = prop('p1', 'ram', 16, 's1', '16GB');
  const pk = { ...base, sources: [s1], proposals: [p1] };
  const r1 = Interp.review({ ...pk, reviews: [], id: 'r1', proposalId: 'p1', action: 'confirm', at: '2026-09-02T00:00:00Z' });
  const res = Interp.resolve({ ...pk, reviews: [r1], at: '2026-10-05T00:00:00Z' });
  return { ram: f(res.understanding, 'ram'), state: res.proposals.map(p => [p.status, p.reasons]) };
});
show('G5 수명 지난 뒤 정정(correct) 시도', () => {
  const s1 = src('s1', '2026-09-01T00:00:00Z'), p1 = prop('p1', 'ram', 16, 's1', '16GB');
  const pk = { ...base, sources: [s1], proposals: [p1] };
  return Interp.review({ ...pk, reviews: [], id: 'r1', proposalId: 'p1', action: 'correct', value: 32, at: '2026-10-05T00:00:00Z' }).action;
});
show('G6 이모지 뒤 인용 위치', () => {
  const s1 = src('s1', '2026-10-05T00:00:00Z'), p1 = prop('p1', 'os', 'win', 's1', '윈도우는 안 써요', { stance: 'past' });
  return Interp.prepare({ ...base, sources: [s1], proposals: [p1], at: '2026-10-05T00:00:00Z' }).proposals.map(p => [p.status, p.reasons]);
});
show('G7 정정 뒤 원문 제외 → 정정값도 비워지는가', () => {
  const s1 = src('s1', '2026-10-05T00:00:00Z'), p1 = prop('p1', 'ram', 16, 's1', '16GB');
  const r1 = Interp.review({ ...base, sources: [s1], proposals: [p1], reviews: [], id: 'r1', proposalId: 'p1', action: 'correct', value: 32, at: '2026-10-05T00:01:00Z' });
  const s1x = { ...s1, excludedAt: '2026-10-05T00:02:00Z' };
  return f(Interp.resolve({ ...base, sources: [s1x], proposals: [p1], reviews: [r1], at: '2026-10-05T00:03:00Z' }).understanding, 'ram');
});

// H. Ask
const qs = [{ id: 'q1', options: [{ id: 'a' }, { id: 'b' }] }, { id: 'q2', options: [{ id: 'x' }, { id: 'y' }], cost: 0.1 }];
show('H1 evaluate 없이 cost → 거절', () => Ask.rank({ questions: qs, decide: a => a.q1 || 'none' }));
show('H2 값 모드 순위', () => Ask.choose({ questions: qs, decide: a => ({ pick: a.q1 === 'b' ? 'B' : 'A', extra: a.q2 || null }), evaluate: ({ decision, answers }) => ({ utility: (answers.q1 === 'b') === (decision.pick === 'B') ? 1 : 0 }) }).ranked.map(r => [r.id, r.impact, r.value, r.reason]));
show('H3 결정 함수가 undefined 반환', () => Ask.choose({ questions: [qs[0]], decide: () => undefined }).status);

// I. Temper outcomes: asOf 뒤 접수 기록
const oc = { id: 'o', version: '1', scope: { domain: 'SHIFT', workspace: 'w', purpose: 'p' }, outcome: { id: 'm', kind: 'binary', direction: 'higher', windowMs: 1000, allowedValues: [0, 1] } };
const pol = [{ id: 'base', version: '1' }, { id: 'cand', version: '1' }];
show('I1 asOf 뒤 접수 기록 포함', () => Outcomes.evaluateOutcomes({ contract: oc, policies: pol, subjects: ['u1'], asOf: '2026-10-05T00:00:00Z', minimumSubjects: 1,
  decisions: [{ id: 'd1', subject: 'u1', scope: oc.scope, at: '2026-10-04T00:00:00Z', recordedAt: '2026-10-06T00:00:00Z', contract: { id: 'o', version: '1' }, policy: pol[0], candidateIds: ['a'], selectedId: 'a' }] }).comparison.status);
show('I2 빈 입력', () => { const r = Outcomes.evaluateOutcomes({ contract: oc, policies: pol, subjects: [], asOf: '2026-10-05T00:00:00Z' }); return [r.comparison, r.byPolicy.map(p => p.status)]; });

console.log(out.join('\n'));
