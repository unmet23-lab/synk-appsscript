import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE_OWNERS, createMessengerState, createPersonalPanelOwner, createSendAttemptStore, createSessionOwner, enterWorkspaceState } from '../public/messenger-state.js';

const UUID = '0b6f1c1e-6d2a-4f7c-9d3e-1a2b3c4d5e6f';
const memoryStorage = (entries = []) => { const map = new Map(entries); return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };

test('every state field has exactly one owner and a fresh state shares no containers', () => {
  const seen = new Map();
  for (const [owner, fields] of Object.entries(STATE_OWNERS)) for (const key of Object.keys(fields())) { assert.ok(!seen.has(key), `${key} is owned by ${seen.get(key)} and ${owner}`); seen.set(key, owner); }
  const a = createMessengerState(), b = createMessengerState();
  assert.deepEqual(Object.keys(a).sort(), [...seen.keys()].sort());
  assert.notEqual(a.queues, b.queues); assert.notEqual(a.unavailableChannels, b.unavailableChannels); assert.notEqual(a.categoryFilters, b.categoryFilters);
  assert.equal(seen.get('user'), 'session'); assert.equal(seen.get('channelId'), 'conversation'); assert.equal(seen.get('workNotificationSession'), 'personal'); assert.equal(seen.get('sendAttempts'), 'transfer');
});

test('entering a workspace replaces the login and the conversation but keeps view settings', () => {
  const state = createMessengerState();
  Object.assign(state, { channelId: 'old', messages: [{ id: '1' }], drawer: 'personal', chatCategory: 'all', navigationSeq: 4, fileQuery: '견적', personalTab: 'notifications', roomQuery: '운영' });
  state.unavailableChannels.add('gone');
  enterWorkspaceState(state, { user: { id: 'u1' }, workspace: { name: 'SYNK' }, channels: [{ id: 'self' }], members: [], limits: { fileBytes: 10 }, sendRecovery: { messages: true }, platformUrl: '' });
  assert.equal(state.user.id, 'u1'); assert.equal(state.channelId, null); assert.deepEqual(state.messages, []); assert.equal(state.drawer, null); assert.equal(state.chatCategory, 'personal'); assert.equal(state.roomQuery, '');
  assert.equal(state.navigationSeq, 5, 'pending navigation from the previous login is invalidated');
  assert.equal(state.unavailableChannels.size, 0); assert.equal(state.fileBytes, 10); assert.equal(state.platformUrl, null); assert.deepEqual(state.storage, { provider: 'local' });
  assert.deepEqual(state.sendRecovery, { messages: true, uploads: false });
  assert.equal(state.fileQuery, '견적'); assert.equal(state.personalTab, 'notifications');
});

test('the session owner rejects responses after a user, link or CSRF change and ends transfers on reset', () => {
  const state = createMessengerState(), session = createSessionOwner(state);
  state.user = { id: 'u1' }; state.integrated = { companyUserId: 'c1', csrfToken: 't1' };
  const identity = session.identity(), transfer = session.transferContext();
  assert.ok(session.identityCurrent(identity)); assert.ok(session.transferCurrent(transfer));
  state.integrated.csrfToken = 't2'; assert.ok(!session.identityCurrent(identity)); state.integrated.csrfToken = 't1';
  state.integrated = { ...state.integrated }; assert.ok(!session.identityCurrent(identity));
  const aborted = [], upload = { xhr: { abort: () => aborted.push('xhr') }, rawFile: {} };
  state.queues.set('c1', [upload]); state.sendAttempts.set('k', {}); state.sending = true;
  session.resetTransfers();
  assert.ok(!session.transferCurrent(transfer)); assert.equal(upload.cancelled, true); assert.equal(upload.rawFile, null); assert.deepEqual(aborted, ['xhr']);
  assert.equal(state.queues.size, 0); assert.equal(state.sendAttempts.size, 0); assert.equal(state.sending, false);
  assert.ok(!session.transferCurrent({ userId: undefined, session: state.transferSession }), 'no user, no transfer');
});

test('expiry and leaving stop live updates and clear the login', () => {
  const state = createMessengerState(), session = createSessionOwner(state), closed = [];
  state.user = { id: 'u1' }; state.events = { close: () => closed.push('events') }; state.queues.set('c1', [{ xhr: { abort: () => closed.push('xhr') } }]);
  session.expire();
  assert.deepEqual(closed, ['events', 'xhr']); assert.equal(state.user, null); assert.equal(state.queues.size, 0);
  state.user = { id: 'u2' }; const before = state.transferSession;
  session.leave();
  assert.equal(state.user, null); assert.equal(state.transferSession, before + 1); assert.deepEqual(closed, ['events', 'xhr', 'events']);
});

test('a same-account bootstrap updates the company link in place; another account or CSRF replaces it', () => {
  const state = createMessengerState(), session = createSessionOwner(state);
  const link = state.integrated = { companyUserId: 'c1', csrfToken: 't1', canWrite: true };
  session.adoptBootstrap({ integrated: { companyUserId: 'c1', csrfToken: 't1', canWrite: false } });
  assert.equal(state.integrated, link); assert.equal(link.canWrite, false);
  session.adoptBootstrap({ integrated: { companyUserId: 'c1', csrfToken: 't2' }, user: { id: 'u9' } });
  assert.notEqual(state.integrated, link); assert.equal(state.user.id, 'u9');
  const replaced = state.integrated; session.adoptBootstrap({}); assert.equal(state.integrated, replaced);
});

test('send attempts survive a reload only for the same user, room and a valid saved request', () => {
  const state = createMessengerState(), session = createSessionOwner(state);
  state.user = { id: 'u1' }; state.channelId = 'c1';
  const saved = { userId: 'u1', channelId: 'c1', clientMessageId: UUID, payload: { body: '안녕', fileIds: [] } };
  const storage = memoryStorage([['synk-messenger:send:u1:c1', JSON.stringify(saved)], ['synk-messenger:send:u1:c2', JSON.stringify({ ...saved, channelId: 'c2', clientMessageId: 'not-a-uuid' })], ['synk-messenger:send:u1:c3', JSON.stringify({ ...saved, channelId: 'c3', userId: 'u2' })]]);
  const store = createSendAttemptStore(state, { storage, transferCurrent: session.transferCurrent });
  const attempt = store.get();
  assert.deepEqual({ ...attempt }, { ...saved, busy: false, status: 'unknown' });
  assert.equal(store.get('c1'), attempt, 'restored once, then served from memory');
  assert.equal(store.get('c2'), null); assert.equal(store.get('c3'), null);
  state.unavailableChannels.add('c1'); assert.equal(store.get('c1'), null); state.unavailableChannels.delete('c1');
  state.user = null; assert.equal(store.get('c1'), null); state.user = { id: 'u1' };
  const context = session.transferContext();
  assert.ok(store.current(attempt, context));
  session.resetTransfers(); assert.ok(!store.current(attempt, context), 'a reset transfer session drops late replies');
});

test('send attempts persist without their busy state and are forgotten only for their own request', () => {
  const state = createMessengerState(), session = createSessionOwner(state), storage = memoryStorage();
  state.user = { id: 'u1' }; state.channelId = 'c1';
  const store = createSendAttemptStore(state, { storage, transferCurrent: session.transferCurrent });
  const attempt = { userId: 'u1', session: 0, channelId: 'c1', clientMessageId: UUID, payload: { body: 'x', fileIds: [] }, busy: true, status: 'sending' };
  assert.equal(store.persist(attempt), true);
  assert.deepEqual(JSON.parse(storage.map.get('synk-messenger:send:u1:c1')), { userId: 'u1', session: 0, channelId: 'c1', clientMessageId: UUID, payload: { body: 'x', fileIds: [] } });
  store.remember(attempt); assert.equal(store.get('c1'), attempt); assert.ok(store.current(attempt, session.transferContext()));
  store.forget({ ...attempt, clientMessageId: '11111111-1111-4111-8111-111111111111' });
  assert.ok(storage.map.has('synk-messenger:send:u1:c1'), 'another request does not erase this one'); assert.equal(store.get('c1'), attempt);
  store.forget(attempt);
  assert.ok(!storage.map.has('synk-messenger:send:u1:c1')); assert.equal(store.get('c1'), null);
  const full = createSendAttemptStore(state, { storage: { ...storage, setItem() { throw new Error('quota'); } }, transferCurrent: session.transferCurrent });
  assert.equal(full.persist(attempt), false, 'a full browser storage refuses the send instead of losing the record');
});

function personalFixture() {
  const state = createMessengerState(), calls = [], timers = new Map(); let id = 0;
  const personal = createPersonalPanelOwner(state, {
    cancelRefresh: () => { calls.push('cancel'); personal.stopRefresh(); },
    setNotificationStatus: (enabled, options) => personal.applyNotificationStatus(enabled, options),
    showReminderStatus: () => calls.push(['labels', state.scheduledNotifications.enabled]),
    setTimer: (callback, delay) => { timers.set(++id, { callback, delay }); return id; }, clearTimer: timer => timers.delete(timer),
  });
  state.user = { id: 'u1' };
  return { state, personal, calls, timers };
}

test('the personal panel reset invalidates pending reads and clears work data for the next login', () => {
  const { state, personal, calls } = personalFixture();
  Object.assign(state, { scheduledNotifications: { enabled: true }, customerWork: [{ id: 'a' }], workdayCount: 3, deadlineSettings: {}, deadlineSettingsUser: 'u1' });
  const ticket = personal.ticket({ revise: true });
  assert.ok(personal.current(ticket));
  personal.reset();
  assert.ok(!personal.current(ticket)); assert.ok(!personal.sameAccount(ticket));
  assert.deepEqual(state.scheduledNotifications, { enabled: null }); assert.deepEqual(state.customerWork, []); assert.equal(state.workdayCount, null);
  assert.equal(state.deadlineSettings, undefined); assert.equal(state.deadlineSettingsUser, null); assert.deepEqual(state.clientRechecks, {});
  assert.deepEqual(calls, ['cancel', ['labels', null]]);
});

test('a newer notification-status read wins over an older one for the same login', () => {
  const { state, personal } = personalFixture();
  const older = personal.ticket({ revise: true }), newer = personal.ticket({ revise: true });
  assert.ok(!personal.current(older) && personal.sameAccount(older)); assert.ok(personal.current(newer));
  personal.applyNotificationStatus('yes'); assert.deepEqual(state.scheduledNotifications, { enabled: null }, 'only booleans count as a known status');
  personal.applyNotificationStatus(false, { invalidatePending: true }); assert.ok(!personal.current(newer)); assert.equal(state.scheduledNotifications.enabled, false);
  const anonymous = { userId: undefined, session: state.workNotificationSession, revision: state.workNotificationRevision };
  state.user = null; assert.ok(personal.matches(anonymous)); assert.ok(!personal.current(anonymous), 'a read without a login is never current');
});

test('the workday refresh timer fires once for the same login and is dropped after a reset or reschedule', () => {
  const { state, personal, timers } = personalFixture(), runs = [];
  personal.startRefresh(1500, () => runs.push('first'));
  const [firstId, first] = [...timers][0];
  assert.equal(first.delay, 1500);
  personal.stopRefresh(); personal.startRefresh(2000, () => runs.push('second'));
  first.callback(); assert.deepEqual(runs, [], 'a superseded timer does nothing');
  assert.ok(!timers.has(firstId));
  const [, second] = [...timers].at(-1);
  state.workNotificationSession++; second.callback(); assert.deepEqual(runs, [], 'a new panel session drops the old timer');
  personal.startRefresh(3000, () => runs.push('third')); [...timers].at(-1)[1].callback(); assert.deepEqual(runs, ['third']);
});
