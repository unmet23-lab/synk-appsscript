// Loopback-only transport for two fictional adult roles. Capabilities distinguish
// demo sessions, not verified identities. No account service, model or disk writes.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const PREFIX = '/api/atlas-journey', COOKIE = 'atlas_journey_session';
const DAY = 86400000, MAX_BODY = 16384;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && keys.length === Object.keys(value).length && keys.every(key => Object.hasOwn(value, key));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, (_key, entry) => plain(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const expiry = value => new Date(value).toISOString();

function localRequest(req) {
  if (!loopback(req.socket?.remoteAddress) || !loopback(req.socket?.localAddress)) fail(403, 'loopback-required', 'This fictional demo only accepts loopback connections.');
  let origin;
  try { origin = new URL(`http://${req.headers.host}`); } catch { fail(403, 'invalid-host', 'Use the local host URL.'); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || Number(origin.port || 80) !== req.socket.localPort
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) fail(403, 'invalid-host', 'Use the local host URL.');
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) fail(403, 'cross-site-request', 'Use this demo from its own origin.');
  if (req.method !== 'GET' || req.headers.origin) {
    if (req.headers.origin !== origin.origin) fail(403, 'origin-required', 'A matching local Origin is required.');
  }
  return origin.origin;
}

async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'json-required', 'Use application/json.');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) fail(413, 'body-too-large', 'The demo request is too large.');
    chunks.push(chunk);
  }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'invalid-json', 'Use a JSON object.'); }
  if (!plain(result)) fail(400, 'invalid-json', 'Use a JSON object.');
  return result;
}

function cookie(req) {
  const values = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) fail(401, 'session-required', 'Open your own fictional role session.');
  return values[0].slice(COOKIE.length + 1);
}

export function createJourneyHost({ adapter, clock = () => new Date(), pairTtlMs = 3 * DAY, sessionTtlMs = DAY, maxPairs = 32 } = {}) {
  if (!adapter?.createFromSelection || !adapter?.record || !adapter?.inspect) throw new TypeError('Journey host requires the meeting adapter.');
  if (typeof clock !== 'function' || !Number.isSafeInteger(pairTtlMs) || pairTtlMs < 1000 || pairTtlMs > 7 * DAY
    || !Number.isSafeInteger(sessionTtlMs) || sessionTtlMs < 1000 || sessionTtlMs > pairTtlMs
    || !Number.isSafeInteger(maxPairs) || maxPairs < 1 || maxPairs > 100) throw new TypeError('Invalid local journey lifetime or capacity.');
  const pairs = new Map(), invitations = new Map(), sessions = new Map(), creations = new Map();
  let stopped = false;
  const now = () => {
    const value = clock(), ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(ms)) throw new TypeError('Journey host clock must return a finite instant.');
    return ms;
  };
  function closePair(pair, reason = 'closed') {
    pair.status = reason; pair.state = null; pair.requests.clear();
    for (const [token, invitation] of invitations) if (invitation.pairId === pair.id) invitations.delete(token);
    for (const session of sessions.values()) if (session.pairId === pair.id) { session.revoked = true; session.tokenHash = null; session.csrf = null; }
    for (const creation of creations.values()) if (creation.pairId === pair.id) creation.response = null;
  }
  function cleanup() {
    const at = now();
    for (const pair of pairs.values()) if (pair.expiresAt <= at && pair.status === 'active') closePair(pair, 'expired');
    for (const [id, session] of sessions) if (session.expiresAt <= at) sessions.delete(id);
    for (const [token, invitation] of invitations) if (invitation.expiresAt <= at) invitations.delete(token);
    // Tombstones last as long as this pair's published lifetime; no content is retained.
    for (const [id, pair] of pairs) if (pair.expiresAt <= at) pairs.delete(id);
    for (const [id, creation] of creations) if (creation.expiresAt <= at) creations.delete(id);
  }
  const timer = setInterval(cleanup, Math.min(60000, Math.max(1000, Math.min(pairTtlMs, sessionTtlMs)))); timer.unref?.();
  const serial = (pair, fn) => {
    const work = pair.tail.then(fn); pair.tail = work.catch(() => {}); return work;
  };
  function available(pair) {
    if (stopped) fail(503, 'host-closed', 'This temporary host is closed.');
    if (!pair || pair.status !== 'active' || pair.expiresAt <= now()) {
      if (pair?.status === 'active') closePair(pair, 'expired');
      fail(410, 'journey-unavailable', 'This temporary journey is no longer available.');
    }
  }
  function authenticate(req, sessionId, mutation = false) {
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt <= now()) fail(401, 'session-expired', 'Open a valid fictional role session.');
    if (session.revoked) fail(410, 'journey-unavailable', 'This temporary journey is no longer available.');
    const token = cookie(req);
    if (!safeEqual(hash(token), session.tokenHash)) fail(401, 'session-required', 'Open your own fictional role session.');
    if (mutation && !safeEqual(req.headers['x-csrf-token'], session.csrf)) fail(403, 'csrf-required', 'Refresh your own role session before changing it.');
    const pair = pairs.get(session.pairId); available(pair); return { pair, session };
  }
  const asOf = pair => expiry(Math.max(now(), Date.parse(pair.state.events?.at(-1)?.at || 0) || 0));
  function projection(pair, session) {
    const raw = clone(adapter.inspect(pair.state, { viewer: session.actor, at: asOf(pair) }));
    // The pure product adapter owns the detailed privacy rules. The transport
    // additionally removes remote read receipts and never returns its raw log.
    if (raw.access?.allowed === false) return { synthetic: true, viewer: session.actor, access: { allowed: false },
      reconnect: { access: 'unavailable', me: { blocking: raw.reconnect?.me?.blocking === true, paused: raw.reconnect?.me?.paused === true } }, proposal: null };
    const allowed = ['version', 'synthetic', 'viewer', 'scenario', 'encounter', 'connection', 'people', 'settingsTargetEncounterId',
      'me', 'partner', 'recommendation', 'proposal', 'nextQuestion', 'canPropose', 'canNext', 'limitations', 'reconnect', 'access'];
    const view = Object.fromEntries(allowed.filter(key => Object.hasOwn(raw, key)).map(key => [key, raw[key]]));
    if (view.proposal?.people) for (const person of view.proposal.people) if (person.id !== session.actor) delete person.seen;
    if (view.nextQuestion?.person !== session.actor && view.nextQuestion) { view.nextQuestion = null; view.awaitingOtherConfirmation = true; }
    return view;
  }
  const stateResponse = (pair, session) => ({ localOnly: true, synthetic: true, persistence: 'memory-only', pairId: pair.id,
    actor: session.actor, sessionId: session.id, sessionPath: session.path, csrfToken: session.csrf, revision: pair.revision,
    expiresAt: expiry(session.expiresAt), journeyExpiresAt: expiry(pair.expiresAt), view: projection(pair, session) });
  const reply = (res, status, payload, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers });
    res.end(JSON.stringify(payload));
  };
  async function handle(req, res) {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return false; }
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return false;
    try {
      if (stopped) fail(503, 'host-closed', 'This temporary host is closed.');
      localRequest(req); cleanup();
      if (req.method === 'GET' && pathname === `${PREFIX}/status`) {
        reply(res, 200, { available: true, localOnly: true, synthetic: true, persistence: 'memory-only', roles: 2,
          sessionTtlMs, pairTtlMs, authenticatedIdentity: false }); return true;
      }
      if (req.method === 'POST' && pathname === `${PREFIX}/create`) {
        const input = await body(req);
        if (stopped) fail(503, 'host-closed', 'This temporary host is closed.');
        if (!exact(input, ['requestId', 'seed']) || !uuid(input.requestId)) fail(400, 'invalid-create', 'Provide a request UUID and discovery seed.');
        const digest = hash(canonical(input.seed)), previous = creations.get(input.requestId);
        if (previous) {
          if (previous.digest !== digest) fail(409, 'idempotency-conflict', 'That request ID was used for different contents.');
          // Receiving a body is asynchronous: the original lifetime may have
          // ended since the request entered this handler.
          available(pairs.get(previous.pairId));
          if (!previous.response) fail(410, 'journey-unavailable', 'This temporary journey is no longer available.');
          reply(res, 200, previous.response); return true;
        }
        cleanup();
        if (pairs.size >= maxPairs) fail(429, 'local-capacity', 'The local demo has reached its temporary journey limit.');
        const state = adapter.createFromSelection(input.seed), createdAt = now();
        const pair = { id: randomUUID(), state, revision: 0, createdAt, expiresAt: createdAt + pairTtlMs, status: 'active', requests: new Map(), tail: Promise.resolve() };
        const people = adapter.inspect(state, { viewer: 'person-a', at: asOf(pair) }).people;
        if (!Array.isArray(people) || people.length !== 2 || people[0].id !== 'person-a' || people[1].id !== 'person-b') fail(400, 'invalid-pair', 'This demo only supports its two fictional roles.');
        const participants = people.map(person => {
          const capability = secret(); invitations.set(hash(capability), { pairId: pair.id, actor: person.id, expiresAt: pair.expiresAt });
          return { id: person.id, label: person.label, capability };
        });
        pairs.set(pair.id, pair);
        const response = { pairId: pair.id, expiresAt: expiry(pair.expiresAt), localOnly: true, synthetic: true, participants };
        creations.set(input.requestId, { pairId: pair.id, digest, expiresAt: pair.expiresAt, response });
        reply(res, 201, response); return true;
      }
      if (req.method === 'POST' && pathname === `${PREFIX}/session`) {
        const input = await body(req);
        if (stopped) fail(503, 'host-closed', 'This temporary host is closed.');
        if (!exact(input, ['capability']) || typeof input.capability !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.capability)) fail(400, 'invalid-capability', 'Use the one-time role capability.');
        const key = hash(input.capability), invitation = invitations.get(key), pair = pairs.get(invitation?.pairId);
        if (!invitation || invitation.expiresAt <= now()) fail(401, 'capability-expired', 'That one-time role capability is unavailable.');
        await serial(pair, () => {
          available(pair);
          if (!invitations.has(key)) fail(409, 'capability-used', 'That one-time role capability was already used.');
          const id = randomUUID(), token = secret(), session = { id, path: `${PREFIX}/sessions/${id}`, pairId: pair.id,
            actor: invitation.actor, tokenHash: hash(token), csrf: secret(), expiresAt: Math.min(now() + sessionTtlMs, pair.expiresAt), revoked: false };
          invitations.delete(key); sessions.set(id, session);
          reply(res, 200, stateResponse(pair, session), { 'Set-Cookie': `${COOKIE}=${token}; Path=${session.path}; HttpOnly; SameSite=Strict; Max-Age=${Math.max(1, Math.floor((session.expiresAt - now()) / 1000))}` });
        }); return true;
      }
      const match = new RegExp(`^${PREFIX}/sessions/([a-f0-9-]{36})/(state|action|control)$`).exec(pathname);
      if (!match || !uuid(match[1])) fail(404, 'not-found', 'Unknown local journey endpoint.');
      const [, sessionId, operation] = match;
      if (req.method !== (operation === 'state' ? 'GET' : 'POST')) fail(405, 'method-not-allowed', 'Use the endpoint method.');
      const authorized = authenticate(req, sessionId, operation !== 'state');
      if (operation === 'state') {
        await serial(authorized.pair, () => { const { pair, session } = authenticate(req, sessionId); reply(res, 200, stateResponse(pair, session)); }); return true;
      }
      const input = await body(req);
      if (!exact(input, ['requestId', 'expectedRevision', 'action']) || !uuid(input.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail(400, 'invalid-mutation', 'Provide a UUID, expected revision and explicit action.');
      if (operation === 'control' ? !['revoke', 'delete'].includes(input.action) : !plain(input.action) || Object.hasOwn(input.action, 'person') || Object.hasOwn(input.action, 'at')) fail(400, 'invalid-action', 'The server determines the actor and event time.');
      await serial(authorized.pair, () => {
        const { pair, session } = authenticate(req, sessionId, true);
        const requestKey = `${session.actor}:${input.requestId}`, digest = hash(canonical({ operation, expectedRevision: input.expectedRevision, action: input.action })), previous = pair.requests.get(requestKey);
        if (previous) {
          if (previous.digest !== digest) fail(409, 'idempotency-conflict', 'That request ID was used for different contents.');
          // Replay the receipt, but project current permissions and values. A past
          // successful request must not expose a now-blocked profile or erased data.
          reply(res, 200, { ...stateResponse(pair, session), appliedRevision: previous.appliedRevision, replayed: true }); return;
        }
        if (input.expectedRevision !== pair.revision) fail(409, 'revision-conflict', 'This journey changed. Read its current state before applying your edit.');
        if (operation === 'control') {
          pair.revision++; closePair(pair, input.action === 'delete' ? 'deleted' : 'revoked');
          reply(res, 200, { closed: true, deleted: input.action === 'delete', revision: pair.revision, persistence: 'memory-only' },
            { 'Set-Cookie': `${COOKIE}=; Path=${session.path}; HttpOnly; SameSite=Strict; Max-Age=0` }); return;
        }
        const access = adapter.inspect(pair.state, { viewer: session.actor, at: asOf(pair) }).access;
        if (access?.allowed === false && !(input.action.kind === 'reconnect' && ['block', 'unblock'].includes(input.action.action?.kind))) fail(403, 'journey-inaccessible', 'This journey is not currently accessible.');
        const last = Date.parse(pair.state.events?.at(-1)?.at || 0) || 0;
        const action = { ...clone(input.action), person: session.actor, at: expiry(Math.max(now(), last + 1)) };
        // `next` is a pair transition in the pure adapter, with no actor property.
        if (action.kind === 'next') delete action.person;
        const updated = adapter.record(pair.state, action);
        pair.state = updated; pair.revision++;
        pair.requests.set(requestKey, { digest, appliedRevision: pair.revision });
        reply(res, 200, { ...stateResponse(pair, session), appliedRevision: pair.revision, replayed: false });
      }); return true;
    } catch (error) {
      const status = error.status || (error instanceof TypeError ? 400 : 500);
      reply(res, status, { error: error.code || (status === 400 ? 'invalid-action' : 'host-error'),
        message: error.status ? error.message : status === 400 ? 'This action is not valid in the current journey.' : 'The local journey host could not complete the request.' });
      return true;
    }
  }
  function close() {
    stopped = true; clearInterval(timer);
    for (const pair of pairs.values()) closePair(pair);
    pairs.clear(); invitations.clear(); sessions.clear(); creations.clear();
  }
  return Object.freeze({ handle, close });
}
