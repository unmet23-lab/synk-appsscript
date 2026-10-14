import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store, today } from './store.mjs';

function environment(t, value) {
  const previous = process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
  if (value === undefined) delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
  else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = value;
  t.after(() => {
    if (previous === undefined) delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
    else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = previous;
  });
}

function intervals(t) {
  const active = [], original = globalThis.setInterval;
  t.mock.method(globalThis, 'setInterval', (callback, milliseconds, ...args) => {
    const handle = original(callback, milliseconds, ...args);
    active.push({ callback, milliseconds, handle });
    return handle;
  });
  return active;
}

function assertScheduledTimers(timers, { background = false, push = false, localInbox = true } = {}) {
  // These approved services have independent schedules. Assert their identities,
  // then verify the remaining identity/general-work/push timers separately.
  const independent = { checkResearch: 30000, scanDeliveryChecks: 60000,
    ...(localInbox ? { scanPublicationInbox: 5000 } : {}),
    ...(background ? { collectPublicationPerformance: 60000, scanPublicationLinks: 60000,
      scanWeeklySummary: 60000, scanAutomationHealthScheduled: 60000, scanSocialPublishing: 15000 } : {}),
  };
  const named = new Set(['checkResearch', 'scanDeliveryChecks', 'scanPublicationInbox', 'collectPublicationPerformance', 'scanPublicationLinks', 'scanWeeklySummary', 'scanAutomationHealthScheduled', 'scanSocialPublishing']);
  const actual = timers.filter(row => named.has(row.callback.name)).map(row => [row.callback.name, row.milliseconds]);
  assert.deepEqual(actual.sort(), Object.entries(independent).sort(), 'only the permitted service schedules start');
  assert.deepEqual(timers.filter(row => !named.has(row.callback.name)).map(row => row.milliseconds).sort((a,b)=>a-b),
    [...(background ? [15000,15000,60000,60000] : [15000]), ...(push ? [30000] : [])].sort((a,b)=>a-b));
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-background-jobs-'));
  let app, at = `${today()}T00:00:00.000Z`;
  const calls = { channel: 0, trends: 0, trash: 0 }, pushSent = [], performance = { calls: 0 };
  const seed = new Store(dir);
  const admin = seed.createUser({ name: 'Synthetic admin', email: 'admin@example.test', role: 'admin', password: 'synthetic-password-2026' });
  seed.put('settings', 'company', { companyName: 'Synthetic', enabled: true, hourKst: 9 });
  seed.put('channels', 'synthetic-channel', { id: 'synthetic-channel', platform: 'youtube', canonicalUrl: 'https://www.youtube.com/@synthetic', handle: 'synthetic', ownerIds: [admin.id], active: true, status: 'ready', createdAt: at });
  seed.setSecret('channel:synthetic-channel', { apiKey: 'synthetic-api-key' });
  seed.close();
  t.after(async () => { await app?.stop(); assert.equal(dirname(resolve(dir)), resolve(tmpdir())); await rm(dir, { recursive: true, force: true }); });
  return {
    calls, pushSent, performance, admin,
    get app() { return app; },
    async start({ seedOutbox = false, seedPerformance = false, webPushEnabled = false, liveClock = false } = {}) {
      app = createCompanyApp({ dataDir: dir, port: 0, allowTestHost: true, synkIdentityConfig: null, synkCustomerIdentityConfig: null, clock: () => liveClock ? new Date().toISOString() : at,
        webPushEnabled, ...(webPushEnabled ? { origin: 'https://workspace.example.test' } : {}),
        webPushSend: async value => { pushSent.push(value); return { statusCode: 201 }; },
        collector: async channel => { calls.channel++; return { channel: { externalId: channel.handle }, posts: [], warnings: [], coverage: { status: 'complete' } }; },
        postPerformanceCollector: async () => { performance.calls++; return { posts: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk', metrics: { views: 1 } }] }; },
        dailyTrendsCollector: async () => { calls.trends++; return { items: [], sources: [] }; },
        messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }), trash: async () => { calls.trash++; } },
      });
      if (seedOutbox) app.messenger.db.prepare('INSERT INTO drive_delete_outbox(file_id,connection_id,remote_id,created_at) VALUES(?,?,?,?)').run('synthetic-file', 'synthetic-connection', 'synthetic-remote', at);
      if (seedPerformance) app.postPerformance.register(admin, { channelId: 'synthetic-channel', url: 'https://www.youtube.com/watch?v=abcdefghijk', publishedAt: new Date(Date.parse(at) - 86400000).toISOString() });
      await app.start();
      await app.waitForIdle();
    },
    async request(path, body, { method = body === undefined ? 'GET' : 'POST', user = admin, headers = {} } = {}) {
      const token = user ? app.store.mint('session', user.id, { csrfToken: 'synthetic-csrf' }, 10) : null;
      const response = await fetch(`http://127.0.0.1:${app.server.address().port}${path}`, { method, headers: { ...(token ? { Cookie: `synk_company_session=${token}` } : {}), Origin: app.origin, 'X-CSRF-Token': 'synthetic-csrf', 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json();
      assert.ok(response.ok, JSON.stringify(result));
      await app.waitForIdle();
      return { data: result, response };
    },
    nextDay() { at = new Date(Date.parse(at) + 86_400_000).toISOString(); },
  };
}

test('invalid background environment fails before creating any company or messenger data', async t => {
  environment(t, '0');
  const dir = await mkdtemp(join(tmpdir(), 'synk-invalid-background-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const value of ['', 'false', 'true', ' 0', '01', '2']) {
    process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = value;
    assert.throws(() => createCompanyApp({ dataDir: dir }), /SYNK_COMPANY_BACKGROUND_JOBS_ENABLED/);
    assert.deepEqual(await readdir(dir), []);
  }
});

test('disabled startup and restart preserve pending queues; explicit collection remains available', async t => {
  environment(t, '0');
  const timers = intervals(t), f = await fixture(t);
  await f.start({ seedOutbox: true });
  assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
  assertScheduledTimers(timers);
  await f.app.scheduledTick();
  await f.app.waitForIdle();
  assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
  assert.equal(f.app.messenger.db.prepare('SELECT attempts FROM drive_delete_outbox').get().attempts, 0);
  await f.app.stop();
  assert.ok(timers.every(timer => timer.handle._destroyed));
  await f.start();
  assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
  await f.request('/api/channels/synthetic-channel/collect', {});
  await f.request('/api/daily-trends/collect', {});
  assert.deepEqual(f.calls, { channel: 1, trends: 1, trash: 0 });
  await f.app.stop();
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = '1';
  f.nextDay();
  await f.start();
  assert.deepEqual(f.calls, { channel: 2, trends: 2, trash: 1 }, 'new accepted process resumes due collection and durable cleanup');
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM drive_delete_outbox').get().n, 0);
  await f.app.stop();
  assert.ok(timers.every(timer => timer.handle._destroyed), 'stop cancels every registered interval');
});

test('independent push timer delivers new mentions and customer alerts without draining paused background queues', async t => {
  environment(t, '0');
  const timers = intervals(t), f = await fixture(t);
  await f.start({ seedOutbox: true, webPushEnabled: true, liveClock: true });
  assertScheduledTimers(timers, { push: true, localInbox: false });
  const other = f.app.store.createUser({ name: 'Synthetic sender', email: 'sender@example.test', role: 'member' });
  const boot = (await f.request('/messenger/api/bootstrap')).data;
  const room = boot.channels.find(channel => channel.systemKey === 'social').id;
  const sendMention = async body => (await f.request(`/messenger/api/channels/${room}/messages`, { body, mentionIds: [boot.user.id] }, { user: other })).data.message;
  const oldMessage = await sendMention('Synthetic old mention');
  await f.request(`/messenger/api/messages/${oldMessage.id}/task`, { title: 'Synthetic overdue task', assigneeId: boot.user.id, dueDate: '2020-01-01' });
  f.app.messenger.db.prepare('INSERT INTO message_reminders(id,message_id,user_id,remind_at,created_at) VALUES(?,?,?,?,?)').run('synthetic-paused-reminder', oldMessage.id, boot.user.id, '2020-01-01T00:00:00.000Z', '2019-12-31T00:00:00.000Z');
  f.app.messenger.db.prepare('INSERT INTO due_digest_preferences(user_id,enabled,include_weekends) VALUES(?,?,?)').run(boot.user.id, 1, 1);
  const oldIds = f.app.messenger.notificationsForCompanyUser(f.admin.id).map(item => item.id);
  const state = (await f.request('/api/device-notifications')).data;
  assert.equal(state.configured, true);
  const key = state.publicKey;
  await f.request('/api/device-notifications', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-independent-push' }, label: 'Synthetic device' });
  const pendingQueues = () => {
    assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
    assert.equal(f.app.messenger.db.prepare('SELECT attempts FROM drive_delete_outbox').get().attempts, 0);
    assert.equal(f.app.messenger.db.prepare('SELECT delivered_at FROM message_reminders').get().delivered_at, null);
    assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM due_digests').get().n, 0);
    assert.equal(f.app.messenger.db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind IN ('reminder','due_digest')").get().n, 0);
  };
  const drainPushTimer = async () => {
    const timer = timers.findLast(item => item.milliseconds === 30000);
    timer.callback();
    await f.app.deviceNotifications.tick();
    await f.app.scheduledTick();
    await f.app.waitForIdle();
    await f.request('/messenger/api/notifications');
    await f.request('/messenger/api/reminders');
    pendingQueues();
  };
  await drainPushTimer();
  assert.equal(f.pushSent.length, 0, 'notifications predating the device opt-in are baseline only');
  for (const id of oldIds) assert.equal(f.app.store.db.prepare('SELECT state FROM web_push_queue WHERE notification_id=?').get(id).state, 'baseline');
  const mention = await sendMention('Synthetic new mention');
  await drainPushTimer();
  assert.equal(f.pushSent.length, 1, 'the 30 second timer sends an explicit mention while background work remains paused');
  assert.ok(f.app.messenger.notificationsForCompanyUser(f.admin.id).some(item => item.kind === 'mention' && item.message.id === mention.id && item.readAt === null));
  const project = (await f.request('/api/client-projects', { title: 'Synthetic push project', customerName: 'Synthetic customer', summary: 'PRIVATE PROJECT TEXT' })).data.project;
  const invite = (await f.request(`/api/client-projects/${project.id}/invite`, { revision: project.revision })).data.invite;
  const customer = await f.request('/pulse/api/open', { invite }, { user: null });
  await f.request('/pulse/api/action', { revision: customer.data.project.revision, action: 'support', text: 'PRIVATE CUSTOMER TEXT' }, { user: null, headers: { Cookie: customer.response.headers.get('set-cookie').split(';')[0], 'X-Pulse-CSRF': customer.data.csrf } });
  await drainPushTimer();
  assert.equal(f.pushSent.length, 2, 'customer support notifications use the same independently enabled timer');
  assert.ok(f.app.messenger.notificationsForCompanyUser(f.admin.id).some(item => item.kind === 'client_workflow' && item.unread));
  for (const request of f.pushSent) { assert.equal(request.body, undefined); assert.equal(request.payload, undefined); }
  await f.app.stop();
  assert.ok(timers.every(timer => timer.handle._destroyed), 'stop cancels the push timer as well as identity checks');
  await f.start({ webPushEnabled: true, liveClock: true });
  await drainPushTimer();
  assert.equal((await f.request('/api/device-notifications')).data.publicKey, key, 'the same VAPID identity survives an independently enabled restart');
  assert.equal(f.pushSent.length, 2, 'accepted notifications stay deduplicated after restart');
  await sendMention('Synthetic pending mention before push opt-out');
  await f.app.stop();
  const sent = f.pushSent.length;
  for (const timer of timers.filter(item => item.milliseconds === 30000)) timer.callback();
  await f.app.deviceNotifications.tick();
  assert.equal(f.pushSent.length, sent, 'a stopped service cannot dispatch from a previously captured timer callback');
  const timerCount = timers.length;
  await f.start({ webPushEnabled: false, liveClock: true });
  assertScheduledTimers(timers.slice(timerCount));
  assert.equal((await f.request('/api/device-notifications')).data.configured, false);
  assert.equal(f.app.store.secret('device-web-push-vapid').publicKey, key, 'disabling transport preserves the key for an intentional later opt-in');
  await f.app.deviceNotifications.tick();
  assert.equal(f.pushSent.length, sent, 'both disabled settings suppress even a persisted subscription with a new unread mention');
  pendingQueues();
});

test('both background work and push disabled create no transport or VAPID key on start, manual ticks or restart', async t => {
  environment(t, '0');
  const timers = intervals(t), f = await fixture(t);
  await f.start({ seedOutbox: true });
  let timerFrom = 0;
  for (let run = 0; run < 2; run++) {
    assertScheduledTimers(timers.slice(timerFrom));
    timerFrom = timers.length;
    assert.equal((await f.request('/api/device-notifications')).data.configured, false);
    assert.equal(f.app.store.secret('device-web-push-vapid'), null);
    await f.app.deviceNotifications.tick();
    await f.app.scheduledTick();
    await f.app.waitForIdle();
    assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
    assert.equal(f.pushSent.length, 0);
    assert.equal(f.app.messenger.db.prepare('SELECT attempts FROM drive_delete_outbox').get().attempts, 0);
    await f.app.stop();
    if (run === 0) await f.start();
  }
  assert.ok(timers.every(timer => timer.handle._destroyed));
});

for (const value of [undefined, '1']) test(`background setting ${value ?? 'unset'} retains immediate and periodic work`, async t => {
  environment(t, value);
  const timers = intervals(t), f = await fixture(t);
  await f.start({ seedOutbox: true });
  assert.deepEqual(f.calls, { channel: 1, trends: 1, trash: 1 });
  assertScheduledTimers(timers, { background: true });
  f.nextDay();
  for (const timer of timers.filter(timer => timer.milliseconds === 60000)) await timer.callback();
  await f.app.waitForIdle();
  assert.deepEqual(f.calls, { channel: 2, trends: 2, trash: 1 });
  await f.app.stop();
  assert.ok(timers.every(timer => timer.handle._destroyed));
});


test('registered due publications keep automatic external collection paused until background work is enabled', async t => {
  environment(t, '0');
  const timers = intervals(t), f = await fixture(t);
  await f.start({ seedPerformance: true });
  assert.equal(f.performance.calls, 0, 'startup must not collect an already due, explicitly registered post while background work is disabled');
  for (const timer of timers) await timer.callback();
  await f.app.waitForIdle();
  assert.equal(f.performance.calls, 0, 'independent local and research timers must not start SNS performance collection');
  assert.deepEqual(f.calls, { channel: 0, trends: 0, trash: 0 });
  await f.app.stop();
  await f.start();
  assert.equal(f.performance.calls, 0, 'a restart preserves the pending checkpoint without collecting it');
  await f.app.stop();
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = '1';
  const activeFrom = timers.length;
  await f.start();
  assert.equal(f.performance.calls, 1, 'the enabled startup collects the retained 24 hour checkpoint once');
  for (const timer of timers.slice(activeFrom)) await timer.callback();
  await f.app.waitForIdle();
  assert.equal(f.performance.calls, 1, 'completed checkpoint is not collected twice');
  await f.app.stop();
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = '0';
  f.nextDay(); f.nextDay();
  const pausedFrom = timers.length;
  await f.start();
  for (const timer of timers.slice(pausedFrom)) await timer.callback();
  await f.app.waitForIdle();
  assert.equal(f.performance.calls, 1, 'the newly due 72 hour checkpoint is paused too');
  await f.app.collectPublicationPerformance();
  assert.equal(f.performance.calls, 2, 'explicit collection remains available while automatic work is paused');
});
