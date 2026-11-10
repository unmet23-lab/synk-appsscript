import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as stateModel from './state.mjs';
import * as content from './content.mjs';
import { createPathSession, GUEST_KEY, LEGACY_KEY, ACCOUNT_CACHE_PREFIX } from './account.mjs';
import { createPathDocument } from './document.mjs';
import * as accountUi from './account-ui.mjs';
import * as jobsUi from './jobs-ui.mjs';

// The real app runs unchanged apart from its static ESM imports. This small DOM
// provides only element parsing, selectors, live input values and event bubbling;
// it deliberately does not emulate layout, navigation or CSS. The real account
// and jobs controllers receive synthetic storage/config fetches, never network.
const appSource = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8')
  .replace(/^import [^\n]*\r?\n/gm, '');
const decode = text => String(text).replace(/&(amp|lt|gt|quot|#39);/g,
  (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[entity]));
const voidTags = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);

class Element {
  constructor(tag, attributes = {}, parent = null) {
    this.tagName = tag.toUpperCase();
    this.attributes = attributes;
    this.parentElement = parent;
    this.children = [];
    this.events = new Map();
    this.value = attributes.value || '';
    this.checked = Object.hasOwn(attributes, 'checked');
    this.disabled = Object.hasOwn(attributes, 'disabled');
    this.hidden = Object.hasOwn(attributes, 'hidden');
  }
  get id() { return this.attributes.id || ''; }
  get dataset() {
    return Object.fromEntries(Object.entries(this.attributes).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
  }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this.children = [String(value)]; }
  set innerHTML(html) { parseInto(this, html); }
  get innerHTML() { return this.textContent; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  appendChild(element) { element.parentElement = this; this.children.push(element); return element; }
  contains(element) { return element === this || this.children.some(child => typeof child !== 'string' && child.contains(element)); }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && this.id !== id) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
    if (classes.some(name => !(this.attributes.class || '').split(/\s+/).includes(name))) return false;
    for (const [, name, quoted, bare] of selector.matchAll(/\[([\w-]+)(?:=(?:"([^"]*)"|([^\]]+)))?\]/g)) {
      if (!Object.hasOwn(this.attributes, name)) return false;
      const value = quoted ?? bare;
      if (value !== undefined && this.attributes[name] !== value) return false;
    }
    return true;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (typeof child === 'string') continue;
      if (child.matches(selector)) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push(callback);
  }
}

function parseInto(container, html) {
  container.children = [];
  const stack = [container];
  for (const token of String(html).match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    const parent = stack.at(-1);
    if (!token.startsWith('<')) { parent.children.push(decode(token)); continue; }
    const tag = token.match(/^<([\w-]+)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    const attributes = {};
    const tail = token.slice(tag.length + 1, token.length - 1);
    for (const [, name, double, single, unquoted] of tail.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attributes[name] = decode(double ?? single ?? unquoted ?? '');
    }
    const element = new Element(tag, attributes, parent);
    element.ownerDocument = parent.ownerDocument;
    parent.children.push(element);
    if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(element);
  }
  for (const textarea of container.querySelectorAll('textarea')) textarea.value = textarea.textContent;
}

function fixture() {
  let state = stateModel.updateProfile(stateModel.createInitialState('ko'), {
    onboarded: true, primaryGoal: 'job',
  }, '2026-11-09T10:00:00.000Z');
  return stateModel.upsertTask(state, {
    goal: 'job', sourceId: 'demo-job-a', body: '고객 문의를 정리해 담당자에게 전달한 경험입니다.',
  }, '2026-11-09T10:01:00.000Z');
}

async function boot(t, { failRead = false, failWrite = false, legacy = false, raw = null, signedIn = false, downloadThrows = false, conflictSave = false, initialLocalConflict = false } = {}) {
  const initial = raw ?? JSON.stringify(legacy ? fixture() : { ...createPathDocument('ko'), state: fixture() });
  const originalKey = legacy ? LEGACY_KEY : GUEST_KEY;
  const records = new Map([[originalKey, initial]]);
  const recoveryKey = ACCOUNT_CACHE_PREFIX + 'qa-account';
  const recoveryDocument = { ...createPathDocument('ko'), state: stateModel.upsertTask(fixture(), { ...fixture().tasks[0], body: '복구 선택 전 원문을 그대로 보존합니다.' }) };
  const recoveryRaw = '\n ' + JSON.stringify({ version: 1, accountId: 'qa-account', baseRevision: 1, state: recoveryDocument, pending: true }) + ' \n';
  if (initialLocalConflict) records.set(recoveryKey, recoveryRaw);
  let writes = 0;
  const storage = {
    get length() { return records.size; },
    key(index) { return [...records.keys()][index] ?? null; },
    getItem(key) { if (failRead) throw new Error('Read access denied'); return records.get(key) ?? null; },
    setItem(key, value) { if (failWrite) throw new Error('Write access denied'); writes += 1; records.set(key, String(value)); },
    removeItem(key) { records.delete(key); },
  };
  const fetcher = async input => {
    assert.equal(new URL(input, 'https://synk.im/path/app/').pathname, '/path/app/config.json', 'unconfigured preview never contacts a remote API');
    return new Response(JSON.stringify({ version: 1 }), { headers: { 'content-type': 'application/json' } });
  };
  let session, sessionOptions, jobsFeed, providerSignOuts = 0, accountOptions, owner = 'qa-account', revision = 1;
  let remote = { ...createPathDocument('ko'), state: fixture() };
  const requests = [];
  let statusOverride = null, useRemoteCalls = 0, confirmHook = null;
  const status = () => ({ configured: true, signedIn: true, accountId: owner, status: 'signed-in' });
  const accountFactory = signedIn ? options => ({
    status,
    start: async () => { accountOptions = options; options.onStatus(status()); },
    request: async (operation, values) => {
      requests.push({ operation, owner });
      assert.ok(['pathLoad', 'pathSave'].includes(operation));
      if (operation === 'pathSave' && conflictSave) throw Object.assign(new Error('Synthetic revision conflict'), { code: 'REVISION_CONFLICT', revision: 2 });
      if (operation === 'pathSave') { remote = structuredClone(values.state); revision++; }
      return { ok: true, scope: 'synk-path', resource: 'path-app', accountId: owner, revision,
        updatedAt: '2026-11-10T00:00:00.000Z', state: structuredClone(remote) };
    },
    signOut: async () => { providerSignOuts++; },
    dispose() {},
  }) : undefined;
  const root = new Element('div', { id: 'app' });
  const announcer = new Element('div', { id: 'announcer' });
  const timers = [], revoked = [], downloads = [], confirmations = [];
  let confirmation = true;
  const body = new Element('body');
  const document = {
    activeElement: null, body,
    documentElement: { lang: 'ko' },
    getElementById: id => id === 'app' ? root : id === 'announcer' ? announcer : root.querySelector(`#${id}`),
    createElement(tag) {
      const element = new Element(tag); element.ownerDocument = document;
      element.click = () => { if (downloadThrows) throw new Error('Download was blocked'); downloads.push({ href: element.href, filename: element.download }); };
      return element;
    },
  };
  root.ownerDocument = document; body.ownerDocument = document;
  class TestURL extends URL {}
  TestURL.createObjectURL = () => `blob:qa-${downloads.length}`;
  TestURL.revokeObjectURL = value => revoked.push(value);
  const context = {
    ...stateModel, ...content, ...accountUi, ...jobsUi,
    createPathSession: options => {
      sessionOptions = options;
      session = createPathSession({ ...options, storage, fetcher, lang: 'ko', ...(accountFactory ? { accountFactory } : {}),
        accountOptions: { getUrl: () => 'https://synk.im/path/app/', replaceUrl() {}, navigate() {} } });
      return { ...session, status: () => statusOverride || session.status(), useRemote: async () => { useRemoteCalls++; return session.useRemote(); } };
    },
    createJobsFeed: options => (jobsFeed = jobsUi.createJobsFeed({ ...options, fetcher, getUrl: () => 'https://synk.im/path/app/' })),
    document,
    navigator: { language: 'ko' },
    sessionStorage: storage,
    URL: TestURL, Blob,
    confirm: message => { confirmations.push(message); if (confirmHook) confirmHook(); return confirmation; },
    setTimeout: (callback, delay = 0) => { if (delay === 30) callback(); else timers.push({ callback, delay }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cancelled = true; },
  };
  vm.runInNewContext(appSource, context, { filename: 'path-app/app.mjs' });
  t.after(() => { session?.dispose(); jobsFeed?.dispose(); });
  // Let real account/config startup settle before interacting with the UI.
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
  const event = (type, target, extra = {}) => {
    for (const callback of root.events.get(type) || []) callback({ target, preventDefault() {}, ...extra });
  };
  const click = (action, extra = '') => {
    const button = root.querySelector(`button[data-action="${action}"]${extra}`);
    assert.ok(button, `visible action ${action}${extra} exists`);
    assert.equal(button.disabled, false);
    event('click', button);
  };
  const typeBody = body => {
    const textarea = root.querySelector('#body');
    assert.ok(textarea, 'editor is open');
    textarea.value = body;
    event('input', textarea);
  };
  return { root, announcer, click, event, typeBody, initial, session,
    original: () => records.get(originalKey), saved: () => records.get(GUEST_KEY), writes: () => writes,
    failWrites: () => { failWrite = true; }, providerSignOuts: () => providerSignOuts,
    notifyStatus: () => sessionOptions.onStatus(session.status()),
    switchOwner: id => { owner = id; remote = { ...createPathDocument('ko'), state: fixture() }; accountOptions.onStatus(status()); },
    flushTimers: (maximum = 0) => { for (const timer of timers.splice(0)) { if (timer.cancelled) continue; if (timer.delay <= maximum) timer.callback(); else timers.push(timer); } },
    revoked, downloads, confirmations, document, timers,
    setConfirmation: value => { confirmation = value; },
    setConfirmHook: callback => { confirmHook = callback; },
    setStatusOverride: value => { statusOverride = value; },
    useRemoteCalls: () => useRemoteCalls, requests,
    recoveryRaw, storedRecoveryRaw: () => records.get(recoveryKey) };
}

const isVisible = element => element && !element.hidden && (!element.parentElement || isVisible(element.parentElement));

test('a failed initial storage read never permits a later profile action to overwrite the unread original', async t => {
  const app = await boot(t, { failRead: true });
  // Reading may be unavailable only at boot; this storage double allows later
  // writes, exercising the destructive path rather than a permanently denied API.
  const skip = app.root.querySelector('button[data-action="skip"]');
  assert.ok(skip); assert.equal(skip.disabled, true);
  app.event('click', skip);
  assert.equal(app.original(), app.initial, 'the original draft survives until the user explicitly resets unreadable data');
  assert.equal(app.writes(), 0);
});

test('failed guest tombstone write preserves the in-memory draft and does not announce successful clearing', async t => {
  const app = await boot(t, { failWrite: true });
  app.click('nav', '[data-page="profile"]');
  app.click('clear');
  assert.equal(app.saved(), app.initial, 'the verified-empty-document clear cannot replace the original on storage failure');
  assert.doesNotMatch(app.announcer.textContent, /지웠어요|Cleared\./);
  app.click('nav', '[data-page="prepare"]');
  app.click('openTask');
  assert.equal(app.root.querySelector('#body').value, fixture().tasks[0].body, 'a failed deletion must not empty the current working copy');

  const unreadable = await boot(t, { raw: '{"unfinished":', failWrite: true });
  unreadable.click('reset');
  assert.equal(unreadable.saved(), unreadable.initial);
  assert.doesNotMatch(unreadable.announcer.textContent, /지웠어요|Cleared\./);
  const skip = unreadable.root.querySelector('button[data-action="skip"]');
  assert.equal(skip.disabled, true); unreadable.event('click', skip);
  assert.equal(unreadable.writes(), 0, 'a failed reset must keep the unread original write-blocked');
});

test('editing an unconfirmed draft invalidates a previously ticked review acknowledgment', async t => {
  const app = await boot(t);
  app.click('openTask');
  const acknowledgment = app.root.querySelector('#ack');
  acknowledgment.checked = true;
  app.typeBody('확인 체크 이후에 내용과 날짜를 바꾼 문장입니다.');
  assert.equal(app.root.querySelector('#ack').checked, false, 'the changed version has not been reviewed');
  assert.equal(JSON.parse(app.saved()).state.tasks[0].confirmedAt, null);
});

test('editing a prepared statement removes its previous completion message and stale result summary', async t => {
  const app = await boot(t);
  app.click('openTask');
  app.root.querySelector('#ack').checked = true;
  app.click('confirm');
  const previousSummary = fixture().tasks[0].body;
  assert.ok(app.root.querySelectorAll('.result-body').some(node => node.textContent === previousSummary));
  const completion = app.root.querySelector('#flash');
  assert.ok(isVisible(completion), 'the completed version has a visible success message');
  assert.match(completion.textContent, /준비 완료로 표시했어요/);
  const completionMessage = completion.textContent.trim();
  app.typeBody('완료 후 정정한 새로운 원문입니다.');
  assert.equal(JSON.parse(app.saved()).state.tasks[0].confirmedAt, null);
  assert.equal(app.root.querySelectorAll('.result-body').some(node => isVisible(node) && node.textContent === previousSummary), false,
    'a previous result must not remain presented beside the current unconfirmed version');
  const visibleMessages = app.root.querySelectorAll('.notice[role="status"]')
    .filter(isVisible).map(node => node.textContent.trim());
  assert.equal(visibleMessages.includes(completionMessage), false,
    'the old completion notice must be withdrawn after editing');
});

test('legacy tab drafts migrate through the real session controller while the original remains untouched', async t => {
  const app = await boot(t, { legacy: true });
  assert.equal(app.original(), app.initial);
  assert.equal(JSON.parse(app.saved()).state.tasks[0].body, fixture().tasks[0].body);
  app.click('openTask'); app.typeBody('계정 계약으로 옮긴 뒤 고친 초안입니다.');
  assert.equal(JSON.parse(app.saved()).state.tasks[0].body, '계정 계약으로 옮긴 뒤 고친 초안입니다.');
  assert.equal(app.original(), app.initial, 'legacy source bytes remain recoverable after migration and editing');
});

test('a refused logout keeps the account draft visible and does not announce that the user signed out', async t => {
  const app = await boot(t, { signedIn: true });
  assert.equal(app.session.status().accountId, 'qa-account');
  app.click('nav', '[data-page="prepare"]');
  app.click('openTask');
  app.failWrites();
  app.typeBody('저장 공간 오류로 아직 이 화면에만 남아 있는 수정입니다.');
  assert.equal(app.session.status().pending, true, JSON.stringify(app.session.status()));
  app.click('nav', '[data-page="profile"]');
  app.click('accountSignOut');
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.providerSignOuts(), 0);
  assert.equal(app.session.status().signedIn, true);
  assert.equal(app.session.status().error.code, 'UNSAVED_ACCOUNT_DRAFT');
  assert.doesNotMatch(app.root.textContent, /로그아웃했습니다\.|Signed out\./);
  assert.doesNotMatch(app.announcer.textContent, /로그아웃했습니다\.|Signed out\./);
  assert.equal(app.session.document().state.tasks[0].body, '저장 공간 오류로 아직 이 화면에만 남아 있는 수정입니다.');
});

test('autosave notifications keep the composing textarea and flush the final Korean draft after compositionend', async t => {
  const app = await boot(t, { signedIn: true });
  app.click('openTask');
  const textarea = app.root.querySelector('#body'); textarea.focus();
  textarea.setSelectionRange(1, 1);
  app.event('compositionstart', textarea);
  textarea.value = 'ㅎ'; app.event('input', textarea, { isComposing: true });
  await app.session.retry();
  app.notifyStatus(); app.notifyStatus();
  assert.equal(app.root.querySelector('#body'), textarea, 'saving/synced and repeated status changes must preserve the composing DOM node');
  app.event('compositionend', textarea);
  assert.equal(app.root.querySelector('#body'), textarea, 'the final browser input event still needs the original node');
  textarea.value = '한글 조합을 끝낸 문장';
  app.event('input', textarea, { isComposing: false });
  app.flushTimers();
  assert.notEqual(app.root.querySelector('#body'), textarea, 'the queued latest-state render must eventually run');
  assert.equal(app.root.querySelector('#body').value, '한글 조합을 끝낸 문장');
  assert.equal(app.session.document().state.tasks[0].body, '한글 조합을 끝낸 문장');
  await app.session.retry();
  assert.equal(app.session.status().syncStatus, 'synced');
  assert.equal(app.root.querySelector('#body').value, '한글 조합을 끝낸 문장');
});

test('an account change during composition hides old text immediately and ignores detached input/end events', async t => {
  const app = await boot(t, { signedIn: true });
  app.click('openTask');
  const textarea = app.root.querySelector('#body'); textarea.focus();
  app.event('compositionstart', textarea);
  textarea.value = '이전 계정의 비공개 조합'; app.event('input', textarea, { isComposing: true });
  app.switchOwner('next-account');
  assert.equal(app.root.contains(textarea), false, 'owner reset cannot wait for compositionend');
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  textarea.value = '다른 계정에 섞이면 안 되는 글';
  app.event('input', textarea, { isComposing: false });
  app.event('compositionend', textarea);
  app.flushTimers();
  assert.equal(app.session.status().accountId, 'next-account');
  assert.equal(app.session.document().state.tasks[0].body, fixture().tasks[0].body);
  assert.doesNotMatch(app.root.textContent, /다른 계정에 섞이면|이전 계정의 비공개/);
});

test('a failed download leaves an unpersisted account draft protected from logout', async t => {
  const app = await boot(t, { signedIn: true, downloadThrows: true });
  app.click('openTask'); app.failWrites(); app.typeBody('다운로드 실패 뒤에도 보존할 유일한 원문');
  app.click('nav', '[data-page="profile"]');
  app.click('accountExport');
  await new Promise(resolve => setImmediate(resolve));
  app.click('accountSignOut');
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.providerSignOuts(), 0);
  assert.equal(app.session.document().state.tasks[0].body, '다운로드 실패 뒤에도 보존할 유일한 원문');
  assert.equal(app.document.body.children.length, 0, 'failed clicks must not leak download anchors');
  assert.equal(app.root.querySelector('[data-action="accountConfirmBackup"]'), null, 'a failed attempt must not offer the backup acknowledgement');
  assert.equal(app.revoked.length, 0, 'blob URL cleanup must be delayed');
  app.flushTimers(60000);
  assert.equal(app.revoked.length, 1);
});

test('requesting a download does not acknowledge a backup; only the later explicit button unlocks unsafe logout', async t => {
  const app = await boot(t, { signedIn: true });
  app.click('openTask'); app.failWrites(); app.typeBody('아직 저장을 확인하지 않은 백업 원문');
  app.click('nav', '[data-page="profile"]'); app.click('accountExport');
  assert.equal(app.downloads.length, 1);
  assert.equal(app.session.status().backupConfirmed, false, 'a click cannot prove browser download completion or cancellation');
  assert.match(app.root.textContent, /다운로드 완료 여부를 확인할 수 없/);
  assert.doesNotMatch(app.root.textContent, /백업 파일로 내려받았습니다|was downloaded as a backup/);
  app.click('accountSignOut');
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.providerSignOuts(), 0);
  app.click('accountConfirmBackup');
  assert.equal(app.session.status().backupConfirmed, true);
  app.click('accountSignOut');
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.providerSignOuts(), 1);
});

test('cancelling the explicit backup-and-load confirmation preserves local conflict data; accepting later loads the account version', async t => {
  const app = await boot(t, { signedIn: true, conflictSave: true });
  app.click('openTask'); app.typeBody('원격 자료를 고르기 전에 보존할 로컬 초안');
  await app.session.retry();
  assert.equal(app.session.status().syncStatus, 'conflict');
  app.click('nav', '[data-page="profile"]'); app.click('accountUseRemote');
  assert.equal(app.session.document().state.tasks[0].body, '원격 자료를 고르기 전에 보존할 로컬 초안');
  app.setConfirmation(false); app.click('accountConfirmBackup');
  assert.equal(app.session.status().backupConfirmed, false);
  assert.equal(app.session.document().state.tasks[0].body, '원격 자료를 고르기 전에 보존할 로컬 초안');
  app.setConfirmation(true); app.click('accountConfirmBackup');
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.session.document().state.tasks[0].body, fixture().tasks[0].body);
  assert.match(app.root.textContent, /계정에 저장된 경로를 불러왔습니다/);
});

test('guest storage failure keeps a single top-level tab-save notice and does not claim account sync failed', async t => {
  const app = await boot(t);
  app.click('openTask'); app.failWrites(); app.typeBody('탭 보관 실패 후 유지할 초안');
  app.click('nav', '[data-page="profile"]');
  const note = app.root.querySelector('#store-note');
  assert.ok(isVisible(note)); assert.match(note.textContent, /이 탭/);
  assert.doesNotMatch(app.root.textContent, /동기화에 실패했습니다/);
  assert.equal(app.root.querySelectorAll('#store-note').length, 1);
  assert.ok(note.querySelector('[data-action="accountRetry"]'));
});

test('initial recovery conflict cancellation preserves raw data, while explicit remote choice reads without a download or write', async t => {
  const app = await boot(t, { signedIn: true, initialLocalConflict: true });
  assert.equal(app.session.status().loaded, false);
  assert.equal(app.session.status().syncStatus, 'local-conflict');
  app.setConfirmation(false); app.click('accountUseRemote');
  assert.equal(app.useRemoteCalls(), 0); assert.equal(app.session.status().loaded, false);
  assert.equal(app.storedRecoveryRaw(), app.recoveryRaw); assert.equal(app.downloads.length, 0);
  app.setConfirmation(true); app.click('accountUseRemote');
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.useRemoteCalls(), 1); assert.equal(app.session.status().loaded, true);
  assert.equal(app.session.document().state.tasks[0].body, fixture().tasks[0].body);
  assert.equal(app.storedRecoveryRaw(), app.recoveryRaw);
  assert.deepEqual(app.requests.map(row => row.operation), ['pathLoad', 'pathLoad']);
  assert.equal(app.downloads.length, 0);
  assert.match(app.root.textContent, /로컬 복구 자료/);
});

test('the initial recovery exception is rejected if a new loaded document appears during confirmation', async t => {
  const app = await boot(t, { signedIn: true, initialLocalConflict: true });
  // The controller status double models a completed load while the native
  // confirmation is open; the action must revalidate instead of bypassing backup.
  app.setConfirmHook(() => app.setStatusOverride({ ...app.session.status(), loaded: true }));
  app.click('accountUseRemote');
  assert.equal(app.useRemoteCalls(), 0);
  assert.equal(app.storedRecoveryRaw(), app.recoveryRaw);
  assert.match(app.root.textContent, /계정 상태/);
});

test('A to B to A while confirming initial recovery cannot reuse the earlier view consent', async t => {
  const app = await boot(t, { signedIn: true, initialLocalConflict: true });
  app.setConfirmHook(() => {
    app.switchOwner('other-account'); app.switchOwner('qa-account');
    // Even if the new A session is already back at the identical recovery
    // status, the old view's consent is stale; equal owner strings are insufficient.
    app.setStatusOverride({ ...app.session.status(), signedIn: true, mode: 'account', accountId: 'qa-account', loaded: false, syncStatus: 'local-conflict' });
  });
  app.click('accountUseRemote');
  assert.equal(app.useRemoteCalls(), 0);
  assert.equal(app.storedRecoveryRaw(), app.recoveryRaw);
  assert.match(app.root.textContent, /계정 상태/);
});
