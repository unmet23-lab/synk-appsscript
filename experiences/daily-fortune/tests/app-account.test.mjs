import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../core.mjs';
import * as accountState from '../account-state.mjs';
import { createFortuneAccount } from '../account.mjs';

// 시그널 판 app.mjs 본문을 그대로 돌린다. 도메인·계정 모듈은 실제 것을 쓰고, 화면은 실제 index.html
// 본문과 app.mjs가 그리는 innerHTML 템플릿을 이 파일의 작은 가짜 DOM으로 해석한다.
// 앱 브리지·계정·응답·입력 글은 모두 합성이다.

// ── 작은 가짜 DOM ─────────────────────────────────────
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['textarea', 'script', 'style', 'title']);
const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = text => text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, name) => name[0] !== '#' ? ENTITY[name.toLowerCase()] ?? all
  : String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1))));
const dataKey = key => `data-${key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`;

class TextNode {
  constructor(data) { this.nodeType = 3; this.data = data; this.parentNode = null; }
  get textContent() { return this.data; }
}

class FakeElement {
  constructor(tag, ownerDocument) {
    this.nodeType = 1; this.localName = tag.toLowerCase(); this.ownerDocument = ownerDocument;
    this.attributes = new Map(); this.childNodes = []; this.parentNode = null; this.listeners = new Map();
    this.style = { setProperty() {}, removeProperty() {} };
    const attributes = this.attributes;
    this.dataset = new Proxy({}, {
      get: (_, key) => typeof key === 'string' ? attributes.get(dataKey(key)) : undefined,
      set: (_, key, value) => { attributes.set(dataKey(key), String(value)); return true; },
      deleteProperty: (_, key) => { attributes.delete(dataKey(key)); return true; },
      has: (_, key) => attributes.has(dataKey(key)),
    });
  }
  get tagName() { return this.localName.toUpperCase(); }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get id() { return this.getAttribute('id') ?? ''; }
  get className() { return this.getAttribute('class') ?? ''; }
  get name() { return this.getAttribute('name') ?? ''; }
  get type() { return this.getAttribute('type') ?? (this.localName === 'button' ? 'submit' : 'text'); }
  get classList() { const names = () => this.className.split(/\s+/).filter(Boolean); return { contains: name => names().includes(name) }; }
  getAttribute(name) { name = name.toLowerCase(); return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name.toLowerCase(), String(value)); }
  removeAttribute(name) { this.attributes.delete(name.toLowerCase()); }
  hasAttribute(name) { return this.attributes.has(name.toLowerCase()); }
  toggleFlag(name, on) { if (on) this.setAttribute(name, ''); else this.removeAttribute(name); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(value) { this.toggleFlag('hidden', value); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { this.toggleFlag('disabled', value); }
  get checked() { return this.checkedState ?? this.hasAttribute('checked'); }
  set checked(value) { this.checkedState = !!value; }
  get selected() { return this.selectedState ?? this.hasAttribute('selected'); }
  set selected(value) { this.selectedState = !!value; }
  get value() {
    if (this.valueState !== undefined) return this.valueState;
    if (this.localName === 'textarea') return this.textContent;
    if (this.localName === 'select') { const options = this.querySelectorAll('option'); return (options.find(option => option.selected) ?? options[0])?.value ?? ''; }
    if (this.localName === 'option') return this.getAttribute('value') ?? this.textContent;
    return this.getAttribute('value') ?? '';
  }
  set value(value) {
    if (this.localName === 'select') { for (const option of this.querySelectorAll('option')) option.selected = option.value === String(value); return; }
    this.valueState = String(value);
  }
  get form() { let node = this.parentNode; while (node && node.localName !== 'form') node = node.parentNode; return node ?? null; }
  get elements() {
    const found = {};
    for (const control of this.querySelectorAll('input,select,textarea,button')) for (const key of [control.name, control.id]) if (key && !Object.hasOwn(found, key)) found[key] = control;
    return found;
  }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); const text = String(value ?? ''); if (text) this.appendChild(new TextNode(text)); }
  set innerHTML(html) { this.replaceChildren(); parseInto(this, String(html)); }
  set outerHTML(html) {
    const parent = this.parentNode; if (!parent) return;
    const holder = new FakeElement('div', this.ownerDocument); parseInto(holder, String(html));
    for (const node of holder.childNodes) node.parentNode = parent;
    parent.childNodes.splice(parent.childNodes.indexOf(this), 1, ...holder.childNodes); this.parentNode = null;
  }
  replaceChildren(...nodes) { for (const node of this.childNodes) node.parentNode = null; this.childNodes = []; for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.parentNode = this; this.childNodes.push(node); return node; }
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(handler); }
  removeEventListener() {}
  focus() { this.ownerDocument.activeElement = this; }
  blur() {}
  select() {}
  click() {}
  scrollIntoView() {}
  querySelectorAll(text) {
    const chains = selector(text), found = [];
    const walk = node => { for (const child of node.childNodes) if (child.nodeType === 1) { if (chains.some(chain => matchChain(child, chain))) found.push(child); walk(child); } };
    walk(this); return found;
  }
  querySelector(text) { return this.querySelectorAll(text)[0] ?? null; }
  closest(text) {
    const chains = selector(text);
    for (let node = this; node?.nodeType === 1; node = node.parentNode) if (chains.some(chain => matchChain(node, chain))) return node;
    return null;
  }
}

function parseInto(container, html) {
  const stack = [container], TAG = /<([a-zA-Z][\w-]*)/y, END = /\s*(\/?)>/y;
  const ATTR = /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y;
  const add = node => stack.at(-1).appendChild(node);
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') { let end = html.indexOf('<', i); if (end < 0) end = html.length; add(new TextNode(decode(html.slice(i, end)))); i = end; continue; }
    if (html.startsWith('<!--', i)) { const end = html.indexOf('-->', i + 4); i = end < 0 ? html.length : end + 3; continue; }
    if (html.startsWith('</', i)) {
      const end = html.indexOf('>', i), name = html.slice(i + 2, end).trim().toLowerCase(); i = end + 1;
      const at = stack.findLastIndex((node, index) => index > 0 && node.localName === name);
      if (at > 0) stack.length = at;
      continue;
    }
    TAG.lastIndex = i; const tag = TAG.exec(html);
    if (!tag) { add(new TextNode('<')); i++; continue; }
    const element = new FakeElement(tag[1], container.ownerDocument); i = TAG.lastIndex;
    let selfClosing = false;
    for (;;) {
      END.lastIndex = i; const end = END.exec(html);
      if (end) { i = END.lastIndex; selfClosing = end[1] === '/'; break; }
      ATTR.lastIndex = i; const attr = ATTR.exec(html);
      if (!attr) throw new Error(`HTML 속성을 읽지 못했어요: ${html.slice(i, i + 60)}`);
      element.attributes.set(attr[1].toLowerCase(), decode(attr[2] ?? attr[3] ?? attr[4] ?? '')); i = ATTR.lastIndex;
    }
    add(element);
    if (RAW.has(element.localName)) {
      const close = html.indexOf(`</${element.localName}`, i), raw = html.slice(i, close < 0 ? html.length : close);
      if (raw) element.appendChild(new TextNode(element.localName === 'textarea' || element.localName === 'title' ? decode(raw) : raw));
      i = close < 0 ? html.length : html.indexOf('>', close) + 1; continue;
    }
    if (!VOID.has(element.localName) && !selfClosing) stack.push(element);
  }
}

// 선택자: 태그·#id·.class·[속성]·[속성="값"]·:not(…)의 조합, 자손(공백), 쉼표 목록.
function splitTop(text, separator) {
  const parts = []; let depth = 0, quote = null, start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) { if (char === quote) quote = null; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '[' || char === '(') depth++;
    else if (char === ']' || char === ')') depth--;
    else if (depth === 0 && separator.test(char)) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start)); return parts.map(part => part.trim()).filter(Boolean);
}
function compound(text) {
  const parts = { tag: null, id: null, classes: [], attrs: [], not: [] };
  const TOKEN = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:not\(([^)]*)\)/y;
  for (let i = 0; i < text.length;) {
    TOKEN.lastIndex = i; const token = TOKEN.exec(text);
    if (!token) throw new Error(`가짜 DOM이 지원하지 않는 선택자예요: ${text}`);
    i = TOKEN.lastIndex;
    if (token[1]) parts.tag = token[1].toLowerCase(); else if (token[2]) parts.id = token[2]; else if (token[3]) parts.classes.push(token[3]);
    else if (token[4]) parts.attrs.push([token[4].toLowerCase(), token[5]]); else parts.not.push(compound(token[6]));
  }
  return parts;
}
const selectors = new Map();
const selector = text => { if (!selectors.has(text)) selectors.set(text, splitTop(text, /,/).map(alternative => splitTop(alternative, /\s/).map(compound))); return selectors.get(text); };
const matchCompound = (element, part) => (!part.tag || element.localName === part.tag) && (!part.id || element.id === part.id)
  && part.classes.every(name => element.classList.contains(name))
  && part.attrs.every(([name, value]) => element.hasAttribute(name) && (value === undefined || element.getAttribute(name) === value))
  && part.not.every(inner => !matchCompound(element, inner));
function matchChain(element, chain) {
  if (!matchCompound(element, chain.at(-1))) return false;
  let node = element.parentNode;
  for (let k = chain.length - 2; k >= 0; k--) {
    while (node?.nodeType === 1 && !matchCompound(node, chain[k])) node = node.parentNode;
    if (node?.nodeType !== 1) return false;
    node = node.parentNode;
  }
  return true;
}

function eventFor(type, target) {
  return { type, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
}
// 대상에서 위로 올라가며 듣는 함수를 부르고, 화면에 붙은 요소면 document까지 올라간다.
function dispatch(target, type) {
  const event = eventFor(type, target), path = [];
  for (let node = target; node; node = node.parentNode) path.push(node);
  if (path.at(-1) === target.ownerDocument.documentElement) path.push(target.ownerDocument);
  for (const node of path) { event.currentTarget = node; for (const handler of node.listeners.get(type) ?? []) handler.call(node, event); if (event.stopped) break; }
  return event;
}
function createDocument(bodyHtml) {
  const document = {
    listeners: new Map(), activeElement: null, hidden: false,
    addEventListener: FakeElement.prototype.addEventListener, removeEventListener() {},
    createElement: tag => new FakeElement(tag, document),
    querySelector: text => document.documentElement.querySelector(text),
    querySelectorAll: text => document.documentElement.querySelectorAll(text),
  };
  document.documentElement = new FakeElement('html', document);
  document.body = document.documentElement.appendChild(new FakeElement('body', document));
  document.body.innerHTML = bodyHtml; document.activeElement = document.body;
  return document;
}

// ── 실제 app.mjs를 돌리는 받침 ────────────────────────
const appURL = new URL('../app.mjs', import.meta.url);
const appSource = await readFile(appURL, 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bodyHtml = indexHtml.slice(indexHtml.indexOf('>', indexHtml.indexOf('<body')) + 1, indexHtml.lastIndexOf('</body>'));
const IMPORT = /^import \{([^}]*)\} from '([^']+)';\r?$/gm;
const imports = [...appSource.matchAll(IMPORT)].map(([, names, from]) => ({ names: names.split(',').map(name => name.trim()).filter(Boolean), from }));
const appBody = appSource.replace(IMPORT, '');
assert.doesNotMatch(appBody, /^\s*import\s/m, 'app.mjs의 import는 모두 이름 붙인 가져오기여야 시험이 실제 모듈을 넣을 수 있다');
const signalImport = imports.find(item => item.from.startsWith('/member-signal/'));
const signalSource = (await readFile(new URL(`..${signalImport.from}`, appURL), 'utf8')).replace(/^export /gm, '');
// 공용 화면 도우미는 가짜 document·타이머를 쓰도록 같은 vm 안에서 평가한다.
const signalScript = `(() => {\n${signalSource}\nreturn { ${signalImport.names.join(', ')} };\n})()`;
const modules = new Map(await Promise.all(imports.filter(item => item !== signalImport).map(async item => [item.from, await import(new URL(item.from, appURL))])));

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const auth = (id, generation) => ({ configured: true, signedIn: true, status: 'signed-in', sessionGeneration: generation, account: { synk_user_id: id, display_name: '합성 계정' } });

async function appFixture(t, accountOptions) {
  const document = createDocument(bodyHtml);
  let connection;
  const context = vm.createContext({
    document, window: { addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: true }) },
    navigator: {}, location: { reload() {} }, setTimeout: () => 1, clearTimeout() {}, URL, Blob,
  });
  for (const { names, from } of imports) if (modules.has(from)) for (const name of names) context[name] = modules.get(from)[name];
  context.createFortuneAccount = options => { connection = createFortuneAccount({ ...options, ...accountOptions }); return connection; };
  Object.assign(context, vm.runInContext(signalScript, context, { filename: 'member-signal/signal.mjs' }));
  vm.runInContext(appBody, context, { filename: 'daily-fortune/app.mjs' });
  t.after(() => connection.dispose()); await settle();
  const app = document.querySelector('#app');
  const $ = text => document.querySelector(text);
  const click = element => {
    assert.ok(element, '누를 단추가 화면에 있어야 한다');
    assert.equal(element.disabled, false, '비활성 단추는 누를 수 없다');
    const event = dispatch(element, 'click');
    if (!event.defaultPrevented && element.localName === 'button' && element.type === 'submit' && element.form) dispatch(element.form, 'submit');
  };
  return {
    document, app, $, connection, click,
    text: text => $(text)?.textContent ?? '',
    state: expression => vm.runInContext(expression, context),
    show: view => click($(`.tabs [data-view="${view}"]`)),
    acct: name => click($(`#account-body [data-acct="${name}"]`)),
    type(element, value) { assert.ok(element, '입력 칸이 화면에 있어야 한다'); assert.equal(element.disabled, false); element.value = value; dispatch(element, 'input'); },
    check(element, value) { assert.ok(element, '선택 칸이 화면에 있어야 한다'); element.checked = value; dispatch(element, 'input'); dispatch(element, 'change'); },
    // 다시 그리기 전에 눌린 단추처럼, 이미 화면에서 빠진 요소의 누름을 위임 처리기에 그대로 전한다.
    deliver(type, target) { const event = eventFor(type, target); for (const handler of document.listeners.get(type) ?? []) handler(event); },
  };
}

const savedAries = () => ({ ...accountState.saveReading(accountState.emptyState(), core.getFortune('aries', core.seoulDateKey(), 'western'), { note: '서버의 기존 메모' }), preferences: { mode: 'western', signId: 'aries' } });
async function editableFixture(t, saved = savedAries()) {
  let current = auth('synthetic-a', 1), listener, responder;
  const response = (state = saved) => ({ ok: true, account: current.account, revision: 1, state: structuredClone(state) });
  const native = {
    onAuthChanged(callback) { listener = callback; return () => {}; },
    async authStatus() { return current; },
    async request(operation, params) {
      const pending = responder?.(operation, params); if (pending !== undefined) return pending;
      if (operation === 'load') return { ok: true, account: current.account };
      return response();
    },
  };
  return { ...await appFixture(t, { native }), response, saved,
    respond(fn) { responder = fn; },
    async switchAccount(id, generation) { current = auth(id, generation); listener(current); await settle(); },
  };
}
const note = page => page.app.querySelector('#keep #note');
const completed = page => page.app.querySelector('#keep [name="completed"]');
const keepButton = page => page.app.querySelector('#keep [type="submit"]');

test('최근 7일 화면은 저장된 메모만 표시하고 직접 저장을 마친 뒤 갱신한다', async t => {
  const page = await editableFixture(t);
  assert.equal(note(page).value, '서버의 기존 메모');
  page.show('vault');
  assert.equal(page.state('view'), 'vault'); assert.equal(page.app.querySelector('#keep'), null);
  assert.match(page.text('#app .recent'), /서버의 기존 메모/);
  // 앞뒤 공백은 저장할 때 다듬어진다. 저장 뒤에는 화면 초안이 아니라 저장본을 보여 줘야 한다.
  const typed = '  아직 보내지 않은 최신 메모  ';
  page.show('today'); page.type(note(page), typed);
  page.show('vault'); assert.doesNotMatch(page.app.textContent, /아직 보내지 않은/);
  let writes = 0;
  page.respond((operation, params) => { if (operation === 'fortunePut') { writes++; return page.response(params.state); } });
  page.show('today'); assert.equal(note(page).value, typed, '탭을 오가도 저장 전 메모는 이 화면에 남는다');
  page.click(keepButton(page)); await settle();
  assert.equal(writes, 1);
  page.show('vault');
  assert.match(page.text('#app .recent'), /아직 보내지 않은 최신 메모/); assert.doesNotMatch(page.text('#app .recent'), /서버의 기존 메모/);
  page.click(page.app.querySelector('.recent [data-open]'));
  assert.equal(page.state('view'), 'today');
  assert.equal(note(page).value, '아직 보내지 않은 최신 메모'); assert.match(page.text('#keep'), /보관함에 있어요/);
});

test('최근 7일 화면과 이전 단추는 다른 계정으로 전환하면 이전 계정 메모를 다시 열 수 없다', async t => {
  const page = await editableFixture(t); page.show('vault');
  const open = page.app.querySelector('.recent [data-open]'); assert.ok(open);
  page.respond(operation => operation === 'fortuneGet' ? page.response(accountState.emptyState()) : undefined);
  await page.switchAccount('synthetic-b', 2);
  assert.equal(page.connection.snapshot().account.synk_user_id, 'synthetic-b');
  assert.doesNotMatch(page.app.textContent, /서버의 기존 메모/);
  assert.equal(page.app.querySelectorAll('.recent .rec').length, 0); assert.equal(page.app.querySelectorAll('.recent .empty-day').length, 7);
  page.deliver('click', open);
  assert.equal(page.state('view'), 'vault');
  page.show('today');
  assert.equal(page.app.querySelector('#keep'), null); assert.doesNotMatch(page.app.textContent, /서버의 기존 메모/);
});

// 계정 판을 열고 다시 불러오기, 또는 전체 삭제 → 확인을 누른다.
async function startAccountTask(page, name) {
  page.click(page.$('.bar-tools [data-action="account"]'));
  if (name === 'confirm-delete') page.acct('delete');
  page.acct(name); await settle();
  assert.equal(page.state('accountBusy'), true);
}

for (const [name, button, operation] of [['다시 불러오기', 'reload', 'fortuneGet'], ['전체 삭제', 'confirm-delete', 'fortuneDelete']]) {
  test(`실제 운세 화면은 ${name} 대기 중 추가한 메모와 입력을 응답 뒤에도 남긴다`, async t => {
    const page = await editableFixture(t), gate = deferred();
    page.respond(next => next === operation ? gate.promise : undefined);
    await startAccountTask(page, button);
    page.type(note(page), '요청 뒤 새로 작성한 메모');
    page.check(completed(page), true);
    page.click(page.app.querySelector('[data-action="change"]'));
    page.type(page.app.querySelector('#zodiac-birth'), '2001-03-14');
    gate.resolve(page.response(operation === 'fortuneDelete' ? accountState.emptyState() : page.saved)); await settle();
    assert.equal(page.state('accountBusy'), false);
    assert.equal(page.app.querySelector('#zodiac-birth').value, '2001-03-14');
    assert.match(page.text('#notice'), /작성|입력/);
    page.show('today');
    assert.equal(note(page).value, '요청 뒤 새로 작성한 메모');
    assert.equal(completed(page).checked, true); assert.equal(keepButton(page).disabled, false);
    if (operation === 'fortuneDelete') assert.equal(page.connection.snapshot().state.entries.length, 0, '보존한 초안은 서버에 다시 저장하지 않는다');
  });

  test(`실제 운세 화면은 ${name} 대기 중 새 입력이 없으면 기존 복원·초기화 동작을 마친다`, async t => {
    const page = await editableFixture(t), gate = deferred();
    page.type(note(page), '요청 전에 쓴 저장하지 않은 메모');
    page.respond(next => next === operation ? gate.promise : undefined);
    await startAccountTask(page, button);
    gate.resolve(page.response(operation === 'fortuneDelete' ? accountState.emptyState() : page.saved)); await settle();
    assert.equal(page.state('accountBusy'), false);
    if (operation === 'fortuneGet') {
      assert.equal(note(page).value, '서버의 기존 메모'); assert.equal(completed(page).checked, false);
      assert.equal(page.state('mode'), 'western'); assert.equal(page.state('signId'), 'aries');
    } else {
      assert.equal(page.app.querySelector('#keep'), null); assert.equal(page.state('mode'), null);
      assert.equal(page.connection.snapshot().state.entries.length, 0);
      page.click(page.app.querySelector('[data-sign="aries"]'));
      assert.equal(note(page).value, '', '삭제 뒤 같은 운세를 다시 열어도 지운 메모나 이전 초안이 돌아오지 않는다');
    }
  });
}

test('다시 불러오는 중 생일만 고쳐도 새 출생 입력을 이전 프로필로 덮지 않는다', async t => {
  const saved = { ...accountState.emptyState(), profile: accountState.birthProfile('1990-05-05', '08:30'), preferences: { mode: 'korean', signId: null } };
  const page = await editableFixture(t, saved), gate = deferred();
  assert.equal(page.state('mode'), 'korean'); assert.equal(page.state('birth?.birthDate'), '1990-05-05');
  page.click(page.app.querySelector('[data-action="change"]'));
  assert.equal(page.app.querySelector('#birth-date').value, '1990-05-05');
  page.respond(operation => operation === 'fortuneGet' ? gate.promise : undefined);
  await startAccountTask(page, 'reload');
  page.type(page.app.querySelector('#birth-date'), '2001-03-14');
  gate.resolve(page.response()); await settle();
  assert.equal(page.app.querySelector('#birth-date').value, '2001-03-14');
  assert.equal(page.app.querySelector('#birth-time').value, '08:30');
  assert.equal(page.connection.snapshot().state.profile.birthDate, '1990-05-05', '화면 입력은 저장 단추 전까지 계정에 보내지 않는다');
  page.click(page.app.querySelector('#saju-form [type="submit"]'));
  assert.equal(page.state('birth?.birthDate'), '2001-03-14'); assert.equal(page.state('birth?.birthTime'), '08:30');
});

// 새 화면에는 「화면 입력·결과 지우기」 단추가 없다. 결과를 비우는 사람의 선택은 방식 바꾸기(사주로, 생년월일 전)다.
test('다시 불러오는 중 사용자가 화면을 비우면 늦은 응답으로 이전 화면을 다시 채우지 않는다', async t => {
  const page = await editableFixture(t), gate = deferred();
  page.respond(operation => operation === 'fortuneGet' ? gate.promise : undefined);
  await startAccountTask(page, 'reload');
  page.click(page.app.querySelector('[data-action="change"]'));
  page.click(page.app.querySelector('[data-mode="korean"]'));
  assert.equal(page.app.querySelector('#keep'), null);
  gate.resolve(page.response()); await settle();
  assert.equal(page.state('mode'), 'korean');
  assert.equal(page.app.querySelector('[data-mode="korean"]').getAttribute('aria-pressed'), 'true');
  page.show('today');
  assert.equal(page.app.querySelector('#keep'), null); assert.doesNotMatch(page.app.textContent, /서버의 기존 메모/);
  assert.equal(page.connection.snapshot().state.entries.length, 1, '화면 비우기는 서버의 기존 기록을 삭제하지 않는다');
});

test('실제 운세 화면은 이전 계정 저장의 늦은 실패를 새 계정 알림으로 표시하지 않는다', async t => {
  const page = await editableFixture(t), gate = deferred();
  page.respond(operation => operation === 'fortunePut' ? gate.promise : undefined);
  page.click(keepButton(page)); await settle();
  assert.equal(page.state('accountBusy'), true);
  await page.switchAccount('synthetic-b', 2);
  const status = page.text('#account-body .acct-status'), notice = page.text('#notice');
  gate.reject(new Error('이전 A 계정의 합성 통신 실패')); await settle();
  assert.equal(page.text('#account-body .acct-status'), status); assert.equal(page.text('#notice'), notice);
  assert.doesNotMatch(page.text('#notice'), /합성 통신 실패/);
  assert.equal(page.connection.snapshot().account.synk_user_id, 'synthetic-b');
  assert.equal(page.state('accountBusy'), false); assert.equal(page.$('#account-body [data-acct="reload"]').disabled, false);
});

test('실제 운세 화면은 같은 계정 재인증 때 미저장 메모를 유지하고 다른 계정·로그아웃 때 비운다', async t => {
  let current = auth('synthetic-a', 1), listener;
  const saved = { ...accountState.emptyState(), preferences: { mode: 'western', signId: 'aries' } }, unexpected = [];
  const native = {
    onAuthChanged(callback) { listener = callback; return () => {}; },
    async authStatus() { return current; },
    async request(operation) {
      if (!['load', 'fortuneGet'].includes(operation)) unexpected.push(operation);
      if (operation === 'load') return { ok: true, account: current.account };
      return { ok: true, account: current.account, revision: 0, state: structuredClone(saved) };
    },
  };
  const page = await appFixture(t, { native });
  assert.ok(page.app.querySelector('#keep'));
  page.type(note(page), '아직 저장하지 않은 내 메모'); page.check(completed(page), true);
  current = auth('synthetic-a', 2); listener(current); await settle();
  assert.equal(note(page).value, '아직 저장하지 않은 내 메모');
  assert.equal(completed(page).checked, true); assert.ok(page.app.querySelector('#keep'));
  current = auth('synthetic-b', 3); listener(current); await settle();
  assert.equal(note(page).value, ''); assert.equal(completed(page).checked, false);
  page.type(note(page), 'B 계정의 미저장 메모');
  current = { ...auth('synthetic-b', 4), signedIn: false, status: 'signed-out', account: null }; listener(current); await settle();
  assert.equal(page.app.querySelector('#keep'), null);
  page.click(page.app.querySelector('[data-sign="aries"]'));
  assert.equal(note(page).value, ''); assert.equal(completed(page).checked, false);
  assert.deepEqual(unexpected, [], 'This scenario must not save or delete records');
});

for (const phase of ['config', 'token']) test(`실제 운세 화면은 ${phase} 일시 실패 뒤 계정 연결 다시 확인으로 같은 로그인을 복구한다`, async t => {
  const config = { version: 1, supabaseUrl: 'https://auth.fortune-test.invalid', accountApiUrl: 'https://account.fortune-test.invalid', portalUrl: 'https://portal.fortune-test.invalid', supabasePublishableKey: 'sb_publishable_synthetic_fortune', clients: { platform: { clientId: 'synthetic-client', redirectUri: 'http://127.0.0.1:4299/' } } };
  const values = new Map(), here = { href: 'http://127.0.0.1:4299/', assign() { throw new Error('Retry must not begin a new OAuth flow'); } };
  if (phase === 'token') {
    here.href += '?code=synthetic-code&state=synthetic-state';
    values.set('synk.oauth.pending.platform', JSON.stringify({ product: 'platform', clientId: 'synthetic-client', redirectUri: config.clients.platform.redirectUri, state: 'synthetic-state', verifier: 'synthetic-verifier', createdAt: Date.now() }));
  } else values.set('synk.oauth.session.fortune', JSON.stringify({ access_token: 'synthetic-access', expires_at: Date.now() + 3600000 }));
  let fail = true, exchanges = 0;
  const page = await appFixture(t, {
    storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, location: here, replaceURL: value => { here.href = value; },
    fetcher: async input => {
      if (input === './account-config.json') return phase === 'config' && fail ? new Response('', { status: 503 }) : Response.json(config);
      if (new URL(input).pathname.endsWith('/oauth/token')) { exchanges++; if (fail) throw new TypeError('synthetic network failure'); return Response.json({ access_token: 'synthetic-access', expires_in: 3600 }); }
      if (new URL(input).pathname.endsWith('/synk-account')) return Response.json({ ok: true, account: { synk_user_id: 'synthetic-a' } });
      return Response.json({ ok: true, account: { synk_user_id: 'synthetic-a' }, revision: 0, state: accountState.emptyState() });
    },
  });
  const login = () => page.$('#account-body [data-acct="login"]');
  assert.ok(login()); assert.equal(login().disabled, false);
  assert.equal(login().textContent, '계정 연결 다시 확인');
  assert.equal(page.$('#account-body [data-acct="save-profile"]'), null, '계정이 준비되기 전에는 내 정보 저장을 열지 않는다');
  fail = false; page.click(login()); await settle();
  assert.equal(page.connection.snapshot().ready, true); assert.equal(login(), null);
  assert.equal(page.$('#account-body [data-acct="export"]').disabled, false);
  page.click(page.app.querySelector('[data-sign="aries"]'));
  assert.equal(page.$('#account-body [data-acct="save-profile"]').disabled, false);
  assert.equal(exchanges, phase === 'token' ? 2 : 0);
});
