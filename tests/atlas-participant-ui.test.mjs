import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createMeetingAdapter } from '../experiences/atlas-lab/meeting.mjs';

// Only DOM primitives used by this module are simulated. Product views and actions
// come from the actual adapter; rendering and handlers are the production module.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this._text = ''; this._value = undefined; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  get textContent() { return this._text + this.children.map(child => child.textContent || '').join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get value() { return this._value ?? this.children.find(child => child.selected)?.value ?? this.children[0]?.value ?? ''; }
  set value(value) { this._value = value; }
}
const api = createMeetingAdapter({ Domain, Ask, Personalization });
const inspect = state => api.inspect(state, { viewer: 'person-a' });
const record = (state, kind, person, extras = {}) => api.record(state, { kind, ...(person ? { person } : {}), ...extras });
function attended() {
  let state = record(api.create('ready'), 'propose', 'person-a');
  for (const person of ['person-a', 'person-b']) {
    state = record(state, 'view', person); state = record(state, 'respond', person, { value: 'accept' });
  }
  return record(state, 'met', 'person-a');
}
function invited(state) {
  state = record(state, 'reconnect', 'person-a', { action: { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' } });
  return record(state, 'reconnect', 'person-b', { action: { kind: 'respond', invitationId: inspect(state).reconnect.invitation.id, value: 'accept' } });
}
const blocked = () => ({ access: { allowed: false }, reconnect: { access: 'unavailable', me: { blocking: true, paused: false } }, proposal: null });
const envelope = (view, revision = 0) => ({ revision, view, csrfToken: 'test-csrf', sessionPath: '/api/atlas-journey/sessions/00000000-0000-4000-8000-000000000001' });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

async function mount(t, initial) {
  const roots = Object.fromEntries(['participant-notice', 'participant-content', 'participant-account', 'participant-title', 'participant-controls'].map(id => [id, new Element('div')]));
  const storage = new Map(), requests = []; let responder = () => { throw new Error('Unexpected UI request'); };
  const globals = { document: { getElementById: id => roots[id], createElement: tag => new Element(tag) },
    location: { hash: '#cap=one-time-test-capability', pathname: '/atlas-lab/participant.html' }, history: { replaceState() {} },
    sessionStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key), removeItem: key => storage.delete(key) }, window: {},
    fetch: async (route, options = {}) => {
      const request = { route, options, body: options.body ? JSON.parse(options.body) : null };
      if (route === '/api/atlas-journey/session') return response(initial);
      requests.push(request); return responder(request);
    } };
  const prior = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => { for (const key of Object.keys(globals)) prior[key] ? Object.defineProperty(globalThis, key, prior[key]) : delete globalThis[key]; });
  let source = await fs.readFile(new URL('../experiences/atlas-lab/participant.mjs', import.meta.url), 'utf8');
  source = source.replace("'./meeting.mjs'", JSON.stringify(new URL('../experiences/atlas-lab/meeting.mjs', import.meta.url).href));
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${randomUUID()}`).toString('base64')}`);
  const participant = globals.window.synkAtlasParticipant;
  function find(action) {
    const walk = node => node.dataset?.participantAction === action ? node : node.children.map(walk).find(Boolean);
    return Object.values(roots).map(walk).find(Boolean);
  }
  function findId(id) {
    const walk = node => node.id === id ? node : node.children.map(walk).find(Boolean);
    return Object.values(roots).map(walk).find(Boolean);
  }
  return { roots, requests, find, findId, snapshot: () => participant.snapshot(), respond: fn => { responder = fn; } };
}

test('delayed reads cannot race a block or overwrite its newer redacted participant projection', async t => {
  const initial = envelope(inspect(api.create('ready'))), ui = await mount(t, initial);
  let release;
  ui.respond(() => new Promise(resolve => { release = () => resolve(response(initial)); }));
  const reading = ui.find('refresh').onclick();
  assert.equal(ui.find('block').disabled, true, 'the displayed controls must serialize the pending read');
  await ui.find('block').onclick();
  assert.equal(ui.requests.filter(request => request.body).length, 0, 'even a stale handler cannot mutate during the read');
  release(); await reading;
  ui.respond(request => {
    assert.equal(request.body.action.action.kind, 'block'); return response(envelope(blocked(), 1));
  });
  await ui.find('block').onclick(); assert.equal(ui.snapshot().access.allowed, false);
  ui.respond(() => response(initial));
  await ui.find('refresh').onclick();
  assert.equal(ui.snapshot().access.allowed, false, 'an older revision must not reinstate a partner profile');
  assert.equal(ui.snapshot().partner, undefined);
  assert.ok(!ui.roots['participant-content'].textContent.includes('가상 인물 B'));
});

test('pending private feedback remains actionable after advancing to the next encounter', async t => {
  let state = record(attended(), 'feedback', 'person-a', { value: 'too-long' });
  state = record(invited(state), 'next'); const before = inspect(state);
  assert.equal(before.encounter.id, 'meeting-2'); assert.equal(before.proposal, null); assert.equal(before.me.pendingProposals.length, 1);
  const ui = await mount(t, envelope(before)), pending = before.me.pendingProposals[0];
  assert.ok(ui.find('apply-once')); assert.ok(ui.find('apply-ongoing')); assert.ok(ui.find('dismiss'));
  assert.equal(ui.snapshot().me.reflection.encounterId, 'meeting-1');
  assert.equal(ui.snapshot().me.reflection.answered, true);
  assert.equal(ui.find('feedback-too-long').disabled, true, 'the completed prior reflection stays visible without allowing a duplicate answer');
  ui.respond(request => {
    assert.deepEqual(request.body.action, { kind: 'apply', proposalId: pending.id, duration: 'once' });
    state = api.record(state, { ...request.body.action, person: 'person-a' }); return response(envelope(inspect(state), 1));
  });
  await ui.find('apply-once').onclick();
  assert.equal(ui.snapshot().me.pendingProposals.length, 0); assert.equal(ui.find('apply-once'), undefined);
});

test('an unwritten reflection after moving on sends the completed prior encounter ID', async t => {
  let state = record(invited(attended()), 'next'); const before = inspect(state);
  assert.equal(before.encounter.id, 'meeting-2'); assert.equal(before.proposal, null);
  assert.deepEqual(before.me.reflection, { encounterId: 'meeting-1', canReflect: true, answered: false });
  const ui = await mount(t, envelope(before)); assert.equal(ui.find('feedback-too-long').disabled, false);
  ui.respond(request => {
    assert.deepEqual(request.body.action, { kind: 'feedback', value: 'too-long', encounterId: 'meeting-1' });
    state = api.record(state, { ...request.body.action, person: 'person-a' }); return response(envelope(inspect(state), 1));
  });
  await ui.find('feedback-too-long').onclick();
  const after = ui.snapshot();
  assert.equal(after.encounter.id, 'meeting-2'); assert.equal(after.proposal, null);
  assert.equal(after.me.feedback.length, 1); assert.equal(after.me.feedback[0].encounterId, 'meeting-1');
  assert.equal(after.me.reflection.answered, true); assert.equal(ui.find('feedback-too-long').disabled, true);
  assert.equal(after.me.pendingProposals[0].targetEncounterId, 'meeting-2', 'review changes target the new unstarted plan, not the completed encounter');
});

test('an accepted but unprepared invitation can be withdrawn and cannot expose a second-send form', async t => {
  let state = invited(attended()); const before = inspect(state);
  assert.equal(before.reconnect.invitation.status, 'accepted'); assert.equal(before.reconnect.canWithdraw, true); assert.equal(before.reconnect.canSend, false);
  const ui = await mount(t, envelope(before)); assert.ok(ui.find('invite-withdraw')); assert.equal(ui.find('send-invitation'), undefined);
  ui.respond(request => {
    assert.deepEqual(request.body.action, { kind: 'reconnect', action: { kind: 'withdraw', invitationId: before.reconnect.invitation.id } });
    state = api.record(state, { ...request.body.action, person: 'person-a' }); return response(envelope(inspect(state), 1));
  });
  await ui.find('invite-withdraw').onclick();
  assert.equal(ui.snapshot().reconnect.invitation.status, 'withdrawn'); assert.equal(ui.find('invite-withdraw'), undefined);
});

test('an action denied after remote blocking removes the previously shown partner immediately', async t => {
  const ui = await mount(t, envelope(inspect(attended())));
  ui.respond(request => request.body
    ? response({ error: 'journey-inaccessible' }, 403)
    : response(envelope(blocked(), 1)));
  await ui.find('intent-yes').onclick();
  assert.equal(ui.snapshot().access.allowed, false);
  assert.equal(ui.snapshot().partner, undefined);
  assert.equal(ui.find('send-invitation'), undefined);
});

test('a failed invitation transmission keeps the explicit message draft for manual retry', async t => {
  const ui = await mount(t, envelope(inspect(attended())));
  const message = ui.findId('participant-invitation'); message.value = '토요일에는 30분만 이야기할까요?';
  message.oninput?.();
  ui.respond(() => { throw new Error('offline'); });
  await ui.find('send-invitation').onclick();
  assert.equal(ui.findId('participant-invitation').value, '토요일에는 30분만 이야기할까요?');
  assert.equal(ui.snapshot().reconnect.invitation, null);
  assert.equal(ui.requests.filter(r => r.body).length, 1, 'failed sends are never automatically repeated');
});

test('known access denial stays redacted even when the follow-up read fails', async t => {
  const ui = await mount(t, envelope(inspect(attended())));
  ui.respond(request => {
    if (request.body) return response({ error: 'journey-inaccessible' }, 403);
    throw new Error('offline');
  });
  await ui.find('intent-yes').onclick();
  assert.equal(ui.snapshot().access.allowed, false);
  assert.equal(ui.snapshot().partner, undefined);
  assert.equal(ui.find('send-invitation'), undefined);
});

test('invitation input uses the adapter limit and normalizes only surrounding whitespace', async t => {
  let state = attended(); const ui = await mount(t, envelope(inspect(state)));
  const message = ui.findId('participant-invitation'); assert.equal(message.maxLength, 280);
  for (const invalid of ['   ', '가'.repeat(281)]) {
    message.value = invalid; message.oninput(); await ui.find('send-invitation').onclick();
    assert.equal(ui.requests.length, 0); assert.match(ui.roots['participant-notice'].textContent, /1~280/);
  }
  message.value = '  토요일에  잠깐 만날까요?  '; message.oninput();
  ui.respond(request => {
    assert.equal(request.body.action.action.message, '토요일에  잠깐 만날까요?');
    state = api.record(state, { ...request.body.action, person: 'person-a' });
    return response(envelope(inspect(state), 1));
  });
  await ui.find('send-invitation').onclick();
  assert.equal(ui.snapshot().reconnect.invitation.message, '토요일에  잠깐 만날까요?');
});
