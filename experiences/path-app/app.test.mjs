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
import * as studyData from './study-data.mjs';
import * as studyMatch from './match.mjs';
import * as studyProfile from './study-profile.mjs';
import * as studyUi from './study-ui.mjs';
import * as channelData from './channel-data.mjs';
import * as channelUi from './channel-ui.mjs';
import * as pathUi from './path-ui.mjs';
import * as docsData from './docs-data.mjs';

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

async function boot(t, { failRead = false, failWrite = false, legacy = false, raw = null, signedIn = false, downloadThrows = false, conflictSave = false, initialLocalConflict = false, publicWeb = false, seed = null, programs = null } = {}) {
  const initial = raw ?? JSON.stringify(legacy ? fixture() : { ...createPathDocument('ko'), state: fixture() });
  const originalKey = legacy ? LEGACY_KEY : GUEST_KEY;
  const records = new Map([[originalKey, initial]]);
  for (const [key, value] of Object.entries(seed || {})) records.set(key, value);
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
    querySelector: selector => publicWeb && selector === 'meta[name="synk-path-runtime"]' ? new Element('meta', { name: 'synk-path-runtime', content: 'public-web' }) : null,
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
    ...stateModel, ...content, ...accountUi, ...jobsUi, ...studyData, ...studyMatch, ...studyProfile, ...studyUi, ...channelData, ...channelUi, ...pathUi, ...docsData,
    // 기본은 예시 묶음이다. 실제 과정이 자료에 들어와도 아래 흐름 시험은 같은 묶음으로 돈다.
    PROGRAMS: programs ?? studyData.PROGRAMS.filter(program => program.example),
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
    original: () => records.get(originalKey), saved: () => records.get(GUEST_KEY), writes: () => writes, record: key => records.get(key),
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

// ── 1단계: 내 조건 · 대학 ──
const STUDY_KEY = studyProfile.STUDY_KEY;
const studySeed = (owner, fields = { topik: 4, gradePct: 88 }) => ({ [STUDY_KEY]: JSON.stringify({ ...studyProfile.createProfile(), ...fields, ...(owner ? { owner } : {}) }) });
const pageText = app => app.root.textContent.replace(/\s+/g, ' ');
const studyGoalDocument = () => JSON.stringify({ ...createPathDocument('ko'), state: stateModel.updateProfile(stateModel.createInitialState('ko'), { onboarded: true, primaryGoal: 'study' }, '2026-11-21T00:00:00.000Z') });
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };

test('대학 탭: 목록에서 자세히, 내 조건에서 넣은 값이 결과와 탭 저장에만 닿고 계정 문서는 그대로다', async t => {
  const app = await boot(t);
  const before = app.saved();
  assert.equal(app.root.querySelector('nav.tabs').querySelectorAll('button').length, 7, '채널 탭이 오늘 다음에 더해진다');
  assert.equal(app.root.querySelector('nav.tabbar').querySelectorAll('button').length, 7);
  assert.doesNotMatch(pageText(app), /undefined/);
  app.click('nav', '[data-page="univ"]');
  assert.match(app.root.querySelector('h1').textContent, /내 조건으로 갈 수 있는 대학/);
  assert.equal(app.root.querySelector('button[data-page="univ"]').getAttribute('aria-current'), 'page');
  assert.equal(app.root.querySelectorAll('button[data-action="univOpen"]').length, 3);
  assert.match(pageText(app), /성적과 한국어를 넣으면 맞는 과정을 세어 줘요/);
  assert.equal(app.root.querySelectorAll('img').every(img => /^\.\/assets\/univ-[abc]\.webp$/.test(img.getAttribute('src')) && img.getAttribute('width') && img.getAttribute('height')), true);

  app.click('nav', '[data-page="cond"]');
  assert.match(app.root.querySelector('h1').textContent, /내 조건/);
  assert.equal(app.root.querySelector('button[data-page="univ"]').getAttribute('aria-current'), 'page', '내 조건은 대학 탭 아래 화면이다');
  app.click('studySet', '[data-key="topik"][data-id="3"]');
  assert.equal(app.document.activeElement.getAttribute('data-id'), '3', '누른 단추로 초점이 돌아온다');
  assert.equal(app.root.querySelector('button[data-action="studySet"][data-key="topik"][data-id="3"]').getAttribute('aria-pressed'), 'true');
  assert.match(app.announcer.textContent, /성적과 한국어를 넣으면 맞는 과정을 세어 줘요/, '화면 읽기 안내도 화면과 같은 말을 쓴다');

  const grade = app.root.querySelector('#sx-grade');
  grade.focus(); grade.value = '80'; app.event('input', grade);
  assert.equal(app.root.querySelector('#sx-grade'), grade, '치는 동안 숫자 칸은 다시 그리지 않는다');
  assert.match(app.root.querySelector('#sx-cond-result').textContent, /2\s*개의 예시 과정이 지금 조건에 맞아요/);
  assert.deepEqual((({ topik, gradePct, owner }) => ({ topik, gradePct, owner }))(JSON.parse(app.record(STUDY_KEY))), { topik: 3, gradePct: 80, owner: 'guest' });

  grade.value = '850'; app.event('input', grade);
  assert.equal(grade.getAttribute('aria-invalid'), 'true');
  assert.match(app.root.querySelector('#sx-grade-hint').textContent, /0부터 100까지/);
  assert.equal(JSON.parse(app.record(STUDY_KEY)).gradePct, 80, '읽을 수 없는 값은 조건을 바꾸지 않는다');
  grade.value = ''; app.event('input', grade);
  assert.equal(grade.getAttribute('aria-invalid'), null);
  assert.equal(JSON.parse(app.record(STUDY_KEY)).gradePct, null);
  assert.match(app.root.querySelector('#sx-cond-result').textContent, /성적과 한국어를 넣으면 맞는 과정을 세어 줘요\.\s*둘 중 하나라도 비어 있으면 세지 않아요/);

  const funds = app.root.querySelector('#sx-funds');
  funds.value = '1,600'; app.event('input', funds);
  assert.equal(JSON.parse(app.record(STUDY_KEY)).fundsWon, 16000000);
  assert.equal(app.saved(), before, '계정 · 손님 문서는 한 글자도 바뀌지 않는다');

  app.click('nav', '[data-page="univ"]');
  app.click('studyCompare', '[data-id="example-a-ug"]');
  app.click('studyCompare', '[data-id="example-b-lang"]');
  app.click('nav', '[data-page="univCompare"]');
  assert.match(app.root.querySelector('h1').textContent, /나란히 보기/);
  assert.equal(app.root.querySelector('table').getAttribute('data-cols'), '2');
  app.click('univOpen', '[data-id="example-a-ug"]');
  assert.match(app.root.querySelector('h1').textContent, /예시대학 A/);
  assert.match(pageText(app), /법무부 2026-10-07 보도자료/);

  app.click('nav', '[data-page="cond"]');
  app.click('studyClear');
  const cleared = JSON.parse(app.record(STUDY_KEY));
  assert.deepEqual([cleared.topik, cleared.fundsWon, cleared.compare], [null, null, ['example-a-ug', 'example-b-lang']], '조건만 지우고 비교에 담은 과정은 남긴다');
  assert.match(app.announcer.textContent, /조건을 모두 지웠어요/);
  app.click('nav', '[data-page="univ"]');
  app.click('studyCompare', '[data-id="example-b-lang"]');
  assert.match(app.announcer.textContent, /비교에서 뺐어요. 지금 1곳을 담았어요/);
  app.click('nav', '[data-page="profile"]');
  assert.match(pageText(app), /「내 조건」\(한국어 · 성적 · 준비한 돈\)과 「다가오는 날」은 계정에 저장되지 않고/);
  app.click('clear');
  assert.equal(app.record(STUDY_KEY), undefined, '이 탭의 자료를 지우면 내 조건도 지운다');
});

test('오늘 화면의 입구는 유학 준비 카드에만 있고, 공개판에는 예시 과정과 대학 탭을 싣지 않는다', async t => {
  const study = await boot(t, { raw: studyGoalDocument() });
  const entry = study.root.querySelector('button.sx-entry-btn');
  assert.ok(entry); assert.match(entry.textContent, /예시 과정으로 내 조건 맞춰 보기/);
  assert.equal(entry.getAttribute('data-page'), 'cond');
  const job = await boot(t);
  assert.equal(job.root.querySelector('button.sx-entry-btn'), null);
  const live = await boot(t, { raw: studyGoalDocument(), publicWeb: true });
  assert.equal(live.root.querySelector('nav.tabs').querySelectorAll('button').length, 6, '대학 탭은 없어도 채널 탭은 있다');
  assert.equal(live.root.querySelector('button[data-page="univ"]'), null);
  assert.equal(live.root.querySelector('button.sx-entry-btn'), null);
  assert.doesNotMatch(pageText(live), /예시대학 [ABC]|내 조건|대학 탭/);
});

test('내 조건의 주인: 같은 계정이면 새로 고침 뒤에도 남고, 다른 계정이나 손님으로 돌아가면 지운다', async t => {
  const same = await boot(t, { signedIn: true, seed: studySeed('qa-account') });
  assert.equal(JSON.parse(same.record(STUDY_KEY)).gradePct, 88, '로그인한 학생이 새로 고쳐도 조건이 남는다');
  same.click('nav', '[data-page="univ"]'); same.click('nav', '[data-page="cond"]');
  assert.equal(same.root.querySelector('#sx-grade').value, '88');
  same.switchOwner('other-account');
  await settle();
  assert.equal(same.record(STUDY_KEY), undefined, '계정이 바뀌면 앞 사람의 조건을 지운다');

  const other = await boot(t, { signedIn: true, seed: studySeed('someone-else') });
  assert.equal(other.record(STUDY_KEY), undefined, '다른 계정의 조건은 보이지 않고 지워진다');
  other.click('nav', '[data-page="univ"]'); other.click('nav', '[data-page="cond"]');
  assert.equal(other.root.querySelector('#sx-grade').value, '');

  const inherit = await boot(t, { signedIn: true, seed: studySeed('guest') });
  assert.equal(JSON.parse(inherit.record(STUDY_KEY)).owner, 'qa-account', '손님이 넣은 조건은 로그인한 계정이 이어받는다');
  assert.equal(JSON.parse(inherit.record(STUDY_KEY)).topik, 4);

  const expired = await boot(t, { seed: studySeed('qa-account') });
  assert.equal(expired.record(STUDY_KEY), undefined, '세션이 끝나 손님으로 돌아오면 앞 계정의 조건을 지운다');
});

test('편집이 막힌 계정에서도 내 조건은 쓸 수 있고, 저장이 막히면 저장됐다고 하지 않는다', async t => {
  const locked = await boot(t, { signedIn: true });
  locked.setStatusOverride({ ...locked.session.status(), canEdit: false });
  locked.notifyStatus();
  locked.click('nav', '[data-page="univ"]'); locked.click('nav', '[data-page="cond"]');
  locked.click('studySet', '[data-key="education"][data-id="graduated"]');
  assert.equal(JSON.parse(locked.record(STUDY_KEY)).education, 'graduated');

  const blocked = await boot(t);
  blocked.failWrites();
  blocked.click('nav', '[data-page="univ"]'); blocked.click('nav', '[data-page="cond"]');
  assert.match(blocked.root.querySelector('.sx-store').textContent, /이 탭에만 저장돼요/);
  const grade = blocked.root.querySelector('#sx-grade');
  grade.value = '75'; blocked.event('input', grade);
  assert.equal(blocked.record(STUDY_KEY), undefined);
  assert.match(blocked.root.querySelector('.sx-store').textContent, /저장할 수 없어서 지금 화면에서만 기억해요/);
  assert.equal(blocked.root.querySelector('#sx-grade').value, '75', '화면 안에서는 넣은 값을 기억한다');
});

test('실제 과정이 있으면 공개판에도 대학 탭이 나오고 예시는 어디에도 나오지 않는다', async t => {
  const real = { ...studyData.PROGRAMS.find(program => program.example), id: 'test-ug', example: false, partner: false, image: null,
    name: { ko: '시험대학교', en: 'Test University' }, costs: { tuition: 4000000, dorm: null, living: null },
    source: { title: { ko: '시험대학교 모집 요강', en: 'Test University admissions guide' }, url: 'https://example.ac.kr/guide.pdf' }, checkedAt: '2026-11-21' };
  for (const publicWeb of [true, false]) {
    const app = await boot(t, { raw: studyGoalDocument(), publicWeb, programs: [...studyData.PROGRAMS.filter(program => program.example), real] });
    assert.equal(app.root.querySelector('nav.tabs').querySelectorAll('button').length, 7, 'publicWeb=' + publicWeb);
    assert.match(app.root.querySelector('button.sx-entry-btn').textContent, /내 조건으로 갈 수 있는 대학을 알아봐요/);
    app.click('nav', '[data-page="univ"]');
    assert.equal(app.root.querySelectorAll('button[data-action="univOpen"]').length, 1);
    assert.match(pageText(app), /대학 공개 모집 요강/);
    assert.doesNotMatch(pageText(app), /예시대학 [ABC]|예시 과정/);
    assert.equal(app.root.querySelectorAll('img').length, 0, '실제 대학에는 지어낸 건물 그림이 없다');
    app.click('univOpen', '[data-id="test-ug"]');
    assert.match(app.root.querySelector('h1').textContent, /시험대학교/);
    assert.match(pageText(app), /시험대학교 모집 요강/);
  }
});

// ── 2단계: 채널과 다가오는 날 ──
test('다가오는 날: 넣은 날은 카드와 상관없이 오늘 화면에 보이고, 채널 글에서 넣고 빼며, 조건 지우기에도 남는다', async t => {
  const goalDoc = goal => JSON.stringify({ ...createPathDocument('ko'), state: stateModel.updateProfile(stateModel.createInitialState('ko'), { onboarded: true, primaryGoal: goal }, '2026-11-21T00:00:00.000Z') });
  // 시험을 돌리는 날에 지나지 않은 날 하나를 고른다(날짜가 지나도 이 시험이 깨지지 않게).
  const now = new Date();
  const pick = channelData.POSTS.flatMap(post => post.dates.map(date => ({ post, date }))).find(x => !['past', 'cancelled'].includes(channelData.dateStatus(x.date, now).state));
  const sample = channelData.POSTS.flatMap(post => post.dates.map(date => ({ post, date })))[0];
  const entry = x => ({ id: x.date.id, start: x.date.start, end: channelData.endDay(x.date) });
  for (const goal of ['study', 'student', 'job', null]) {
    const app = await boot(t, { raw: goalDoc(goal), seed: studySeed('guest', { dates: [entry(sample)] }) });
    assert.match(pageText(app), /다가오는 날|지난 날/, 'goal=' + goal);
    assert.match(pageText(app), /이 탭에만 있어요/);
    // 채널 탭은 모두에게 열리고 「오늘 화면에 보이기」가 이 자리를 약속하므로 새 소식도 카드와 상관없이 둔다(카본 A2).
    assert.match(pageText(app), /새 소식/, 'news goal=' + goal);
  }
  // 글에서 빠진 날만 있던 목록을 지우면 칸이 사라지므로 초점은 쪽 제목으로 간다(카본 A3).
  const cleaned = await boot(t, { raw: goalDoc('job'), seed: studySeed('guest', { dates: [{ id: 'gone-date', start: '2026-12-01', end: '2026-12-01' }] }) });
  cleaned.click('datesClean');
  assert.doesNotMatch(pageText(cleaned), /다가오는 날/);
  assert.match(cleaned.document.activeElement?.getAttribute('class') || '', /\bpage-title\b/, '초점이 쪽 제목에 있다');
  const fresh = await boot(t, { raw: goalDoc('study') });
  assert.doesNotMatch(pageText(fresh), /다가오는 날/, '넣은 날이 없으면 칸이 없다');
  assert.match(pageText(fresh), /새 소식/, '유학 카드에는 새 소식이 있다');
  if (!pick) { t.diagnostic('지나지 않은 날이 자료에 없어 넣기 흐름은 건너뛴다'); return; }
  fresh.click('nav', '[data-page="channels"]');
  assert.match(fresh.root.querySelector('h1').textContent, /채널/);
  fresh.click('channelOpen', `[data-id="${pick.post.channel}"]`);
  fresh.click('postOpen', `[data-id="${pick.post.id}"]`);
  fresh.click('dateToggle', `[data-id="${pick.date.id}"]`);
  assert.match(fresh.announcer.textContent, /이 탭의 다가오는 날에 넣었어요/);
  assert.equal(fresh.root.querySelector(`button[data-action="dateToggle"][data-id="${pick.date.id}"]`).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(JSON.parse(fresh.record(STUDY_KEY)).dates, [entry(pick)]);
  fresh.click('nav', '[data-page="univ"]');
  fresh.click('nav', '[data-page="cond"]');
  fresh.click('studySet', '[data-key="topik"][data-id="3"]');
  fresh.click('studyClear');
  assert.deepEqual(JSON.parse(fresh.record(STUDY_KEY)).dates, [entry(pick)], '조건만 지우고 넣은 날은 남긴다');
  fresh.click('nav', '[data-page="today"]');
  assert.ok(pageText(fresh).includes(pick.date.label.ko), '오늘 화면의 다가오는 날에 넣은 날 이름이 있다');
  fresh.click('postOpen', `[data-id="${pick.post.id}"]`);
  fresh.click('dateToggle', `[data-id="${pick.date.id}"]`);
  assert.match(fresh.announcer.textContent, /다가오는 날에서 뺐어요/);
  assert.deepEqual(JSON.parse(fresh.record(STUDY_KEY)).dates, []);
  fresh.click('nav', '[data-page="channels"]');
  fresh.click('channelShow', '[data-id="scam"]');
  assert.match(fresh.announcer.textContent, /새 소식에서 뺐어요/);
  assert.deepEqual(JSON.parse(fresh.record(STUDY_KEY)).channelsOff, ['scam']);
});

test('달력 파일을 못 만들면 날짜 목록 위에 보이는 경고가 뜨고, 언어를 바꾸면 경고도 그 언어로 바뀐다', async t => {
  const goalDoc = JSON.stringify({ ...createPathDocument('ko'), state: stateModel.updateProfile(stateModel.createInitialState('ko'), { onboarded: true, primaryGoal: 'study' }, '2026-11-21T00:00:00.000Z') });
  const now = new Date();
  const pick = channelData.POSTS.flatMap(post => post.dates.map(date => ({ post, date }))).find(x => !['past', 'cancelled'].includes(channelData.dateStatus(x.date, now).state));
  if (!pick) { t.diagnostic('지나지 않은 날이 자료에 없어 건너뛴다'); return; }
  const app = await boot(t, { raw: goalDoc, downloadThrows: true });
  app.click('nav', '[data-page="channels"]');
  app.click('channelOpen', `[data-id="${pick.post.channel}"]`);
  app.click('postOpen', `[data-id="${pick.post.id}"]`);
  app.click('dateIcs', `[data-id="${pick.date.id}"]`);
  assert.match(pageText(app), /이 브라우저에서는 달력 파일을 만들 수 없어요/, '눈으로 보이는 경고(페이블 F3)');
  assert.match(app.announcer.textContent, /달력 파일을 만들 수 없어요/);
  app.click('setLang', '[data-id="en"]');
  assert.match(pageText(app), /This browser cannot create the calendar file/, '언어를 바꾸면 경고도 바뀐다(페이블 FA1)');
  assert.doesNotMatch(pageText(app), /달력 파일을 만들 수 없어요/);
  app.click('nav', '[data-page="today"]');
  app.click('nav', '[data-page="channels"]');
  assert.doesNotMatch(pageText(app), /cannot create the calendar file/, '다른 쪽으로 가면 지운다');
});

test('내 길: 대학 자세히에서 과정을 고르면 오늘에 카드가 생기고, 서류를 표시하고, 과정을 바꾸기 전에 묻는다', async t => {
  const real = studyData.programsFor(studyData.PROGRAMS, true);
  const app = await boot(t, { raw: studyGoalDocument(), programs: real });
  app.click('nav', '[data-page="univ"]');
  app.click('univOpen', '[data-id="wku-ug"]');
  assert.match(pageText(app), /이 과정의 원서 · 합격 뒤 서류와 유학\(D-2\) 비자 서류를 한곳에서 챙겨요/);
  app.click('pathPick', '[data-id="wku-ug"]');
  assert.match(app.announcer.textContent, /이 과정으로 준비해요/);
  assert.equal(app.root.querySelector('button[data-action="pathPick"][data-id="wku-ug"]').getAttribute('aria-pressed'), 'true');
  assert.equal(JSON.parse(app.record(STUDY_KEY)).target, 'wku-ug');
  app.click('nav', '[data-page="today"]');
  assert.match(pageText(app), /준비 중인 과정/, '오늘 화면의 내 길 카드');
  app.click('nav', '[data-page="path"]');
  assert.match(app.root.querySelector('h1').textContent, /원광대학교 학부/);
  assert.ok(app.root.querySelectorAll('button[data-page="today"]').some(b => b.getAttribute('aria-current') === 'page'), '내 길은 오늘 탭 아래 화면이다');
  assert.equal(app.root.querySelector('button[data-action="pathPick"]').getAttribute('aria-pressed'), null, '「준비 그만하기」는 켜고 끄는 단추가 아니다');
  app.click('docToggle', '[data-id="wku-ug-passport"]');
  assert.match(app.announcer.textContent, /준비했어요로 표시했어요\. 이 묶음 1\/7\./);
  assert.equal(app.document.activeElement.getAttribute('data-id'), 'wku-ug-passport', '누른 단추로 초점이 돌아온다');
  app.root.querySelector('[data-fold="docs-apply"]').open = true;
  app.click('docToggle', '[data-id="wku-ug-translator"]');
  assert.match(app.announcer.textContent, /준비했어요로 표시했어요/);
  assert.doesNotMatch(app.announcer.textContent, /이 묶음/, '접힌 서류는 묶음 수에 들지 않아 수를 붙이지 않는다');
  assert.equal(app.root.querySelector('[data-fold="docs-apply"]').open, true, '펼쳐 둔 접힘은 다시 그려도 펼친 채다');
  assert.equal(app.document.activeElement.getAttribute('data-id'), 'wku-ug-translator', '접힌 서류를 눌러도 초점이 그 단추에 남는다');
  app.click('docToggle', '[data-id="wku-ug-translator"]');
  app.click('docToggle', '[data-id="visa-d2-photo"]');
  assert.deepEqual(JSON.parse(app.record(STUDY_KEY)).docs.map(d => d.id), ['wku-ug-passport', 'visa-d2-photo']);
  // 다른 과정으로 바꾸면 그 과정에 없는 표시를 지운다. 묻고, 아니라고 하면 그대로 둔다.
  app.click('nav', '[data-page="univ"]');
  app.click('univOpen', '[data-id="jj-ug"]');
  app.setConfirmation(false);
  app.click('pathPick', '[data-id="jj-ug"]');
  assert.match(app.confirmations.at(-1), /앞 과정에서 표시한 서류 1개를 지우고 이 과정으로 바꿀까요/);
  assert.equal(JSON.parse(app.record(STUDY_KEY)).target, 'wku-ug', '아니라고 하면 바뀌지 않는다');
  app.setConfirmation(true);
  app.click('pathPick', '[data-id="jj-ug"]');
  const saved = JSON.parse(app.record(STUDY_KEY));
  assert.equal(saved.target, 'jj-ug');
  assert.deepEqual(saved.docs.map(d => d.id), ['visa-d2-photo'], '같은 비자 서류 표시는 이어진다');
  assert.match(app.announcer.textContent, /앞 과정의 표시 1개를 지웠어요/);
  // 조건 모두 지우기는 고른 과정과 표시를 남긴다.
  app.click('nav', '[data-page="cond"]');
  app.click('studySet', '[data-key="topik"][data-id="3"]');
  app.click('studyClear');
  assert.equal(JSON.parse(app.record(STUDY_KEY)).target, 'jj-ug');
  assert.equal(JSON.parse(app.record(STUDY_KEY)).docs.length, 1);
});
