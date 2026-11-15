import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanyEntryTransport } from '../src/company-entry-web.mjs';

const origin = 'https://workspace.synk.im';
const destinationsEndpoint = 'https://workspace.synk.im/api/customer/entry/destinations';
const generation = '10000000-0000-4000-8000-000000000001';
const account = '20000000-0000-4000-8000-000000000002';
const nextGeneration = '50000000-0000-4000-8000-000000000005';
const nextAccount = '60000000-0000-4000-8000-000000000006';
const receiverDocument = '30000000-0000-4000-8000-000000000003';
const targetDocument = '40000000-0000-4000-8000-000000000004';
const token = 'SyntheticInvite_1234567890';
const tick = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonHttpResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

function httpDestinationsBody({ workspace = 'unassigned', pulse = 'unassigned' } = {}) {
  return {
    version: 1,
    accountMatch: true,
    workspace: { state: workspace, destination: '/' },
    pulse: { state: pulse, destination: '/pulse-app/' },
  };
}

function fixture({ blocked = false } = {}) {
  const listeners = new Map(), posted = [], opens = [], navigations = [], popupNavigations = [];
  let binding = { accountGeneration: generation, expectedAccountId: account };
  const popup = {
    closed: false,
    close() { this.closed = true; },
    focus() {},
    postMessage(message, targetOrigin) { posted.push({ message: structuredClone(message), targetOrigin }); },
    location: {
      set href(value) { popupNavigations.push(value); navigations.push(value); },
      replace(value) { popupNavigations.push(value); navigations.push(value); },
      assign(value) { popupNavigations.push(value); navigations.push(value); },
    },
  };
  const windowRef = {
    crypto: globalThis.crypto,
    location: {
      origin: 'https://synk.im',
      assign(value) { navigations.push(value); },
      replace(value) { navigations.push(value); },
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    open(...args) { opens.push(args); return blocked ? null : popup; },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const transport = createCompanyEntryTransport({ windowRef, getBinding: () => binding });
  const send = (message, options = {}) => {
    for (const listener of [...(listeners.get('message') || [])]) {
      listener({ origin: options.origin ?? origin, source: options.source ?? popup, data: message });
    }
  };
  const msg = (type, fields) => ({ channel: 'synk.company.entry', version: 1, type, ...fields });
  const ready = (documentId = receiverDocument, documentRole = 'receiver', options = {}) =>
    send(msg('ready', { documentId, documentRole }), options);
  const bindingFields = bind => ({
    requestId: bind.requestId, accountGeneration: bind.accountGeneration, documentId: bind.documentId,
  });
  const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;
  async function bound(documentId, role, phase) {
    ready(documentId, role);
    await tick();
    const bind = last('bind');
    assert.ok(bind, 'A ready document must be bound before receiving a secret');
    assert.deepEqual(Object.keys(bind).sort(), ['channel', 'version', 'type', 'requestId', 'accountGeneration', 'documentId', 'phase', 'expectedAccountId'].sort());
    assert.equal(bind.documentId, documentId);
    assert.equal(bind.phase, phase);
    send(msg('bound', { ...bindingFields(bind), phase }));
    await tick();
    return bind;
  }
  return {
    transport, posted, opens, navigations, popupNavigations, popup, listeners, msg, send, ready, bound, last, bindingFields,
    replaceBinding(next) { binding = next; },
    startInvite(extra = {}) { return transport.startInvite({ token, accountGeneration: generation, expectedAccountId: account, ...extra }); },
    resolve(extra = {}) { return transport.resolveAssignments({ accountGeneration: generation, expectedAccountId: account, ...extra }); },
  };
}

function fetchFixture({
  onFetch = null,
  replaceOnlyLocation = false,
  transportOptions = {},
} = {}) {
  const listeners = new Map();
  const opens = [];
  const fetchCalls = [];
  const sameTabNavigations = [];
  const responderQueue = [];
  let binding = { accountGeneration: generation, expectedAccountId: account };

  const location = replaceOnlyLocation
    ? {
        origin: 'https://synk.im',
        replace(url) { sameTabNavigations.push({ method: 'replace', url }); },
      }
    : {
        origin: 'https://synk.im',
        assign(url) { sameTabNavigations.push({ method: 'assign', url }); },
        replace(url) { sameTabNavigations.push({ method: 'replace', url }); },
      };

  const windowRef = {
    crypto: globalThis.crypto,
    location,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    open(...args) {
      opens.push(args);
      return null;
    },
    fetch(url, init = {}) {
      const record = {
        url,
        init: {
          ...init,
          headers: init.headers ? { ...init.headers } : undefined,
        },
        signal: init.signal ?? null,
      };
      fetchCalls.push(record);

      const handler = responderQueue.length > 0 ? responderQueue.shift() : onFetch;
      if (typeof handler !== 'function') {
        return Promise.reject(new Error('Unexpected fetch call without responder'));
      }

      return new Promise((resolve, reject) => {
        const signal = init.signal;
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        const onAbort = () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        signal?.addEventListener?.('abort', onAbort, { once: true });

        Promise.resolve()
          .then(() => handler(url, init, record))
          .then(
            value => {
              signal?.removeEventListener?.('abort', onAbort);
              resolve(value);
            },
            err => {
              signal?.removeEventListener?.('abort', onAbort);
              reject(err);
            },
          );
      });
    },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      listeners.get(name)?.delete(callback);
    },
  };

  const transport = createCompanyEntryTransport({
    windowRef,
    getBinding: () => binding,
    ...transportOptions,
  });

  return {
    transport,
    opens,
    fetchCalls,
    sameTabNavigations,
    enqueueFetch(fn) {
      responderQueue.push(fn);
    },
    replaceBinding(next) {
      binding = next;
    },
    resolve(extra = {}) {
      return transport.resolveAssignments({
        accountGeneration: binding?.accountGeneration ?? generation,
        expectedAccountId: binding?.expectedAccountId ?? account,
        ...extra,
      });
    },
  };
}

// --- 1. 초대 전달 기존 메모리/팝업 계약 시험 (보존) ---

for (const [kind, destination, role] of [
  ['employee', '/', 'employee'], ['customer', '/pulse-app/', 'customer'],
]) {
  test('invite waits for the actual ' + kind + ' queue acknowledgement across documents', async t => {
    const f = fixture(); t.after(() => f.transport.dispose());
    let settled = false;
    const pending = f.startInvite({ expectedKind: kind }).then(value => { settled = true; return value; });
    assert.equal(f.opens.length, 1, 'Popup must be opened synchronously inside the user gesture');
    assert.equal(f.opens[0][0], origin + '/entry/');
    const classify = await f.bound(receiverDocument, 'receiver', 'classify');
    const offer = f.last('offer');
    assert.equal(offer.token, token);
    assert.deepEqual(Object.keys(offer).sort(), ['channel', 'version', 'type', 'requestId', 'accountGeneration', 'documentId', 'token'].sort());
    f.send(f.msg('classified', { ...f.bindingFields(classify), kind, destination }));
    await tick();
    assert.equal(settled, false, 'Classification is not a delivery receipt');
    const deliver = await f.bound(targetDocument, role, 'deliver');
    assert.equal(deliver.requestId, classify.requestId);
    assert.equal(deliver.accountGeneration, generation);
    f.send(f.msg('received', { ...f.bindingFields(classify), kind, destination, state: 'queued' }));
    await tick();
    assert.equal(settled, false, 'A receipt from the old document cannot complete delivery');
    f.send(f.msg('received', { ...f.bindingFields(deliver), kind, destination, state: 'queued' }));
    const result = await pending;
    assert.equal(result.ok, true); assert.equal(result.state, 'received'); assert.equal(result.destination, destination);
    assert.equal(f.posted.every(row => row.targetOrigin === origin), true);
    assert.equal(f.opens.some(args => args.some(value => String(value).includes(token))), false);
    assert.equal(f.navigations.some(value => String(value).includes(token)), false);
    assert.equal(JSON.stringify(result).includes(token), false);
  });
}

test('a forged origin, another window and extra ready fields receive no token', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.startInvite();
  f.ready(receiverDocument, 'receiver', { origin: 'https://evil.invalid' });
  f.ready(receiverDocument, 'receiver', { source: {} });
  f.send(f.msg('ready', { documentId: receiverDocument, documentRole: 'receiver', extra: true }));
  await tick();
  assert.equal(f.posted.some(row => row.message.type === 'offer'), false);
  f.transport.cancel();
  assert.equal((await pending).ok, false);
});

test('a full employee link cannot be silently reinterpreted as a customer invite', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.startInvite({ expectedKind: 'employee' });
  const bind = await f.bound(receiverDocument, 'receiver', 'classify');
  f.send(f.msg('classified', { ...f.bindingFields(bind), kind: 'customer', destination: '/pulse-app/' }));
  assert.equal((await pending).ok, false);
});

test('account change before bound prevents releasing the invite', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.startInvite();
  f.ready(); await tick();
  const bind = f.last('bind'); assert.ok(bind);
  f.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: nextAccount });
  f.send(f.msg('bound', { ...f.bindingFields(bind), phase: 'classify' }));
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(f.posted.some(row => row.message.type === 'offer'), false);
});

test('blocked popup is a failure and never a received invitation', async t => {
  const f = fixture({ blocked: true }); t.after(() => f.transport.dispose());
  const result = await f.startInvite();
  assert.equal(result.ok, false);
  assert.notEqual(result.state, 'received');
});

// --- 2. 수동 대화형 로그인 복구(`interactiveRecovery: true`) 팝업 프로토콜 시험 (보존) ---

for (const result of [
  { status: 'resolved', destinations: [], unavailable: [] },
  { status: 'resolved', destinations: ['/'], unavailable: [] },
  { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] },
  { status: 'partial', destinations: ['/'], unavailable: ['pulse'] },
  { status: 'login_required', destinations: [], unavailable: [] },
  { status: 'account_mismatch', destinations: [], unavailable: [] },
]) {
  test('interactive recovery assignment preserves ' + result.status + ' with ' + result.destinations.length + ' destinations', async t => {
    const f = fixture(); t.after(() => f.transport.dispose());
    const pending = f.resolve({ interactiveRecovery: true });
    assert.equal(f.opens.length, 1, 'Interactive recovery must open the entry popup synchronously before await');
    const bind = await f.bound(receiverDocument, 'receiver', 'resolve');
    assert.equal(f.posted.some(row => row.message.type === 'offer'), false);
    f.send(f.msg('assignment', { ...f.bindingFields(bind), result }));
    const answer = await pending;
    assert.equal(answer.ok, true);
    assert.deepEqual(answer.result, result);
    assert.deepEqual(f.navigations, [], 'Transport does not auto-open a partial or selected destination');
  });
}

test('assignment cannot introduce an external destination', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.resolve({ interactiveRecovery: true });
  const bind = await f.bound(receiverDocument, 'receiver', 'resolve');
  f.send(f.msg('assignment', { ...f.bindingFields(bind), result: { status: 'resolved', destinations: ['https://evil.invalid/'], unavailable: [] } }));
  await tick();
  f.transport.cancel();
  assert.equal((await pending).ok, false);
  assert.deepEqual(f.navigations, []);
});

test('a partial result permits only an explicitly selected confirmed destination', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.resolve({ interactiveRecovery: true });
  const bind = await f.bound(receiverDocument, 'receiver', 'resolve');
  f.send(f.msg('assignment', {
    ...f.bindingFields(bind),
    result: { status: 'partial', destinations: ['/'], unavailable: ['pulse'] },
  }));
  assert.equal((await pending).ok, true);
  assert.deepEqual(f.navigations, [], 'A partial result cannot automatically choose a product');
  assert.equal((await f.transport.openDestination('/pulse-app/')).ok, false);
  assert.deepEqual(f.navigations, [], 'An unavailable product must not be opened as an assignment');
  const opened = await f.transport.openDestination('/');
  assert.equal(opened.ok, true);
  assert.equal(opened.navigationRequested, true);
  assert.equal('opened' in opened, false);
  assert.deepEqual(f.navigations, [origin + '/']);
  assert.deepEqual(f.popupNavigations, [], 'Destination navigation occurs in the same tab');
});

test('a confirmed assignment cannot be reused after the account changes', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const pending = f.resolve({ interactiveRecovery: true });
  const bind = await f.bound(receiverDocument, 'receiver', 'resolve');
  f.send(f.msg('assignment', {
    ...f.bindingFields(bind),
    result: { status: 'resolved', destinations: ['/'], unavailable: [] },
  }));
  assert.equal((await pending).ok, true);
  f.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: nextAccount });
  assert.equal((await f.transport.openDestination('/')).ok, false);
  assert.deepEqual(f.navigations, []);
});

test('company login can return through a new document in the same popup', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const updates = [];
  const pending = f.resolve({ interactiveRecovery: true, onUpdate: value => updates.push(value) });
  const initial = await f.bound(receiverDocument, 'receiver', 'resolve');
  f.send(f.msg('assignment', {
    ...f.bindingFields(initial),
    result: { status: 'login_required', destinations: [], unavailable: [] },
  }));
  assert.equal((await pending).result.status, 'login_required');
  assert.equal(f.popup.closed, false);
  const returned = await f.bound(targetDocument, 'customer', 'resolve');
  assert.notEqual(returned.requestId, initial.requestId);
  f.send(f.msg('assignment', {
    ...f.bindingFields(initial),
    result: { status: 'resolved', destinations: ['/'], unavailable: [] },
  }));
  await tick();
  assert.deepEqual(updates, [], 'A result from the pre-login document must be ignored');
  f.send(f.msg('assignment', {
    ...f.bindingFields(returned),
    result: { status: 'resolved', destinations: ['/pulse-app/'], unavailable: [] },
  }));
  await tick();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].ok, true);
  assert.deepEqual(updates[0].result.destinations, ['/pulse-app/']);
  assert.equal(f.opens.length, 1, 'The login callback must reuse the original popup');
});

test('company login from an old account cannot rebind after an account switch', async t => {
  const f = fixture(); t.after(() => f.transport.dispose());
  const updates = [];
  const pending = f.resolve({ interactiveRecovery: true, onUpdate: value => updates.push(value) });
  const initial = await f.bound(receiverDocument, 'receiver', 'resolve');
  f.send(f.msg('assignment', {
    ...f.bindingFields(initial),
    result: { status: 'login_required', destinations: [], unavailable: [] },
  }));
  await pending;
  f.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: nextAccount });
  f.ready(targetDocument, 'customer');
  await tick();
  assert.equal(f.posted.filter(row => row.message.type === 'bind').length, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].ok, false);
  assert.equal(updates[0].code, 'ACCOUNT_CHANGED');
});

// --- 3. 팝업 없는 자동 배정 조회(`fetch`) 회귀 시험 ---

test('automatic assignment resolution sends fixed POST fetch options without Authorization or window.open', async t => {
  const f = fetchFixture({
    onFetch: () => jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned', pulse: 'unassigned' })),
  });
  t.after(() => f.transport.dispose());

  const answer = await f.resolve();
  assert.equal(answer.ok, true);
  assert.equal(f.opens.length, 0, 'Automatic assignment lookup must never call window.open');
  assert.equal(f.fetchCalls.length, 1);

  const [call] = f.fetchCalls;
  assert.equal(call.url, destinationsEndpoint);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.credentials, 'include');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.cache, 'no-store');
  assert.deepEqual(call.init.headers, { 'Content-Type': 'application/json' });
  assert.equal(
    Object.keys(call.init.headers).some(key => key.toLowerCase() === 'authorization'),
    false,
    'Platform bearer or authorization headers must never be sent to the company endpoint',
  );
  assert.deepEqual(JSON.parse(call.init.body), { expectedAccountId: account });
  assert.deepEqual(f.sameTabNavigations, [], 'Lookup alone does not navigate before openDestination');
});

for (const [label, body, expected] of [
  [
    '0 assignments',
    httpDestinationsBody({ workspace: 'unassigned', pulse: 'unassigned' }),
    { status: 'resolved', destinations: [], unavailable: [] },
  ],
  [
    '1 workspace assignment',
    httpDestinationsBody({ workspace: 'assigned', pulse: 'unassigned' }),
    { status: 'resolved', destinations: ['/'], unavailable: [] },
  ],
  [
    '1 pulse assignment',
    httpDestinationsBody({ workspace: 'unassigned', pulse: 'assigned' }),
    { status: 'resolved', destinations: ['/pulse-app/'], unavailable: [] },
  ],
  [
    '2 assignments',
    httpDestinationsBody({ workspace: 'assigned', pulse: 'assigned' }),
    { status: 'resolved', destinations: ['/', '/pulse-app/'], unavailable: [] },
  ],
  [
    'partial with confirmed workspace',
    httpDestinationsBody({ workspace: 'assigned', pulse: 'unavailable' }),
    { status: 'partial', destinations: ['/'], unavailable: ['pulse'] },
  ],
  [
    'partial with no confirmed product',
    httpDestinationsBody({ workspace: 'unassigned', pulse: 'unavailable' }),
    { status: 'partial', destinations: [], unavailable: ['pulse'] },
  ],
]) {
  test('automatic fetch maps ' + label + ' without opening a popup', async t => {
    const f = fetchFixture({
      onFetch: () => jsonHttpResponse(200, body),
    });
    t.after(() => f.transport.dispose());

    const answer = await f.resolve();
    assert.equal(answer.ok, true);
    assert.equal(answer.accountGeneration, generation);
    assert.match(answer.requestId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(answer.result, expected);
    assert.equal(f.opens.length, 0);
    assert.deepEqual(f.sameTabNavigations, []);
  });
}

for (const [label, status, payload, expectedCode, expectedRetryable] of [
  ['missing company session', 401, { error: { code: 'LOGIN_REQUIRED', retryable: false } }, 'LOGIN_REQUIRED', false],
  ['auth required alias', 401, { error: { code: 'AUTH_REQUIRED', retryable: false } }, 'LOGIN_REQUIRED', false],
  ['account mismatch', 409, { error: { code: 'ACCOUNT_MISMATCH', retryable: false } }, 'ACCOUNT_MISMATCH', false],
  ['rate limited', 429, { error: { code: 'RATE_LIMITED', retryable: true } }, 'RATE_LIMITED', true],
  ['client forbidden', 403, { error: { code: 'CLIENT_FORBIDDEN', retryable: false } }, 'CLIENT_FORBIDDEN', false],
  ['invalid input', 400, { error: { code: 'INVALID_INPUT', retryable: false } }, 'INVALID_INPUT', false],
  ['temporary server failure', 503, { error: { code: 'TEMPORARY_UNAVAILABLE', retryable: true } }, 'TEMPORARY_UNAVAILABLE', true],
]) {
  test('automatic fetch distinguishes ' + label + ' error without popup or raw server copy', async t => {
    const f = fetchFixture({
      onFetch: () => jsonHttpResponse(status, payload),
    });
    t.after(() => f.transport.dispose());

    const answer = await f.resolve();
    assert.equal(answer.ok, false);
    assert.equal(answer.code, expectedCode);
    assert.equal(answer.retryable, expectedRetryable);
    assert.equal('message' in answer, false);
    assert.equal(f.opens.length, 0, 'Error responses must not trigger automatic popup creation');
  });
}

test('network failure and untrusted server error text collapse to safe temporary failure codes', async t => {
  const f = fetchFixture();
  t.after(() => f.transport.dispose());

  f.enqueueFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  const networkFail = await f.resolve();
  assert.equal(networkFail.ok, false);
  assert.equal(networkFail.code, 'TEMPORARY_UNAVAILABLE');
  assert.equal(networkFail.retryable, true);
  assert.equal(f.opens.length, 0);

  f.enqueueFetch(() => jsonHttpResponse(401, {
    error: {
      code: 'LOGIN_REQUIRED',
      retryable: false,
      message: 'Server supplied UI string must be rejected',
    },
  }));
  const untrustedError = await f.resolve();
  assert.equal(untrustedError.ok, false);
  assert.equal(untrustedError.code, 'TEMPORARY_UNAVAILABLE');
  assert.equal(JSON.stringify(untrustedError).includes('Server supplied'), false);
});

for (const [label, makeBadResponse] of [
  ['wrong schema version', () => jsonHttpResponse(200, { ...httpDestinationsBody(), version: 2 })],
  ['accountMatch false on 200', () => jsonHttpResponse(200, { ...httpDestinationsBody(), accountMatch: false })],
  ['unexpected top-level key', () => jsonHttpResponse(200, { ...httpDestinationsBody(), message: 'unsafe' })],
  [
    'unexpected nested key',
    () => jsonHttpResponse(200, {
      version: 1,
      accountMatch: true,
      workspace: { state: 'assigned', destination: '/', extra: true },
      pulse: { state: 'unassigned', destination: '/pulse-app/' },
    }),
  ],
  [
    'external workspace destination',
    () => jsonHttpResponse(200, {
      version: 1,
      accountMatch: true,
      workspace: { state: 'assigned', destination: 'https://evil.invalid/' },
      pulse: { state: 'unassigned', destination: '/pulse-app/' },
    }),
  ],
  [
    'swapped fixed pulse destination',
    () => jsonHttpResponse(200, {
      version: 1,
      accountMatch: true,
      workspace: { state: 'unassigned', destination: '/' },
      pulse: { state: 'assigned', destination: '/' },
    }),
  ],
  [
    'disallowed workspace unavailable state',
    () => jsonHttpResponse(200, {
      version: 1,
      accountMatch: true,
      workspace: { state: 'unavailable', destination: '/' },
      pulse: { state: 'unassigned', destination: '/pulse-app/' },
    }),
  ],
  ['non-JSON 200 body', () => new Response('<html>unexpected</html>', { status: 200 })],
  [
    'redirected response',
    () => ({
      status: 200,
      redirected: true,
      type: 'basic',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(httpDestinationsBody({ workspace: 'assigned' })),
    }),
  ],
]) {
  test('automatic fetch rejects malformed response: ' + label, async t => {
    const f = fetchFixture({ onFetch: makeBadResponse });
    t.after(() => f.transport.dispose());

    const answer = await f.resolve();
    assert.equal(answer.ok, false);
    assert.equal(answer.code, 'TEMPORARY_UNAVAILABLE');
    assert.equal(f.transport.openDestination('/').ok, false);
    assert.deepEqual(f.sameTabNavigations, []);
  });
}

test('automatic fetch enforces the 64KB response size limit via Content-Length and streaming chunks', async t => {
  const f = fetchFixture();
  t.after(() => f.transport.dispose());

  let bodyReadAttempted = false;
  f.enqueueFetch(() => ({
    status: 200,
    redirected: false,
    type: 'basic',
    headers: new Headers({ 'content-length': '65537' }),
    body: {
      cancel() { return Promise.resolve(); },
      getReader() {
        bodyReadAttempted = true;
        throw new Error('Oversized Content-Length must fail before reading body chunks');
      },
    },
  }));

  const headerRejected = await f.resolve();
  assert.equal(headerRejected.ok, false);
  assert.equal(headerRejected.code, 'TEMPORARY_UNAVAILABLE');
  assert.equal(headerRejected.retryable, false);
  assert.equal(bodyReadAttempted, false);

  let streamCancelled = false;
  f.enqueueFetch(() => {
    let step = 0;
    const stream = new ReadableStream({
      pull(controller) {
        step += 1;
        if (step <= 2) {
          controller.enqueue(new Uint8Array(40_000).fill(0x20));
          return;
        }
        controller.close();
      },
      cancel() {
        streamCancelled = true;
      },
    }, { highWaterMark: 0 });
    return new Response(stream, { status: 200 });
  });

  const streamRejected = await f.resolve();
  assert.equal(streamRejected.ok, false);
  assert.equal(streamRejected.code, 'TEMPORARY_UNAVAILABLE');
  assert.equal(streamRejected.retryable, false);
  assert.equal(streamCancelled, true);
});

test('automatic fetch times out and aborts the underlying request when the deadline expires', async t => {
  const f = fetchFixture({
    transportOptions: { fetchTimeoutMs: 25 },
    onFetch: () => new Promise(() => {}),
  });
  t.after(() => f.transport.dispose());

  const answer = await f.resolve();
  assert.equal(answer.ok, false);
  assert.equal(answer.code, 'HANDOFF_TIMEOUT');
  assert.equal(answer.retryable, true);
  assert.equal(f.fetchCalls.length, 1);
  assert.equal(f.fetchCalls[0].signal?.aborted, true);
});

test('binding mismatch before or during fetch rejects with ACCOUNT_CHANGED and records no destination', async t => {
  const f = fetchFixture();
  t.after(() => f.transport.dispose());

  const staleBeforeStart = await f.transport.resolveAssignments({
    accountGeneration: nextGeneration,
    expectedAccountId: account,
  });
  assert.equal(staleBeforeStart.ok, false);
  assert.equal(staleBeforeStart.code, 'ACCOUNT_CHANGED');
  assert.equal(f.fetchCalls.length, 0, 'Mismatched binding must fail before issuing network requests');

  const staleAccountBeforeStart = await f.transport.resolveAssignments({
    accountGeneration: generation,
    expectedAccountId: nextAccount,
  });
  assert.equal(staleAccountBeforeStart.ok, false);
  assert.equal(staleAccountBeforeStart.code, 'ACCOUNT_CHANGED');
  assert.equal(f.fetchCalls.length, 0);

  const guestRejected = await f.transport.resolveAssignments({
    accountGeneration: generation,
    expectedAccountId: null,
  });
  assert.equal(guestRejected.ok, false);
  assert.equal(guestRejected.code, 'INVALID_INPUT');
  assert.equal(f.fetchCalls.length, 0);

  const inFlightGen = deferred();
  f.enqueueFetch(() => inFlightGen.promise);
  const pendingGen = f.resolve();
  assert.equal(f.fetchCalls.length, 1);

  f.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: account });
  inFlightGen.resolve(jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned', pulse: 'assigned' })));
  const changedGenOutcome = await pendingGen;
  assert.equal(changedGenOutcome.ok, false);
  assert.equal(changedGenOutcome.code, 'ACCOUNT_CHANGED');
  assert.equal(f.transport.openDestination('/').ok, false);

  f.replaceBinding({ accountGeneration: generation, expectedAccountId: account });
  const inFlight = deferred();
  f.enqueueFetch(() => inFlight.promise);
  const pending = f.resolve();
  assert.equal(f.fetchCalls.length, 2);

  f.replaceBinding({ accountGeneration: generation, expectedAccountId: nextAccount });
  inFlight.resolve(jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned', pulse: 'assigned' })));

  const changedDuringFlight = await pending;
  assert.equal(changedDuringFlight.ok, false);
  assert.equal(changedDuringFlight.code, 'ACCOUNT_CHANGED');
  assert.equal(f.transport.openDestination('/').ok, false);
  assert.deepEqual(f.sameTabNavigations, []);
});

test('AbortSignal, cancel, dispose, BUSY guard and late responses from cancelled requests never overwrite newer results', async t => {
  const f = fetchFixture();
  t.after(() => f.transport.dispose());

  // 1) Caller AbortSignal aborts in-flight fetch, and concurrent calls while in flight return BUSY.
  const externalAbort = new AbortController();
  const firstGate = deferred();
  f.enqueueFetch(() => firstGate.promise);
  const abortedRun = f.resolve({ signal: externalAbort.signal });
  const concurrentBusy = await f.resolve();
  assert.equal(concurrentBusy.ok, false);
  assert.equal(concurrentBusy.code, 'BUSY');
  externalAbort.abort();
  const abortedResult = await abortedRun;
  assert.equal(abortedResult.ok, false);
  assert.equal(abortedResult.code, 'CANCELLED');
  assert.equal(f.fetchCalls[0].signal?.aborted, true);

  // 2) Cancelled older request resolving late cannot overwrite a newer confirmed assignment.
  const slowOldResponse = deferred();
  const secondResponse = deferred();
  const customLateCalls = [];
  let customBinding = { accountGeneration: generation, expectedAccountId: account };
  const lateSafeNavigations = [];
  const lateSafeTransport = createCompanyEntryTransport({
    windowRef: {
      crypto: globalThis.crypto,
      location: {
        origin: 'https://synk.im',
        assign(url) { lateSafeNavigations.push(url); },
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      fetch(url, init) {
        customLateCalls.push({ url, init });
        return customLateCalls.length === 1 ? slowOldResponse.promise : secondResponse.promise;
      },
    },
    getBinding: () => customBinding,
  });
  t.after(() => lateSafeTransport.dispose());

  const run1 = lateSafeTransport.resolveAssignments({
    accountGeneration: generation,
    expectedAccountId: account,
  });
  lateSafeTransport.cancel();
  const run1Outcome = await run1;
  assert.equal(run1Outcome.ok, false);
  assert.equal(run1Outcome.code, 'CANCELLED');
  assert.equal(customLateCalls[0].init.signal?.aborted, true);

  const run2 = lateSafeTransport.resolveAssignments({
    accountGeneration: generation,
    expectedAccountId: account,
  });
  secondResponse.resolve(jsonHttpResponse(200, httpDestinationsBody({ workspace: 'unassigned', pulse: 'assigned' })));
  const run2Outcome = await run2;
  assert.equal(run2Outcome.ok, true);
  assert.deepEqual(run2Outcome.result.destinations, ['/pulse-app/']);

  // Now the cancelled first request resolves late with '/' assignment.
  slowOldResponse.resolve(jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned', pulse: 'unassigned' })));
  await tick();
  await tick();

  assert.equal(lateSafeTransport.openDestination('/').ok, false, 'Late response from cancelled request must not overwrite verified destinations');
  const validOpen = lateSafeTransport.openDestination('/pulse-app/');
  assert.equal(validOpen.ok, true);
  assert.equal(validOpen.navigationRequested, true);
  assert.deepEqual(lateSafeNavigations, [origin + '/pulse-app/']);

  // 3) Starting a new request or disposing invalidates prior openable destinations immediately.
  const thirdGate = deferred();
  f.enqueueFetch(() => jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned' })));
  assert.equal((await f.resolve()).ok, true);
  f.enqueueFetch(() => thirdGate.promise);
  const pendingThird = f.resolve();
  assert.equal(f.transport.openDestination('/').ok, false, 'Starting a new request invalidates previous verified resolution');
  f.transport.dispose();
  const disposedOutcome = await pendingThird;
  assert.equal(disposedOutcome.ok, false);
  assert.equal(disposedOutcome.code, 'CANCELLED');
  assert.equal((await f.resolve()).code, 'CANCELLED');
  customBinding = null;
});

test('openDestination navigates same-tab only for destinations in the latest verified resolution', async t => {
  const f = fetchFixture({
    onFetch: () => jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned', pulse: 'unassigned' })),
  });
  t.after(() => f.transport.dispose());

  assert.equal(f.transport.openDestination('/').code, 'HANDOFF_UNAVAILABLE');
  assert.deepEqual(f.sameTabNavigations, []);

  const resolved = await f.resolve();
  assert.equal(resolved.ok, true);

  for (const forbidden of ['/pulse-app/', '/entry/', 'https://workspace.synk.im/', 'https://evil.invalid/']) {
    const rejected = f.transport.openDestination(forbidden);
    assert.equal(rejected.ok, false);
  }
  assert.deepEqual(f.sameTabNavigations, []);

  const opened = f.transport.openDestination('/');
  assert.deepEqual(opened, {
    ok: true,
    requestId: resolved.requestId,
    accountGeneration: generation,
    destination: '/',
    state: 'navigationRequested',
    navigationRequested: true,
  });
  assert.equal('opened' in opened, false);
  assert.equal(f.opens.length, 0);
  assert.deepEqual(f.sameTabNavigations, [
    { method: 'assign', url: 'https://workspace.synk.im/' },
  ]);

  // Verify location.replace fallback when assign is absent.
  const replaceOnly = fetchFixture({
    replaceOnlyLocation: true,
    onFetch: () => jsonHttpResponse(200, httpDestinationsBody({ workspace: 'unassigned', pulse: 'assigned' })),
  });
  t.after(() => replaceOnly.transport.dispose());

  assert.equal((await replaceOnly.resolve()).ok, true);
  const replaced = replaceOnly.transport.openDestination('/pulse-app/');
  assert.equal(replaced.ok, true);
  assert.equal(replaced.navigationRequested, true);
  assert.deepEqual(replaceOnly.sameTabNavigations, [
    { method: 'replace', url: 'https://workspace.synk.im/pulse-app/' },
  ]);
});

function timedInviteFixture({ stepTimeoutMs = 25, totalTimeoutMs = 80, pollIntervalMs = 15 } = {}) {
  const listeners = new Map(), posted = [], opens = [];
  let binding = { accountGeneration: generation, expectedAccountId: account };
  const popup = {
    closed: false,
    close() { this.closed = true; },
    focus() {},
    postMessage(message, targetOrigin) {
      posted.push({ message: structuredClone(message), targetOrigin });
    },
    location: { href: '' },
  };
  const windowRef = {
    crypto: globalThis.crypto,
    location: { origin: 'https://synk.im' },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    open(...args) { opens.push(args); return popup; },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const transport = createCompanyEntryTransport({
    windowRef,
    getBinding: () => binding,
    stepTimeoutMs,
    totalTimeoutMs,
    pollIntervalMs,
  });
  const send = (message, options = {}) => {
    for (const listener of [...(listeners.get('message') || [])]) {
      listener({ origin: options.origin ?? origin, source: options.source ?? popup, data: message });
    }
  };
  const msg = (type, fields) => ({ channel: 'synk.company.entry', version: 1, type, ...fields });
  const ready = (documentId = receiverDocument, documentRole = 'receiver') =>
    send(msg('ready', { documentId, documentRole }));
  const bindingFields = bind => ({
    requestId: bind.requestId,
    accountGeneration: bind.accountGeneration,
    documentId: bind.documentId,
  });
  const last = type => posted.filter(row => row.message.type === type).at(-1)?.message;

  async function advanceToDeliverOffer({ kind = 'employee', destination = '/' } = {}) {
    ready(receiverDocument, 'receiver');
    await tick();
    const classifyBind = last('bind');
    send(msg('bound', { ...bindingFields(classifyBind), phase: 'classify' }));
    await tick();
    const classifyOffer = last('offer');
    assert.equal(classifyOffer.documentId, receiverDocument);
    assert.equal(classifyOffer.token, token);
    send(msg('classified', { ...bindingFields(classifyBind), kind, destination }));
    await tick();

    ready(targetDocument, kind);
    await tick();
    const deliverBind = last('bind');
    assert.equal(deliverBind.phase, 'deliver');
    assert.equal(deliverBind.documentId, targetDocument);
    send(msg('bound', { ...bindingFields(deliverBind), phase: 'deliver' }));
    await tick();

    const offers = posted.filter(row => row.message.type === 'offer').map(row => row.message);
    assert.equal(offers.length, 2, 'Classify and deliver each send exactly one offer');
    assert.equal(offers[1].documentId, targetDocument);
    assert.equal(offers[1].token, token);
    return { classifyBind, deliverBind };
  }

  return {
    transport,
    popup,
    posted,
    opens,
    msg,
    send,
    ready,
    bindingFields,
    last,
    advanceToDeliverOffer,
    replaceBinding(next) { binding = next; },
    startInvite(extra = {}) {
      return transport.startInvite({
        token,
        accountGeneration: generation,
        expectedAccountId: account,
        ...extra,
      });
    },
  };
}

test('classify offer is not treated as final delivery: pre-deliver cancel, timeout, and account change keep original codes', async t => {
  // 1) Explicit cancel after classify offer (before deliver offer) stays CANCELLED and sends cancel.
  const f1 = timedInviteFixture();
  t.after(() => f1.transport.dispose());
  const p1 = f1.startInvite();
  const classifyBind1 = await (async () => {
    f1.ready(receiverDocument, 'receiver');
    await tick();
    const bind = f1.last('bind');
    f1.send(f1.msg('bound', { ...f1.bindingFields(bind), phase: 'classify' }));
    await tick();
    return bind;
  })();
  assert.equal(f1.posted.filter(row => row.message.type === 'offer').length, 1);
  f1.transport.cancel();
  const r1 = await p1;
  assert.deepEqual(r1, { ok: false, code: 'CANCELLED', retryable: false });
  assert.equal(f1.last('cancel')?.documentId, classifyBind1.documentId);

  // 2) Step timeout during await_deliver_bound (deliver bind sent, deliver offer NOT yet sent) stays HANDOFF_TIMEOUT.
  const f2 = timedInviteFixture({ stepTimeoutMs: 20, totalTimeoutMs: 200 });
  t.after(() => f2.transport.dispose());
  const p2 = f2.startInvite();
  f2.ready(receiverDocument, 'receiver');
  await tick();
  const cBind2 = f2.last('bind');
  f2.send(f2.msg('bound', { ...f2.bindingFields(cBind2), phase: 'classify' }));
  await tick();
  f2.send(f2.msg('classified', { ...f2.bindingFields(cBind2), kind: 'customer', destination: '/pulse-app/' }));
  await tick();
  f2.ready(targetDocument, 'customer');
  await tick();
  assert.equal(f2.posted.filter(row => row.message.type === 'offer').length, 1);
  const r2 = await p2;
  assert.deepEqual(r2, { ok: false, code: 'HANDOFF_TIMEOUT', retryable: true });
  assert.equal(f2.last('cancel')?.documentId, targetDocument);

  // 3) Account replacement before deliver offer stays ACCOUNT_CHANGED and sends cancel.
  const f3 = timedInviteFixture({ pollIntervalMs: 10 });
  t.after(() => f3.transport.dispose());
  const p3 = f3.startInvite();
  f3.ready(receiverDocument, 'receiver');
  await tick();
  const cBind3 = f3.last('bind');
  f3.send(f3.msg('bound', { ...f3.bindingFields(cBind3), phase: 'classify' }));
  await tick();
  f3.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: nextAccount });
  const r3 = await p3;
  assert.deepEqual(r3, { ok: false, code: 'ACCOUNT_CHANGED', retryable: false });
  assert.equal(f3.last('cancel')?.documentId, receiverDocument);
});

test('after deliver offer, cancel, abort, timeout, popup close, account change, and dispose settle as HANDOFF_UNCONFIRMED without sending cancel', async t => {
  // 1) Explicit cancel after deliver offer -> HANDOFF_UNCONFIRMED, retryable: false, no cancel message.
  const fCancel = timedInviteFixture();
  t.after(() => fCancel.transport.dispose());
  const pCancel = fCancel.startInvite();
  await fCancel.advanceToDeliverOffer({ kind: 'customer', destination: '/pulse-app/' });
  fCancel.transport.cancel();
  const resCancel = await pCancel;
  assert.deepEqual(resCancel, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fCancel.posted.some(row => row.message.type === 'cancel'), false);
  assert.equal(fCancel.posted.filter(row => row.message.type === 'offer').length, 2);
  assert.equal(JSON.stringify(resCancel).includes(token), false);
  assert.equal(JSON.stringify(fCancel.opens).includes(token), false);

  // 2) AbortSignal abort after deliver offer -> HANDOFF_UNCONFIRMED, no cancel message.
  const fAbort = timedInviteFixture();
  t.after(() => fAbort.transport.dispose());
  const abortController = new AbortController();
  const pAbort = fAbort.startInvite({ signal: abortController.signal });
  await fAbort.advanceToDeliverOffer();
  abortController.abort();
  assert.deepEqual(await pAbort, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fAbort.posted.some(row => row.message.type === 'cancel'), false);

  // 3) ACK loss / step timeout after deliver offer -> HANDOFF_UNCONFIRMED, retryable: false, no auto-resend.
  const fTimeout = timedInviteFixture({ stepTimeoutMs: 20, totalTimeoutMs: 120 });
  t.after(() => fTimeout.transport.dispose());
  const pTimeout = fTimeout.startInvite();
  await fTimeout.advanceToDeliverOffer();
  const resTimeout = await pTimeout;
  assert.deepEqual(resTimeout, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fTimeout.posted.some(row => row.message.type === 'cancel'), false);
  assert.equal(fTimeout.posted.filter(row => row.message.type === 'offer').length, 2);

  // 4) Popup closed after deliver offer -> HANDOFF_UNCONFIRMED.
  const fClosed = timedInviteFixture({ pollIntervalMs: 10 });
  t.after(() => fClosed.transport.dispose());
  const pClosed = fClosed.startInvite();
  await fClosed.advanceToDeliverOffer();
  fClosed.popup.closed = true;
  assert.deepEqual(await pClosed, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fClosed.posted.some(row => row.message.type === 'cancel'), false);

  // 5) Account change after deliver offer -> HANDOFF_UNCONFIRMED, late received ignored.
  const fAccount = timedInviteFixture({ pollIntervalMs: 10 });
  t.after(() => fAccount.transport.dispose());
  const pAccount = fAccount.startInvite();
  const { deliverBind } = await fAccount.advanceToDeliverOffer();
  fAccount.replaceBinding({ accountGeneration: nextGeneration, expectedAccountId: nextAccount });
  const resAccount = await pAccount;
  assert.deepEqual(resAccount, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fAccount.posted.some(row => row.message.type === 'cancel'), false);
  fAccount.send(fAccount.msg('received', {
    ...fAccount.bindingFields(deliverBind),
    kind: 'employee',
    destination: '/',
    state: 'queued',
  }));
  await tick();

  // 6) dispose() after deliver offer -> HANDOFF_UNCONFIRMED, no cancel message.
  const fDispose = timedInviteFixture();
  const pDispose = fDispose.startInvite();
  await fDispose.advanceToDeliverOffer();
  fDispose.transport.dispose();
  assert.deepEqual(await pDispose, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });
  assert.equal(fDispose.posted.some(row => row.message.type === 'cancel'), false);
});

test('deliver phase distinguishes proven product rejection errors from unconfirmed timeouts while keeping queued -> received ACK', async t => {
  // 1) Explicit product INVITE_REJECTED error from bound deliver document proves non-receipt.
  const fRejected = timedInviteFixture();
  t.after(() => fRejected.transport.dispose());
  const pRejected = fRejected.startInvite();
  const { deliverBind: rejectedBind } = await fRejected.advanceToDeliverOffer();
  fRejected.send(fRejected.msg('error', {
    ...fRejected.bindingFields(rejectedBind),
    code: 'INVITE_REJECTED',
    retryable: false,
  }));
  assert.deepEqual(await pRejected, { ok: false, code: 'INVITE_REJECTED', retryable: false });

  // 2) Wire HANDOFF_TIMEOUT from bound deliver document does not disprove receipt -> HANDOFF_UNCONFIRMED.
  const fWireTimeout = timedInviteFixture();
  t.after(() => fWireTimeout.transport.dispose());
  const pWireTimeout = fWireTimeout.startInvite();
  const { deliverBind: timeoutBind } = await fWireTimeout.advanceToDeliverOffer();
  fWireTimeout.send(fWireTimeout.msg('error', {
    ...fWireTimeout.bindingFields(timeoutBind),
    code: 'HANDOFF_TIMEOUT',
    retryable: true,
  }));
  assert.deepEqual(await pWireTimeout, { ok: false, code: 'HANDOFF_UNCONFIRMED', retryable: false });

  // 3) Valid received with wire state 'queued' continues to normalize to host state 'received'.
  const fSuccess = timedInviteFixture();
  t.after(() => fSuccess.transport.dispose());
  const pSuccess = fSuccess.startInvite();
  const { deliverBind: okBind } = await fSuccess.advanceToDeliverOffer({
    kind: 'customer',
    destination: '/pulse-app/',
  });
  fSuccess.send(fSuccess.msg('received', {
    ...fSuccess.bindingFields(okBind),
    kind: 'customer',
    destination: '/pulse-app/',
    state: 'queued',
  }));
  const okResult = await pSuccess;
  assert.deepEqual(okResult, {
    ok: true,
    requestId: okBind.requestId,
    accountGeneration: generation,
    state: 'received',
    destination: '/pulse-app/',
  });
});

async function resolvedDestinationFixture(t, body = httpDestinationsBody({ workspace: 'assigned', pulse: 'assigned' })) {
  const f = fetchFixture({ onFetch: async () => jsonHttpResponse(200, body) });
  t.after(() => f.transport.dispose());
  assert.equal((await f.resolve()).ok, true);
  return f;
}
test('preserving a current verified resolution retains an actual destination without a new lookup', async t => {
  const f = await resolvedDestinationFixture(t);
  f.transport.cancel({ preserveVerifiedResolution: true });
  assert.equal(f.transport.openDestination('/pulse-app/').ok, true);
  assert.deepEqual(f.sameTabNavigations, [{ method: 'assign', url: origin + '/pulse-app/' }]);
  assert.equal(f.fetchCalls.length, 1);
});
test('ordinary cancellation clears a resolution retained for a personal chooser', async t => {
  const f = await resolvedDestinationFixture(t);
  f.transport.cancel({ preserveVerifiedResolution: true });
  f.transport.cancel();
  assert.equal(f.transport.openDestination('/').ok, false);
  assert.deepEqual(f.sameTabNavigations, []);
});
for (const [label, binding] of [['generation', { accountGeneration: nextGeneration, expectedAccountId: account }], ['account', { accountGeneration: generation, expectedAccountId: nextAccount }]]) {
  test('preserved resolution cannot survive a changed ' + label, async t => {
    const f = await resolvedDestinationFixture(t);
    f.transport.cancel({ preserveVerifiedResolution: true });
    f.replaceBinding(binding);
    f.transport.cancel({ preserveVerifiedResolution: true });
    assert.equal(f.transport.openDestination('/').ok, false);
    assert.deepEqual(f.sameTabNavigations, []);
  });
}
test('a preservation request cannot invent an assigned destination for an unassigned account', async t => {
  const f = await resolvedDestinationFixture(t, httpDestinationsBody());
  f.transport.cancel({ preserveVerifiedResolution: true });
  assert.equal(f.transport.openDestination('/').ok, false);
  assert.deepEqual(f.sameTabNavigations, []);
});
test('preserving verification still aborts an unfinished lookup and ignores its late response', async t => {
  const reply = deferred();
  const f = fetchFixture({ onFetch: () => reply.promise });
  t.after(() => f.transport.dispose());
  const pending = f.resolve(); await tick();
  f.transport.cancel({ preserveVerifiedResolution: true });
  assert.equal((await pending).ok, false);
  assert.equal(f.fetchCalls[0].signal.aborted, true);
  reply.resolve(jsonHttpResponse(200, httpDestinationsBody({ workspace: 'assigned' })));
  await tick(); await tick();
  assert.equal(f.transport.openDestination('/').ok, false);
  assert.deepEqual(f.sameTabNavigations, []);
});
