import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDesktopPortalHost } from '../../../desktop/renderer/portal-host.mjs';
import { createCompanyEntryTransport } from '../src/company-entry-web.mjs';
import {
  createDefaultWebCompanyBoundaries,
  mountWebPortalHost,
} from '../src/platform-portal.mjs';

const generation = '10000000-0000-4000-8000-000000000001';
const account = '20000000-0000-4000-8000-000000000002';
const receiver = '30000000-0000-4000-8000-000000000003';
const deliverDoc = '40000000-0000-4000-8000-000000000004';
const secondAccount = '60000000-0000-4000-8000-000000000006';
const inviteSecret = 'SyntheticInvite_1234567890';
const pulseInviteHref = `https://workspace.synk.im/pulse-app/#invite=${inviteSecret}`;
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, binding) {
  const listeners = new Set(), opened = [], posted = [];
  const popup = { closed: false, close() { this.closed = true; }, focus() {}, postMessage(value) { posted.push(value); }, location: { href: '' } };
  const windowRef = {
    crypto: globalThis.crypto, location: { origin: 'https://synk.im' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    open(...args) { opened.push(args); return popup; },
    addEventListener(type, callback) { if (type === 'message') listeners.add(callback); },
    removeEventListener(type, callback) { if (type === 'message') listeners.delete(callback); },
  };
  const boundary = createDefaultWebCompanyBoundaries({ windowRef, ...(binding === undefined ? {} : { getBinding: () => binding }) });
  t.after(() => boundary.disposeCompanyEntry());
  return { boundary, opened, posted, ready() {
    const data = { channel: 'synk.company.entry', version: 1, type: 'ready', documentId: receiver, documentRole: 'receiver' };
    for (const callback of listeners) callback({ source: popup, origin: 'https://workspace.synk.im', data });
  } };
}

test('explicit company login recovery preserves the host accountId as expectedAccountId', async t => {
  const f = fixture(t, { accountGeneration: generation, accountId: account });
  const pending = f.boundary.resolveAssignedDestination({ interactiveRecovery: true });
  assert.equal(f.opened.length, 1, 'A verified host binding opens the receiver synchronously');
  f.ready(); await new Promise(resolve => setImmediate(resolve));
  const bind = f.posted.find(value => value.type === 'bind');
  assert.equal(bind.expectedAccountId, account);
  assert.equal(bind.accountGeneration, generation);
  assert.equal(bind.phase, 'resolve');
  f.boundary.cancelCompanyEntry();
  assert.equal((await pending).ok, false);
});

test('the standalone guest host binds a bare invitation with an explicit null account', async t => {
  const f = fixture(t);
  const pending = f.boundary.resolveBareInviteCode({ code: 'SyntheticInvite_1234567890' });
  assert.equal(f.opened.length, 1);
  f.ready(); await new Promise(resolve => setImmediate(resolve));
  const bind = f.posted.find(value => value.type === 'bind');
  assert.equal(bind.expectedAccountId, null);
  assert.equal(bind.phase, 'classify');
  f.boundary.cancelCompanyEntry();
  assert.equal((await pending).ok, false);
});

test('conflicting host and wire account identifiers never open a receiver', async t => {
  const f = fixture(t, { accountGeneration: generation, accountId: account, expectedAccountId: receiver });
  const result = await f.boundary.resolveAssignedDestination({ accountGeneration: generation, expectedAccountId: account });
  assert.equal(result.ok, false);
  assert.equal(f.opened.length, 0);
});

const VOID_HTML_TAGS = new Set(['INPUT', 'BR', 'HR', 'IMG', 'META', 'LINK']);

function toDataAttrName(prop) {
  return `data-${String(prop).replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}`;
}

function toDatasetKey(attrName) {
  return attrName
    .slice(5)
    .replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function decodeBasicEntities(text) {
  return String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function matchesCompoundSelector(el, rawSelector) {
  const sel = rawSelector.trim();
  if (!sel || el?.nodeType !== 1) return false;

  let cursor = sel;
  const notClauses = [];
  cursor = cursor.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    notClauses.push(inner.trim());
    return '';
  });

  const attrClauses = [];
  cursor = cursor.replace(/\[([^\]]+)\]/g, (_, inner) => {
    attrClauses.push(inner.trim());
    return '';
  });

  const classClauses = [];
  cursor = cursor.replace(/\.([A-Za-z0-9_-]+)/g, (_, cls) => {
    classClauses.push(cls);
    return '';
  });

  let idClause = null;
  cursor = cursor.replace(/#([A-Za-z0-9_-]+)/g, (_, idVal) => {
    idClause = idVal;
    return '';
  });

  const tagClause = cursor.trim();
  if (tagClause && el.tagName !== tagClause.toUpperCase()) return false;
  if (idClause !== null && el.id !== idClause) return false;
  for (const cls of classClauses) {
    if (!el.classList.contains(cls)) return false;
  }
  for (const rawAttr of attrClauses) {
    const eqIdx = rawAttr.indexOf('=');
    if (eqIdx === -1) {
      if (!el.hasAttribute(rawAttr)) return false;
    } else {
      const name = rawAttr.slice(0, eqIdx).trim();
      const expected = rawAttr.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (el.getAttribute(name) !== expected) return false;
    }
  }
  for (const neg of notClauses) {
    if (matchesCompoundSelector(el, neg)) return false;
  }
  return true;
}

function matchesSelectorList(el, selectorList) {
  return String(selectorList)
    .split(',')
    .some(part => matchesCompoundSelector(el, part));
}

function createFakeDomEnvironment({
  popupRef = null,
  onWindowOpen = null,
  fetchImpl = null,
} = {}) {
  const winListeners = new Map();
  const docListeners = new Map();

  function addListener(map, type, fn, opts) {
    if (typeof fn !== 'function') return;
    const capture = opts === true || Boolean(opts && typeof opts === 'object' && opts.capture);
    if (!map.has(type)) map.set(type, []);
    const list = map.get(type);
    if (!list.some(entry => entry.fn === fn && entry.capture === capture)) {
      list.push({ fn, capture });
    }
  }

  function removeListener(map, type, fn, opts) {
    const list = map.get(type);
    if (!list) return;
    const capture = opts === true || Boolean(opts && typeof opts === 'object' && opts.capture);
    const idx = list.findIndex(entry => entry.fn === fn && entry.capture === capture);
    if (idx >= 0) list.splice(idx, 1);
  }

  let doc = null;

  function createElement(tagName) {
    const upperTag = String(tagName || 'div').toUpperCase();
    const attrs = new Map();
    const classes = new Set();
    const styleMap = new Map();
    const elemListeners = new Map();
    let textValue = '';
    let inputValue = '';
    let inertValue = false;

    const el = {
      nodeType: 1,
      tagName: upperTag,
      parentElement: null,
      children: [],
      isConnected: true,
      isContentEditable: false,
      width: 0,
      height: 0,
      get ownerDocument() {
        return doc;
      },
      get id() {
        return attrs.get('id') || '';
      },
      set id(val) {
        const str = String(val ?? '');
        if (str) attrs.set('id', str);
        else attrs.delete('id');
      },
      get className() {
        return [...classes].join(' ');
      },
      set className(val) {
        classes.clear();
        for (const token of String(val ?? '').split(/\s+/).filter(Boolean)) {
          classes.add(token);
        }
        if (classes.size > 0) attrs.set('class', [...classes].join(' '));
        else attrs.delete('class');
      },
      get hidden() {
        return attrs.has('hidden');
      },
      set hidden(val) {
        if (val) attrs.set('hidden', '');
        else attrs.delete('hidden');
      },
      get disabled() {
        return attrs.has('disabled');
      },
      set disabled(val) {
        if (val) attrs.set('disabled', '');
        else attrs.delete('disabled');
      },
      get inert() {
        return inertValue;
      },
      set inert(val) {
        inertValue = Boolean(val);
      },
      get value() {
        return inputValue;
      },
      set value(val) {
        inputValue = String(val ?? '');
      },
      get textContent() {
        if (el.children.length === 0) return textValue;
        return textValue + el.children.map(child => child.textContent).join('');
      },
      set textContent(val) {
        el.children = [];
        textValue = String(val ?? '');
      },
      classList: {
        add(...names) {
          for (const n of names) {
            if (n) classes.add(n);
          }
          if (classes.size > 0) attrs.set('class', [...classes].join(' '));
        },
        remove(...names) {
          for (const n of names) classes.delete(n);
          if (classes.size > 0) attrs.set('class', [...classes].join(' '));
          else attrs.delete('class');
        },
        contains(name) {
          return classes.has(name);
        },
        toggle(name, force) {
          const next = force === undefined ? !classes.has(name) : Boolean(force);
          if (next) classes.add(name);
          else classes.delete(name);
          if (classes.size > 0) attrs.set('class', [...classes].join(' '));
          else attrs.delete('class');
          return next;
        },
      },
      style: {
        setProperty(k, v) { styleMap.set(k, String(v)); },
        getPropertyValue(k) { return styleMap.get(k) || ''; },
        removeProperty(k) { styleMap.delete(k); },
      },
      dataset: new Proxy({}, {
        get(_, prop) {
          if (typeof prop !== 'string') return undefined;
          const attr = toDataAttrName(prop);
          return attrs.has(attr) ? attrs.get(attr) : undefined;
        },
        set(_, prop, value) {
          if (typeof prop === 'string') {
            attrs.set(toDataAttrName(prop), String(value));
          }
          return true;
        },
        deleteProperty(_, prop) {
          if (typeof prop === 'string') {
            attrs.delete(toDataAttrName(prop));
          }
          return true;
        },
        has(_, prop) {
          return typeof prop === 'string' && attrs.has(toDataAttrName(prop));
        },
        ownKeys() {
          return [...attrs.keys()]
            .filter(k => k.startsWith('data-'))
            .map(toDatasetKey);
        },
        getOwnPropertyDescriptor(_, prop) {
          if (typeof prop === 'string' && attrs.has(toDataAttrName(prop))) {
            return { enumerable: true, configurable: true, value: attrs.get(toDataAttrName(prop)) };
          }
          return undefined;
        },
      }),
      getAttribute(name) {
        const key = String(name).toLowerCase();
        return attrs.has(key) ? attrs.get(key) : null;
      },
      setAttribute(name, val) {
        const key = String(name).toLowerCase();
        const str = String(val ?? '');
        attrs.set(key, str);
        if (key === 'class') {
          classes.clear();
          for (const token of str.split(/\s+/).filter(Boolean)) classes.add(token);
        } else if (key === 'value') {
          inputValue = str;
        }
      },
      hasAttribute(name) {
        return attrs.has(String(name).toLowerCase());
      },
      removeAttribute(name) {
        const key = String(name).toLowerCase();
        attrs.delete(key);
        if (key === 'class') classes.clear();
      },
      append(...nodes) {
        for (const node of nodes) {
          if (node && typeof node === 'object') {
            node.parentElement = el;
            el.children.push(node);
          }
        }
      },
      remove() {
        if (!el.parentElement) return;
        const idx = el.parentElement.children.indexOf(el);
        if (idx >= 0) el.parentElement.children.splice(idx, 1);
        el.parentElement = null;
      },
      getContext() {
        return null;
      },
      focus() {
        if (!el.disabled && doc) {
          doc.activeElement = el;
        }
      },
      contains(target) {
        let cur = target;
        while (cur) {
          if (cur === el) return true;
          cur = cur.parentElement;
        }
        return false;
      },
      closest(selector) {
        let cur = el;
        while (cur && cur.nodeType === 1) {
          if (matchesSelectorList(cur, selector)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      querySelector(selector) {
        for (const child of el.children) {
          if (matchesSelectorList(child, selector)) return child;
          const found = child.querySelector(selector);
          if (found) return found;
        }
        return null;
      },
      querySelectorAll(selector) {
        const out = [];
        const visit = node => {
          for (const child of node.children) {
            if (matchesSelectorList(child, selector)) out.push(child);
            visit(child);
          }
        };
        visit(el);
        return out;
      },
      addEventListener(type, fn, opts) {
        addListener(elemListeners, type, fn, opts);
      },
      removeEventListener(type, fn, opts) {
        removeListener(elemListeners, type, fn, opts);
      },
      dispatchEvent(rawEvent) {
        // Native Event fields are read-only. This DOM double owns a writable dispatch envelope.
        const event = rawEvent && typeof rawEvent === 'object'
          ? { ...rawEvent, type: rawEvent.type, detail: rawEvent.detail, target: rawEvent.target || el, bubbles: rawEvent.bubbles !== false, defaultPrevented: rawEvent.defaultPrevented }
          : { type: String(rawEvent) };
        let defaultPrevented = Boolean(event.defaultPrevented);
        let propagationStopped = false;
        let immediateStopped = false;
        event.target = event.target || el;
        event.bubbles = event.bubbles !== false;
        Object.defineProperty(event, 'defaultPrevented', {
          configurable: true,
          get: () => defaultPrevented,
        });
        event.preventDefault = () => { defaultPrevented = true; };
        event.stopPropagation = () => { propagationStopped = true; };
        event.stopImmediatePropagation = () => {
          propagationStopped = true;
          immediateStopped = true;
        };

        const chain = [];
        let cur = el;
        while (cur) {
          chain.push(cur);
          cur = cur.parentElement;
        }
        const ancestorsTopDown = chain.slice(1).reverse();

        for (const node of ancestorsTopDown) {
          if (propagationStopped) break;
          event.currentTarget = node;
          for (const entry of [...(node._listeners?.get(event.type) || [])]) {
            if (!entry.capture) continue;
            entry.fn(event);
            if (immediateStopped) break;
          }
        }

        if (!propagationStopped) {
          event.currentTarget = el;
          for (const entry of [...(elemListeners.get(event.type) || [])]) {
            if (!entry.capture) continue;
            entry.fn(event);
            if (immediateStopped) break;
          }
        }

        if (!propagationStopped) {
          event.currentTarget = el;
          for (const entry of [...(elemListeners.get(event.type) || [])]) {
            if (entry.capture) continue;
            entry.fn(event);
            if (immediateStopped) break;
          }
        }

        if (event.bubbles && !propagationStopped) {
          for (const node of chain.slice(1)) {
            if (propagationStopped) break;
            event.currentTarget = node;
            for (const entry of [...(node._listeners?.get(event.type) || [])]) {
              if (entry.capture) continue;
              entry.fn(event);
              if (immediateStopped) break;
            }
          }
        }

        return !defaultPrevented;
      },
      click() {
        if (el.disabled) return;
        const clickAllowed = el.dispatchEvent({ type: 'click', bubbles: true });
        if (
          clickAllowed
          && el.tagName === 'BUTTON'
          && (el.getAttribute('type') || 'submit').toLowerCase() === 'submit'
        ) {
          const form = el.closest('form');
          if (form && !form.disabled) {
            form.dispatchEvent({ type: 'submit', bubbles: true });
          }
        }
      },
      set innerHTML(markup) {
        el.children = [];
        textValue = '';
        const src = String(markup ?? '');
        if (!src.trim()) return;
        const stack = [el];
        const tokenPattern = /<!--[\s\S]*?-->|<\/([A-Za-z0-9-]+)\s*>|<([A-Za-z0-9-]+)([\s\S]*?)(\/?)>|([^<]+)/g;
        let match;
        while ((match = tokenPattern.exec(src)) !== null) {
          const [, closeTag, openTag, rawAttrs, selfSlash, textChunk] = match;
          const top = stack[stack.length - 1];
          if (closeTag) {
            const upperClose = closeTag.toUpperCase();
            if (stack.length > 1 && top.tagName === upperClose) {
              stack.pop();
            }
            continue;
          }
          if (openTag) {
            const child = createElement(openTag);
            const attrRegex = /([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(rawAttrs || '')) !== null) {
              const attrName = attrMatch[1];
              const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
              child.setAttribute(attrName, decodeBasicEntities(attrVal));
            }
            top.append(child);
            if (!selfSlash && !VOID_HTML_TAGS.has(child.tagName)) {
              stack.push(child);
            }
            continue;
          }
          if (textChunk && top && top.children.length === 0) {
            const decoded = decodeBasicEntities(textChunk);
            if (decoded.trim()) {
              top.textContent = (top.textContent || '') + decoded.trim();
            }
          }
        }
      },
      get innerHTML() {
        return '';
      },
      _listeners: elemListeners,
    };
    return el;
  }

  const win = {
    crypto: globalThis.crypto,
    innerWidth: 1280,
    innerHeight: 800,
    location: {
      origin: 'https://synk.im',
      hash: '#home',
      assign() {},
      replace() {},
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    ...(typeof fetchImpl === 'function' ? { fetch: fetchImpl } : {}),
    matchMedia: () => ({ matches: true }),
    open(...args) {
      if (typeof onWindowOpen === 'function') return onWindowOpen(...args);
      return popupRef;
    },
    addEventListener(type, fn, opts) {
      addListener(winListeners, type, fn, opts);
    },
    removeEventListener(type, fn, opts) {
      removeListener(winListeners, type, fn, opts);
    },
    dispatchWindowEvent(event) {
      for (const entry of [...(winListeners.get(event.type) || [])]) {
        entry.fn(event);
      }
    },
  };

  const documentElement = createElement('html');
  const body = createElement('body');
  const root = createElement('div');
  root.id = 'portal-entry';
  body.append(root);
  documentElement.append(body);

  doc = {
    hidden: false,
    defaultView: win,
    documentElement,
    body,
    activeElement: body,
    createElement,
    getElementById(id) {
      if (root.id === id) return root;
      return root.querySelector(`#${id}`);
    },
    addEventListener(type, fn, opts) {
      addListener(docListeners, type, fn, opts);
    },
    removeEventListener(type, fn, opts) {
      removeListener(docListeners, type, fn, opts);
    },
  };

  return { root, doc, win, winListeners };
}

function createPopupWireHarness({ stepTimeoutMs = 25, totalTimeoutMs = 100, pollIntervalMs = 15 } = {}) {
  const posted = [];
  const opens = [];
  const popup = {
    closed: false,
    close() { this.closed = true; },
    focus() {},
    postMessage(message, targetOrigin) {
      posted.push({ message: structuredClone(message), targetOrigin });
    },
    location: { href: '' },
  };
  const dom = createFakeDomEnvironment({
    popupRef: popup,
    onWindowOpen(...args) {
      opens.push(args);
      return popup;
    },
  });

  function emitWire(data) {
    dom.win.dispatchWindowEvent({
      type: 'message',
      origin: 'https://workspace.synk.im',
      source: popup,
      data,
    });
  }

  const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;

  async function advanceInviteToDeliverOffer({ kind = 'customer', destination = '/pulse-app/' } = {}) {
    const offerCount = posted.filter(row => row.message.type === 'offer').length;
    const receiverDocument = globalThis.crypto.randomUUID();
    const deliveryDocument = globalThis.crypto.randomUUID();
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: receiverDocument,
      documentRole: 'receiver',
    });
    await tick();
    const classifyBind = last('bind');
    assert.ok(classifyBind, 'the receiver ready message binds the classification document');
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      phase: 'classify',
    });
    await tick();
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'classified',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      kind,
      destination,
    });
    await tick();

    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: deliveryDocument,
      documentRole: kind,
    });
    await tick();
    const deliverBind = last('bind');
    assert.ok(deliverBind, 'the product ready message binds the delivery document');
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: deliverBind.requestId,
      accountGeneration: deliverBind.accountGeneration,
      documentId: deliverBind.documentId,
      phase: 'deliver',
    });
    await tick();

    const offers = posted.filter(row => row.message.type === 'offer').map(row => row.message);
    assert.equal(offers.length - offerCount, 2);
    return { classifyBind, deliverBind };
  }

  function makeTransport(getBinding) {
    return createCompanyEntryTransport({
      windowRef: dom.win,
      getBinding,
      stepTimeoutMs,
      totalTimeoutMs,
      pollIntervalMs,
    });
  }

  return {
    ...dom,
    popup,
    posted,
    opens,
    emitWire,
    last,
    advanceInviteToDeliverOffer,
    makeTransport,
  };
}

test('default web company boundaries surface HANDOFF_UNCONFIRMED with workspace check guidance after deliver offer', async t => {
  let liveBinding = { accountGeneration: generation, expectedAccountId: null };
  const h = createPopupWireHarness();
  const transport = h.makeTransport(() => liveBinding);
  const boundary = createDefaultWebCompanyBoundaries({
    windowRef: h.win,
    transport,
    getBinding: () => liveBinding,
  });
  t.after(() => boundary.disposeCompanyEntry());

  const pendingLink = boundary.handoffInviteLink({ href: pulseInviteHref });
  await h.advanceInviteToDeliverOffer({ kind: 'customer', destination: '/pulse-app/' });
  boundary.cancelCompanyEntry();

  const result = await pendingLink;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HANDOFF_UNCONFIRMED');
  assert.equal(result.retryable, false);
  assert.match(result.message, /열린 작업 공간 창/);
  assert.equal(result.message.includes(inviteSecret), false);
  assert.equal(h.posted.some(row => row.message.type === 'cancel'), false);

  liveBinding = { accountGeneration: generation, expectedAccountId: account };
  const pendingBare = boundary.resolveBareInviteCode({ code: inviteSecret });
  const { deliverBind } = await h.advanceInviteToDeliverOffer({ kind: 'employee', destination: '/' });
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'received',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    kind: 'employee',
    destination: '/',
    state: 'queued',
  });
  const okBare = await pendingBare;
  assert.equal(okBare.ok, true);
  assert.equal(okBare.state, 'received');
  assert.equal(okBare.destination, '/');
});

test('mountWebPortalHost keeps unconfirmed invite guidance visible across close-invite cancel and invite-pane timeout without leaking secrets', async t => {
  // 1) Closing invite panel after deliver offer transitions to auth pane and shows unconfirmed guidance on auth feedback.
  const h1 = createPopupWireHarness({ stepTimeoutMs: 80, totalTimeoutMs: 200 });
  let bindingSnapshot1 = null;
  const transport1 = createCompanyEntryTransport({
    windowRef: h1.win,
    getBinding: () => bindingSnapshot1(),
    stepTimeoutMs: 80,
    totalTimeoutMs: 200,
    pollIntervalMs: 15,
  });
  const customBoundaries1 = createDefaultWebCompanyBoundaries({
    windowRef: h1.win,
    transport: transport1,
    getBinding: () => bindingSnapshot1(),
  });
  let currentGen1 = generation;
  bindingSnapshot1 = () => ({ accountGeneration: currentGen1, expectedAccountId: null });

  const host1 = mountWebPortalHost({
    root: h1.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: 'signed-out' }),
    getAccount: () => ({ identity: () => ({ status: 'signed-out', signedIn: false }) }),
    companyBoundaries: {
      handoffInviteLink: args => {
        currentGen1 = args.accountGeneration;
        return customBoundaries1.handoffInviteLink(args);
      },
      cancelCompanyEntry: () => customBoundaries1.cancelCompanyEntry(),
      disposeCompanyEntry: () => customBoundaries1.disposeCompanyEntry(),
    },
  });
  t.after(() => host1.dispose());

  h1.root.querySelector('[data-portal-action="orb"]').click();
  assert.equal(host1.getState().phase, 'auth');
  h1.root.querySelector('[data-portal-action="open-invite"]').click();
  assert.equal(host1.getState().phase, 'invite');

  const input1 = h1.root.querySelector('#portal-invite-input');
  input1.value = pulseInviteHref;
  h1.root.querySelector('[data-portal-invite-submit]').click();

  await h1.advanceInviteToDeliverOffer({ kind: 'customer', destination: '/pulse-app/' });
  h1.root.querySelector('[data-portal-action="close-invite"]').click();
  await tick();
  await tick();

  assert.equal(host1.getState().phase, 'auth');
  assert.equal(h1.posted.some(row => row.message.type === 'cancel'), false);
  const authFeedback = h1.root.querySelector('[data-portal-auth-feedback]');
  assert.equal(authFeedback.hidden, false);
  assert.match(authFeedback.textContent, /열린 작업 공간 창/);
  assert.equal(authFeedback.textContent.includes(inviteSecret), false);

  // 2) ACK loss timeout while remaining on invite pane shows unconfirmed guidance in #portal-invite-error.
  const h2 = createPopupWireHarness({ stepTimeoutMs: 20, totalTimeoutMs: 120, pollIntervalMs: 10 });
  let currentGen2 = generation;
  const transport2 = createCompanyEntryTransport({
    windowRef: h2.win,
    getBinding: () => ({ accountGeneration: currentGen2, expectedAccountId: null }),
    stepTimeoutMs: 20,
    totalTimeoutMs: 120,
    pollIntervalMs: 10,
  });
  const customBoundaries2 = createDefaultWebCompanyBoundaries({
    windowRef: h2.win,
    transport: transport2,
    getBinding: () => ({ accountGeneration: currentGen2, expectedAccountId: null }),
  });
  const host2 = mountWebPortalHost({
    root: h2.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: 'signed-out' }),
    getAccount: () => ({ identity: () => ({ status: 'signed-out', signedIn: false }) }),
    companyBoundaries: {
      resolveBareInviteCode: args => {
        currentGen2 = args.accountGeneration;
        return customBoundaries2.resolveBareInviteCode(args);
      },
      cancelCompanyEntry: () => customBoundaries2.cancelCompanyEntry(),
      disposeCompanyEntry: () => customBoundaries2.disposeCompanyEntry(),
    },
  });
  t.after(() => host2.dispose());

  h2.root.querySelector('[data-portal-action="orb"]').click();
  h2.root.querySelector('[data-portal-action="open-invite"]').click();
  const input2 = h2.root.querySelector('#portal-invite-input');
  input2.value = inviteSecret;
  h2.root.querySelector('[data-portal-invite-submit]').click();

  await h2.advanceInviteToDeliverOffer({ kind: 'employee', destination: '/' });
  await new Promise(resolve => setTimeout(resolve, 40));
  await tick();

  assert.equal(host2.getState().phase, 'invite');
  const inviteError = h2.root.querySelector('#portal-invite-error');
  assert.match(inviteError.textContent, /열린 작업 공간 창/);
  assert.equal(inviteError.textContent.includes(inviteSecret), false);
});

test('mountWebPortalHost syncAccountState preserves active guest invites on identical guest syncs and cancels once on real binding changes', async t => {
  const h = createPopupWireHarness({ stepTimeoutMs: 200, totalTimeoutMs: 400, pollIntervalMs: 15 });
  let authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 0 };
  let cancelCalls = 0;
  let hostRef = null;
  let reentrantSyncDuringCancel = false;
  const seenInviteGenerations = [];

  let latestBoundGen = null;
  let latestExpectedAccount = null;
  const transport = createCompanyEntryTransport({
    windowRef: h.win,
    getBinding: () => (latestBoundGen ? { accountGeneration: latestBoundGen, expectedAccountId: latestExpectedAccount } : null),
    stepTimeoutMs: 200,
    totalTimeoutMs: 400,
    pollIntervalMs: 15,
  });
  const baseBoundaries = createDefaultWebCompanyBoundaries({
    windowRef: h.win,
    transport,
    getBinding: () => (latestBoundGen ? { accountGeneration: latestBoundGen, expectedAccountId: latestExpectedAccount } : null),
  });

  const host = mountWebPortalHost({
    root: h.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      resolveBareInviteCode(args) {
        latestBoundGen = args.accountGeneration;
        latestExpectedAccount = args.expectedAccountId;
        seenInviteGenerations.push(args.accountGeneration);
        return baseBoundaries.resolveBareInviteCode(args);
      },
      resolveAssignedDestination() {
        return Promise.resolve({
          ok: true,
          result: { status: 'resolved', destinations: ['/'], unavailable: [] },
        });
      },
      openAssignedDestination() {
        return { ok: true, navigationRequested: true };
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
        if (reentrantSyncDuringCancel && hostRef) {
          reentrantSyncDuringCancel = false;
          hostRef.syncAccountState();
        }
        baseBoundaries.cancelCompanyEntry();
      },
      disposeCompanyEntry() {
        baseBoundaries.disposeCompanyEntry();
      },
    },
  });
  hostRef = host;
  t.after(() => host.dispose());

  // Mount normalizes binding without spurious cancel.
  assert.equal(cancelCalls, 0);

  // Start a guest invite while signed-out.
  h.root.querySelector('[data-portal-action="orb"]').click();
  h.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = h.root.querySelector('#portal-invite-input');
  inviteInput.value = inviteSecret;
  h.root.querySelector('[data-portal-invite-submit]').click();

  assert.equal(seenInviteGenerations.length, 1);
  const guestGen = seenInviteGenerations[0];

  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: receiver,
    documentRole: 'receiver',
  });
  await tick();

  // Emitting the same confirmed signed-out guest account state twice must NOT cancel the active invite.
  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, 0);
  assert.equal(host.getState().phase, 'invite');

  // Complete the guest invite all the way to received ('queued' -> 'received').
  const classifyBind = h.last('bind');
  assert.equal(classifyBind.accountGeneration, guestGen);
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    phase: 'classify',
  });
  await tick();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'classified',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    kind: 'employee',
    destination: '/',
  });
  await tick();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: deliverDoc,
    documentRole: 'employee',
  });
  await tick();
  const deliverBind = h.last('bind');
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    phase: 'deliver',
  });
  await tick();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'received',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    kind: 'employee',
    destination: '/',
    state: 'queued',
  });
  await tick();
  await tick();

  const statusBanner = h.root.querySelector('[data-portal-invite-status]');
  assert.equal(statusBanner.hidden, false);
  assert.match(statusBanner.textContent, /열린 작업 공간 창/);
  assert.equal(cancelCalls, 0);

  // Real transition guest -> signed-in(A) cancels prior binding once (even under re-entrant syncAccountState).
  reentrantSyncDuringCancel = true;
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 1);

  // Same signed-in(A) syncs and same-account restoring refresh do NOT cancel.
  host.syncAccountState();
  authIdentity = {
    status: 'restoring',
    signedIn: false,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 1);

  // Real account switch A -> B cancels once.
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: secondAccount,
    accountKey: secondAccount,
    accountGeneration: 2,
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 2);

  // Real restore error cancels once.
  authIdentity = {
    status: 'error',
    signedIn: false,
    accountKey: secondAccount,
    accountGeneration: 2,
    error: { message: '세션 확인에 실패했어요.', retryable: true },
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 3);

  // Logout to signed-out cancels if active, and subsequent identical signed-out syncs do not cancel.
  authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 3 };
  host.syncAccountState();
  const cancelsAfterLogout = cancelCalls;
  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, cancelsAfterLogout);
});

test('mountWebPortalHost preserves active unconfigured guest invite across repeated unconfigured syncs', async t => {
  const h = createPopupWireHarness({ stepTimeoutMs: 200, totalTimeoutMs: 400 });
  let cancelCalls = 0;

  const host = mountWebPortalHost({
    root: h.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: 'unconfigured' }),
    getAccount: () => ({ identity: () => ({ status: 'unconfigured', signedIn: false }) }),
    companyBoundaries: {
      resolveBareInviteCode() {
        return new Promise(() => {});
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
      },
    },
  });
  t.after(() => host.dispose());

  h.root.querySelector('[data-portal-action="orb"]').click();
  h.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = h.root.querySelector('#portal-invite-input');
  inviteInput.value = inviteSecret;
  h.root.querySelector('[data-portal-invite-submit]').click();

  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, 0);
  assert.equal(host.getState().phase, 'invite');
});

test('mountWebPortalHost built-in default boundaries keep guest binding across identical syncs and avoid cancel message after deliver offer', async t => {
  const posted = [];
  const popup = {
    closed: false,
    close() { this.closed = true; },
    focus() {},
    postMessage(message, targetOrigin) {
      posted.push({ message: structuredClone(message), targetOrigin });
    },
    location: { href: '' },
  };
  const dom = createFakeDomEnvironment({
    popupRef: popup,
    fetchImpl: () => Promise.resolve(new Response(
      JSON.stringify({
        version: 1,
        accountMatch: true,
        workspace: { state: 'unassigned', destination: '/' },
        pulse: { state: 'unassigned', destination: '/pulse-app/' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )),
  });

  let authIdentity = { status: 'signed-out', signedIn: false };
  const host = mountWebPortalHost({
    root: dom.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
  });
  t.after(() => host.dispose());

  dom.root.querySelector('[data-portal-action="orb"]').click();
  dom.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = dom.root.querySelector('#portal-invite-input');
  inviteInput.value = pulseInviteHref;
  dom.root.querySelector('[data-portal-invite-submit]').click();

  // Repeated same-guest syncs do not rotate built-in binding or cancel the transport.
  host.syncAccountState();
  host.syncAccountState();

  const emitWire = data => {
    dom.win.dispatchWindowEvent({
      type: 'message',
      origin: 'https://workspace.synk.im',
      source: popup,
      data,
    });
  };
  const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;

  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: receiver,
    documentRole: 'receiver',
  });
  await tick();
  const classifyBind = last('bind');
  assert.ok(classifyBind, 'Invite remains active after repeated same-guest syncs');
  assert.equal(classifyBind.expectedAccountId, null);

  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    phase: 'classify',
  });
  await tick();
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'classified',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    kind: 'customer',
    destination: '/pulse-app/',
  });
  await tick();
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: deliverDoc,
    documentRole: 'customer',
  });
  await tick();
  const deliverBind = last('bind');
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    phase: 'deliver',
  });
  await tick();
  assert.equal(posted.filter(row => row.message.type === 'offer').length, 2);

  // Logout/login transition after deliver offer must NOT send cancel to popup.
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  await tick();
  await tick();

  assert.equal(posted.some(row => row.message.type === 'cancel'), false);
});

test('R1: bare invite submitted after unsynced restoring->signed-out settles prior generation before binding and survives same-guest syncs', async t => {
  const h = createPopupWireHarness({ stepTimeoutMs: 200, totalTimeoutMs: 400, pollIntervalMs: 15 });
  let authIdentity = { status: 'restoring', signedIn: false, accountGeneration: 0 };
  let cancelCalls = 0;
  let liveTransportBinding = null;
  let pendingOutcome = null;
  const seenBareGenerations = [];

  const transport = createCompanyEntryTransport({
    windowRef: h.win,
    getBinding: () => liveTransportBinding,
    stepTimeoutMs: 200,
    totalTimeoutMs: 400,
    pollIntervalMs: 15,
  });
  const baseBoundaries = createDefaultWebCompanyBoundaries({
    windowRef: h.win,
    transport,
    getBinding: () => liveTransportBinding,
  });

  const host = mountWebPortalHost({
    root: h.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      resolveBareInviteCode(args) {
        liveTransportBinding = {
          accountGeneration: args.accountGeneration,
          expectedAccountId: args.expectedAccountId,
        };
        seenBareGenerations.push(args.accountGeneration);
        pendingOutcome = baseBoundaries.resolveBareInviteCode(args);
        return pendingOutcome;
      },
      resolveAssignedDestination() {
        return Promise.resolve({
          ok: true,
          result: { status: 'resolved', destinations: ['/'], unavailable: [] },
        });
      },
      openAssignedDestination() {
        return { ok: true, navigationRequested: true };
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
        baseBoundaries.cancelCompanyEntry();
      },
      disposeCompanyEntry() {
        baseBoundaries.disposeCompanyEntry();
      },
    },
  });
  t.after(() => host.dispose());

  // Transition restoring -> signed-out without calling syncAccountState first (keeping guest generation 0).
  authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 0 };

  h.root.querySelector('[data-portal-action="orb"]').click();
  h.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = h.root.querySelector('#portal-invite-input');
  inviteInput.value = inviteSecret;
  h.root.querySelector('[data-portal-invite-submit]').click();

  assert.equal(seenBareGenerations.length, 1);
  const boundGen = seenBareGenerations[0];

  // Two subsequent syncAccountState calls for the already-settled signed-out guest state must not cancel.
  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, 0);
  assert.equal(host.getState().phase, 'invite');

  const receiverDocument = globalThis.crypto.randomUUID();
  const deliveryDocument = globalThis.crypto.randomUUID();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: receiverDocument,
    documentRole: 'receiver',
  });
  await tick();

  const classifyBind = h.last('bind');
  assert.ok(classifyBind, 'classify bind is emitted because invite was not cancelled');
  assert.equal(classifyBind.accountGeneration, boundGen);
  assert.equal(classifyBind.expectedAccountId, null);

  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    phase: 'classify',
  });
  await tick();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'classified',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    kind: 'customer',
    destination: '/pulse-app/',
  });
  await tick();
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: deliveryDocument,
    documentRole: 'customer',
  });
  await tick();
  const deliverBind = h.last('bind');
  assert.ok(deliverBind);
  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    phase: 'deliver',
  });
  await tick();
  assert.equal(h.posted.filter(row => row.message.type === 'offer').length, 2);

  // Two more same-guest syncs after deliver offer must still post 0 cancel messages.
  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, 0);
  assert.equal(h.posted.some(row => row.message.type === 'cancel'), false);

  // Real transition to signed-in A settles as HANDOFF_UNCONFIRMED (retryable: false) with 0 cancel wire messages.
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  const outcome = await pendingOutcome;
  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, 'HANDOFF_UNCONFIRMED');
  assert.equal(outcome.retryable, false);
  assert.equal(cancelCalls, 1);
  assert.equal(h.posted.some(row => row.message.type === 'cancel'), false);
});

test('R1b: built-in default mountWebPortalHost boundaries keep bare invite active after unsynced restoring->signed-out', async t => {
  const posted = [];
  const popup = {
    closed: false,
    close() { this.closed = true; },
    focus() {},
    postMessage(message, targetOrigin) {
      posted.push({ message: structuredClone(message), targetOrigin });
    },
    location: { href: '' },
  };
  const dom = createFakeDomEnvironment({
    popupRef: popup,
    fetchImpl: () => Promise.resolve(new Response(
      JSON.stringify({
        version: 1,
        accountMatch: true,
        workspace: { state: 'unassigned', destination: '/' },
        pulse: { state: 'unassigned', destination: '/pulse-app/' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )),
  });

  let authIdentity = { status: 'restoring', signedIn: false, accountGeneration: 0 };
  const host = mountWebPortalHost({
    root: dom.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
  });
  t.after(() => host.dispose());

  authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 0 };

  dom.root.querySelector('[data-portal-action="orb"]').click();
  dom.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = dom.root.querySelector('#portal-invite-input');
  inviteInput.value = inviteSecret;
  dom.root.querySelector('[data-portal-invite-submit]').click();

  host.syncAccountState();
  host.syncAccountState();
  assert.equal(host.getState().phase, 'invite');

  const emitWire = data => {
    dom.win.dispatchWindowEvent({
      type: 'message',
      origin: 'https://workspace.synk.im',
      source: popup,
      data,
    });
  };
  const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;

  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: globalThis.crypto.randomUUID(),
    documentRole: 'receiver',
  });
  await tick();

  const classifyBind = last('bind');
  assert.ok(classifyBind, 'built-in default boundary keeps bare invite alive across late guest syncs');
  assert.equal(classifyBind.expectedAccountId, null);

  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    phase: 'classify',
  });
  await tick();
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'classified',
    requestId: classifyBind.requestId,
    accountGeneration: classifyBind.accountGeneration,
    documentId: classifyBind.documentId,
    kind: 'customer',
    destination: '/pulse-app/',
  });
  await tick();
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: globalThis.crypto.randomUUID(),
    documentRole: 'customer',
  });
  await tick();
  const deliverBind = last('bind');
  assert.ok(deliverBind);
  emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'bound',
    requestId: deliverBind.requestId,
    accountGeneration: deliverBind.accountGeneration,
    documentId: deliverBind.documentId,
    phase: 'deliver',
  });
  await tick();
  assert.equal(posted.filter(row => row.message.type === 'offer').length, 2);

  host.syncAccountState();
  host.syncAccountState();
  assert.equal(posted.some(row => row.message.type === 'cancel'), false);

  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  await tick();
  await tick();
  assert.equal(posted.some(row => row.message.type === 'cancel'), false);
});

test('R2: invite link submitted after unsynced restoring->signed-out settles prior generation in shared pre-branch spot', async t => {
  const h = createPopupWireHarness({ stepTimeoutMs: 200, totalTimeoutMs: 400, pollIntervalMs: 15 });
  let authIdentity = { status: 'restoring', signedIn: false, accountGeneration: 0 };
  let cancelCalls = 0;
  let liveTransportBinding = null;
  const seenLinkGenerations = [];

  const transport = createCompanyEntryTransport({
    windowRef: h.win,
    getBinding: () => liveTransportBinding,
    stepTimeoutMs: 200,
    totalTimeoutMs: 400,
    pollIntervalMs: 15,
  });
  const baseBoundaries = createDefaultWebCompanyBoundaries({
    windowRef: h.win,
    transport,
    getBinding: () => liveTransportBinding,
  });

  const host = mountWebPortalHost({
    root: h.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      handoffInviteLink(args) {
        liveTransportBinding = {
          accountGeneration: args.accountGeneration,
          expectedAccountId: args.expectedAccountId,
        };
        seenLinkGenerations.push(args.accountGeneration);
        return baseBoundaries.handoffInviteLink(args);
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
        baseBoundaries.cancelCompanyEntry();
      },
      disposeCompanyEntry() {
        baseBoundaries.disposeCompanyEntry();
      },
    },
  });
  t.after(() => host.dispose());

  authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 0 };

  h.root.querySelector('[data-portal-action="orb"]').click();
  h.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = h.root.querySelector('#portal-invite-input');
  inviteInput.value = pulseInviteHref;
  h.root.querySelector('[data-portal-invite-submit]').click();

  assert.equal(seenLinkGenerations.length, 1);
  const boundGen = seenLinkGenerations[0];

  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, 0);
  assert.equal(host.getState().phase, 'invite');

  h.emitWire({
    channel: 'synk.company.entry',
    version: 1,
    type: 'ready',
    documentId: globalThis.crypto.randomUUID(),
    documentRole: 'receiver',
  });
  await tick();

  const classifyBind = h.last('bind');
  assert.ok(classifyBind);
  assert.equal(classifyBind.accountGeneration, boundGen);
  assert.equal(classifyBind.expectedAccountId, null);
});

test('R3: retry-workspace after unsynced same-account generation bump settles prior generation before binding new resolution', async t => {
  const dom = createFakeDomEnvironment();
  let authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  let cancelCalls = 0;
  let resolveSecond = null;
  const resolveCalls = [];

  const host = mountWebPortalHost({
    root: dom.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      resolveAssignedDestination(args) {
        resolveCalls.push(args);
        if (resolveCalls.length === 1) {
          return Promise.resolve({
            ok: true,
            result: {
              status: 'resolved',
              destinations: ['/', '/pulse-app/'],
              unavailable: [],
            },
          });
        }
        return new Promise(resolve => {
          resolveSecond = resolve;
        });
      },
      openAssignedDestination() {
        return { ok: true, navigationRequested: true };
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
        if (resolveSecond) {
          const pending = resolveSecond;
          resolveSecond = null;
          pending({ ok: false, code: 'CANCELLED', retryable: true });
        }
      },
    },
  });
  t.after(() => host.dispose());

  dom.root.querySelector('[data-portal-action="orb"]').click();
  await tick();
  await tick();

  assert.equal(host.getState().phase, 'workspace');
  assert.deepEqual(host.getState().workspace.destinations, ['/', '/pulse-app/']);
  assert.equal(resolveCalls.length, 1);
  const firstBoundGen = resolveCalls[0].accountGeneration;

  // Same account with new identity generation before syncAccountState runs.
  authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 2,
  };

  dom.root.querySelector('[data-portal-action="retry-workspace"]').click();
  const cancelsAfterRetryStart = cancelCalls;
  assert.equal(resolveCalls.length, 2);
  const secondBoundGen = resolveCalls[1].accountGeneration;
  assert.notEqual(secondBoundGen, firstBoundGen);

  // Subsequent syncAccountState calls for the same state must not cancel the newly bound retry resolution.
  host.syncAccountState();
  host.syncAccountState();
  assert.equal(cancelCalls, cancelsAfterRetryStart);
  assert.ok(resolveSecond, 'retry-workspace resolution remains active across same-state syncs');

  const finishSecond = resolveSecond;
  resolveSecond = null;
  finishSecond({
    ok: true,
    result: {
      status: 'partial',
      destinations: ['/'],
      unavailable: ['pulse'],
    },
  });
  await tick();
  await tick();

  assert.equal(host.getState().phase, 'workspace');
  assert.equal(host.getState().workspace.status, 'partial');
  assert.deepEqual(host.getState().workspace.destinations, ['/']);
  assert.deepEqual(host.getState().workspace.unavailable, ['pulse']);
});

test('R4: interactive login-recovery watch stays alive after initial return across same-state syncs and cancels once on continue-personal or account switch', async t => {
  async function setupLoginRecoveryWatch() {
    const dom = createFakeDomEnvironment();
    let authIdentity = {
      status: 'signed-in',
      signedIn: true,
      accountId: account,
      accountKey: account,
      accountGeneration: 1,
    };
    let cancelCalls = 0;
    let retainedUpdate = null;
    const resolveCalls = [];

    const host = mountWebPortalHost({
      root: dom.root,
      getReducedMotion: () => true,
      getStartupState: () => ({ status: authIdentity.status }),
      getAccount: () => ({
        identity: () => authIdentity,
        isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
      }),
      companyBoundaries: {
        resolveAssignedDestination(args) {
          resolveCalls.push(args);
          if (args.interactiveRecovery) {
            retainedUpdate = args.onAssignmentUpdate;
          }
          return Promise.resolve({
            ok: true,
            result: {
              status: 'login_required',
              destinations: [],
              unavailable: [],
            },
          });
        },
        openAssignedDestination() {
          return { ok: true, navigationRequested: true };
        },
        cancelCompanyEntry() {
          cancelCalls += 1;
        },
      },
    });
    t.after(() => host.dispose());

    dom.root.querySelector('[data-portal-action="orb"]').click();
    await tick();
    await tick();
    assert.equal(host.getState().phase, 'workspace');
    assert.equal(host.getState().workspace.status, 'login_required');

    dom.root.querySelector('[data-portal-action="retry-workspace"]').click();
    await tick();
    await tick();
    assert.equal(resolveCalls.length, 2);
    assert.equal(resolveCalls[1].interactiveRecovery, true);
    assert.equal(typeof retainedUpdate, 'function');
    // Starting recovery cancels the previous assignment lookup once. Measure subsequent cancellation separately.
    assert.equal(cancelCalls, 1);
    const cancelsAtRecoveryStart = cancelCalls;

    return {
      dom,
      host,
      getCancelCalls: () => cancelCalls - cancelsAtRecoveryStart,
      getRetainedUpdate: () => retainedUpdate,
      setAuthIdentity(next) {
        authIdentity = next;
      },
    };
  }

  // (a) Same-state sync twice -> 0 cancels; retained update applies resolved multi-destination workspace.
  const caseA = await setupLoginRecoveryWatch();
  caseA.host.syncAccountState();
  caseA.host.syncAccountState();
  assert.equal(caseA.getCancelCalls(), 0);
  caseA.getRetainedUpdate()({
    ok: true,
    result: {
      status: 'resolved',
      destinations: ['/', '/pulse-app/'],
      unavailable: [],
    },
  });
  assert.equal(caseA.host.getState().phase, 'workspace');
  assert.equal(caseA.host.getState().workspace.status, 'resolved');
  assert.deepEqual(caseA.host.getState().workspace.destinations, ['/', '/pulse-app/']);

  // (b) Clicking continue-personal after initial return cancels the retained watch exactly once.
  const caseB = await setupLoginRecoveryWatch();
  caseB.dom.root.querySelector('[data-portal-action="continue-personal"]').click();
  await tick();
  await tick();
  assert.equal(caseB.getCancelCalls(), 1);
  assert.equal(caseB.host.getState().phase, 'purpose'); // Personal entry keeps the product chooser visible.

  // (c) Syncing signed-in B after initial return cancels once and ignores late update from A.
  const caseC = await setupLoginRecoveryWatch();
  const staleUpdateFromA = caseC.getRetainedUpdate();
  caseC.setAuthIdentity({
    status: 'signed-in',
    signedIn: true,
    accountId: secondAccount,
    accountKey: secondAccount,
    accountGeneration: 2,
  });
  caseC.host.syncAccountState();
  assert.equal(caseC.getCancelCalls(), 1);
  await tick();
  await tick();
  assert.equal(caseC.host.getState().accountKey, secondAccount);
  assert.equal(caseC.host.getState().workspace.status, 'login_required');

  staleUpdateFromA({
    ok: true,
    result: {
      status: 'resolved',
      destinations: ['/', '/pulse-app/'],
      unavailable: [],
    },
  });
  assert.equal(caseC.host.getState().accountKey, secondAccount);
  assert.equal(caseC.host.getState().workspace.status, 'login_required');
  assert.deepEqual(caseC.host.getState().workspace.destinations, []);
});

test('R5: restoring same-account preservation requires matching explicit identity accountGeneration', async t => {
  const dom = createFakeDomEnvironment();
  let authIdentity = {
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  };
  let cancelCalls = 0;

  const host = mountWebPortalHost({
    root: dom.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      resolveAssignedDestination() {
        return new Promise(() => {});
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
      },
    },
  });
  t.after(() => host.dispose());

  dom.root.querySelector('[data-portal-action="orb"]').click();
  assert.equal(host.getState().phase, 'entering');
  assert.equal(cancelCalls, 0);

  // Restoring with same accountKey and same accountGeneration (1) preserves binding without cancelling.
  authIdentity = {
    status: 'restoring',
    signedIn: false,
    accountKey: account,
    accountGeneration: 1,
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 0);

  // Restoring with same accountKey but bumped accountGeneration (2) rotates binding and cancels once.
  authIdentity = {
    status: 'restoring',
    signedIn: false,
    accountKey: account,
    accountGeneration: 2,
  };
  host.syncAccountState();
  assert.equal(cancelCalls, 1);
});

test('R6: late settlement of cancelled invite #1 finally does not erase invite #2 and restoring->signed-out cancels once', async t => {
  const dom = createFakeDomEnvironment();
  let authIdentity = { status: 'restoring', signedIn: false, accountGeneration: 0 };
  let cancelCalls = 0;
  const deferredInvites = [];

  const host = mountWebPortalHost({
    root: dom.root,
    getReducedMotion: () => true,
    getStartupState: () => ({ status: authIdentity.status }),
    getAccount: () => ({
      identity: () => authIdentity,
      isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
    }),
    companyBoundaries: {
      resolveBareInviteCode(args) {
        let settle;
        const promise = new Promise(resolve => {
          settle = resolve;
        });
        deferredInvites.push({ args, settle });
        return promise;
      },
      cancelCompanyEntry() {
        cancelCalls += 1;
      },
    },
  });
  t.after(() => host.dispose());

  // Invite #1 (pending while mounted in restoring)
  dom.root.querySelector('[data-portal-action="orb"]').click();
  dom.root.querySelector('[data-portal-action="open-invite"]').click();
  const inviteInput = dom.root.querySelector('#portal-invite-input');
  inviteInput.value = inviteSecret;
  dom.root.querySelector('[data-portal-invite-submit]').click();
  assert.equal(deferredInvites.length, 1);
  assert.equal(cancelCalls, 0);

  // Explicit close-invite cancels Invite #1 once.
  dom.root.querySelector('[data-portal-action="close-invite"]').click();
  assert.equal(cancelCalls, 1);

  // Reopen invite and submit Invite #2 (still bound to restoring generation).
  dom.root.querySelector('[data-portal-action="open-invite"]').click();
  inviteInput.value = inviteSecret;
  dom.root.querySelector('[data-portal-invite-submit]').click();
  assert.equal(deferredInvites.length, 2);
  assert.equal(cancelCalls, 1);

  // Settle Invite #1 late: its finally guard (entrySeq === myEntrySeq) must NOT mark Invite #2 inactive.
  deferredInvites[0].settle({ ok: false, code: 'CANCELLED', retryable: false });
  await tick();
  await tick();
  assert.equal(cancelCalls, 1);

  // Transition restoring -> signed-out and sync: Invite #2 was bound to restoring generation, so it cancels once.
  const cancelsBeforeSignedOut = cancelCalls;
  authIdentity = { status: 'signed-out', signedIn: false, accountGeneration: 0 };
  host.syncAccountState();
  assert.equal(cancelCalls - cancelsBeforeSignedOut, 1);

  // Repeated signed-out sync does not cancel again.
  host.syncAccountState();
  assert.equal(cancelCalls - cancelsBeforeSignedOut, 1);
});

test('R7: settled guest invite survives two signed-out<->restoring(key null) G0 roundtrips to received while restoring->signed-in A, accountGeneration bump, and startWebOAuth each cancel once', async t => {
  function setupGuestInviteSession() {
    const h = createPopupWireHarness({ stepTimeoutMs: 200, totalTimeoutMs: 400, pollIntervalMs: 15 });
    let authIdentity = { status: 'signed-out', signedIn: false, accountKey: null, accountGeneration: 0 };
    let cancelCalls = 0;
    let liveTransportBinding = null;
    let pendingOutcome = null;
    const seenInviteGenerations = [];
    const navigatedUrls = [];
    const storageMap = new Map();
    const sessionStorageStub = {
      getItem: key => (storageMap.has(key) ? storageMap.get(key) : null),
      setItem: (key, value) => {
        storageMap.set(key, String(value));
      },
      removeItem: key => {
        storageMap.delete(key);
      },
    };

    const transport = createCompanyEntryTransport({
      windowRef: h.win,
      getBinding: () => liveTransportBinding,
      stepTimeoutMs: 200,
      totalTimeoutMs: 400,
      pollIntervalMs: 15,
    });
    const baseBoundaries = createDefaultWebCompanyBoundaries({
      windowRef: h.win,
      transport,
      getBinding: () => liveTransportBinding,
    });

    const host = mountWebPortalHost({
      root: h.root,
      getReducedMotion: () => true,
      getConfig: () => ({
        configured: true,
        clients: {
          platform: {
            clientId: 'platform-web',
            redirectUri: 'https://synk.im/account/client.html',
          },
        },
      }),
      getSessionStorage: () => sessionStorageStub,
      beginOAuthFn: async () => 'https://synk.im/id/?client_id=platform-web&state=f1-regression',
      rememberLoginFn: () => {},
      onNavigateExternal: href => {
        navigatedUrls.push(href);
      },
      getStartupState: () => ({ status: authIdentity.status }),
      getAccount: () => ({
        identity: () => authIdentity,
        isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
      }),
      companyBoundaries: {
        resolveBareInviteCode(args) {
          liveTransportBinding = {
            accountGeneration: args.accountGeneration,
            expectedAccountId: args.expectedAccountId,
          };
          seenInviteGenerations.push(args.accountGeneration);
          pendingOutcome = baseBoundaries.resolveBareInviteCode(args);
          return pendingOutcome;
        },
        resolveAssignedDestination() {
          return Promise.resolve({
            ok: true,
            result: { status: 'resolved', destinations: ['/'], unavailable: [] },
          });
        },
        openAssignedDestination() {
          return { ok: true, navigationRequested: true };
        },
        cancelCompanyEntry() {
          cancelCalls += 1;
          baseBoundaries.cancelCompanyEntry();
        },
        disposeCompanyEntry() {
          baseBoundaries.disposeCompanyEntry();
        },
      },
    });
    t.after(() => host.dispose());

    h.root.querySelector('[data-portal-action="orb"]').click();
    h.root.querySelector('[data-portal-action="open-invite"]').click();
    const inviteInput = h.root.querySelector('#portal-invite-input');
    inviteInput.value = inviteSecret;
    h.root.querySelector('[data-portal-invite-submit]').click();

    assert.equal(seenInviteGenerations.length, 1);
    assert.equal(cancelCalls, 0);
    assert.equal(inviteInput.disabled, true);

    return {
      h,
      host,
      inviteInput,
      guestGen: seenInviteGenerations[0],
      navigatedUrls,
      getCancelCalls: () => cancelCalls,
      getPendingOutcome: () => pendingOutcome,
      setAuthIdentity(next) {
        authIdentity = next;
      },
    };
  }

  async function completeBareInviteToReceived(session) {
    const { h, guestGen } = session;
    const receiverDocId = globalThis.crypto.randomUUID();
    const deliveryDocId = globalThis.crypto.randomUUID();

    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: receiverDocId,
      documentRole: 'receiver',
    });
    await tick();
    const classifyBind = h.last('bind');
    assert.ok(classifyBind, 'classify bind is emitted for active guest invite');
    assert.equal(classifyBind.accountGeneration, guestGen);
    assert.equal(classifyBind.expectedAccountId, null);

    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      phase: 'classify',
    });
    await tick();
    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'classified',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      kind: 'employee',
      destination: '/',
    });
    await tick();
    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: deliveryDocId,
      documentRole: 'employee',
    });
    await tick();
    const deliverBind = h.last('bind');
    assert.ok(deliverBind, 'deliver bind is emitted for active guest invite');
    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: deliverBind.requestId,
      accountGeneration: deliverBind.accountGeneration,
      documentId: deliverBind.documentId,
      phase: 'deliver',
    });
    await tick();
    h.emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'received',
      requestId: deliverBind.requestId,
      accountGeneration: deliverBind.accountGeneration,
      documentId: deliverBind.documentId,
      kind: 'employee',
      destination: '/',
      state: 'queued',
    });
    await tick();
    await tick();
  }

  // (a) Two signed-out G0 -> restoring G0 (key null) -> signed-out G0 roundtrips: 0 cancels and finishes with received.
  const caseRoundtrip = setupGuestInviteSession();
  for (let round = 0; round < 2; round += 1) {
    caseRoundtrip.setAuthIdentity({
      status: 'restoring',
      signedIn: false,
      accountKey: null,
      accountGeneration: 0,
    });
    caseRoundtrip.host.syncAccountState();
    assert.equal(caseRoundtrip.getCancelCalls(), 0);
    assert.equal(caseRoundtrip.host.getState().phase, 'invite');
    assert.equal(caseRoundtrip.inviteInput.disabled, true);

    caseRoundtrip.setAuthIdentity({
      status: 'signed-out',
      signedIn: false,
      accountKey: null,
      accountGeneration: 0,
    });
    caseRoundtrip.host.syncAccountState();
    assert.equal(caseRoundtrip.getCancelCalls(), 0);
    assert.equal(caseRoundtrip.host.getState().phase, 'invite');
    assert.equal(caseRoundtrip.inviteInput.disabled, true);
  }

  await completeBareInviteToReceived(caseRoundtrip);
  const completedOutcome = await caseRoundtrip.getPendingOutcome();
  assert.equal(completedOutcome.ok, true);
  assert.equal(completedOutcome.state, 'received');
  assert.equal(completedOutcome.destination, '/');
  const statusBanner = caseRoundtrip.h.root.querySelector('[data-portal-invite-status]');
  assert.equal(statusBanner.hidden, false);
  assert.match(statusBanner.textContent, /열린 작업 공간 창/);
  assert.equal(caseRoundtrip.getCancelCalls(), 0);
  assert.equal(caseRoundtrip.h.posted.some(row => row.message.type === 'cancel'), false);

  // (b) Transition restoring (G0, key null) -> signed-in A cancels active guest invite once.
  const caseSignedIn = setupGuestInviteSession();
  caseSignedIn.setAuthIdentity({
    status: 'restoring',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseSignedIn.host.syncAccountState();
  assert.equal(caseSignedIn.getCancelCalls(), 0);

  caseSignedIn.setAuthIdentity({
    status: 'signed-in',
    signedIn: true,
    accountId: account,
    accountKey: account,
    accountGeneration: 1,
  });
  caseSignedIn.host.syncAccountState();
  assert.equal(caseSignedIn.getCancelCalls(), 1);
  const cancelledBySignIn = await caseSignedIn.getPendingOutcome();
  assert.equal(cancelledBySignIn.ok, false);
  assert.equal(cancelledBySignIn.code, 'CANCELLED');
  caseSignedIn.host.syncAccountState();
  assert.equal(caseSignedIn.getCancelCalls(), 1);

  // (c) Transition restoring (G0, key null) -> restoring (G1, key null) on accountGeneration bump cancels once.
  const caseGenBump = setupGuestInviteSession();
  caseGenBump.setAuthIdentity({
    status: 'restoring',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseGenBump.host.syncAccountState();
  assert.equal(caseGenBump.getCancelCalls(), 0);

  caseGenBump.setAuthIdentity({
    status: 'restoring',
    signedIn: false,
    accountKey: null,
    accountGeneration: 1,
  });
  caseGenBump.host.syncAccountState();
  assert.equal(caseGenBump.getCancelCalls(), 1);
  assert.equal(caseGenBump.inviteInput.disabled, false);
  const cancelledByGenBump = await caseGenBump.getPendingOutcome();
  assert.equal(cancelledByGenBump.ok, false);
  assert.equal(cancelledByGenBump.code, 'CANCELLED');

  caseGenBump.setAuthIdentity({
    status: 'signed-out',
    signedIn: false,
    accountKey: null,
    accountGeneration: 1,
  });
  caseGenBump.host.syncAccountState();
  assert.equal(caseGenBump.getCancelCalls(), 1);

  // (d) Starting web OAuth (startWebOAuth) while guest binding is in restoring(key null, G0) cancels once.
  const caseStartOAuth = setupGuestInviteSession();
  caseStartOAuth.setAuthIdentity({
    status: 'restoring',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseStartOAuth.host.syncAccountState();
  caseStartOAuth.setAuthIdentity({
    status: 'signed-out',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseStartOAuth.host.syncAccountState();
  await completeBareInviteToReceived(caseStartOAuth);
  assert.equal(caseStartOAuth.getCancelCalls(), 0);

  caseStartOAuth.h.root.querySelector('[data-portal-action="close-invite"]').click();
  assert.equal(caseStartOAuth.host.getState().phase, 'auth');
  assert.equal(caseStartOAuth.getCancelCalls(), 0);

  caseStartOAuth.setAuthIdentity({
    status: 'restoring',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseStartOAuth.host.syncAccountState();
  assert.equal(caseStartOAuth.host.getState().phase, 'auth');
  assert.equal(caseStartOAuth.getCancelCalls(), 0);

  caseStartOAuth.h.root.querySelector('[data-portal-action="google"]').click();
  await tick();
  await tick();
  assert.equal(caseStartOAuth.getCancelCalls(), 1);
  assert.equal(caseStartOAuth.navigatedUrls.length, 1);

  caseStartOAuth.setAuthIdentity({
    status: 'signed-out',
    signedIn: false,
    accountKey: null,
    accountGeneration: 0,
  });
  caseStartOAuth.host.syncAccountState();
  assert.equal(caseStartOAuth.getCancelCalls(), 1);
});

test('R7b: built-in default mountWebPortalHost boundaries complete guest invite to received across synchronous window.open hide/show roundtrips for signed-out and unconfigured', async t => {
  async function runBuiltInRoundtripCase(settledStatus) {
    const posted = [];
    const popup = {
      closed: false,
      close() { this.closed = true; },
      focus() {},
      postMessage(message, targetOrigin) {
        posted.push({ message: structuredClone(message), targetOrigin });
      },
      location: { href: '' },
    };

    let authIdentity = { status: settledStatus, signedIn: false, accountKey: null, accountGeneration: 0 };
    let host = null;
    let dom = null;

    dom = createFakeDomEnvironment({
      popupRef: popup,
      onWindowOpen() {
        // Simulate opener tab becoming hidden immediately when /entry/ opens in front.
        dom.doc.hidden = true;
        authIdentity = { status: 'restoring', signedIn: false, accountKey: null, accountGeneration: 0 };
        host?.syncAccountState();
        return popup;
      },
      fetchImpl: () => Promise.resolve(new Response(
        JSON.stringify({
          version: 1,
          accountMatch: true,
          workspace: { state: 'unassigned', destination: '/' },
          pulse: { state: 'unassigned', destination: '/pulse-app/' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )),
    });

    host = mountWebPortalHost({
      root: dom.root,
      getReducedMotion: () => true,
      getStartupState: () => ({ status: authIdentity.status }),
      getAccount: () => ({
        identity: () => authIdentity,
        isAccountBound: id => authIdentity.signedIn === true && authIdentity.accountId === id,
      }),
    });
    t.after(() => host.dispose());

    dom.root.querySelector('[data-portal-action="orb"]').click();
    dom.root.querySelector('[data-portal-action="open-invite"]').click();
    const inviteInput = dom.root.querySelector('#portal-invite-input');
    inviteInput.value = pulseInviteHref;
    dom.root.querySelector('[data-portal-invite-submit]').click();

    // Still active in invite phase while hidden/restoring right after window.open.
    assert.equal(host.getState().phase, 'invite');
    assert.equal(inviteInput.disabled, true);

    const emitWire = data => {
      dom.win.dispatchWindowEvent({
        type: 'message',
        origin: 'https://workspace.synk.im',
        source: popup,
        data,
      });
    };
    const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;

    // Receiver ready arrives while opener is still hidden (status: 'restoring', key: null, G0).
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: globalThis.crypto.randomUUID(),
      documentRole: 'receiver',
    });
    await tick();

    const classifyBind = last('bind');
    assert.ok(classifyBind, `built-in guest binding stays valid during hidden restoring (${settledStatus})`);
    assert.equal(classifyBind.expectedAccountId, null);

    // Return to visible settled guest state (#1), then hide/show roundtrip (#2).
    dom.doc.hidden = false;
    authIdentity = { status: settledStatus, signedIn: false, accountKey: null, accountGeneration: 0 };
    host.syncAccountState();

    dom.doc.hidden = true;
    authIdentity = { status: 'restoring', signedIn: false, accountKey: null, accountGeneration: 0 };
    host.syncAccountState();

    dom.doc.hidden = false;
    authIdentity = { status: settledStatus, signedIn: false, accountKey: null, accountGeneration: 0 };
    host.syncAccountState();

    assert.equal(host.getState().phase, 'invite');
    assert.equal(inviteInput.disabled, true);

    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      phase: 'classify',
    });
    await tick();
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'classified',
      requestId: classifyBind.requestId,
      accountGeneration: classifyBind.accountGeneration,
      documentId: classifyBind.documentId,
      kind: 'customer',
      destination: '/pulse-app/',
    });
    await tick();
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'ready',
      documentId: globalThis.crypto.randomUUID(),
      documentRole: 'customer',
    });
    await tick();
    const deliverBind = last('bind');
    assert.ok(deliverBind);
    assert.equal(deliverBind.accountGeneration, classifyBind.accountGeneration);

    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'bound',
      requestId: deliverBind.requestId,
      accountGeneration: deliverBind.accountGeneration,
      documentId: deliverBind.documentId,
      phase: 'deliver',
    });
    await tick();
    emitWire({
      channel: 'synk.company.entry',
      version: 1,
      type: 'received',
      requestId: deliverBind.requestId,
      accountGeneration: deliverBind.accountGeneration,
      documentId: deliverBind.documentId,
      kind: 'customer',
      destination: '/pulse-app/',
      state: 'queued',
    });
    await tick();
    await tick();

    const statusBanner = dom.root.querySelector('[data-portal-invite-status]');
    assert.equal(statusBanner.hidden, false);
    assert.match(statusBanner.textContent, /열린 작업 공간 창/);
    assert.equal(posted.some(row => row.message.type === 'cancel'), false);
  }

  await runBuiltInRoundtripCase('signed-out');
  await runBuiltInRoundtripCase('unconfigured');
});


async function settleEntryHost() { for(let n=0;n<8;n++) await tick(); }
for(const mode of ['web','pc'])for(const purpose of ['none','pending'])test('unassigned existing-user entry uses the product picker without creating onboarding '+mode+' '+purpose,async t=>{
 const dom=createFakeDomEnvironment(),writes=[],opened=[];let ensureCount=0;
 const identity={status:'signed-in',signedIn:true,accountId:account,accountKey:account,accountGeneration:1,onboarding:{purpose}};
 const auth={configured:true,status:'signed-in',signedIn:true,accountGeneration:generation,sessionGeneration:1,account:{synk_user_id:account},onboarding:{purpose}};
 let host;
 if(mode==='web')host=mountWebPortalHost({root:dom.root,getReducedMotion:()=>true,getStartupState:()=>({status:'signed-in'}),getAccount:()=>({identity:()=>identity,isAccountBound:id=>id===account,completePurposeOnboarding:async outcome=>{writes.push(outcome);return {ok:true};}}),companyBoundaries:{resolveAssignedDestination:async()=>({ok:true,result:{status:'resolved',destinations:[],unavailable:[]}}),cancelCompanyEntry(){}},onEnsureEnteredRoute:()=>{ensureCount++;},onNavigateHash:hash=>opened.push(hash)});
 else host=mountDesktopPortalHost({root:dom.root,getReducedMotion:()=>true,getAuth:()=>auth,bridge:{authStatus:async()=>auth,resolveCompanyEntryDestinations:async request=>({ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,result:{status:'resolved',destinations:[],unavailable:[]}}),cancelCompanyEntry:async()=>null,accountRequest:async(operation,params)=>{writes.push({operation,...params});return {ok:true};}},onEnsureEnteredView:()=>{ensureCount++;return {ok:true};},onOpenPurposeTarget:async id=>{opened.push(id);return {ok:true};}});
 t.after(()=>host.dispose());await settleEntryHost();assert.equal(host.getState().phase,'purpose','a verified unassigned account should remain in the black product picker');assert.equal(ensureCount,0);assert.deepEqual(writes,[]);
 dom.root.querySelector('[data-portal-purpose="solio"]').click();await settleEntryHost();assert.equal(host.getState().phase,'entered');assert.deepEqual(opened,[mode==='web'?'#solio':'solio']);
 assert.equal(writes.length,purpose==='pending'?1:0,'only an actually pending newcomer may write an onboarding outcome');
 if(purpose==='pending')assert.equal(mode==='web'?writes[0]:writes[0].outcome,'chosen');
});
test('unassigned existing-user entry after asynchronous company recovery uses the same picker without onboarding writes',async t=>{
 const dom=createFakeDomEnvironment(),writes=[],identity={status:'signed-in',signedIn:true,accountId:account,accountKey:account,accountGeneration:1,onboarding:{purpose:'none'}};let onUpdate,ensureCount=0;
 const host=mountWebPortalHost({root:dom.root,getReducedMotion:()=>true,getStartupState:()=>({status:'signed-in'}),getAccount:()=>({identity:()=>identity,isAccountBound:id=>id===account,completePurposeOnboarding:async outcome=>{writes.push(outcome);return {ok:true};}}),companyBoundaries:{resolveAssignedDestination:async context=>{onUpdate=context.onAssignmentUpdate;return {ok:true,result:{status:'login_required',destinations:[],unavailable:[]}};},cancelCompanyEntry(){}},onEnsureEnteredRoute:()=>{ensureCount++;}});
 t.after(()=>host.dispose());await settleEntryHost();assert.equal(host.getState().phase,'workspace');assert.equal(typeof onUpdate,'function');
 onUpdate({ok:true,result:{status:'resolved',destinations:[],unavailable:[]}});await settleEntryHost();assert.equal(host.getState().phase,'purpose');assert.equal(ensureCount,0);assert.deepEqual(writes,[]);
 await host.closePurposePicker();await settleEntryHost();assert.deepEqual(writes,[],'dismissing a product menu is not newcomer onboarding');assert.notEqual(host.getState().phase,'entered','closing the existing-user picker must keep the black portal');assert.equal(host.getState().active,true);assert.equal(host.getState().accountKey,account);
});
for(const result of [{status:'partial',destinations:[],unavailable:['pulse']},{status:'unavailable',destinations:[],unavailable:['workspace','pulse']}])test('unassigned existing-user entry does not treat unresolved company lookup as no assignment '+result.status,async t=>{
 const dom=createFakeDomEnvironment(),identity={status:'signed-in',signedIn:true,accountId:account,accountKey:account,accountGeneration:1,onboarding:{purpose:'none'}};
 const host=mountWebPortalHost({root:dom.root,getReducedMotion:()=>true,getStartupState:()=>({status:'signed-in'}),getAccount:()=>({identity:()=>identity,isAccountBound:id=>id===account}),companyBoundaries:{resolveAssignedDestination:async()=>({ok:true,result}),cancelCompanyEntry(){}}});t.after(()=>host.dispose());await settleEntryHost();assert.equal(host.getState().phase,'workspace');assert.notEqual(host.getState().phase,'purpose');
});


test('unassigned existing-user entry on PC stays inside the black portal when its picker closes',async t=>{
 const dom=createFakeDomEnvironment(),writes=[];const auth={configured:true,status:'signed-in',signedIn:true,accountGeneration:generation,sessionGeneration:1,account:{synk_user_id:account},onboarding:{purpose:'none'}};
 const host=mountDesktopPortalHost({root:dom.root,getReducedMotion:()=>true,getAuth:()=>auth,bridge:{authStatus:async()=>auth,resolveCompanyEntryDestinations:async request=>({ok:true,requestId:request.requestId,accountGeneration:request.accountGeneration,result:{status:'resolved',destinations:[],unavailable:[]}}),cancelCompanyEntry:async()=>null,accountRequest:async(operation,params)=>{writes.push({operation,...params});return {ok:true};}},onEnsureEnteredView:()=>({ok:true})});
 t.after(()=>host.dispose());await settleEntryHost();assert.equal(host.getState().phase,'purpose');await host.closePurposePicker();await settleEntryHost();assert.notEqual(host.getState().phase,'entered');assert.equal(host.getState().active,true);assert.equal(host.getState().accountKey,account);assert.deepEqual(writes,[]);assert.equal(auth.signedIn,true);
});

for (const [kind, destination] of [['both', '/'], ['both', '/pulse-app/'], ['partial', '/']]) {
  test('real transport preserves an existing account destination after personal chooser close: ' + kind + ' ' + destination, async t => {
    const navigations = [], writes = [], requests = [];
    const dom = createFakeDomEnvironment({ fetchImpl: async (url, init) => {
      requests.push({ url, init });
      assert.equal(init.method, 'POST');
      return new Response(JSON.stringify({ version: 1, accountMatch: true,
        workspace: { state: 'assigned', destination: '/' },
        pulse: { state: kind === 'partial' ? 'unavailable' : 'assigned', destination: '/pulse-app/' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    } });
    dom.win.location.assign = href => navigations.push(href);
    const identity = { status: 'signed-in', signedIn: true, accountId: account, accountKey: account, accountGeneration: 1, onboarding: { purpose: 'none' } };
    const host = mountWebPortalHost({ root: dom.root, getReducedMotion: () => true,
      getStartupState: () => ({ status: 'signed-in' }),
      getAccount: () => ({ identity: () => identity, isAccountBound: id => id === account,
        completePurposeOnboarding: async outcome => { writes.push(outcome); return { ok: true }; },
      }),
    });
    t.after(() => host.dispose());
    await settleEntryHost();
    assert.equal(host.getState().phase, 'workspace');
    assert.equal(requests.length, 1);
    dom.root.querySelector('[data-portal-action="continue-personal"]').click();
    await settleEntryHost();
    assert.equal(host.getState().phase, 'purpose');
    dom.root.querySelector('[data-portal-action="close-purpose"]').click();
    await settleEntryHost();
    assert.equal(host.getState().phase, 'workspace');
    assert.deepEqual(host.getState().workspace.destinations, kind === 'partial' ? ['/'] : ['/', '/pulse-app/']);
    dom.root.querySelector('[data-portal-workspace="' + destination + '"]').click();
    await settleEntryHost();
    assert.deepEqual(navigations, ['https://workspace.synk.im' + destination]);
    assert.equal(requests.length, 1, 'a verified return must not require a second lookup');
    assert.deepEqual(writes, [], 'existing account navigation must not complete newcomer onboarding');
  });
}

for (const initialStatus of ['login_required', 'account_mismatch']) {
  test('an unverified chooser return refreshes its company lookup and ignores the cancelled watch: ' + initialStatus, async t => {
    const dom = createFakeDomEnvironment(), writes = [];
    const identity = { status: 'signed-in', signedIn: true, accountId: account, accountKey: account, accountGeneration: 1, onboarding: { purpose: 'none' } };
    let lookups = 0, oldUpdate;
    const host = mountWebPortalHost({ root: dom.root, getReducedMotion: () => true,
      getStartupState: () => ({ status: 'signed-in' }),
      getAccount: () => ({ identity: () => identity, isAccountBound: id => id === account,
        completePurposeOnboarding: async outcome => { writes.push(outcome); return { ok: true }; },
      }),
      companyBoundaries: {
        resolveAssignedDestination(args) {
          lookups += 1;
          if (lookups === 1) { oldUpdate = args.onAssignmentUpdate; return Promise.resolve({ ok: true, result: { status: initialStatus, destinations: [], unavailable: [] } }); }
          return Promise.resolve({ ok: true, result: { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] } });
        },
        cancelCompanyEntry() {},
        openAssignedDestination() { return { ok: true, navigationRequested: true }; },
      },
    });
    t.after(() => host.dispose()); await settleEntryHost();
    assert.equal(host.getState().phase, 'workspace');
    dom.root.querySelector('[data-portal-action="continue-personal"]').click(); await settleEntryHost();
    assert.equal(host.getState().phase, 'purpose');
    oldUpdate({ ok: true, result: { status: 'resolved', destinations: [], unavailable: [] } });
    await settleEntryHost(); assert.equal(host.getState().phase, 'purpose');
    dom.root.querySelector('[data-portal-action="close-purpose"]').click(); await settleEntryHost();
    assert.equal(lookups, 2);
    assert.equal(host.getState().phase, 'workspace');
    assert.deepEqual(host.getState().workspace.destinations, ['/', '/pulse-app/']);
    assert.deepEqual(writes, []);
  });
}
