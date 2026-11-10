import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// Execute the real UI functions with a small DOM boundary and controlled fetch
// responses. Browser rendering and the real identity provider are tested separately.
const source = fs.readFileSync(new URL('../experiences/ai-market/app.mjs', import.meta.url), 'utf8');
const startup = source.lastIndexOf('\nawait refreshSession();');
assert(startup > 0, 'the UI startup boundary must exist');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const requestId = '55555555-5555-4555-8555-555555555555';
const session = (owner = A, csrfToken = 'csrf-A') => ({ authenticated: true, loginAvailable: true, user: { id: owner }, profile: { displayName: owner === A ? '작성자 A' : '작성자 B', revision: 1 }, csrfToken });
const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const storageKey = owner => 'synk.ai-market.drafts.v1:' + owner;
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness() {
  const storage = new Map(), listeners = new Map();
  const main = { innerHTML: '', addEventListener() {}, focus() {}, querySelector() { return null; } };
  const notice = { textContent: '', hidden: true, classList: { toggle() {} } }, account = { innerHTML: '' };
  const env = {
    console, URL, URLSearchParams, AbortSignal, Intl, Date, Map, crypto: webcrypto, CSS: { escape: value => value },
    location: { hash: '#/community' }, history: { replaceState() {} },
    document: { getElementById: key => key === 'main' ? main : key === 'notice' ? notice : account, querySelectorAll: () => [], addEventListener: (name, fn) => listeners.set(name, fn) },
    window: { addEventListener() {}, scrollTo() {} },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    FormData: class { constructor(form) { this.values = form.values; } *[Symbol.iterator]() { yield* Object.entries(this.values); } getAll(key) { return this.values[key] || []; } },
    fetch: async () => response({ items: [] }),
  };
  vm.createContext(env);
  vm.runInContext(source.slice(0, startup) + '\nconfirmAction = async () => true;globalThis.ui = {state,setSession,refreshSession,logout,submitForm,prepareDraft,formStart,renderPost,userId};', env, { filename: 'ai-market/app.mjs' });
  env.ui.setSession(session());
  return { env, ui: env.ui, storage, account, main, notice, listeners };
}

function postForm(owner = A, body = '작성 중인 원고') {
  const fieldset = { disabled: false }, retryButton = { disabled: false }, pending = { hidden: true, querySelector: () => retryButton }, error = { hidden: true, focus() {} };
  const form = {
    dataset: { formKey: 'post:new', type: 'post', owner, rowId: '' },
    values: { revision: '0', title: '아직 게시하지 못한 글', body, kind: 'case', category: 'content', requestId },
    reportValidity: () => true, isConnected: true,
    querySelector: selector => selector === 'fieldset' ? fieldset : selector === '.pending-notice' ? pending : selector === '.form-error' ? error : selector === '[name=requestId]' ? { value: requestId } : null,
  };
  return { form, fieldset, pending, error };
}

test('a definitive POST 401 preserves an editable draft after the same member signs in again', async () => {
  const h = harness(), f = postForm(); let posts = 0;
  h.env.fetch = async (_url, options) => options.method === 'POST' ? (posts++, response({ code: 'AUTH_REQUIRED', error: '로그인이 만료됐습니다.' }, 401)) : response({ items: [] });
  await h.ui.submitForm(f.form); await tick();
  assert.equal(h.ui.userId(), null);
  assert.equal(h.ui.state.drafts.size, 0, 'anonymous UI must not retain the member draft');
  h.ui.setSession(session());
  const restored = h.ui.prepareDraft('post:new', {}, true);
  assert.equal(restored.pendingPayload, null);
  assert.equal(restored.values.body, '작성 중인 원고');
  assert.equal(restored.requestId, requestId);
  assert(!h.ui.formStart('post', 'post:new', restored).includes(' disabled'));
  assert.equal(posts, 1, 'signing in must not publish automatically');
});

for (const failure of ['network', '503']) test(`an uncertain ${failure} result retries the exact create payload and request ID`, async () => {
  const h = harness(), f = postForm(), calls = [];
  h.env.fetch = async (_url, options) => {
    if (options.method !== 'POST') return response({ items: [] });
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) { if (failure === 'network') throw new Error('response lost'); return response({ error: 'temporarily unavailable' }, 503); }
    return response({ post: { id: 'created-post' } });
  };
  await h.ui.submitForm(f.form);
  assert(h.ui.state.drafts.get('post:new').pendingPayload);
  assert.equal(f.fieldset.disabled, true);
  f.form.values.body = 'a changed form must not alter the uncertain request';
  await h.ui.submitForm(f.form, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[1].requestId, requestId);
  assert.equal(h.ui.state.drafts.has('post:new'), false);
});

test('a late definitive failure unlocks only its original member draft', async () => {
  const h = harness(), wait = deferred(), f = postForm();
  h.env.fetch = async (_url, options) => options.method === 'POST' ? wait.promise : response({ items: [] });
  const saving = h.ui.submitForm(f.form);
  const otherDraft = JSON.stringify([['post:new', { values: { body: 'B만 볼 원고' }, requestId: 'B-request', pendingPayload: null }]]);
  h.storage.set(storageKey(B), otherDraft);
  h.ui.setSession(session(B, 'csrf-B'));
  wait.resolve(response({ error: 'expired' }, 401)); await saving;
  assert.equal(h.ui.userId(), B);
  assert.equal(h.ui.state.drafts.get('post:new').values.body, 'B만 볼 원고');
  assert.equal(h.storage.get(storageKey(B)), otherDraft);
  h.ui.setSession(session());
  assert.equal(h.ui.prepareDraft('post:new', {}, true).pendingPayload, null);
  assert.equal(h.ui.prepareDraft('post:new', {}, true).values.body, '작성 중인 원고');
});

test('a successful response after an account change keeps the original request for safe result confirmation', async () => {
  const h = harness(), wait = deferred(), f = postForm();
  h.env.fetch = async (_url, options) => options.method === 'POST' ? wait.promise : response({ items: [] });
  const saving = h.ui.submitForm(f.form);
  h.ui.setSession(session(B, 'csrf-B'));
  wait.resolve(response({ post: { id: 'created-post' } })); await saving;
  assert.equal(h.ui.userId(), B);
  assert.equal(h.ui.state.drafts.size, 0);
  h.ui.setSession(session());
  const restored = h.ui.prepareDraft('post:new', {}, true);
  assert.equal(restored.pendingPayload.requestId, requestId);
  assert.equal(restored.pendingPayload.body, '작성 중인 원고');
});

test('an older 401 cannot unlock a newer retry of the same request after reauthentication', async () => {
  const h = harness(), first = deferred(), second = deferred(); let calls = 0;
  h.env.fetch = async (_url, options) => options.method === 'POST' ? (++calls === 1 ? first.promise : second.promise) : response({ items: [] });
  const original = h.ui.submitForm(postForm().form);
  h.ui.setSession({ authenticated: false, loginAvailable: true });
  h.ui.setSession(session(A, 'csrf-renewed'));
  const retry = h.ui.submitForm(postForm().form, true);
  first.resolve(response({ error: 'expired original attempt' }, 401)); await original;
  assert(h.ui.state.drafts.get('post:new').pendingPayload, 'the newer pending attempt must remain locked');
  second.resolve(response({ post: { id: 'created-post' } })); await retry;
  assert.equal(calls, 2);
  assert.equal(h.ui.state.drafts.has('post:new'), false);
});

test('a definitive response after explicit logout does not recreate a deliberately removed draft', async () => {
  const h = harness(), wait = deferred();
  h.env.fetch = async (url, options) => url.endsWith('/logout') ? response({ ok: true, localSignedOut: true, serverRevoked: true }) : options.method === 'POST' ? wait.promise : response({ items: [] });
  const saving = h.ui.submitForm(postForm().form);
  await h.ui.logout({ disabled: false });
  assert.equal(h.storage.has(storageKey(A)), false);
  wait.resolve(response({ error: 'expired' }, 401)); await saving;
  assert.equal(h.storage.has(storageKey(A)), false);
  assert.equal(h.ui.userId(), null);
});

test('a session response obtained before logout cannot restore the signed-out UI', async () => {
  const h = harness(), wait = deferred();
  h.env.fetch = async url => url.endsWith('/session') ? wait.promise : url.endsWith('/logout') ? response({ ok: true, localSignedOut: true, serverRevoked: true }) : response({ items: [] });
  const refresh = h.ui.refreshSession({ redraw: true });
  await h.ui.logout({ disabled: false });
  wait.resolve(response(session())); await refresh;
  assert.equal(h.ui.userId(), null);
  assert(!h.account.innerHTML.includes('작성자 A'));
  assert(h.account.innerHTML.includes('가입·로그인'));
});

for (const oldOutcome of ['success', 'failure']) test(`an old session ${oldOutcome} cannot replace a new account or clear its in-flight check`, async () => {
  const h = harness(), first = deferred(), second = deferred(); let calls = 0;
  h.env.fetch = async url => url.endsWith('/session') ? (++calls === 1 ? first.promise : second.promise) : response({ items: [] });
  const old = h.ui.refreshSession();
  h.ui.setSession(session(B, 'csrf-B'));
  const current = h.ui.refreshSession();
  if (oldOutcome === 'success') first.resolve(response(session())); else first.reject(new Error('old check failed'));
  await old;
  const sameCurrent = h.ui.refreshSession();
  assert.equal(calls, 2, 'the old finally must not clear the current check');
  assert.equal(h.ui.userId(), B);
  assert.equal(h.ui.state.sessionError, false);
  second.resolve(response(session(B, 'csrf-B')));
  await Promise.all([current, sameCurrent]);
  assert.equal(h.ui.userId(), B);
});

test('creating a public profile from the comment prompt returns to the original post', async () => {
  const h = harness(), postId = 'post-to-comment';
  h.ui.setSession({ ...session(), profile: null });
  h.ui.state.data = { post: { id: postId, authorId: B, author: { id: B, displayName: '작성자 B' }, title: '함께 읽는 글', body: '내용', category: 'content', kind: 'case', createdAt: '2026-11-10', revision: 1 }, comments: [], services: [], bookmarkState: 'loaded' };
  h.ui.renderPost();
  assert(h.main.innerHTML.includes('data-action="profile-before-comment"'));
  h.listeners.get('click')({ target: { closest: selector => selector === '.skip-link' ? null : { dataset: { action: 'profile-before-comment' } } } });
  assert.equal(h.env.location.hash, '#/profile');
  assert.equal(h.storage.get('synk.ai-market.after-profile:' + A), 'post/' + postId);
  const f = postForm();
  f.form.dataset.type = 'profile'; f.form.dataset.formKey = 'profile';
  f.form.values = { revision: '0', displayName: '새 닉네임', bio: '' };
  h.env.fetch = async () => response({ profile: { displayName: '새 닉네임', revision: 1 } });
  await h.ui.submitForm(f.form);
  assert.equal(h.env.location.hash, '#/post/' + postId);
  assert.equal(h.storage.has('synk.ai-market.after-profile:' + A), false);
});
