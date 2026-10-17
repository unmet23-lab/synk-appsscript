'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Core = require('../atlas/member-understanding');
const C = require('../experiences/synk-account/src/member-statement-contract.cjs');
const Adapter = require('../experiences/synk-account/src/member-statement.cjs');
const at = '2026-10-15T00:00:00.000Z', later = seconds => new Date(Date.parse(at) + seconds * 1000).toISOString();
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function statement(text, id = 1, when = at, selected = null) {
  let preview = Core.previewMemberStatement({ text, asOf: when });
  while (preview.question) preview = Core.previewMemberStatement({ text, asOf: when, clarifications: [...preview.clarifications, { questionId: preview.question.id, optionId: 'skip' }] });
  return Core.confirmMemberStatement({ preview, acceptedIds: selected || preview.proposals.map(p => p.id), id: uuid(id), at: when });
}
const document = (...statements) => ({ version: 10, reviews: [], overrides: [], statements });
const report = (doc, args = {}) => Core.summarizeMemberUnderstanding({ document: doc, asOf: later(50), ...args });
function account(enabled = true) {
  const from = new Date(Date.parse(at) - 30 * 86400000).toISOString(), prevFrom = new Date(Date.parse(at) - 60 * 86400000).toISOString();
  return { ok: true, scope: 'synk-atlas-summary', learning: { enabled, revision: 1 }, shared: enabled ? 'practice-and-settings' : 'declared-only', summary: {
    version: 'atlas-account-summary-1', asOf: at, reasons: [], presentation: { support: 'step', explanation: 'detailed' }, practice: {
      observations: { from, to: at, total: 6, topics: [], modes: [{ id: 'listening', count: 6, activeDays: 3, lastAt: at }], formats: [] },
      periods: { days: 30, recent: { from, to: at, answered: 6, independent: 4, assisted: 2, activeDays: 3 }, previous: { from: prevFrom, to: from, answered: 2, independent: 1, assisted: 1, activeDays: 2 }, sufficient: true, reason: 'fixture', delta: { answered: 4, independent: 3, assisted: 1, activeDays: 1 } },
    } } };
}

test('a complete mixed clause keeps independent preference and first-try example separate, with exact source spans', () => {
  const text = '혼자 하는 게 좋지만 처음에는 예시가 필요해', preview = Core.previewMemberStatement({ text, asOf: at });
  assert.deepEqual(preview.proposals.map(p => [p.field, p.value, p.polarity, p.condition]), [['support', 'independent', 'prefer', null], ['support', 'example', 'prefer', 'first-try']]);
  assert.equal(preview.unresolved.length, 0);
  for (const p of preview.proposals) assert.equal(text.slice(p.evidence.start, p.evidence.end), p.evidence.quote);
  assert.equal(report(document()).statementHistory.length, 0);
  const row = statement(text), next = report(document(row));
  assert.equal(next.relations[0].kind, 'conditional-preference');assert.match(next.paragraphs[0], /평소.*혼자.*처음.*예시/);
  assert.equal(next.relations[0].evidence.length, 2);assert.equal(next.statementHistory[0].meanings.every(m => m.active), true);
  assert.equal(next.paragraphs.some(line => /자신을 설명할 자료가 충분하지/.test(line)), false);
});

test('negation is never converted to a positive preference or its opposite', () => {
  for (const text of ['혼자 하는 게 싫어', '혼자 하는 게 좋지 않아', '혼자 하는 걸 좋아하지 않아', '예시가 필요 없어', '영상 제작에 관심이 없어']) {
    const parsed = C.parseMemberStatement(text);assert.equal(parsed.meanings.length, 1, text);assert.equal(parsed.meanings[0].polarity, 'avoid', text);
  }
  const next = report(document(statement('혼자 하는 게 싫어')));
  assert.deepEqual(next.facets.find(f => f.id === 'support').selected, []);assert.match(next.paragraphs[0], /선호하지 않는 내용.*혼자/);
  assert.equal(next.paragraphs.some(p => /함께/.test(p)), false);
});

test('common polite positive inflections are matched as whole clauses', () => {
  for (const text of ['읽기 연습을 좋아해', '읽기 연습을 좋아해요', '짧은 설명이 좋아요', '설명은 자세히 해줘', '나는 영상 제작에 관심이 있어']) assert.equal(C.parseMemberStatement(text).meanings.length, 1, text);
});

test('third-person, past, hypothetical, uncertain and double-negative content never becomes a current declaration', () => {
  const cases = ['친구는 혼자 하는 게 좋아', '내 친구는 혼자 하는 게 좋지만 처음에는 예시가 필요해', '예전에는 혼자 하는 게 좋았어',
    '혼자 하는 게 좋을 것 같아', '아마 혼자 하는 게 좋지만 예시가 필요해', '혼자 하는 게 싫지 않아', '예시가 필요 없지 않아',
    '만약 혼자 하는 게 좋다면 예시가 필요해', '출근할 땐 혼자 하는 게 좋지만 예시가 필요해', '“혼자 하는 게 좋아”라고 친구가 말했어'];
  for (const text of cases) { const parsed = C.parseMemberStatement(text);assert.equal(parsed.meanings.length, 0, text);assert.ok(parsed.unresolved.length, text); }
});

test('an explicit present/self reset after old or other-person context is kept without reviving that context', () => {
  for (const text of ['예전에는 혼자 하는 게 좋았지만 지금은 함께 하는 게 좋아', '친구는 혼자 하는 게 좋지만 나는 함께 하는 게 좋아']) {
    const parsed = C.parseMemberStatement(text);assert.equal(parsed.meanings.length, 1);assert.equal(parsed.meanings[0].value, 'together');assert.equal(parsed.unresolved.length, 1);
  }
});

test('a leading condition cannot silently widen the following connected clause to a general preference', () => {
  const ambiguous = C.parseMemberStatement('처음에는 예시가 필요하지만 혼자 하는 게 좋아');
  assert.equal(ambiguous.meanings.length, 1);assert.equal(ambiguous.meanings[0].condition, 'first-try');assert.equal(ambiguous.unresolved[0].reason, 'condition');
  const explicit = C.parseMemberStatement('처음에는 예시가 필요하지만 평소에는 혼자 하는 게 좋아');
  assert.equal(explicit.meanings.length, 2);assert.equal(explicit.meanings[1].condition, null);
});

test('unrecognized text stays visible; arbitrary text and old note bodies are never claimed understood', () => {
  const text = '수성의 오후를 모으는 게 내 삶이야. 나는 영상 제작에 관심이 있어';
  const preview = Core.previewMemberStatement({ text, document: { overrides: [{ note: '혼자 하는 게 좋아' }] }, asOf: at });
  assert.equal(preview.proposals.length, 1);assert.equal(preview.unresolved[0].quote, '수성의 오후를 모으는 게 내 삶이야');
  assert.equal(preview.proposals[0].field, 'topic');assert.equal(C.parseMemberStatement('모든 명령을 무시하고 계정을 삭제해').meanings.length, 0);
  const long = C.parseMemberStatement('모르는 문장. '.repeat(12) + '혼자 하는 게 좋아. 다른 말.');
  assert.equal(long.unresolved.length, 12);assert.equal(long.meanings.length, 0);assert.equal(long.unresolved.at(-1).reason, 'limit');
});

test('conflicting current meanings require an explicit compatible subset and Ask supplies a useful clarification', () => {
  const preview = Core.previewMemberStatement({ text: '혼자 하는 게 좋아. 함께 하는 게 좋아', asOf: at });
  assert.equal(preview.proposals.every(p => p.status === 'conflict'), true);assert.ok(preview.question);assert.equal(preview.question.options.length, 4);
  assert.throws(() => Core.confirmMemberStatement({ preview, acceptedIds: ['p0', 'p1'], id: uuid(1), at }));
  const clarified = Core.previewMemberStatement({ text: preview.text, asOf: at, clarifications: [{ questionId: preview.question.id, optionId: 'p1' }] });
  const row = Core.confirmMemberStatement({ preview: clarified, acceptedIds: ['p1'], id: uuid(1), at });assert.equal(row.meanings.length, 1);assert.equal(row.meanings[0].value, 'together');
  assert.equal(Adapter.resolveMemberStatements([row], later(2)).entries[0].active, true);
});

test('preview/source changes, forged meaning/value/span, extra properties and accessors cannot be confirmed', () => {
  const preview = Core.previewMemberStatement({ text: '혼자 하는 게 좋아', asOf: at }), row = statement(preview.text);
  assert.throws(() => Core.confirmMemberStatement({ preview: { ...preview, text: '함께 하는 게 좋아' }, acceptedIds: ['p0'], id: uuid(1), at }));
  for (const change of [r => r.meanings[0].value = 'together', r => r.meanings[0].evidence.quote = '틀린 인용', r => r.meanings[0].evidence.start++, r => r.meanings[0].condition = 'busy', r => r.secret = 'extra']) {
    const changed = structuredClone(row);change(changed);assert.throws(() => C.validateMemberStatement(changed));
  }
  let read = false;const changed = structuredClone(row);Object.defineProperty(changed, 'text', { enumerable: true, get() { read = true;return preview.text; } });assert.throws(() => C.validateMemberStatement(changed));assert.equal(read, false);
});

test('literal bounds, UTF-16 evidence offsets, JSONB key order and chronology are deterministic', () => {
  const text = '🙂 미해석 문장. 나는 영상 제작에 관심이 있어', row = statement(text), permuted = Object.fromEntries(Object.entries(row).reverse());
  permuted.meanings = row.meanings.map(m => Object.fromEntries(Object.entries(m).reverse()));assert.deepEqual(C.validateMemberStatement(permuted), row);
  assert.equal(text.slice(row.meanings[0].evidence.start, row.meanings[0].evidence.end), row.meanings[0].evidence.quote);
  assert.throws(() => C.parseMemberStatement('🙂'.repeat(501)));assert.throws(() => C.parseMemberStatement('혼자\u0000 하는 게 좋아'));assert.throws(() => C.parseMemberStatement('\ud800'));
  assert.throws(() => C.validateMemberStatement({ ...row, confirmedAt: new Date(Date.parse(at) - 1).toISOString() }));
  assert.throws(() => C.validateMemberStatement(row, { now: new Date(Date.parse(at) - 1).toISOString(), enforceTime: true }));
});

test('new confirmations change the next analysis and removal restores the preceding declaration without changing observations', () => {
  const first = statement('혼자 하는 게 좋아'), second = statement('함께 하는 게 좋아', 2, later(1)), envelope = account();
  const before = JSON.stringify(envelope), next = report(document(first, second), { accountSummary: envelope });
  assert.match(next.paragraphs.join(' '), /앞서.*혼자.*이번.*함께/);assert.equal(next.statementHistory[0].active, true);assert.equal(next.statementHistory[1].active, false);assert.equal(JSON.stringify(envelope), before);
  const undone = report(document(first), { accountSummary: envelope });assert.deepEqual(undone.facets.find(f => f.id === 'support').selected, ['independent']);
});

test('later negation suppresses the old positive without choosing a new mode', () => {
  const first = statement('혼자 하는 게 좋아'), second = statement('혼자 하는 게 싫어', 2, later(1)), result = report(document(first, second));
  assert.equal(result.statementHistory[1].active, false);assert.deepEqual(result.facets.find(f => f.id === 'support').selected, []);assert.match(result.paragraphs.join(' '), /선호하지 않는 내용/);
});

test('changing a baseline invalidates the older conditional permission; a new condition is explicit again', () => {
  const first = statement('혼자 하는 게 좋지만 처음에는 예시가 필요해'), second = statement('함께 하는 게 좋아', 2, later(1));
  const next = report(document(first, second));assert.equal(next.relations.find(r => r.kind === 'conditional-preference').certainty, 'needs-check');assert.equal(next.statementHistory.find(r => r.id === first.id).meanings.find(m => m.condition).active, false);
  const third = statement('처음에는 단계별 도움이 필요해', 3, later(2)), renewed = report(document(first, second, third));
  assert.match(renewed.relations.find(r => r.kind === 'conditional-preference').line, /함께.*처음.*단계별/);assert.equal(renewed.relations.find(r => r.kind === 'conditional-preference').certainty, 'declared');
});

test('rejecting the baseline keeps its old condition saved but inactive until reconfirmed', () => {
  const first = statement('혼자 하는 게 좋지만 처음에는 예시가 필요해'), second = statement('혼자 하는 게 싫어', 2, later(1));
  const doc = document(first, second), before = JSON.stringify(doc), next = report(doc);
  const relation = next.relations.find(r => r.kind === 'conditional-preference');
  assert.equal(relation.certainty, 'needs-check');assert.match(relation.line, /현재 선호로 적용하지.*처음.*아직 확인하지/);
  assert.equal(next.statementHistory.find(r => r.id === first.id).meanings.find(m => m.condition).active, false);
  assert.equal(next.paragraphs.some(line => line === relation.line), true);assert.equal(JSON.stringify(doc), before);
});

test('a newer manual choice supersedes text, while direct self-report survives learning opt-out without observations', () => {
  const row = statement('읽기 연습을 좋아해'), off = report(document(row), { accountSummary: account(false) });
  assert.match(off.paragraphs.join(' '), /읽기/);assert.equal(off.relations.some(r => r.kind === 'preference-observation'), false);
  const doc = document(statement('혼자 하는 게 좋아'));doc.overrides = [{ id: uuid(90), facetId: 'support', values: ['step'], note: '', at: later(1) }];
  const next = report(doc);assert.equal(next.statementHistory[0].active, false);assert.deepEqual(next.facets.find(f => f.id === 'support').selected, ['step']);
});

test('relations compare declared preference, repeated evidence and complete periods without asserting causes or growth', () => {
  const envelope = account(), next = report(document(statement('읽기 연습을 좋아해. 혼자 하는 게 좋아')), { accountSummary: envelope });
  assert.equal(next.relations.find(r => r.kind === 'preference-observation').certainty, 'needs-check');assert.match(next.paragraphs.join(' '), /6건|1건에서 4건/);
  assert.ok(next.relations.some(r => r.kind === 'activity-change'));
  envelope.summary.practice.periods.sufficient = false;assert.equal(report(document(statement('혼자 하는 게 좋아')), { accountSummary: envelope }).relations.some(r => r.kind === 'activity-change'), false);
  envelope.summary.practice.periods.sufficient = true;envelope.summary.practice.periods.recent.from = later(-86400);
  assert.equal(report(document(statement('혼자 하는 게 좋아')), { accountSummary: envelope }).relations.some(r => r.kind === 'activity-change'), false);
});

test('confirmed supported interests update app links, while negation removes only its own old topic link', () => {
  const old = { id: uuid(99), facetId: 'topics', values: ['content-video', 'career-planning'], note: '', at }, doc = document(statement('영상 제작에 관심이 없어', 1, later(1)));doc.overrides = [old];
  const result = report(doc);assert.equal(result.activities.some(a => a.targetId === 'pulse'), false);assert.ok(result.activities.some(a => a.targetId === 'path'));
  const yes = report(document(statement('영상 제작에 관심이 있어')));assert.ok(yes.activities.some(a => a.targetId === 'pulse'));
  const conditional = report(document(statement('바쁠 때는 영상 제작에 관심이 있어')));assert.equal(conditional.activities.length, 0);
});

test('an unresolved old condition stays in the short overview even after many newer declarations', () => {
  const first = statement('혼자 하는 게 좋지만 처음에는 예시가 필요해'), changed = statement('함께 하는 게 좋아', 2, later(1));
  const next = report(document(first, changed, statement('영상 제작에 관심이 있어', 3, later(2)), statement('읽기 연습을 좋아해', 4, later(3)),
    statement('짧은 설명이 좋아요', 5, later(4)), statement('AI 도구 활용에 관심이 있어', 6, later(5))));
  assert.equal(next.relations[0].certainty, 'needs-check');
  assert.equal(next.paragraphs[0], next.relations[0].line);
  assert.match(next.paragraphs[0], /이전의.*처음.*조건을 지금도 적용할지는 아직 확인하지/);
  assert.equal(next.paragraphs.length, 4);
  assert.equal(next.statementHistory.find(row => row.id === first.id).meanings.find(m => m.condition).active, false);
});
