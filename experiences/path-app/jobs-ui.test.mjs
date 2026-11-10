import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJobsFeed, renderJobs, jobOpportunity } from './jobs-ui.mjs';
import { createPathSession } from './account.mjs';
import { readConfig } from '../synk-account/src/core.mjs';
import { validatePathDocument } from './document.mjs';

const at = '2026-11-10T00:00:00.000Z';
const pageUrl = 'https://synk.im/path/app/';
// Public values only. Optional learningUrl intentionally absent: readConfig supplies its default using the page URL.
const config = { version: 1, supabaseUrl: 'https://path-test.supabase.co', accountApiUrl: 'https://path-test.supabase.co',
  supabasePublishableKey: 'sb_publishable_synthetic_only', portalUrl: 'https://synk.im/id/',
  clients: { 'path-app': { clientId: 'synthetic-path-browser', redirectUri: pageUrl } } };
const configured = { ...config, learningUrl: 'https://synk.im/learning-hub/' };
const clone = value => structuredClone(value);
const json = (value, options) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...options });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const source = (board, extra = {}) => ({ provider: 'greenhouse', board, company: board === 'moloco' ? 'Moloco' : 'Coupang',
  status: 'fresh', complete: true, observedAt: at, attemptedAt: at, retryAfter: null, error: null,
  evidence: { careerUrl: board === 'moloco' ? 'https://www.moloco.com/company/careers' : 'https://www.coupang.jobs/en/jobs/',
    documentationUrl: 'https://docs.greenhouse.io/job-board.html', verifiedAt: '2026-11-09T19:46:44.651Z' }, ...extra });
const row = (id = '123', board = 'moloco', extra = {}) => ({ id: `greenhouse-${board}-${id}`, provider: 'greenhouse', board, jobId: id,
  company: board === 'moloco' ? 'Moloco' : 'Coupang', title: `Software Engineer ${id}`, location: 'Seoul, South Korea', employmentType: null,
  url: `https://boards.greenhouse.io/${board}/jobs/${id}`, observedAt: at, updatedAt: at, ...extra });
// Wire contract from SYNK-talk/lib/synk-path-jobs.js, including object-shaped provider failures.
const payload = (jobs = [row()], sources = [source('moloco'), source('coupang')]) => ({ ok: true, scope: 'synk-path-jobs', jobs, sources });
function fixture(t, { data = payload(), publicConfig = configured, intercept } = {}) {
  const calls = [], changes = [];
  const feed = createJobsFeed({ getUrl: () => pageUrl, onChange: value => changes.push(clone(value)),
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const fallback = () => json(url === pageUrl + 'config.json' ? publicConfig : data);
      return intercept ? intercept(url, init, fallback) : fallback();
    } });
  t.after(() => feed.dispose());
  return { feed, calls, changes };
}
function guest(t) {
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, String(value)), removeItem: key => records.delete(key) };
  const status = { configured: true, signedIn: false, accountId: null, status: 'signed-out' };
  const session = createPathSession({ storage, lang: 'ko', now: () => new Date(at),
    accountFactory: () => ({ start: async () => status, status: () => status, dispose() {} }) });
  t.after(() => session.dispose());
  return session;
}
const cards = html => [...html.matchAll(/<li class="opportunity jobs-card" data-id="([^"]+)"/g)].map(match => match[1]);

test('valid public config defaults resolve against the page URL and request the real jobs action anonymously', async t => {
  assert.equal(readConfig(config, pageUrl).configured, true);
  const f = fixture(t, { publicConfig: config }), state = await f.feed.load();
  assert.equal(state.status, 'ready');
  assert.deepEqual(f.calls.map(call => call.url), [pageUrl + 'config.json', 'https://path-test.supabase.co/functions/v1/synk-path?action=jobs']);
  const init = f.calls[1].init;
  assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
  assert.equal(init.headers.apikey, config.supabasePublishableKey);
  // The public jobs branch advertises only apikey/content-type in its CORS
  // preflight. Private document contract headers block the browser GET.
  const publicCorsHeaders = new Set(['apikey', 'content-type']);
  assert.deepEqual([...new Headers(init.headers).keys()].filter(name => !publicCorsHeaders.has(name)), []);
  assert.equal(Object.keys(init.headers).some(name => name.toLowerCase() === 'authorization'), false);
});

test('a normalized live feed entry can be saved and used as a task without extra API metadata entering the document', async t => {
  const f = fixture(t), state = await f.feed.load(), session = guest(t); await session.init();
  assert.equal(state.status, 'ready'); assert.equal(session.saveJob(state.jobs[0]), true);
  assert.equal(session.saveJob(state.jobs[0]), false);
  const doc = session.document();
  assert.equal(doc.savedJobs[0].snapshot.employmentType, null); assert.equal('updatedAt' in doc.savedJobs[0], false);
  const opportunity = jobOpportunity(doc.savedJobs[0]); assert.equal(opportunity.id, row().id); assert.equal(opportunity.goal, 'job');
  session.updateState({ ...doc.state, tasks: [{ id: 'prepare-live-123', goal: 'job', sourceId: opportunity.id,
    body: 'My experience draft', confirmedAt: null, updatedAt: at }] });
  assert.equal(validatePathDocument(session.document()).state.tasks[0].body, 'My experience draft');
  assert.throws(() => session.removeJob(opportunity.id), { code: 'JOB_IN_USE' });
});

test('one failed provider preserves the other provider feed and communicates unknown availability', async t => {
  const f = fixture(t, { data: payload([row()], [source('moloco'), source('coupang', {
    status: 'error', complete: false, observedAt: null, error: { code: 'upstream_http', httpStatus: 503 }, retryAfter: at,
  })]) });
  const state = await f.feed.load();
  assert.equal(state.status, 'ready'); assert.equal(state.jobs.length, 1);
  assert.equal(state.sources.find(s => s.board === 'coupang').status, 'error');
  const html = renderJobs({ feed: state }); assert.equal(cards(html).length, 1); assert.match(html, /일부 출처/);
  assert.doesNotMatch(html, /현재 게시된 공고가 없습니다/);
});

test('safe titles, source labels and search text remain escaped while job links retain strict original destinations', async t => {
  const hostile = '<img src=x onerror="alert(1)"> & \'title\'';
  const f = fixture(t, { data: payload([row('123', 'moloco', { title: hostile })], [source('moloco', { company: hostile })]) });
  const state = await f.feed.load(), html = renderJobs({ feed: state });
  assert.equal(state.status, 'ready'); assert.doesNotMatch(html, /<img\s/); assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /rel="noopener noreferrer"/); assert.match(html, /href="https:\/\/boards.greenhouse.io\/moloco\/jobs\/123"/);
  const search = renderJobs({ feed: state, query: '\" autofocus onfocus="alert(1)' });
  assert.match(search, /value="&quot; autofocus onfocus=&quot;alert\(1\)"/);
  assert.doesNotMatch(search, /value="" autofocus/);
});

test('search, board and saved filters operate before pagination and out-of-range pages clamp', async t => {
  const rows = Array.from({ length: 15 }, (_, n) => row(String(n + 1), n < 13 ? 'moloco' : 'coupang'));
  const f = fixture(t, { data: payload(rows) }), state = await f.feed.load();
  assert.equal(cards(renderJobs({ feed: state })).length, 12);
  assert.deepEqual(cards(renderJobs({ feed: state, page: 99 })), rows.slice(12).map(j => j.id));
  assert.deepEqual(cards(renderJobs({ feed: state, board: 'coupang', query: 'SOFTWARE' })), rows.slice(13).map(j => j.id));
  const unmatched = renderJobs({ feed: state, query: 'not a real match' });
  assert.equal(cards(unmatched).length, 0);
  assert.match(unmatched, /검색 조건에 맞는 공고가 없습니다/);
  assert.doesNotMatch(unmatched, /현재 게시된 공고가 없습니다/);
  const saved = state.jobs.slice(0, 1).map(({ updatedAt, ...job }) => job);
  assert.deepEqual(cards(renderJobs({ feed: state, savedJobs: saved, onlySaved: true })), [rows[0].id]);
  assert.match(renderJobs({ feed: state, canEdit: false }), /data-action="saveJob"[^>]* disabled/);
  assert.match(renderJobs({ feed: state, canEdit: false }), /내 정보에서 저장 상태를 확인/);
});

test('disabled publication clears the live feed while preserving saved jobs and preparation drafts', async t => {
  let data = payload();
  const f = fixture(t, { intercept: (url, _init, fallback) => url.includes('functions/v1') ? json(data) : fallback() });
  const initial = await f.feed.load(), session = guest(t); await session.init();
  session.saveJob(initial.jobs[0]);
  const taskState = session.document().state;
  session.updateState({ ...taskState, tasks: [{ id: 'prepare-disabled-123', goal: 'job', sourceId: row().id,
    body: 'The previously saved draft remains available.', confirmedAt: null, updatedAt: at }] });
  const saved = clone(session.document());
  data = { ok: true, scope: 'synk-path-jobs', availability: 'disabled', jobs: [], sources: [] };
  const state = await f.feed.load();
  assert.equal(state.status, 'disabled'); assert.deepEqual(state.jobs, []); assert.deepEqual(state.sources, []);
  assert.equal(state.error, null); assert.equal(state.stale, false);
  assert.deepEqual(session.document(), saved, 'changing feed availability must never modify personal documents');
  const html = renderJobs({ feed: state, savedJobs: saved.savedJobs });
  assert.match(html, /채용 공고 연결을 준비하고 있어요/);
  assert.doesNotMatch(html, /현재 게시된 공고가 없습니다|공고를 불러오지 못했습니다|data-action="refreshJobs"/);
  assert.deepEqual(cards(html), [row().id]);
  assert.match(html, /data-action="prepareJob"/); assert.match(html, /data-action="removeJob"/);
  const readOnly = renderJobs({ feed: state, savedJobs: saved.savedJobs, canEdit: false });
  assert.match(readOnly, /내 정보에서 저장 상태를 확인/);
  assert.match(readOnly, /data-action="prepareJob"[^>]* disabled/);
  assert.match(renderJobs({ feed: state, lang: 'en' }), /preparing to connect job listings/);
});

test('a malformed disabled response is an error rather than silently clearing a previous live result', async t => {
  let data = payload();
  const f = fixture(t, { intercept: (url, _init, fallback) => url.includes('functions/v1') ? json(data) : fallback() });
  const first = await f.feed.load();
  data = { ...payload(), availability: 'disabled' };
  const state = await f.feed.load();
  assert.equal(state.status, 'error'); assert.deepEqual(state.jobs, first.jobs);
});

test('refreshing ready and failed feeds publishes loading immediately and shares the in-flight request', async t => {
  let pending;
  const f = fixture(t, { intercept: (url, _init, fallback) => url.includes('functions/v1') && pending ? pending.promise : fallback() });
  const initial = await f.feed.load();
  for (const next of [() => new Response('', { status: 503 }), () => json(payload())]) {
    pending = deferred();
    const before = f.calls.length;
    const a = f.feed.load(), b = f.feed.load();
    assert.equal(f.feed.snapshot().status, 'loading');
    assert.equal(f.changes.at(-1).status, 'loading');
    assert.deepEqual(f.feed.snapshot().jobs, initial.jobs, 'refresh keeps existing cards available');
    const html = renderJobs({ feed: f.feed.snapshot() });
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-action="refreshJobs" disabled>불러오는 중/);
    for (let i = 0; i < 20 && f.calls.length < before + 2; i++) await tick();
    assert.equal(f.calls.length, before + 2, 'concurrent refresh performs one config and one API request');
    pending.resolve(next()); await Promise.all([a, b]);
  }
  assert.equal(f.feed.snapshot().status, 'ready');
});

test('missing saved jobs remain visible: only fresh complete success labels absence, while stale/error stays unconfirmed', async t => {
  const f = fixture(t), initial = await f.feed.load(), saved = initial.jobs.map(({ updatedAt, ...job }) => job);
  const base = { status: 'ready', jobs: [], sources: [source('moloco')], error: null };
  const current = renderJobs({ feed: base, savedJobs: saved, onlySaved: true });
  assert.match(current, /현재 목록에 없음/); assert.deepEqual(cards(current), [row().id]);
  for (const status of ['stale', 'error']) {
    const html = renderJobs({ feed: { ...base, sources: [source('moloco', { status, complete: false })] }, savedJobs: saved, onlySaved: true });
    assert.match(html, /현재 게시 여부 확인 불가/); assert.doesNotMatch(html, /현재 목록에 없음/);
  }
  const failedRefresh = renderJobs({ feed: { ...base, status: 'error', stale: true, error: 'network' }, savedJobs: saved, onlySaved: true });
  assert.match(failedRefresh, /현재 게시 여부 확인 불가/); assert.doesNotMatch(failedRefresh, /현재 목록에 없음/);
  assert.equal(saved[0].snapshot.title, row().title);
});

test('fresh empty success, failed empty fetch and unavailable configuration show distinct states', async t => {
  const empty = fixture(t, { data: payload([]) }), ready = await empty.feed.load();
  assert.match(renderJobs({ feed: ready }), /현재 게시된 공고가 없습니다/);
  const failed = fixture(t, { intercept: (url, _init, fallback) => url.includes('functions/v1') ? new Response('', { status: 503 }) : fallback() });
  const error = await failed.feed.load(); assert.equal(error.status, 'error'); assert.doesNotMatch(renderJobs({ feed: error }), /현재 게시된 공고가 없습니다/);
  const missing = fixture(t, { publicConfig: { version: 1 } });
  const unconfigured = await missing.feed.load(); assert.equal(unconfigured.status, 'unconfigured'); assert.equal(missing.calls.length, 1);
});

test('unsafe source URLs and mismatched source IDs reject the payload and retain previous valid results', async t => {
  let current = payload();
  const f = fixture(t, { intercept: (url, _init, fallback) => url.includes('functions/v1') ? json(current) : fallback() });
  const first = await f.feed.load(); assert.equal(first.status, 'ready');
  for (const url of ['javascript:alert(1)', 'https://boards.greenhouse.io.evil.test/moloco/jobs/123',
    'https://user:pass@boards.greenhouse.io/moloco/jobs/123', 'https://boards.greenhouse.io/moloco/jobs/999',
    'https://boards.greenhouse.io/moloco/jobs/123#fragment', 'https://www.coupang.jobs/en/jobs/?gh_jid=999']) {
    current = payload([row('123', 'moloco', { url })]);
    const state = await f.feed.load(); assert.equal(state.status, 'error', url); assert.equal(state.stale, true);
    assert.deepEqual(state.jobs, first.jobs); assert.doesNotMatch(renderJobs({ feed: state }), /href="javascript:/);
  }
  current = payload([row('123', 'moloco', { jobId: '999' })]);
  assert.equal((await f.feed.load()).status, 'error');
});

test('secret or insecure config is rejected before contacting an API', async t => {
  for (const publicConfig of [{ ...configured, supabasePublishableKey: 'sb_secret_synthetic_only' },
    { ...configured, secret: 'synthetic' }, { ...configured, accountApiUrl: 'http://untrusted.example' }]) {
    const f = fixture(t, { publicConfig }); assert.equal((await f.feed.load()).status, 'unconfigured'); assert.equal(f.calls.length, 1);
  }
});

test('config and jobs body limits reject oversized streams, cancel readers and preserve existing jobs', async t => {
  let mode = 'normal', cancelled = 0;
  const over = () => ({ ok: true, headers: new Headers(), body: new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); }, cancel() { cancelled++; },
  }) });
  const f = fixture(t, { intercept: (url, _init, fallback) => mode === 'jobs' && url.includes('functions/v1') || mode === 'config' && url.endsWith('/config.json') ? over() : fallback() });
  const initial = await f.feed.load();
  for (const next of ['jobs', 'config']) {
    mode = next; const state = await f.feed.load(); assert.equal(state.status, 'error'); assert.equal(state.error, 'too_large');
    assert.deepEqual(state.jobs, initial.jobs);
  }
  assert.equal(cancelled, 2);
  const declared = fixture(t, { intercept: () => new Response('{}', { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } }) });
  assert.equal((await declared.feed.load()).error, 'too_large'); assert.equal(declared.calls.length, 1);
});

test('malformed response does not turn existing jobs into a successful empty feed', async t => {
  let bad = false;
  const f = fixture(t, { intercept: (url, _init, fallback) => bad && url.includes('functions/v1') ? json({ ok: true, jobs: [] }) : fallback() });
  const first = await f.feed.load(); bad = true;
  const state = await f.feed.load(); assert.equal(state.status, 'error'); assert.deepEqual(state.jobs, first.jobs);
  assert.match(renderJobs({ feed: state }), /최신이 아닐 수 있습니다/);
});

test('concurrent loads share one request and disposal aborts it without publishing a late result', async t => {
  const pending = deferred(); let apiSignal;
  const f = fixture(t, { intercept: (url, init, fallback) => {
    if (!url.includes('functions/v1')) return fallback(); apiSignal = init.signal; return pending.promise;
  } });
  const a = f.feed.load(), b = f.feed.load();
  for (let i = 0; i < 20 && !apiSignal; i++) await tick();
  assert.ok(apiSignal); assert.equal(f.calls.filter(call => call.url.includes('functions/v1')).length, 1);
  assert.deepEqual(f.changes.map(change => change.status), ['loading']);
  const beforeDispose = clone(f.changes);
  f.feed.dispose(); assert.equal(apiSignal.aborted, true);
  pending.resolve(json(payload())); await Promise.all([a, b]);
  assert.deepEqual(f.changes, beforeDispose); assert.notEqual(f.feed.snapshot().status, 'ready');
  await f.feed.load(); assert.equal(f.calls.length, 2);
});
