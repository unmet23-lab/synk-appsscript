import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNextAction, safeNextActionHref, validateNextActionInput } from './assistant-next-action.mjs';
import { createAssistantService } from './assistant-service.mjs';

const now = '2026-11-09T01:00:00.000Z';
const day = () => ({ date: '2026-11-09', today: { groups: { reply: [], due: [], review: [], recovery: [] } }, remaining: { groups: { upcoming: [], undated: [], waiting: [] } } });
const task = (id, extra = {}) => ({ id, title: '업무 ' + id, channelId: 'room', messageId: '1', stage: 'doing', status: 'doing', revision: 1, canManage: true, assigneeUnavailable: false, reviewerUnavailable: false, canReassignReviewer: false, allowedStages: ['done'], dueDate: null, ...extra });
const customer = (id, extra = {}) => ({ id: 'client:p:' + id, kind: 'follow_up', group: 'next', title: '고객 업무 ' + id, projectTitle: '고객 프로젝트', status: 'due', statusLabel: '연락할 날', dueDate: '2026-11-09', href: '/?tab=workroom&section=clients&project=p&followUp=1', ...extra });
const publication = (id, extra = {}) => ({ id: 'social:job:' + id, kind: 'publication_social', group: 'next', title: 'SNS 업무 ' + id, status: 'manual', statusLabel: 'SNS 발행 확인', actionLabel: '손이 필요한 예약 열기', href: '/?tab=social&section=fix', createdAt: '2026-10-01T00:00:00Z', ...extra });
function sources({ workday = day(), clients = [], deferred = [], publications = [] } = {}) {
  return { messenger: { ok: true, value: workday }, client: { ok: true, value: { todayItems: clients, deferredItems: deferred, rechecks: Object.fromEntries([...clients, ...deferred].map(row => [row.id, { state: deferred.includes(row) ? 'deferred' : 'active', fingerprint: 'semantic:' + row.id }])) } }, publication: { ok: true, value: { items: publications } } };
}
const build = (data, extra = {}) => buildNextAction({ now, sources: data, ...extra });

test('source order cannot hide overdue customer work behind messenger rows; alternatives are bounded', () => {
  const workday = day(); workday.today.groups.reply = Array.from({ length: 8 }, (_, i) => task('t' + i, { stage: 'requested', allowedStages: ['accepted'] }));
  const result = build(sources({ workday, clients: [customer('late', { dueDate: '2026-11-08' })], publications: [publication('broken')] }));
  assert.equal(result.status, 'ready'); assert.equal(result.next.source, 'client'); assert.equal(result.next.reasons[0].code, 'due_overdue'); assert.equal(result.totalCount, 10); assert.equal(result.alternatives.length, 5);
});

test('future and undated accepted work remain candidates without comparing company and messenger IDs', () => {
  const workday = day(); workday.remaining.groups.upcoming = [task('future', { stage: 'accepted', allowedStages: ['doing'], dueDate: '2026-11-11', assignee: { id: 'messenger:person' } })]; workday.remaining.groups.undated = [task('no-date')];
  const result = build(sources({ workday })); assert.equal(result.totalCount, 2); assert.equal(result.next.sourceId, 'future'); assert.equal(result.alternatives[0].due, null); assert.equal(result.next.action.panel, 'tasks');
});

test('overlapping workday groups deduplicate tasks while unrelated source IDs remain independent', () => {
  const workday = day(), row = task('one', { stage: 'requested', allowedStages: ['accepted'], dueDate: '2026-11-08' }); workday.today.groups.reply = [row]; workday.today.groups.due = [row];
  const result = build(sources({ workday, clients: [customer('one')], publications: [publication('one'), publication('one')] })); assert.equal(result.totalCount, 3);
});

test('waiting and done work are excluded, unavailable assignees are counted, reviewer recovery remains actionable only when authorized', () => {
  const workday = day(); workday.remaining.groups.waiting = [task('wait')]; workday.today.groups.due = [task('done', { stage: 'done', status: 'done' }), task('departed', { assigneeUnavailable: true, allowedStages: [] }), task('readonly', { canManage: false, allowedStages: [] })];
  workday.today.groups.recovery = [task('recover', { reviewerUnavailable: true, canReassignReviewer: true, allowedStages: [] }), task('cannot-recover', { reviewerUnavailable: true, allowedStages: [] })];
  const result = build(sources({ workday, clients: [customer('waiting', { group: 'waiting' })] }));
  assert.equal(result.totalCount, 1); assert.equal(result.unavailableCount, 3); assert.equal(result.next.sourceId, 'recover'); assert.equal(result.next.action.label, '검토자 지정하기');
});

test('customer recheck projection respects defer and reactivates changed sources without requiring mutation actions', () => {
  const active = customer('active', { actions: [] }), later = customer('later');
  let result = build(sources({ clients: [active], deferred: [later] })); assert.equal(result.totalCount, 1); assert.equal(result.next.sourceId, active.id);
  const next = sources({ clients: [later] }); next.client.value.rechecks[later.id].state = 'changed';
  result = build(next); assert.equal(result.next.sourceId, later.id);
});

test('KST date deadlines do not become overdue until next day; ordinary publication creation time is not a deadline', () => {
  const workday = day(); workday.today.groups.due = [task('dated', { dueDate: '2026-11-09' })];
  const data = sources({ workday, publications: [publication('old')] });
  const before = build(data, { now: '2026-11-09T14:59:59Z' }); assert.equal(before.next.reasons[0].code, 'due_today'); assert.equal(before.alternatives[0].due, null);
  const after = build(data, { now: '2026-11-09T15:00:00Z' }); assert.equal(after.date, '2026-11-10'); assert.equal(after.next.reasons[0].code, 'due_overdue');
  const revived = build(data, { now: '2026-11-09T15:00:00Z', exclusions: [before.next.key], candidateKey: before.next.key }); assert.equal(revived.next.sourceId, 'dated'); assert.equal(revived.excludedCount, 0); assert.equal(revived.candidateCheck.status, 'changed');
});

test('24h and 72h performance checkpoints retain exact due times and distinct identities', () => {
  const rows = [24, 72].map(hours => publication('measurement' + hours, { id: 'publication:performance:entry:' + hours, kind: 'publication_performance', group: 'reply', status: 'manual-required', checkpointHours: hours, createdAt: hours === 24 ? '2026-11-09T00:00:00Z' : '2026-11-09T00:30:00Z', href: '/?tab=workroom&section=tools&tool=publication&publicationAction=performance&entryId=entry&checkpoint=' + hours + 'h' }));
  const result = build(sources({ publications: rows })); assert.equal(result.totalCount, 2); assert.equal(result.next.due.precision, 'instant'); assert.equal(result.next.sourceId, 'publication:performance:entry:24');
});

test('SNS unknown publication state is a verified action to inspect, not a failed source or automatic retry', () => {
  const result = build(sources({ publications: [publication('uncertain', { status: 'unknown' })] }));
  assert.equal(result.status, 'ready'); assert.equal(result.coverage.publication.status, 'ok'); assert.match(result.next.reasons[0].text, /발행 여부/); assert.match(result.next.checks[1], /다시 보내지/);
});

test('missing, malformed and failed sources do not imply no work; successful sources remain useful', () => {
  const data = sources({ publications: [publication('one')] }); data.client = { ok: false };
  assert.equal(build(data).status, 'partial'); assert.equal(build(data).next.source, 'publication');
  data.messenger.value = { today: {} }; data.publication.value = { items: [null] };
  const unknown = build(data); assert.equal(unknown.status, 'unknown'); assert.equal(unknown.next, null);
  assert.equal(build(sources()).status, 'empty');
});

test('all skipped differs from no work and only matched unique keys count as exclusions', () => {
  const data = sources({ publications: [publication('one')] }), initial = build(data), key = initial.next.key;
  const result = build(data, { exclusions: [key, key] }); assert.equal(result.status, 'empty'); assert.equal(result.next, null); assert.equal(result.totalCount, 1); assert.equal(result.excludedCount, 1);
  assert.equal(build(sources(), { exclusions: [key] }).excludedCount, 0);
});

test('candidate confirmation searches the entire current set before exclusions and top-five truncation', () => {
  const rows = Array.from({ length: 10 }, (_, i) => publication(String(i))), data = sources({ publications: rows });
  const last = build(sources({ publications: [rows[9]] })).next;
  const result = build(data, { exclusions: [last.key], candidateKey: last.key }); assert.equal(result.candidateCheck.status, 'confirmed'); assert.equal(result.candidateCheck.candidate.key, last.key); assert.equal(result.alternatives.length, 5);
});

test('candidate confirmation distinguishes changed, removed and failed source states', () => {
  const row = publication('one'), data = sources({ publications: [row] }), key = build(data).next.key;
  data.publication.value.items = [{ ...row, status: 'reconnect_required' }]; assert.equal(build(data, { candidateKey: key }).candidateCheck.status, 'changed');
  data.publication.value.items = []; assert.equal(build(data, { candidateKey: key }).candidateCheck.status, 'missing');
  data.publication = { ok: false }; const result = build(data, { candidateKey: key }); assert.equal(result.candidateCheck.status, 'unverified'); assert.equal(result.candidateCheck.candidate, null);
});

test('message request, references and result changes revive skipped work without a task revision change', () => {
  const workday = day(); workday.remaining.groups.undated = [task('source-edit', {
    message: { id: '1', body: '원래 요청 ' + '가'.repeat(400), user: { id: 'author' }, workspaceLink: { title: '참고 현황', url: '/#view=history&section=mine', kind: 'report' }, files: [{ id: 'f1', name: '요청.txt', size: 12, mime: 'text/plain' }], replyToId: '2', replyTo: { id: '2', body: '상위 요청', files: [] }, mentions: [], ackRequired: false },
    resultMessage: { id: '3', body: '결과 설명', user: { id: 'assignee' } },
  })];
  const data = sources({ workday }), key = build(data).next.key;
  const changes = [
    row => { row.message.body += ' 마지막 요청 변경'; },
    row => { row.message.workspaceLink.url = '/#view=analysis&section=mine'; },
    row => { row.message.workspaceLink.title = '새 참고 자료'; },
    row => { row.message.files[0].name = '수정된 요청.txt'; },
    row => { row.message.files = []; },
    row => { row.message.replyTo.body = '상위 요청 수정'; },
    row => { row.message.replyTo.files = [{ id: 'parent-file', name: '참조.txt', size: 1, mime: 'text/plain' }]; },
    row => { row.message.mentions = [{ id: 'another-crew' }]; },
    row => { row.message.ackRequired = true; },
    row => { row.resultMessage.body = '결과 설명 수정'; },
  ];
  for (const change of changes) {
    const changed = structuredClone(data), row = changed.messenger.value.remaining.groups.undated[0]; change(row);
    const result = build(changed, { exclusions: [key], candidateKey: key });
    assert.equal(row.revision, 1); assert.equal(result.candidateCheck.status, 'changed'); assert.equal(result.excludedCount, 0); assert.equal(result.next.sourceId, row.id); assert.notEqual(result.next.key, key);
  }
});

test('message reactions, bookmarks and no-op edit metadata do not revive skipped work', () => {
  const workday = day(); workday.remaining.groups.undated = [task('stable-message', { message: { id: '1', body: '같은 요청', files: [], mentions: [] } })];
  const data = sources({ workday }), key = build(data).next.key;
  Object.assign(workday.remaining.groups.undated[0].message, { editedAt: '2026-11-09T02:00:00Z', saved: true, reactions: [{ emoji: '👍', count: 2 }], acknowledged: true, ackCount: 4, pinned: true, replyCount: 2 });
  const result = build(data, { exclusions: [key], candidateKey: key });
  assert.equal(result.candidateCheck.status, 'confirmed'); assert.equal(result.excludedCount, 1); assert.equal(result.next, null);
});

test('generated time and unrelated project metadata do not change a semantic recommendation key', () => {
  const data = sources({ clients: [customer('one')] }), key = build(data).next.key;
  data.client.value.todayItems[0].revision = 900; data.client.value.todayItems[0].updatedAt = '2026-11-09T01:30:00Z';
  assert.equal(build(data, { now: '2026-11-09T02:00:00Z' }).next.key, key);
});

test('every workspace action URL is constrained to internal authorized work pages', () => {
  for (const bad of ['https://evil.test/', '//evil.test/', '/api/users', '/?tab=workroom&section=clients&project=p&redirect=https://evil.test', '/?tab=social&section=fix#x', '/?tab=social&section=fix&tab=social', '/?tab=social&section=delete', '/?tab=workroom&section=clients&project=%00', '/?tab=workroom&section=tools&tool=publication&publicationAction=publish']) assert.equal(safeNextActionHref(bad), null, bad);
  for (const good of ['/?tab=social&section=today', '/?tab=workroom&section=clients&project=p&version=v&message=m&seconds=12.5', '/?tab=workroom&section=tools&tool=publication&publicationAction=publish&packageId=p&publicationFormat=youtube-shorts']) assert.ok(safeNextActionHref(good), good);
  const data = sources({ publications: [publication('bad', { href: '//evil.test/' })] }); assert.equal(build(data).coverage.publication.status, 'error');
});

test('input keys, array bounds and request types are validated before any sources are read', () => {
  const key = build(sources({ publications: [publication('one')] })).next.key;
  for (const input of [{ intent: 'next-action', exclusions: 'bad' }, { intent: 'next-action', exclusions: Array(101).fill(key) }, { intent: 'next-action', exclusions: [null] }, { intent: 'next-action', candidateKey: '["evil","one","x"]' }]) assert.throws(() => validateNextActionInput(input), error => error.status === 400);
  assert.equal(validateNextActionInput({ intent: 'next-action', exclusions: [key, key] }).exclusions.length, 1);
  let reads = 0; const service = createAssistantService({ productivity: () => { reads++; return day(); } });
  assert.throws(() => service.answer({}, { intent: 'next-action', exclusions: {} }), error => error.status === 400); assert.equal(reads, 0);
});

test('explicit intent needs no message, uses injected clock, reads each source once and never mutates input', () => {
  const data = sources({ publications: [publication('one')] }), before = JSON.stringify(data), reads = [];
  const service = createAssistantService({ clock: () => now, productivity: (_req, kind) => { reads.push(kind); return data.messenger.value; }, clientWorkday: () => { reads.push('client'); return data.client.value; }, publicationWorkday: () => { reads.push('publication'); return data.publication.value; } });
  const result = service.answer({ id: 'company:person' }, { intent: 'next-action' }, {});
  assert.equal(result.intent, 'next-action'); assert.equal(result.data.generatedAt, now); assert.equal(result.generative, false); assert.equal(result.externalCalls, false); assert.deepEqual(reads, ['workday', 'client', 'publication']); assert.equal(JSON.stringify(data), before);
});
