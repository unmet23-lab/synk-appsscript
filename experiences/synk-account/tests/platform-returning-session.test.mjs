import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { beginOAuth, consumeCallback, readConfig } from '../src/core.mjs';
import { createPlatformAccount } from '../src/platform-account.mjs';
import { probeCentralPlatformSession } from '../src/platform-central-session.mjs';
import {
  PLATFORM_AUTO_LOGIN_ATTEMPT_KEY,
  PLATFORM_AUTO_LOGIN_PAUSE_KEY,
  PLATFORM_LOGIN_INTENT,
  PLATFORM_LOGIN_NOTICE,
  PLATFORM_RESUME_METHOD,
  PLATFORM_RESUME_SUBJECT_KEY,
  clearPlatformAutoLoginPause,
  finishPlatformErrorReturn,
  finishPlatformLogin,
  hasPlatformAutoLoginAttempt,
  isPlatformAutoLoginPaused,
  pausePlatformAutoLogin,
  platformCallbackIntent,
  platformErrorCallbackIntent,
  rememberPlatformLogin,
  takePlatformLoginNotice,
} from '../src/platform-login-return.mjs';
import { mountWebPortalHost } from '../src/platform-portal.mjs';
import { mountPortal } from '../src/portal.mjs';
import { PORTAL_DURATION_MS } from '../../../desktop/renderer/portal-orb.mjs';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function toCamelDatasetKey(attrName) {
  return attrName
    .slice(5)
    .replace(/-([a-z0-9])/gi, (_, ch) => ch.toUpperCase());
}

function toDashDatasetAttr(prop) {
  return `data-${String(prop).replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}`;
}

function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

class SyntheticClassList {
  constructor(owner) {
    this._owner = owner;
    this._set = new Set();
  }

  _syncAttr() {
    if (this._set.size === 0) this._owner._attrs.delete('class');
    else this._owner._attrs.set('class', [...this._set].join(' '));
  }

  _loadFromString(raw) {
    this._set.clear();
    for (const part of String(raw || '').split(/\s+/).filter(Boolean)) {
      this._set.add(part);
    }
    this._syncAttr();
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) this._set.add(token);
    }
    this._syncAttr();
  }

  remove(...tokens) {
    for (const token of tokens) {
      this._set.delete(token);
    }
    this._syncAttr();
  }

  toggle(token, force) {
    const shouldHave = force === undefined ? !this._set.has(token) : Boolean(force);
    if (shouldHave) this._set.add(token);
    else this._set.delete(token);
    this._syncAttr();
    return shouldHave;
  }

  contains(token) {
    return this._set.has(token);
  }
}

function matchesSingleSelector(el, rawSelector) {
  if (!el || el.nodeType !== 1) return false;
  let selector = rawSelector.trim();
  if (!selector) return false;

  const negations = [];
  selector = selector.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    negations.push(inner.trim());
    return '';
  });

  const attrs = [];
  selector = selector.replace(/\[([^\]=]+)(?:="([^"]*)")?\]/g, (_, name, value) => {
    attrs.push({ name: name.trim(), value });
    return '';
  });

  const ids = [];
  selector = selector.replace(/#([A-Za-z0-9_-]+)/g, (_, id) => {
    ids.push(id);
    return '';
  });

  const classes = [];
  selector = selector.replace(/\.([A-Za-z0-9_-]+)/g, (_, cls) => {
    classes.push(cls);
    return '';
  });

  const tag = selector.trim();
  if (tag && tag !== '*' && el.tagName !== tag.toUpperCase()) return false;
  for (const id of ids) {
    if (el.id !== id) return false;
  }
  for (const cls of classes) {
    if (!el.classList.contains(cls)) return false;
  }
  for (const attr of attrs) {
    if (attr.name === 'disabled') {
      if (attr.value === undefined) {
        if (!el.disabled && !el.hasAttribute('disabled')) return false;
      } else if (el.getAttribute('disabled') !== attr.value) {
        return false;
      }
      continue;
    }
    if (attr.name === 'hidden') {
      if (attr.value === undefined) {
        if (!el.hidden && !el.hasAttribute('hidden')) return false;
      } else if (el.getAttribute('hidden') !== attr.value) {
        return false;
      }
      continue;
    }
    if (!el.hasAttribute(attr.name)) return false;
    if (attr.value !== undefined && el.getAttribute(attr.name) !== attr.value) return false;
  }
  for (const neg of negations) {
    if (matchesSingleSelector(el, neg)) return false;
  }
  return true;
}

function matchesSelectorList(el, selectorList) {
  const parts = String(selectorList || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return parts.some(part => {
    const segments = part.split(/\s+/).filter(Boolean);
    if (segments.length === 0) return false;
    if (!matchesSingleSelector(el, segments[segments.length - 1])) return false;
    let cursor = el.parentElement;
    for (let i = segments.length - 2; i >= 0; i--) {
      while (cursor && !matchesSingleSelector(cursor, segments[i])) {
        cursor = cursor.parentElement;
      }
      if (!cursor) return false;
      cursor = cursor.parentElement;
    }
    return true;
  });
}

class SyntheticElement {
  constructor(tagName = 'DIV', ownerDocument = null) {
    this.nodeType = 1;
    this.tagName = String(tagName || 'DIV').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.childNodes = [];
    this._attrs = new Map();
    this._listeners = new Map();
    this._text = '';
    this.value = '';
    this.checked = false;
    this.inert = false;
    this.isContentEditable = false;
    this.classList = new SyntheticClassList(this);
    this.style = {
      _props: new Map(),
      setProperty(k, v) { this._props.set(k, String(v)); },
      removeProperty(k) { this._props.delete(k); },
      getPropertyValue(k) { return this._props.get(k) || ''; },
    };
    this.dataset = new Proxy({}, {
      get: (_, prop) => {
        if (typeof prop !== 'string') return undefined;
        const attr = toDashDatasetAttr(prop);
        return this._attrs.has(attr) ? this._attrs.get(attr) : undefined;
      },
      set: (_, prop, val) => {
        if (typeof prop === 'string') {
          this._attrs.set(toDashDatasetAttr(prop), String(val));
        }
        return true;
      },
      deleteProperty: (_, prop) => {
        if (typeof prop === 'string') {
          this._attrs.delete(toDashDatasetAttr(prop));
        }
        return true;
      },
      has: (_, prop) => typeof prop === 'string' && this._attrs.has(toDashDatasetAttr(prop)),
    });
  }

  get id() {
    return this._attrs.get('id') || '';
  }

  set id(val) {
    if (val === '' || val === null || val === undefined) this._attrs.delete('id');
    else this._attrs.set('id', String(val));
  }

  get hidden() {
    return this._attrs.has('hidden');
  }

  set hidden(val) {
    if (val) this._attrs.set('hidden', '');
    else this._attrs.delete('hidden');
  }

  get disabled() {
    return this._attrs.has('disabled');
  }

  set disabled(val) {
    if (val) this._attrs.set('disabled', '');
    else this._attrs.delete('disabled');
  }

  get isConnected() {
    let cursor = this;
    while (cursor) {
      if (cursor === this.ownerDocument?.documentElement || cursor === this.ownerDocument?.body) {
        return true;
      }
      cursor = cursor.parentElement;
    }
    return true;
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map(child => child.textContent).join('');
  }

  set textContent(val) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.childNodes = [];
    this._text = String(val ?? '');
  }

  set innerHTML(html) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.childNodes = [];
    this._text = '';
    parseHtmlInto(this, String(html ?? ''), this.ownerDocument);
  }

  get innerHTML() {
    return this._text;
  }

  setAttribute(name, value) {
    const lower = String(name).toLowerCase();
    if (lower === 'class') {
      this.classList._loadFromString(value);
      return;
    }
    this._attrs.set(lower, String(value ?? ''));
  }

  getAttribute(name) {
    const lower = String(name).toLowerCase();
    return this._attrs.has(lower) ? this._attrs.get(lower) : null;
  }

  hasAttribute(name) {
    return this._attrs.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const lower = String(name).toLowerCase();
    if (lower === 'class') {
      this.classList._loadFromString('');
      return;
    }
    this._attrs.delete(lower);
  }

  append(...nodes) {
    for (const node of nodes) {
      if (!node || typeof node === 'string') {
        if (typeof node === 'string') this._text += node;
        continue;
      }
      if (node.parentElement) node.parentElement.removeChild(node);
      node.parentElement = this;
      this.children.push(node);
      this.childNodes.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      this.childNodes = [...this.children];
      node.parentElement = null;
    }
    return node;
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.childNodes = [];
    this._text = '';
    this.append(...nodes);
  }

  contains(target) {
    let cursor = target;
    while (cursor) {
      if (cursor === this) return true;
      cursor = cursor.parentElement;
    }
    return false;
  }

  closest(selector) {
    let cursor = this;
    while (cursor && cursor.nodeType === 1) {
      if (matchesSelectorList(cursor, selector)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelectorList(child, selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = node => {
      for (const child of node.children) {
        if (matchesSelectorList(child, selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  addEventListener(type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push({ listener, capture });
  }

  removeEventListener(type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const list = this._listeners.get(type);
    if (!list) return;
    const idx = list.findIndex(entry => entry.listener === listener && entry.capture === capture);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(rawEvent) {
    const event = rawEvent && typeof rawEvent === 'object' ? rawEvent : { type: String(rawEvent) };
    if (!event.target) {
      Object.defineProperty(event, 'target', { value: this, configurable: true });
    }
    let defaultPrevented = Boolean(event.defaultPrevented);
    let stopped = false;
    let immediateStopped = false;
    const origPreventDefault = typeof event.preventDefault === 'function' ? event.preventDefault.bind(event) : null;
    Object.defineProperty(event, 'preventDefault', {
      value: () => {
        defaultPrevented = true;
        origPreventDefault?.();
      },
      configurable: true,
    });
    Object.defineProperty(event, 'stopPropagation', {
      value: () => { stopped = true; },
      configurable: true,
    });
    Object.defineProperty(event, 'stopImmediatePropagation', {
      value: () => { stopped = true; immediateStopped = true; },
      configurable: true,
    });
    Object.defineProperty(event, 'defaultPrevented', {
      get: () => defaultPrevented,
      configurable: true,
    });

    const setCurrentTarget = node => {
      Object.defineProperty(event, 'currentTarget', {
        value: node,
        configurable: true,
      });
    };

    const path = [];
    let cursor = this;
    while (cursor) {
      path.push(cursor);
      cursor = cursor.parentElement;
    }

    for (let i = path.length - 1; i >= 1 && !stopped; i--) {
      const entries = [...(path[i]._listeners.get(event.type) || [])].filter(item => item.capture);
      setCurrentTarget(path[i]);
      for (const entry of entries) {
        entry.listener.call(path[i], event);
        if (immediateStopped) break;
      }
    }

    if (!stopped) {
      const selfEntries = [...(this._listeners.get(event.type) || [])];
      setCurrentTarget(this);
      for (const entry of selfEntries) {
        entry.listener.call(this, event);
        if (immediateStopped) break;
      }
    }

    if (event.bubbles !== false) {
      for (let i = 1; i < path.length && !stopped; i++) {
        const entries = [...(path[i]._listeners.get(event.type) || [])].filter(item => !item.capture);
        setCurrentTarget(path[i]);
        for (const entry of entries) {
          entry.listener.call(path[i], event);
          if (immediateStopped) break;
        }
      }
    }

    return !defaultPrevented;
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click', bubbles: true, button: 0 });
  }

  focus() {
    if (!this.disabled && this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  getContext() {
    return null;
  }

  getBoundingClientRect() {
    return { width: 1280, height: 800, top: 0, left: 0, right: 1280, bottom: 800 };
  }
}

function parseAttributes(attrText, el) {
  const attrRegex = /([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = attrRegex.exec(attrText)) !== null) {
    const [, name, dq, sq, bare] = match;
    const val = dq ?? sq ?? bare ?? '';
    el.setAttribute(name, decodeEntities(val));
  }
}

function parseHtmlInto(rootEl, html, ownerDocument) {
  const tokenRegex = /<!--[\s\S]*?-->|<\/([A-Za-z0-9-]+)\s*>|<([A-Za-z0-9-]+)([^>]*?)(\/?)>|([^<]+)/g;
  const stack = [rootEl];
  let match;
  while ((match = tokenRegex.exec(html)) !== null) {
    const [, closeTag, openTag, attrText, selfClose, textChunk] = match;
    const current = stack[stack.length - 1];
    if (closeTag) {
      const upper = closeTag.toUpperCase();
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tagName === upper) {
          stack.length = i;
          break;
        }
      }
    } else if (openTag) {
      const lower = openTag.toLowerCase();
      const el = new SyntheticElement(openTag, ownerDocument);
      parseAttributes(attrText || '', el);
      current.append(el);
      if (!selfClose && !VOID_TAGS.has(lower)) {
        stack.push(el);
      }
    } else if (textChunk) {
      const decoded = decodeEntities(textChunk);
      if (current.children.length === 0) {
        current._text += decoded;
      }
    }
  }
}

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    },
  };
}

function createPlatformDomEnv({
  url = 'https://synk.im/account/platform.html',
  reducedMotion = false,
  sessionStorage = createMemoryStorage(),
  localStorage = createMemoryStorage(),
} = {}) {
  let nowMs = 1_800_000_000_000;
  let rafSeq = 0;
  const rafQueue = new Map();
  const winListeners = new Map();
  const docListeners = new Map();
  const navigations = [];
  const replacedUrls = [];

  const doc = {
    hidden: false,
    activeElement: null,
    documentElement: null,
    body: null,
    defaultView: null,
    createElement(tag) {
      return new SyntheticElement(tag, doc);
    },
    getElementById(id) {
      if (doc.body?.id === id) return doc.body;
      return doc.body?.querySelector(`#${id}`) || null;
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = docListeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    },
  };

  doc.documentElement = new SyntheticElement('HTML', doc);
  doc.body = new SyntheticElement('BODY', doc);
  doc.documentElement.append(doc.body);

  const portalRoot = new SyntheticElement('DIV', doc);
  portalRoot.id = 'portal-entry';
  portalRoot.dataset.portalActive = 'true';
  const mainEl = new SyntheticElement('MAIN', doc);
  mainEl.id = 'page-content';
  doc.body.append(portalRoot, mainEl);
  doc.activeElement = doc.body;

  let currentUrl = new URL(url);
  const locationObj = {
    get href() {
      return currentUrl.href;
    },
    set href(val) {
      currentUrl = new URL(val, currentUrl.href);
      navigations.push(currentUrl.href);
    },
    get hash() {
      return currentUrl.hash;
    },
    set hash(val) {
      const next = String(val || '');
      currentUrl.hash = next.startsWith('#') || next === '' ? next : `#${next}`;
    },
    assign(val) {
      currentUrl = new URL(val, currentUrl.href);
      navigations.push(currentUrl.href);
    },
    replace(val) {
      currentUrl = new URL(val, currentUrl.href);
      replacedUrls.push(currentUrl.href);
      navigations.push(currentUrl.href);
    },
  };

  const win = {
    document: doc,
    location: locationObj,
    sessionStorage,
    localStorage,
    crypto: webcrypto,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: {
      now: () => nowMs,
    },
    matchMedia(query) {
      if (query === '(prefers-reduced-motion: reduce)') {
        return { matches: reducedMotion };
      }
      return { matches: false };
    },
    requestAnimationFrame(cb) {
      const id = ++rafSeq;
      rafQueue.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      rafQueue.delete(id);
    },
    addEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push({ listener, capture });
    },
    removeEventListener(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const list = winListeners.get(type);
      if (!list) return;
      const idx = list.findIndex(item => item.listener === listener && item.capture === capture);
      if (idx !== -1) list.splice(idx, 1);
    },
  };
  doc.defaultView = win;

  function stepAnimationFrames(deltaMs = 400, maxFrames = 10) {
    let executed = 0;
    while (rafQueue.size > 0 && executed < maxFrames) {
      nowMs += deltaMs;
      const batch = [...rafQueue.entries()];
      rafQueue.clear();
      for (const [, fn] of batch) {
        fn(nowMs);
      }
      executed += 1;
    }
  }

  return {
    doc,
    win,
    portalRoot,
    mainEl,
    sessionStorage,
    localStorage,
    navigations,
    replacedUrls,
    now: () => nowMs,
    advanceNow(ms) {
      nowMs += ms;
    },
    stepAnimationFrames,
  };
}

class PortalIdElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.beforeNodes = [];
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.text = '';
    this.checked = false;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }

  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  removeAttribute(key) { delete this[key]; }
  closest() { return this; }
  before(node) { this.beforeNodes.push(node); }
  after() {}
  addEventListener() {}
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = String(value ?? ''); }
}

function createPortalClock(startMs = 1_800_000_000_000) {
  let now = startMs;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: now + (Number.isFinite(ms) && ms <= 2147483647 ? ms : 0), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      let next;
      while ((next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]) && next[1].at <= end) {
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

const flushMicrotasks = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
};

function buildTestConfig() {
  return readConfig({
    version: 1,
    supabaseUrl: 'https://auth.synk.example.test',
    supabasePublishableKey: 'sb_publishable_synthetic_public_key',
    accountApiUrl: 'https://auth.synk.example.test',
    portalUrl: 'https://synk.im/id/',
    messengerUrl: 'https://workspace.synk.im/',
    clients: {
      platform: {
        clientId: 'platform-web-client',
        redirectUri: 'https://synk.im/account/client.html?product=platform',
      },
    },
  }, 'https://synk.im/account/platform.html');
}

async function runCentralPortalConsentStep(t, {
  config,
  sessionStorage,
  localStorage,
  initialSession,
  verifiedUser = initialSession?.user || null,
  consentDetails,
  nowMs = 1_800_000_000_500,
  accountResponse = null,
  onAuthorizationLookup,
}) {
  const ids = new Map();
  const events = new Map();
  const calls = [];
  const destinations = [];
  const modes = ['login', 'signup', 'recover'].map(value =>
    Object.assign(new PortalIdElement('button'), { dataset: { view: value } }),
  );
  const get = id => {
    if (!ids.has(id)) ids.set(id, new PortalIdElement());
    return ids.get(id);
  };
  for (const id of ['auth-panel', 'consent', 'account', 'setup', 'signup-choices', 'consent-switch', 'consent-switch-note']) {
    get(id).hidden = true;
  }
  get('signup-age').checked = true;
  get('signup-learning').checked = true;

  const doc = {
    documentElement: { dataset: {} },
    body: new PortalIdElement('body'),
    getElementById: get,
    createElement: tag => new PortalIdElement(tag),
    querySelectorAll: () => modes,
  };
  if (onAuthorizationLookup) {
    doc.documentElement.dataset.platformPortalBoot = 'true';
    for (const id of ['connection-restart', 'account-profile', 'account-security', 'google-onboarding']) {
      get(id).hidden = true;
    }
  }
  let savedSession = initialSession;
  let authListener = null;
  const clock = createPortalClock(nowMs);

  const savedGlobals = ['document', 'window', 'location', 'fetch'].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  const locationObj = {
    href: 'https://synk.im/id/?authorization_id=authz-returning-001',
    assign(url) {
      destinations.push(url);
    },
    reload() {},
  };

  Object.assign(globalThis, {
    document: doc,
    window: {
      sessionStorage,
      localStorage,
      addEventListener(type, fn) { events.set(type, fn); },
      removeEventListener(type, fn) { if (events.get(type) === fn) events.delete(type); },
      history: {
        state: null,
        replaceState(_state, _title, url) { locationObj.href = url; },
      },
    },
    location: locationObj,
    fetch: async url => {
      const parsed = new URL(url);
      if (parsed.pathname === '/functions/v1/synk-account' && parsed.searchParams.get('view') === 'registration') {
        return new Response(JSON.stringify({
          ok: true,
          registration: { required: false },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected fetch in synthetic portal test: ${url}`);
    },
  });

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    events.get('pagehide')?.({});
    for (const [key, desc] of savedGlobals) {
      if (desc) Object.defineProperty(globalThis, key, desc);
      else delete globalThis[key];
    }
  };
  t.after(cleanup);

  const sdk = {
    auth: {
      initialize: async () => ({ error: null }),
      getSession: async () => ({ data: { session: savedSession }, error: null }),
      getUser: async () => ({ data: { user: verifiedUser }, error: null }),
      onAuthStateChange(fn) { authListener = fn; return {}; },
      async signOut(args) {
        calls.push({ method: 'signOut', args });
        savedSession = null;
        return { error: null };
      },
      signInWithOAuth: async args => { calls.push({ method: 'signInWithOAuth', args }); return { data: {}, error: null }; },
      signUp: async args => { calls.push({ method: 'signUp', args }); return { data: {}, error: null }; },
      signInWithPassword: async args => { calls.push({ method: 'signInWithPassword', args }); return { data: {}, error: null }; },
      oauth: {
        getAuthorizationDetails: async () => {
          onAuthorizationLookup?.(doc.body.dataset.platformContext);
          return { data: consentDetails, error: null };
        },
        approveAuthorization: async (id, opts) => {
          calls.push({ method: 'approveAuthorization', id, opts });
          return { data: { redirect_url: consentDetails.approveRedirectUrl }, error: null };
        },
        denyAuthorization: async (id, opts) => {
          calls.push({ method: 'denyAuthorization', id, opts });
          const denyUrl = new URL(config.clients.platform.redirectUri);
          denyUrl.searchParams.set('error', 'access_denied');
          if (consentDetails.state) denyUrl.searchParams.set('state', consentDetails.state);
          return { data: { redirect_url: denyUrl.href }, error: null };
        },
      },
    },
  };

  await mountPortal({
    config,
    sdk,
    preview: false,
    cooldownClock: clock,
    ...(accountResponse ? {
      accountFactory: () => ({
        load: async () => accountResponse,
        revokeAll: async () => ({ refreshRevoked: true, legacyAccessGuard: true }),
        revokeSession: async () => ({ refreshRevoked: true }),
      }),
    } : {}),
  });

  return {
    get,
    calls,
    destinations,
    clock,
    authListener,
    cleanup,
  };
}

test('기존 유효 중앙 Google/SYNK ID 로그인 사용자는 새 탭에서 원이 자동 확대된 뒤 배정 작업으로 바로 진입한다', async t => {
  const config = buildTestConfig();
  const centralSubject = '11111111-2222-4333-8444-555555555555';
  const localStorage = createMemoryStorage();
  const newTabSessionStorage = createMemoryStorage();
  const registrationCalls = [];

  const centralUser = {
    id: centralSubject,
    email: 'yuho@synk.example.test',
    identities: [{ provider: 'google' }],
  };

  const dom1 = createPlatformDomEnv({
    url: 'https://synk.im/account/platform.html',
    reducedMotion: false,
    sessionStorage: newTabSessionStorage,
    localStorage,
  });

  let accountRef = null;
  const host1 = mountWebPortalHost({
    root: dom1.portalRoot,
    getConfig: () => config,
    getAccount: () => accountRef,
    getStartupState: () => accountRef?.identity() || { status: 'loading' },
    getSessionStorage: () => newTabSessionStorage,
    getLocalStorage: () => localStorage,
    cryptoRef: webcrypto,
    nowFn: dom1.now,
  });

  // 새 탭 초기 상태는 검정 구 한 개(welcome)이며 내부 패널은 숨겨져 있다.
  assert.equal(host1.getState().phase, 'welcome');
  assert.equal(dom1.portalRoot.querySelector('[data-portal-interior]').hidden, true);

  accountRef = createPlatformAccount({
    config,
    storage: newTabSessionStorage,
    fetcher: async () => { throw new Error('플랫폼 탭 세션이 없으므로 호출되면 안 됨'); },
    onStatus: () => host1.syncAccountState(),
  });
  await accountRef.refresh();
  assert.equal(accountRef.identity().status, 'signed-out');
  assert.equal(host1.canAutoResumeCentralSession(), true);

  const probe = await probeCentralPlatformSession({
    config,
    sessionStorageRef: newTabSessionStorage,
    localStorageRef: localStorage,
    createSdk: () => ({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'central-jwt-do-not-persist',
              refresh_token: 'central-refresh-do-not-persist',
              user: centralUser,
            },
          },
          error: null,
        }),
        getUser: async () => ({ data: { user: centralUser }, error: null }),
      },
    }),
    fetchFn: async (url, options) => {
      registrationCalls.push({ url, headers: options.headers });
      return new Response(JSON.stringify({
        ok: true,
        registration: { required: false },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  assert.equal(probe.ok, true);
  assert.equal(probe.subject, centralSubject);
  assert.equal('access_token' in probe, false);
  assert.equal(registrationCalls.length, 1);

  const resumed = await host1.resumeCentralSession({ subject: probe.subject });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.method, PLATFORM_RESUME_METHOD);
  assert.equal(dom1.replacedUrls.length, 1);
  assert.equal(hasPlatformAutoLoginAttempt(newTabSessionStorage), true);

  const authorizeUrl = new URL(dom1.replacedUrls[0]);
  assert.equal(authorizeUrl.pathname, '/auth/v1/oauth/authorize');
  assert.equal(authorizeUrl.searchParams.has('access_token'), false);
  assert.equal(authorizeUrl.searchParams.has('refresh_token'), false);

  const stateParam = authorizeUrl.searchParams.get('state');
  assert.ok(stateParam);
  host1.dispose();

  // 중앙 /id/ 동의 단계: 사전 승인된 플랫폼 클라이언트 + 동일 중앙 계정이면 멈춤 없이 즉시 코드 콜백으로 이동한다.
  const callbackTarget = new URL(config.clients.platform.redirectUri);
  callbackTarget.searchParams.set('code', 'oauth-pkce-code-returning');
  callbackTarget.searchParams.set('state', stateParam);

  const centralStep = await runCentralPortalConsentStep(t, {
    config,
    sessionStorage: newTabSessionStorage,
    localStorage,
    initialSession: {
      access_token: 'central-jwt-do-not-persist',
      user: centralUser,
    },
    verifiedUser: centralUser,
    consentDetails: {
      redirect_url: callbackTarget.href,
      user: { id: centralSubject },
    },
  });

  assert.deepEqual(centralStep.destinations, [callbackTarget.href]);
  assert.equal(centralStep.get('consent').hidden, true);

  // client.html 콜백 소비 및 탭 전용 세션 발급
  const callbackIntent = platformCallbackIntent({
    storage: newTabSessionStorage,
    url: callbackTarget.href,
    product: 'platform',
    config,
    now: dom1.now() + 1000,
  });
  assert.ok(callbackIntent);
  assert.equal(callbackIntent.method, PLATFORM_RESUME_METHOD);

  const exchangeParams = consumeCallback({
    config,
    product: 'platform',
    url: callbackTarget.href,
    storage: newTabSessionStorage,
    now: dom1.now() + 1000,
  });
  assert.equal(exchangeParams.grant_type, 'authorization_code');
  assert.equal(exchangeParams.code, 'oauth-pkce-code-returning');

  const platformTabSession = {
    access_token: 'platform-tab-only-access',
    refresh_token: 'platform-tab-only-refresh',
    token_type: 'bearer',
  };
  newTabSessionStorage.setItem('synk.oauth.session.platform', JSON.stringify(platformTabSession));
  const returnDestination = finishPlatformLogin(newTabSessionStorage, callbackIntent, {
    now: dom1.now() + 1000,
  });
  assert.equal(returnDestination, './platform.html#home');
  assert.equal(newTabSessionStorage.getItem(PLATFORM_LOGIN_INTENT), null);
  assert.equal(newTabSessionStorage.getItem(PLATFORM_RESUME_SUBJECT_KEY), null);

  // 플랫폼 복귀 후: 검정 구가 자동으로 확대(zooming)된 뒤 배정 작업(Workspace)으로 바로 진입한다.
  const openedDestinations = [];
  let finishDestinationLookup;
  const destinationLookup = new Promise(resolve => { finishDestinationLookup = resolve; });
  const dom2 = createPlatformDomEnv({
    url: 'https://synk.im/account/platform.html#home',
    reducedMotion: false,
    sessionStorage: newTabSessionStorage,
    localStorage,
  });

  let returnedAccount = null;
  const host2 = mountWebPortalHost({
    root: dom2.portalRoot,
    getConfig: () => config,
    getAccount: () => returnedAccount,
    getStartupState: () => returnedAccount?.identity() || { status: 'loading' },
    getSessionStorage: () => newTabSessionStorage,
    getLocalStorage: () => localStorage,
    cryptoRef: webcrypto,
    nowFn: dom2.now,
    companyBoundaries: {
      resolveAssignedDestination: () => destinationLookup,
      openAssignedDestination: async dest => {
        openedDestinations.push(dest);
        return { ok: true, destination: dest, navigationRequested: true };
      },
    },
  });

  returnedAccount = createPlatformAccount({
    config,
    storage: newTabSessionStorage,
    fetcher: async () => new Response(JSON.stringify({
      ok: true,
      account: {
        synk_user_id: centralSubject,
        display_name: '유호',
        status: 'active',
        purpose_onboarding: { status: 'completed', reason: 'chosen' },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
    onStatus: () => host2.syncAccountState(),
  });

  await returnedAccount.refresh();
  assert.equal(returnedAccount.identity().status, 'signed-in');
  // 구를 누르지 않아도 자동으로 zooming 단계에 진입한다.
  assert.equal(host2.getState().phase, 'zooming');

  dom2.stepAnimationFrames(Math.ceil(PORTAL_DURATION_MS / 2) + 50, 6);
  await flushMicrotasks();

  // 배정을 기다리는 동안에도 구만 보인다. 응답 전에는 작업을 열지 않는다.
  assert.equal(dom2.portalRoot.querySelector('[data-portal-pane="welcome"]').hidden, false);
  assert.equal(dom2.portalRoot.querySelector('[data-portal-interior]').hidden, true);
  assert.deepEqual(openedDestinations, []);
  finishDestinationLookup({
    ok: true,
    result: { status: 'resolved', destinations: ['/'], unavailable: [] },
  });
  await flushMicrotasks();
  assert.deepEqual(openedDestinations, ['/']);

  // 목적지의 첫 응답이 늦어도 출발 문서에 예전 홈이 한 프레임이라도 드러나지 않는다.
  assert.equal(host2.getState().phase, 'entered');
  assert.equal(dom2.portalRoot.hidden, false);
  assert.equal(dom2.portalRoot.querySelector('[data-portal-pane="welcome"]').hidden, false);
  assert.equal(dom2.portalRoot.querySelector('[data-portal-interior]').hidden, true);

  // 뒤로 돌아와 이 문서를 복원하면 떠나는 동안 유지하던 구를 해제한다.
  host2.handlePageShow({ persisted: true });
  assert.equal(dom2.portalRoot.hidden, true);

  // localStorage에는 어떤 토큰도 새로 저장되지 않아야 한다.
  const persistedLocal = JSON.stringify(localStorage.snapshot());
  assert.equal(persistedLocal.includes('central-jwt-do-not-persist'), false);
  assert.equal(persistedLocal.includes('platform-tab-only-access'), false);
  assert.equal(persistedLocal.includes('refresh'), false);

  host2.dispose();
});

test('중앙 ID에 플랫폼 도착 주소만 등록된 운영 설정에서도 자동 복귀를 확인하는 동안 구를 유지한다', async t => {
  const config = buildTestConfig();
  const { clientId, redirectUri } = config.clients.platform;
  const sessionStorage = createMemoryStorage();
  const now = 1_800_000_000_000;
  const subject = '11111111-2222-4333-8444-555555555555';
  const authorization = await beginOAuth({ config, product: 'platform', storage: sessionStorage, now, cryptoAPI: webcrypto });
  const state = new URL(authorization).searchParams.get('state');
  rememberPlatformLogin(sessionStorage, { config, method: PLATFORM_RESUME_METHOD, subject, returnHash: '#home', now });
  const callback = new URL(redirectUri);
  callback.searchParams.set('code', 'fixture-return-code');
  callback.searchParams.set('state', state);
  const stages = [];
  const result = await runCentralPortalConsentStep(t, {
    config: {
      ...config,
      clients: { ...config.clients, platform: { clientId: '', redirectUri: '' } },
      authorizationClients: [{ product: 'platform', clientId, redirectUris: [redirectUri] }],
    },
    sessionStorage,
    localStorage: createMemoryStorage(),
    initialSession: { access_token: 'fixture-session', user: { id: subject, email: 'member@example.test' } },
    consentDetails: { redirect_url: callback.href, user: { id: subject } },
    onAuthorizationLookup: stage => stages.push(stage),
  });
  assert.deepEqual(stages, ['boot']);
  assert.deepEqual(result.destinations, [callback.href]);
});

test('비로그인 손님은 recent-login 표시가 남아 있어도 외부 요청이나 리디렉션 없이 검정 구 첫 화면과 신규 로그인·초대 흐름을 유지한다', async () => {
  const config = buildTestConfig();
  const localStorage = createMemoryStorage({
    // localStorage 로그인 힌트가 있어도 인증으로 절대 취급하면 안 된다.
    'synk.id.recent-login.v1': JSON.stringify({
      version: 1,
      realm: '/id/',
      method: 'google',
      masked: 'yu***@synk.im',
      at: 1_800_000_000_000,
    }),
  });
  const sessionStorage = createMemoryStorage();
  let getUserCalled = 0;
  let fetchCalled = 0;

  const probe = await probeCentralPlatformSession({
    config,
    sessionStorageRef: sessionStorage,
    localStorageRef: localStorage,
    createSdk: () => ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => {
          getUserCalled += 1;
          return { data: { user: null }, error: null };
        },
      },
    }),
    fetchFn: async () => {
      fetchCalled += 1;
      throw new Error('손님에게 네트워크 호출이 발생하면 안 됨');
    },
  });

  assert.equal(probe.ok, false);
  assert.equal(probe.reason, 'signed-out');
  assert.equal(getUserCalled, 0);
  assert.equal(fetchCalled, 0);
  // 실제 리디렉션 시도를 하지 않았으므로 같은 탭에서 나중에 로그인 후 돌아와도 막히지 않는다.
  assert.equal(hasPlatformAutoLoginAttempt(sessionStorage), false);

  const dom = createPlatformDomEnv({
    sessionStorage,
    localStorage,
  });
  const account = {
    identity: () => ({ configured: true, signedIn: false, status: 'signed-out', accountGeneration: 1 }),
  };
  const host = mountWebPortalHost({
    root: dom.portalRoot,
    getConfig: () => config,
    getAccount: () => account,
    getStartupState: () => account.identity(),
    getSessionStorage: () => sessionStorage,
    getLocalStorage: () => localStorage,
    cryptoRef: webcrypto,
    nowFn: dom.now,
  });
  host.syncAccountState();

  assert.equal(host.getState().phase, 'welcome');
  assert.equal(dom.navigations.length, 0);

  // 손님이 구를 누르면 기존 로그인/초대코드 화면이 그대로 열린다.
  dom.portalRoot.querySelector('[data-portal-action="orb"]').click();
  dom.stepAnimationFrames(PORTAL_DURATION_MS + 100, 4);
  assert.equal(host.getState().phase, 'auth');

  dom.portalRoot.querySelector('[data-portal-action="open-invite"]').click();
  assert.equal(host.getState().phase, 'invite');

  dom.portalRoot.querySelector('[data-portal-action="close-invite"]').click();
  assert.equal(host.getState().phase, 'auth');

  dom.portalRoot.querySelector('[data-portal-action="google"]').click();
  await flushMicrotasks();
  assert.equal(dom.navigations.length, 1);
  const manualAuthorize = new URL(dom.navigations[0]);
  assert.equal(manualAuthorize.pathname, '/auth/v1/oauth/authorize');
  const savedIntent = JSON.parse(sessionStorage.getItem(PLATFORM_LOGIN_INTENT));
  assert.equal(savedIntent.method, 'google');

  host.dispose();
});

test('자동 복귀(resumeCentralSession) 대기 중 사용자가 수동 Google/이메일 로그인을 시작하면 늦게 끝난 자동 시도가 새 PKCE 상태를 지우지 않는다', async () => {
  const config = buildTestConfig();
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  const dom = createPlatformDomEnv({
    sessionStorage,
    localStorage,
  });

  let releaseStaleAutoBegin = null;
  const staleAutoGate = new Promise(resolve => {
    releaseStaleAutoBegin = resolve;
  });

  let beginCallCount = 0;
  const customBeginOAuth = async opts => {
    beginCallCount += 1;
    if (beginCallCount === 1) {
      // 첫 번째 호출(자동 복귀)이 비동기 대기하는 사이 사용자가 수동 Google 로그인을 시작한다.
      await staleAutoGate;
    }
    return beginOAuth({ ...opts, cryptoAPI: webcrypto });
  };

  const account = {
    identity: () => ({ configured: true, signedIn: false, status: 'signed-out', accountGeneration: 1 }),
  };

  const host = mountWebPortalHost({
    root: dom.portalRoot,
    getConfig: () => config,
    getAccount: () => account,
    getStartupState: () => account.identity(),
    getSessionStorage: () => sessionStorage,
    getLocalStorage: () => localStorage,
    cryptoRef: webcrypto,
    beginOAuthFn: customBeginOAuth,
    nowFn: dom.now,
  });
  host.syncAccountState();

  const pendingAutoResume = host.resumeCentralSession({
    subject: '22222222-3333-4444-8555-666666666666',
  });

  // 자동 복귀의 beginOAuth가 끝나기 전에 사용자가 구를 열고 Google 로그인을 누른다.
  dom.portalRoot.querySelector('[data-portal-action="orb"]').click();
  dom.stepAnimationFrames(PORTAL_DURATION_MS + 100, 4);
  assert.equal(host.getState().phase, 'auth');

  dom.portalRoot.querySelector('[data-portal-action="google"]').click();
  await flushMicrotasks();

  // 수동 Google PKCE 요청과 의도가 기록되고 이동했음을 확인한다.
  assert.equal(dom.navigations.length, 1);
  const manualPendingBefore = sessionStorage.getItem('synk.oauth.pending.platform');
  const manualIntentBefore = sessionStorage.getItem(PLATFORM_LOGIN_INTENT);
  assert.ok(manualPendingBefore);
  assert.ok(manualIntentBefore);
  assert.equal(JSON.parse(manualIntentBefore).method, 'google');

  // 이제 늦게 끝난 stale 자동 복귀를 풀어 준다.
  releaseStaleAutoBegin();
  const staleOutcome = await pendingAutoResume;

  assert.equal(staleOutcome.ok, false);
  assert.equal(staleOutcome.code, 'AUTH_CANCELLED');
  // 새 소유자인 수동 Google PKCE 상태가 절대 지워지거나 덮어써지면 안 된다.
  assert.equal(sessionStorage.getItem('synk.oauth.pending.platform'), manualPendingBefore);
  assert.equal(sessionStorage.getItem(PLATFORM_LOGIN_INTENT), manualIntentBefore);
  assert.equal(sessionStorage.getItem(PLATFORM_RESUME_SUBJECT_KEY), null);
  assert.equal(dom.replacedUrls.length, 0);
  assert.equal(dom.navigations.length, 1);

  host.dispose();
});

test('최초 미승인 권한동의 및 중간 계정 변경 시 자동 승인하지 않고 동의·계정 선택 카드를 띄우며, 취소·계정 전환·명시적 로그아웃을 보존한다', async t => {
  const config = buildTestConfig();
  const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@synk.example.test' };
  const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@synk.example.test' };

  // 1) 미승인 최초 연결(redirect_url 없음): 자동 승인하지 않고 권한동의·계정 전환 카드 표시
  {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage();
    await beginOAuth({ config, product: 'platform', storage: sessionStorage, now: 1_800_000_000_000, cryptoAPI: webcrypto });
    const intent = rememberPlatformLogin(sessionStorage, {
      config,
      method: PLATFORM_RESUME_METHOD,
      subject: userA.id,
      returnHash: '#solio',
      now: 1_800_000_000_000,
    });

    const step = await runCentralPortalConsentStep(t, {
      config,
      sessionStorage,
      localStorage,
      initialSession: { access_token: 'token-a', user: userA },
      verifiedUser: userA,
      consentDetails: {
        client: { id: config.clients.platform.clientId, name: 'SYNK 플랫폼' },
        redirect_uri: config.clients.platform.redirectUri,
        scope: 'openid email profile',
        state: intent.state,
      },
    });

    assert.equal(step.destinations.length, 0);
    assert.equal(step.get('consent').hidden, false);
    assert.equal(step.get('consent-switch').hidden, false);

    // 동의 카드에서 「취소」를 누르면 억제 마커를 기록하고, 플랫폼 복귀 시 에러 창 없이 손님 화면으로 돌아간다.
    await step.get('deny').onclick();
    await flushMicrotasks();
    assert.equal(isPlatformAutoLoginPaused(localStorage), true);
    assert.equal(step.destinations.length, 1);

    const errIntent = platformErrorCallbackIntent({
      storage: sessionStorage,
      url: step.destinations[0],
      product: 'platform',
      config,
      now: 1_800_000_001_000,
    });
    assert.ok(errIntent);
    const errDest = finishPlatformErrorReturn(sessionStorage, errIntent, { now: 1_800_000_001_000 });
    assert.equal(errDest, './platform.html#solio');
    assert.equal(takePlatformLoginNotice(sessionStorage, { now: 1_800_000_001_000 }), null);

    // 억제된 동안 새 탭에서도 자동 복귀하지 않는다.
    const nextTabProbe = await probeCentralPlatformSession({
      config,
      sessionStorageRef: createMemoryStorage(),
      localStorageRef: localStorage,
      createSdk: () => { throw new Error('억제 상태에서는 SDK를 호출하지 않아야 함'); },
    });
    assert.equal(nextTabProbe.ok, false);
    assert.equal(nextTabProbe.reason, 'paused');

    // 이후 명시적 로그인 성공 시 억제가 해제된다.
    clearPlatformAutoLoginPause(localStorage);
    assert.equal(isPlatformAutoLoginPaused(localStorage), false);
    step.cleanup();
  }

  // 2) 사전 승인 클라이언트라 해도 그사이 중앙 계정이 userB로 바뀌었으면 자동 이동하지 않고 계정 확인/전환 카드를 표시한다.
  {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage();
    await beginOAuth({ config, product: 'platform', storage: sessionStorage, now: 1_800_000_000_000, cryptoAPI: webcrypto });
    const intent = rememberPlatformLogin(sessionStorage, {
      config,
      method: PLATFORM_RESUME_METHOD,
      subject: userA.id,
      returnHash: '#home',
      now: 1_800_000_000_000,
    });
    const preauthTarget = new URL(config.clients.platform.redirectUri);
    preauthTarget.searchParams.set('code', 'preauth-code-user-b');
    preauthTarget.searchParams.set('state', intent.state);

    const step = await runCentralPortalConsentStep(t, {
      config,
      sessionStorage,
      localStorage,
      initialSession: { access_token: 'token-b', user: userB },
      verifiedUser: userB,
      consentDetails: {
        redirect_url: preauthTarget.href,
        user: { id: userB.id },
      },
    });

    assert.equal(step.destinations.length, 0);
    assert.equal(step.get('consent').hidden, false);
    assert.equal(step.get('consent-switch').hidden, false);

    // 여기서 「다른 계정으로 로그인」을 누르면 중앙 세션 로그아웃 후 플랫폼 로그인 선택 화면 안내가 남는다.
    await step.get('consent-switch').onclick();
    await flushMicrotasks();
    assert.equal(step.calls.some(call => call.method === 'signOut'), true);
    assert.equal(step.destinations.length, 1);

    const switchErr = platformErrorCallbackIntent({
      storage: sessionStorage,
      url: step.destinations[0],
      product: 'platform',
      config,
      now: 1_800_000_001_000,
    });
    assert.ok(switchErr);
    finishPlatformErrorReturn(sessionStorage, switchErr, { now: 1_800_000_001_000 });
    const notice = takePlatformLoginNotice(sessionStorage, { now: 1_800_000_001_000 });
    assert.equal(notice?.kind, 'cancelled');
  }

  // 3) 플랫폼 개별 로그아웃(pausePlatformAutoLogin) 및 포털 onSwitchAccount 보존
  {
    const localStorage = createMemoryStorage();
    pausePlatformAutoLogin(localStorage);
    assert.equal(localStorage.getItem(PLATFORM_AUTO_LOGIN_PAUSE_KEY) !== null, true);

    const probeAfterLogout = await probeCentralPlatformSession({
      config,
      sessionStorageRef: createMemoryStorage(),
      localStorageRef: localStorage,
      createSdk: () => ({
        auth: {
          getSession: async () => ({
            data: { session: { access_token: 'still-central', user: userA } },
            error: null,
          }),
          getUser: async () => ({ data: { user: userA }, error: null }),
        },
      }),
    });
    assert.equal(probeAfterLogout.ok, false);
    assert.equal(probeAfterLogout.reason, 'paused');
  }
});

test('오프라인·서버 오류·미완료 Google 가입·복귀 중 로그아웃·반복 루프 상황에서도 손님 화면으로 안전하게 폴백한다', async t => {
  const config = buildTestConfig();
  const centralSubject = '77777777-8888-4999-8000-111111111111';

  // 1) 오프라인 / getUser 실패 시 중앙 저장소를 건드리지 않고 unverified 반환
  const offlineLocal = createMemoryStorage({ 'sb-central-session': '{"keep":true}' });
  const offlineProbe = await probeCentralPlatformSession({
    config,
    sessionStorageRef: createMemoryStorage(),
    localStorageRef: offlineLocal,
    createSdk: () => ({
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'tok', user: { id: centralSubject } } },
          error: null,
        }),
        getUser: async () => { throw new Error('Failed to fetch'); },
      },
    }),
  });
  assert.equal(offlineProbe.ok, false);
  assert.equal(offlineProbe.reason, 'unverified');
  assert.equal(offlineLocal.getItem('sb-central-session'), '{"keep":true}');

  // 2) 미완료 Google 가입(registration.required === true)은 자동 연결하지 않음
  const incompleteGoogleProbe = await probeCentralPlatformSession({
    config,
    sessionStorageRef: createMemoryStorage(),
    localStorageRef: createMemoryStorage(),
    createSdk: () => ({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'tok-google',
              user: { id: centralSubject, identities: [{ provider: 'google' }] },
            },
          },
          error: null,
        }),
        getUser: async () => ({
          data: { user: { id: centralSubject, identities: [{ provider: 'google' }] } },
          error: null,
        }),
      },
    }),
    fetchFn: async () => new Response(JSON.stringify({
      ok: true,
      registration: { required: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  assert.equal(incompleteGoogleProbe.ok, false);
  assert.equal(incompleteGoogleProbe.reason, 'registration-incomplete');

  // 3) 자동 복귀로 /id/에 도착했는데 그사이 중앙 세션이 사라진 경우: /id/ 로그인 창에 멈추지 않고 즉시 플랫폼 손님 화면으로 복귀하며 재시도 루프를 막는다.
  const loopSessionStorage = createMemoryStorage();
  const loopLocalStorage = createMemoryStorage();
  const dom = createPlatformDomEnv({
    sessionStorage: loopSessionStorage,
    localStorage: loopLocalStorage,
  });
  const account = {
    identity: () => ({ configured: true, signedIn: false, status: 'signed-out', accountGeneration: 1 }),
  };
  const host = mountWebPortalHost({
    root: dom.portalRoot,
    getConfig: () => config,
    getAccount: () => account,
    getStartupState: () => account.identity(),
    getSessionStorage: () => loopSessionStorage,
    getLocalStorage: () => loopLocalStorage,
    cryptoRef: webcrypto,
    nowFn: dom.now,
  });
  host.syncAccountState();

  const started = await host.resumeCentralSession({ subject: centralSubject });
  assert.equal(started.ok, true);
  assert.equal(loopSessionStorage.getItem(PLATFORM_AUTO_LOGIN_ATTEMPT_KEY) !== null, true);
  host.dispose();

  const signedOutCentralStep = await runCentralPortalConsentStep(t, {
    config,
    sessionStorage: loopSessionStorage,
    localStorage: loopLocalStorage,
    initialSession: null,
    verifiedUser: null,
    consentDetails: {},
  });

  // /id/ 로그인 폼에 가두지 않고 취소 콜백으로 즉시 복귀시킨다.
  assert.equal(signedOutCentralStep.destinations.length, 1);
  const cancelCallback = signedOutCentralStep.destinations[0];
  const parsedErr = platformErrorCallbackIntent({
    storage: loopSessionStorage,
    url: cancelCallback,
    product: 'platform',
    config,
    now: dom.now() + 500,
  });
  assert.ok(parsedErr);
  const returnedPath = finishPlatformErrorReturn(loopSessionStorage, parsedErr, { now: dom.now() + 500 });
  assert.equal(returnedPath, './platform.html#home');
  assert.equal(loopSessionStorage.getItem(PLATFORM_LOGIN_NOTICE), null);

  // 복귀한 같은 탭에서는 시도 기록이 남아 있어 두 번째 자동 복귀 루프가 절대 돌지 않는다.
  const secondProbeSameTab = await probeCentralPlatformSession({
    config,
    sessionStorageRef: loopSessionStorage,
    localStorageRef: loopLocalStorage,
    createSdk: () => { throw new Error('같은 탭 재진입 시 SDK가 다시 호출되면 안 됨'); },
  });
  assert.equal(secondProbeSameTab.ok, false);
  assert.equal(secondProbeSameTab.reason, 'already-handled');
});

test('일반 첫 페이지 pageshow({ persisted: false })가 중앙 세션 검증 전·도중에 끼어들어도 자동 복귀와 수동 로그인을 지우지 않으며, BFCache·알림·명시적 호출 안전 동작은 보존한다', async () => {
  const config = buildTestConfig();
  const centralSubject = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
  const centralUser = {
    id: centralSubject,
    email: 'returning-pageshow@synk.example.test',
    identities: [{ provider: 'google' }],
  };

  // 1) 일반 초기 pageshow({ persisted: false })가 central probe 전 및 /auth/v1/user(188ms)·registration(360ms) 도중 끼어드는 실제 지연 재현
  {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const dom = createPlatformDomEnv({
      url: 'https://synk.im/account/platform.html',
      reducedMotion: false,
      sessionStorage,
      localStorage,
    });

    let accountRef = null;
    const host = mountWebPortalHost({
      root: dom.portalRoot,
      getConfig: () => config,
      getAccount: () => accountRef,
      getStartupState: () => accountRef?.identity() || { status: 'loading' },
      getSessionStorage: () => sessionStorage,
      getLocalStorage: () => localStorage,
      cryptoRef: webcrypto,
      beginOAuthFn: async opts => {
        // beginOAuth 도중 초기 pageshow가 한 번 더 들어와도 취소되지 않아야 한다.
        host.handlePageShow({ persisted: false });
        return beginOAuth({ ...opts, cryptoAPI: webcrypto });
      },
      nowFn: dom.now,
    });

    accountRef = createPlatformAccount({
      config,
      storage: sessionStorage,
      fetcher: async () => { throw new Error('플랫폼 탭 세션이 없으므로 호출되면 안 됨'); },
      onStatus: () => host.syncAccountState(),
    });
    await accountRef.refresh();
    assert.equal(host.canAutoResumeCentralSession(), true);

    // probe 시작 전 일반 초기 pageshow
    host.handlePageShow({ persisted: false });
    assert.equal(host.canAutoResumeCentralSession(), true);

    const probe = await probeCentralPlatformSession({
      config,
      sessionStorageRef: sessionStorage,
      localStorageRef: localStorage,
      createSdk: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: 'central-jwt-pageshow',
                refresh_token: 'central-refresh-pageshow',
                user: centralUser,
              },
            },
            error: null,
          }),
          getUser: async () => {
            dom.advanceNow(188);
            await flushMicrotasks(2);
            // /auth/v1/user 응답 직후, registration 조회 도중 일반 초기 pageshow 발생
            host.handlePageShow({ persisted: false });
            return { data: { user: centralUser }, error: null };
          },
        },
      }),
      fetchFn: async () => {
        dom.advanceNow(360);
        await flushMicrotasks(2);
        host.handlePageShow({ persisted: false });
        return new Response(JSON.stringify({
          ok: true,
          registration: { required: false },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    assert.equal(probe.ok, true);
    assert.equal(host.canAutoResumeCentralSession(), true);

    const resumed = await host.resumeCentralSession({ subject: probe.subject });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.method, PLATFORM_RESUME_METHOD);
    assert.equal(dom.replacedUrls.length, 1);
    assert.equal(new URL(dom.replacedUrls[0]).pathname, '/auth/v1/oauth/authorize');
    assert.ok(sessionStorage.getItem('synk.oauth.pending.platform'));
    assert.ok(sessionStorage.getItem(PLATFORM_LOGIN_INTENT));
    host.dispose();
  }

  // 2) 수동 로그인 진행 중 일반 초기 pageshow({ persisted: false })는 PKCE 상태와 signing-in 단계를 지우지 않고, 실제 BFCache({ persisted: true })는 정리 후 로그인 창을 다시 연다.
  {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const dom = createPlatformDomEnv({
      sessionStorage,
      localStorage,
    });
    const account = {
      identity: () => ({ configured: true, signedIn: false, status: 'signed-out', accountGeneration: 1 }),
    };

    let releaseManualBegin = null;
    const manualGate = new Promise(resolve => {
      releaseManualBegin = resolve;
    });
    const host = mountWebPortalHost({
      root: dom.portalRoot,
      getConfig: () => config,
      getAccount: () => account,
      getStartupState: () => account.identity(),
      getSessionStorage: () => sessionStorage,
      getLocalStorage: () => localStorage,
      cryptoRef: webcrypto,
      beginOAuthFn: async opts => {
        await manualGate;
        return beginOAuth({ ...opts, cryptoAPI: webcrypto });
      },
      nowFn: dom.now,
    });
    host.syncAccountState();

    dom.portalRoot.querySelector('[data-portal-action="orb"]').click();
    dom.stepAnimationFrames(PORTAL_DURATION_MS + 100, 4);
    assert.equal(host.getState().phase, 'auth');

    dom.portalRoot.querySelector('[data-portal-action="google"]').click();
    await flushMicrotasks(2);
    assert.equal(host.getState().phase, 'signing-in');

    // beginOAuth 비동기 대기 도중 초기 pageshow({ persisted: false }) 발생
    host.handlePageShow({ persisted: false });
    releaseManualBegin();
    await flushMicrotasks();

    assert.equal(dom.navigations.length, 1);
    const pendingPkce = sessionStorage.getItem('synk.oauth.pending.platform');
    const savedIntent = sessionStorage.getItem(PLATFORM_LOGIN_INTENT);
    assert.ok(pendingPkce);
    assert.ok(savedIntent);
    assert.equal(host.getState().phase, 'signing-in');

    // 이동 직전 초기 pageshow({ persisted: false })가 도착해도 수동 PKCE 상태를 지우지 않는다.
    host.handlePageShow({ persisted: false });
    assert.equal(sessionStorage.getItem('synk.oauth.pending.platform'), pendingPkce);
    assert.equal(sessionStorage.getItem(PLATFORM_LOGIN_INTENT), savedIntent);
    assert.equal(host.getState().phase, 'signing-in');

    // 반면 실제 BFCache 복귀({ persisted: true })는 대기 중이던 PKCE 상태를 비우고 로그인 선택 화면으로 되돌린다.
    host.handlePageShow({ persisted: true });
    assert.equal(sessionStorage.getItem('synk.oauth.pending.platform'), null);
    assert.equal(sessionStorage.getItem(PLATFORM_LOGIN_INTENT), null);
    assert.equal(host.getState().phase, 'auth');
    host.dispose();
  }

  // 3) BFCache 복귀·명시적 1회 로그인 알림·명시적 무인자 handlePageShow() 호출은 자동 복귀를 차단하고 기존 안전 동작을 유지한다.
  {
    const bfDom = createPlatformDomEnv();
    const bfAccount = {
      identity: () => ({ configured: true, signedIn: false, status: 'signed-out', accountGeneration: 1 }),
    };
    const bfHost = mountWebPortalHost({
      root: bfDom.portalRoot,
      getConfig: () => config,
      getAccount: () => bfAccount,
      getStartupState: () => bfAccount.identity(),
      getSessionStorage: () => bfDom.sessionStorage,
      getLocalStorage: () => bfDom.localStorage,
      cryptoRef: webcrypto,
      nowFn: bfDom.now,
    });
    bfHost.syncAccountState();
    assert.equal(bfHost.canAutoResumeCentralSession(), true);
    bfHost.handlePageShow({ persisted: true });
    assert.equal(bfHost.canAutoResumeCentralSession(), false);
    bfHost.dispose();

    const explicitDom = createPlatformDomEnv();
    const explicitHost = mountWebPortalHost({
      root: explicitDom.portalRoot,
      getConfig: () => config,
      getAccount: () => bfAccount,
      getStartupState: () => bfAccount.identity(),
      getSessionStorage: () => explicitDom.sessionStorage,
      getLocalStorage: () => explicitDom.localStorage,
      cryptoRef: webcrypto,
      nowFn: explicitDom.now,
    });
    explicitHost.syncAccountState();
    assert.equal(explicitHost.canAutoResumeCentralSession(), true);
    explicitHost.handlePageShow();
    assert.equal(explicitHost.canAutoResumeCentralSession(), false);
    explicitHost.dispose();

    const noticeStorage = createMemoryStorage();
    const noticeDom = createPlatformDomEnv({ sessionStorage: noticeStorage });
    const noticeHost = mountWebPortalHost({
      root: noticeDom.portalRoot,
      getConfig: () => config,
      getAccount: () => bfAccount,
      getStartupState: () => bfAccount.identity(),
      getSessionStorage: () => noticeStorage,
      getLocalStorage: () => noticeDom.localStorage,
      cryptoRef: webcrypto,
      nowFn: noticeDom.now,
    });
    noticeHost.syncAccountState();
    await beginOAuth({ config, product: 'platform', storage: noticeStorage, now: noticeDom.now(), cryptoAPI: webcrypto });
    const manualErrIntent = rememberPlatformLogin(noticeStorage, {
      config,
      method: 'google',
      returnHash: '#home',
      now: noticeDom.now(),
    });
    const deniedCallback = new URL(config.clients.platform.redirectUri);
    deniedCallback.searchParams.set('error', 'access_denied');
    deniedCallback.searchParams.set('state', manualErrIntent.state);
    noticeDom.advanceNow(100);
    const parsedDenied = platformErrorCallbackIntent({
      storage: noticeStorage,
      url: deniedCallback.href,
      product: 'platform',
      config,
      now: noticeDom.now(),
    });
    finishPlatformErrorReturn(noticeStorage, parsedDenied, { now: noticeDom.now() });
    assert.ok(noticeStorage.getItem(PLATFORM_LOGIN_NOTICE));

    noticeHost.handlePageShow({ persisted: false });
    assert.equal(noticeHost.canAutoResumeCentralSession(), false);
    assert.equal(noticeHost.getState().phase, 'auth');
    assert.equal(noticeStorage.getItem('synk.oauth.pending.platform'), null);
    assert.equal(noticeStorage.getItem(PLATFORM_LOGIN_NOTICE), null);
    noticeHost.dispose();
  }
});
