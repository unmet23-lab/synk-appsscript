import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store } from './store.mjs';

const backgroundKey = 'SYNK_COMPANY_BACKGROUND_JOBS_ENABLED';
const workKey = 'SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED';
function environment(t, { background = '0', work } = {}) {
  const before = Object.fromEntries([backgroundKey, workKey].map(key => [key, process.env[key]]));
  for (const [key, value] of [[backgroundKey, background], [workKey, work]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}
function intervals(t) {
  const timers = [], original = globalThis.setInterval;
  t.mock.method(globalThis, 'setInterval', (callback, milliseconds, ...args) => {
    const handle = original(callback, milliseconds, ...args);
    timers.push({ callback, milliseconds, handle });
    return handle;
  });
  return timers;
}
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-work-notifications-'));
  const seed = new Store(directory), calls = { channel: 0, trends: 0, trash: 0 };
  const users = {};
  for (const [id, role] of [['admin', 'admin'], ['worker', 'member']]) users[id] = seed.createUser({ name: 'Synthetic ' + id, email: id + '@work-notifications.example.test', role });
  seed.put('settings', 'company', { companyName: 'Synthetic', enabled: true, hourKst: 9 });
  seed.put('channels', 'synthetic-work-channel', { id: 'synthetic-work-channel', platform: 'youtube', canonicalUrl: 'https://www.youtube.com/@synthetic-work', handle: 'synthetic-work', ownerIds: [users.admin.id], active: true, status: 'ready', createdAt: '2026-10-08T00:00:00.000Z' });
  seed.setSecret('channel:synthetic-work-channel', { apiKey: 'synthetic-key' });
  seed.close();
  let app, base;
  t.after(async () => { await app?.stop(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); await rm(directory, { recursive: true, force: true }); });
  return {
    calls, users, get app() { return app; },
    async start(options = {}) {
      app = createCompanyApp({ dataDir: directory, port: 0, allowTestHost: true, synkIdentityConfig: null, synkCustomerIdentityConfig: null,
        webPushEnabled: false, socialSchedule: false, // This fixture isolates the work-notification timer.
        collector: async channel => { calls.channel++; return { channel: { externalId: channel.handle }, posts: [], warnings: [], coverage: { status: 'complete' } }; },
        dailyTrendsCollector: async () => { calls.trends++; return { items: [], sources: [] }; },
        messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }), trash: async () => { calls.trash++; } }, ...options });
      app.messenger.db.prepare('INSERT OR IGNORE INTO drive_delete_outbox(file_id,connection_id,remote_id,created_at) VALUES(?,?,?,?)').run('synthetic-work-file', 'synthetic-connection', 'synthetic-remote', '2026-10-08T00:00:00.000Z');
      await app.start(); await app.waitForIdle(); base = `http://127.0.0.1:${app.server.address().port}`;
    },
    async request(path, { body, method = body === undefined ? 'GET' : 'POST', user = 'admin', status = 200 } = {}) {
      const token = app.store.mint('session', users[user].id, { csrfToken: 'synthetic-work-csrf' }, 10);
      const response = await fetch(base + path, { method, headers: { Cookie: 'synk_company_session=' + token, Origin: app.origin, 'X-CSRF-Token': 'synthetic-work-csrf', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const value = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(value)}`); return value;
    },
  };
}
async function messageAndTask(f) {
  const boot = await f.request('/messenger/api/bootstrap', { user: 'worker' }), room = boot.channels.find(row => row.systemKey === 'social').id;
  const { message } = await f.request(`/messenger/api/channels/${room}/messages`, { body: { body: 'Synthetic scheduled work' }, status: 201 });
  const { task } = await f.request(`/messenger/api/messages/${message.id}/task`, { body: { title: 'Synthetic deadline', assigneeId: boot.user.id, dueDate: '2026-10-08' }, status: 201 });
  return { boot, room, message, task };
}
function seedPending(f, { message, boot }, id = 'synthetic-restored-work-reminder') {
  f.app.messenger.db.prepare('INSERT INTO message_reminders(id,message_id,user_id,remind_at,created_at) VALUES(?,?,?,?,?)').run(id, message.id, boot.user.id, '2026-10-08T00:30:00.000Z', '2026-10-08T00:00:00.000Z');
  return id;
}

test('work notification environment and option reject invalid values before creating data', async t => {
  environment(t);
  const directory = await mkdtemp(join(tmpdir(), 'synk-invalid-work-notifications-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const value of ['', 'false', 'true', ' 1', '01', '2']) {
    process.env[workKey] = value;
    assert.throws(() => createCompanyApp({ dataDir: directory }), /SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED/);
    assert.deepEqual(await readdir(directory), []);
  }
  delete process.env[workKey];
  for (const workNotificationsEnabled of [null, 0, 1, '0', '1', 'true']) {
    assert.throws(() => createCompanyApp({ dataDir: directory, workNotificationsEnabled }), /boolean|알림|WORK_NOTIFICATIONS/);
    assert.deepEqual(await readdir(directory), []);
  }
});

for (const row of [
  { background: '0', enabled: false },
  { background: '1', enabled: true },
  { background: '0', work: '1', enabled: true },
  { background: '1', work: '0', enabled: false },
  { background: '0', work: '1', option: false, enabled: false },
  { background: '0', work: '0', option: true, enabled: true },
]) test(`work notification status is explicit for background=${row.background}, work=${row.work ?? 'inherited'}, option=${row.option ?? 'unset'}`, async t => {
  environment(t, row); const timers = intervals(t), f = await fixture(t);
  await f.start(row.option === undefined ? {} : { workNotificationsEnabled: row.option });
  const boot = await f.request('/messenger/api/bootstrap'), preferences = await f.request('/messenger/api/workday/notifications');
  assert.equal(boot.scheduledNotifications.enabled, row.enabled);
  assert.equal(preferences.schedulerEnabled, row.enabled);
  assert.equal(preferences.enabled, true, 'personal preferences remain distinct from server availability');
  assert.equal(timers.filter(timer => timer.milliseconds === 15000).length, row.enabled ? 2 : 1, 'identity timer is always present; work timer follows only the effective work setting');
});

test('paused scheduled writes fail without saving while cancellation and turning off remain available', async t => {
  environment(t, { background: '1', work: '0' });
  const f = await fixture(t); await f.start(); const work = await messageAndTask(f);
  assert.equal(work.boot.scheduledNotifications.enabled, false);
  const reminderPath = `/messenger/api/messages/${work.message.id}/reminder`;
  const rejected = await f.request(reminderPath, { method: 'PUT', user: 'worker', body: { remindAt: new Date(Date.now() + 3600000).toISOString() }, status: 503 });
  assert.equal(rejected.code, 'SYNK_WORK_NOTIFICATIONS_PAUSED');
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM message_reminders').get().n, 0);
  for (const body of [{ enabled: true }, { includeWeekends: true }]) {
    const denied = await f.request('/messenger/api/workday/notifications', { method: 'PATCH', user: 'worker', body, status: 503 });
    assert.equal(denied.code, 'SYNK_WORK_NOTIFICATIONS_PAUSED');
    assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM due_digest_preferences').get().n, 0);
  }
  seedPending(f, work);
  await f.request(reminderPath, { method: 'DELETE', user: 'worker' });
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM message_reminders').get().n, 0);
  const off = await f.request('/messenger/api/workday/notifications', { method: 'PATCH', user: 'worker', body: { enabled: false, includeWeekends: true } });
  assert.equal(off.enabled, false); assert.equal(off.schedulerEnabled, false);
  const editedOff = await f.request('/messenger/api/workday/notifications', { method: 'PATCH', user: 'worker', body: { includeWeekends: false } });
  assert.equal(editedOff.enabled, false); assert.equal(editedOff.includeWeekends, false);
});

test('independent work timer delivers once after restart while collection and deletion remain paused, and stopped callbacks do nothing', async t => {
  environment(t, { background: '0', work: '1' });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T01:00:00.000Z') });
  const timers = intervals(t), f = await fixture(t); await f.start(); const work = await messageAndTask(f);
  const reminderPath = `/messenger/api/messages/${work.message.id}/reminder`;
  const { reminder } = await f.request(reminderPath, { method: 'PUT', user: 'worker', body: { remindAt: '2026-10-08T02:00:00.000Z' } });
  f.app.messenger.db.prepare('UPDATE message_reminders SET remind_at=? WHERE id=?').run('2026-10-08T00:30:00.000Z', reminder.id);
  const workTimer = timers.find(timer => timer.milliseconds === 15000);
  await workTimer.callback(); await workTimer.callback();
  const counts = () => ({ reminders: f.app.messenger.db.prepare("SELECT COUNT(*) n FROM notifications WHERE kind='reminder'").get().n, digests: f.app.messenger.db.prepare('SELECT COUNT(*) n FROM due_digests').get().n });
  assert.deepEqual(counts(), { reminders: 1, digests: 1 });
  const pendingQueues = () => { assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 }); assert.equal(f.app.messenger.db.prepare('SELECT attempts FROM drive_delete_outbox').get().attempts, 0); };
  pendingQueues(); await f.app.scheduledTick(); await f.app.waitForIdle(); pendingQueues();
  await f.app.stop(); assert.ok(timers.every(timer => timer.handle._destroyed));
  for (const timer of timers) assert.doesNotThrow(() => timer.callback(), 'a stale callback must not touch closed databases');
  await f.start();
  assert.deepEqual(counts(), { reminders: 1, digests: 1 }, 'restart catches up without duplicating a reminder or the same-day digest');
  for (const timer of timers.filter(timer => !timer.handle._destroyed)) await timer.callback();
  const inbox = await f.request('/messenger/api/notifications', { user: 'worker' });
  assert.equal(inbox.items.filter(item => item.kind === 'reminder').length, 1);
  assert.equal(inbox.items.filter(item => item.kind === 'due_digest').length, 1);
  assert.deepEqual(counts(), { reminders: 1, digests: 1 }); pendingQueues();
});

test('an independent timer rechecks deactivated company users before reminder and due delivery', async t => {
  environment(t, { background: '0', work: '1' });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T23:00:00.000Z') });
  const timers = intervals(t), f = await fixture(t); await f.start(); const work = await messageAndTask(f);
  seedPending(f, work);
  const worker = f.app.store.get('users', f.users.worker.id); f.app.store.put('users', worker.id, { ...worker, active: false });
  t.mock.timers.setTime(new Date('2026-10-08T01:00:00.000Z').getTime());
  for (const timer of timers) await timer.callback();
  assert.equal(f.app.messenger.db.prepare("SELECT COUNT(*) n FROM notifications WHERE kind='reminder'").get().n, 0);
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM due_digests').get().n, 0);
  assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
  await f.app.stop(); await f.start();
  assert.equal(f.app.messenger.db.prepare("SELECT COUNT(*) n FROM notifications WHERE kind='reminder'").get().n, 0);
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) n FROM due_digests').get().n, 0);
});
