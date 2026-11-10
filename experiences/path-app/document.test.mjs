import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPathDocument, validatePathDocument, validateSavedJob, addSavedJob, removeSavedJob, isSafeJobUrl, MAX_DOCUMENT_BYTES } from './document.mjs';
import { upsertTask } from './state.mjs';
const stamp = '2026-11-09T21:00:00.000Z';
const job = { id: 'greenhouse-moloco-123', provider: 'greenhouse', board: 'moloco', jobId: '123', company: 'Moloco', title: 'Software Engineer', location: 'Seoul, South Korea', employmentType: null, url: 'https://job-boards.greenhouse.io/moloco/jobs/123', observedAt: stamp };
const throws = fn => assert.throws(fn, error => ['INVALID_PATH_DOCUMENT', 'PATH_DOCUMENT_TOO_LARGE'].includes(error.code));

test('account document clones exact state and preserves both languages and overlapping goals', () => {
  for (const lang of ['ko', 'en']) {
    const d = createPathDocument(lang); d.state.secondaryGoals = ['study', 'student', 'job'];
    assert.deepEqual(validatePathDocument(d), d);
    assert.notEqual(validatePathDocument(d).state, d.state);
  }
});
test('future and unknown fields fail without changing source bytes', () => {
  for (const mutate of [d => d.version++, d => d.state.schemaVersion++, d => d.accountId = 'owner', d => d.state.extra = true, d => d.state.location = 'missing']) {
    const d = createPathDocument(); mutate(d); const before = JSON.stringify(d); throws(() => validatePathDocument(d)); assert.equal(JSON.stringify(d), before);
  }
});
test('malformed fields are rejected rather than sanitized or truncated', () => {
  for (const mutate of [d => d.state.lang = 'fr', d => d.state.revision = -1, d => d.state.onboarded = 'yes', d => d.state.primaryGoal = 'visa',
    d => d.state.interests = ['a', 'a'], d => d.state.secondaryGoals = ['job', 'job'], d => d.savedJobs = {}, d => d.state.savedAt = 'yesterday']) {
    const d = createPathDocument(); mutate(d); throws(() => validatePathDocument(d));
  }
});
test('real job preparation requires a retained snapshot and job goal', () => {
  let d = createPathDocument(); d.state = upsertTask(d.state, { goal: 'job', sourceId: job.id, body: '나의 준비' }, stamp);
  throws(() => validatePathDocument(d));
  d = addSavedJob(createPathDocument(), job, stamp); d.state = upsertTask(d.state, { goal: 'job', sourceId: job.id, body: '나의 준비' }, stamp);
  assert.equal(validatePathDocument(d).state.tasks[0].body, '나의 준비');
  assert.throws(() => removeSavedJob(d, job.id), { code: 'JOB_IN_USE' });
  d.state.tasks[0].goal = 'study'; throws(() => validatePathDocument(d));
});
test('only the six known practice sources match their correct goal', () => {
  for (const goal of ['study', 'student', 'job']) {
    const d = createPathDocument(); d.state = upsertTask(d.state, { goal, sourceId: `demo-${goal}-a`, body: '' }, stamp);
    assert.equal(validatePathDocument(d).state.tasks.length, 1);
    d.state.tasks[0].sourceId = 'invented'; throws(() => validatePathDocument(d));
  }
});
test('bookmark saves are bounded, updated in place, and retain original savedAt', () => {
  let d = addSavedJob(createPathDocument(), job, stamp);
  d = addSavedJob(d, { ...job, title: 'Updated title' }, '2026-11-10T01:00:00.000Z');
  assert.equal(d.savedJobs.length, 1); assert.equal(d.savedJobs[0].savedAt, stamp); assert.equal(d.savedJobs[0].snapshot.title, 'Updated title');
  assert.equal(removeSavedJob(d, job.id).savedJobs.length, 0);
  d.savedJobs.push(structuredClone(d.savedJobs[0])); throws(() => validatePathDocument(d));
});
test('job IDs and URLs cannot point at another company, application, or active scheme', () => {
  for (const url of ['javascript:alert(1)', 'https://evil.invalid/moloco/jobs/123', 'https://user:pass@job-boards.greenhouse.io/moloco/jobs/123',
    'https://job-boards.greenhouse.io/moloco/jobs/124', 'https://job-boards.greenhouse.io/other/jobs/123', 'https://job-boards.greenhouse.io/moloco/jobs/123#x',
    'https://job-boards.greenhouse.io/moloco/jobs/123?return=https://evil.invalid', 'https://www.coupang.jobs/en/jobs/?gh_jid=123']) {
    assert.equal(isSafeJobUrl(url, 'moloco', '123'), false, url);
  }
  assert.equal(isSafeJobUrl('https://www.coupang.jobs/en/jobs/?gh_jid=123', 'coupang', '123'), true);
  assert.equal(isSafeJobUrl('https://www.coupang.jobs/en/jobs/123/role-name/?gh_jid=123', 'coupang', '123'), true);
  assert.equal(isSafeJobUrl('https://www.coupang.jobs/en/jobs/124/role-name/?gh_jid=123', 'coupang', '123'), false);
});
test('snapshots reject unknown fields, inconsistent IDs and overlong titles', () => {
  const saved = addSavedJob(createPathDocument(), job, stamp).savedJobs[0];
  for (const mutate of [s => s.id += '4', s => s.jobId = '0', s => s.board = 'other', s => s.snapshot.title = 'x'.repeat(301),
    s => s.snapshot.employmentType = undefined, s => s.snapshot.description = 'unwanted full text']) {
    const s = structuredClone(saved); mutate(s); throws(() => validateSavedJob(s));
  }
});
test('empty confirmed drafts, duplicates, long tasks, invalid JSONB characters are refused', () => {
  const base = createPathDocument(); base.state = upsertTask(base.state, { goal: 'job', sourceId: 'demo-job-a', body: 'valid🙂' }, stamp);
  for (const mutate of [d => { d.state.tasks[0].body = ''; d.state.tasks[0].confirmedAt = stamp; }, d => d.state.tasks.push(d.state.tasks[0]),
    d => d.state.tasks[0].body = 'x'.repeat(6001), d => d.state.tasks[0].body = 'a\u0000b', d => d.state.tasks[0].body = 'a\ud800b', d => d.state.tasks[0].body = 'a\udc00b']) {
    const d = structuredClone(base); mutate(d); throws(() => validatePathDocument(d));
  }
  assert.equal(validatePathDocument(base).state.tasks[0].body, 'valid🙂');
});
test('serialized document byte bound applies before unsupported giant objects enter storage', () => {
  const d = createPathDocument(); d.extra = '가'.repeat(MAX_DOCUMENT_BYTES);
  assert.throws(() => validatePathDocument(d), { code: 'PATH_DOCUMENT_TOO_LARGE' });
});
