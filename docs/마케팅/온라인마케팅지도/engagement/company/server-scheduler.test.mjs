import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { Store, today } from './store.mjs';
import { refreshCredentials } from './oauth.mjs';

const DAY = 86_400_000;
const atMinutes = (at, minutes) => new Date(Date.parse(at) + minutes * 60_000).toISOString();
const startOfSchedule = () => `${today()}T00:00:00.000Z`; // 09:00 KST on today's date.
const success = (channel, partial = false) => ({
  channel: { externalId: channel.handle || channel.id, displayName: 'Fixture channel', followers: 0, views: 100 },
  posts: [{ externalId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'Fixture post', publishedAt: '2026-01-01T00:00:00Z', metrics: { views: 100, likes: 0, comments: 2, shares: null, saves: null, reach: null } }],
  warnings: partial ? ['Fixture unavailable metric'] : [], coverage: { status: partial ? 'partial' : 'complete', ownerAuthorized: false },
});
const failure = (code, retryable = false) => Object.assign(new Error('Fixture collection failure'), { code, retryable });

async function fixture(t, collector, { seed, startAt = startOfSchedule(), appOptions = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'synk-scheduler-'));
  let at = startAt;
  if (seed) {
    const store = new Store(dir);
    try { seed(store, at); } finally { store.close(); }
  }
  const app = createCompanyApp({ dataDir: dir, port: 0, allowTestHost: true, schedule: false, collector, dailyTrendsCollector:async()=>({items:[],sources:[]}), ...appOptions, clock: () => at });
  const address = await app.start();
  t.after(async () => {
    await app.stop();
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(dir.includes('synk-scheduler-'));
    await rm(dir, { recursive: true, force: true });
  });
  const admin = app.store.all('users').find(user => user.role === 'admin') || app.store.createUser({ name: 'Scheduler admin', email: 'scheduler@example.test', role: 'admin', password: 'fixture-admin-password' });
  const session = app.store.mint('session', admin.id, { csrfToken: 'scheduler-test-csrf' }, 10);
  const base = `http://127.0.0.1:${address.port}`;
  const call = async (path, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: `synk_company_session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: app.origin, 'X-CSRF-Token': 'scheduler-test-csrf' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  const add = async (handle = 'scheduler') => {
    const added = await call('/api/channels', { urls: `https://www.youtube.com/@${handle}` });
    assert.equal(added.status, 201);
    const channel = added.data.added[0];
    assert.ok(channel);
    assert.equal((await call(`/api/channels/${channel.id}/connection`, { apiKey: 'fixture-public-api-key' })).status, 200);
    return channel;
  };
  const tick = async (value) => { at = value; await app.scheduledTick(value); await app.waitForIdle(); };
  app.store.put('settings', 'company', { companyName: 'Scheduler Test', enabled: true, hourKst: 9 });
  return { app, admin, call, add, tick, setTime: value => { at = value; }, getTime: () => at };
}

test('enqueue persists failure, scheduled tick waits then retries, and success clears failure fields', async t => {
  let calls = 0;
  const f = await fixture(t, async (channel, credentials) => {
    assert.equal(credentials.apiKey, 'fixture-public-api-key');
    calls++;
    if (calls < 3) throw failure('TIMEOUT', true);
    return success(channel);
  });
  const start = f.getTime();
  const channel = await f.add();
  assert.equal((await f.call(`/api/channels/${channel.id}/collect`, {})).status, 202);
  await f.app.waitForIdle();
  let saved = f.app.store.get('channels', channel.id);
  assert.equal(calls, 1);
  assert.equal(saved.status, 'error');
  assert.equal(saved.failureKind, 'transient');
  assert.equal(saved.failureCode, 'TIMEOUT');
  assert.equal(saved.retryCount, 1);
  assert.equal(saved.lastFailureAt, start);
  assert.equal(saved.nextRetryAt, atMinutes(start, 5));
  assert.equal((await f.call('/api/state')).data.collection.retryScheduled, 1);
  assert.equal(f.app.store.all('snapshots').length, 0);

  await f.tick(atMinutes(start, 4));
  assert.equal(calls, 1);
  await f.tick(atMinutes(start, 5));
  assert.equal(calls, 2);
  saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.retryCount, 2);
  assert.equal(saved.nextRetryAt, atMinutes(start, 25));
  await f.tick(atMinutes(start, 24));
  assert.equal(calls, 2);
  await f.tick(atMinutes(start, 25));
  assert.equal(calls, 3);
  saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.status, 'success');
  assert.equal(saved.lastCollectedAt, atMinutes(start, 25));
  assert.equal(saved.lastSuccessAt, atMinutes(start, 25));
  for (const field of ['failureKind', 'failureCode', 'lastFailureAt', 'nextRetryAt', 'lastError']) assert.equal(saved[field], null, field);
  assert.equal(saved.retryCount, 0);
  assert.equal(saved.requiresReconnect, false);
  assert.equal(f.app.store.all('snapshots')[0].likes, 0);
  assert.equal(f.app.store.all('snapshots')[0].shares, null);
  assert.deepEqual(f.app.store.all('runs').map(run => run.status), ['error', 'error', 'success']);
  const health = (await f.call('/api/state')).data.collection;
  assert.equal(health.successToday, 1);
  assert.equal(health.retryScheduled, 0);
  await f.tick(atMinutes(start, 60));
  assert.equal(calls, 4, 'a recent-content scan is due after 30 minutes');
  assert.equal(f.app.store.all('runs').filter(run => run.mode === 'recent').length, 1);
  assert.equal(f.app.store.get('channels', channel.id).lastCollectedAt, atMinutes(start, 25), 'recent scans do not replace the full daily timestamp');
});

test('one-minute inbox checks avoid a second fifteen-minute delay when account scans start 1.5 seconds apart', async t => {
  const start = startOfSchedule(), atMs = elapsed => new Date(Date.parse(start) + elapsed).toISOString();
  const calls = [], scans = { instagram: [], facebook: [] };
  const credentials = {
    instagram: { accessToken: 'fixture-instagram-token', authType: 'instagram-login', apiVersion: 'v26.0', scope: 'instagram_business_basic instagram_business_manage_comments' },
    facebook: { accessToken: 'fixture-facebook-token', authType: 'facebook-page', apiVersion: 'v26.0', scope: 'pages_show_list pages_read_engagement pages_read_user_content' },
  };
  const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
  let f;
  f = await fixture(t, async channel => success(channel), { startAt: start, appOptions: {
    socialInboxOptions: {
      getCredentials: async channel => credentials[channel.platform],
      fetchImpl: async (url, init) => {
        const parsed = new URL(url), platform = parsed.hostname === 'graph.instagram.com' ? 'instagram' : 'facebook';
        assert.equal(init.method, 'GET');
        assert.ok(['graph.instagram.com', 'graph.facebook.com'].includes(parsed.hostname));
        calls.push({ platform, path: parsed.pathname, at: f.getTime() });
        if (parsed.pathname === '/v26.0/me') {
          scans[platform].push(f.getTime());
          // The first account consumes 1.5 seconds before the Facebook scan starts.
          if (platform === 'instagram' && scans.instagram.length === 1) f.setTime(atMs(1500));
          return json({ id: platform === 'instagram' ? '100' : '200', username: 'fixtureinstagram', name: 'Fixture Facebook' });
        }
        if (parsed.pathname === '/v26.0/100/media' || parsed.pathname === '/v26.0/200/posts') return json({ data: [] });
        throw new Error('Unexpected fixture inbox endpoint');
      },
    },
    socialReplyOptions: { fetchImpl: async () => { throw new Error('Fixture reply health is offline'); } },
    socialProviderOptions: { fetchImpl: async () => { throw new Error('Fixture publishing health is offline'); } },
  } });
  for (const platform of ['instagram', 'facebook']) {
    const channel = { id: `inbox-${platform}`, platform, externalId: platform === 'instagram' ? '100' : '200', handle: `fixture${platform}`, active: true, ownerIds: [f.admin.id], connectionVersion: 1 };
    f.app.store.put('channels', channel.id, channel);
    f.app.store.setSecret(`channel:${channel.id}`, credentials[platform]);
    f.app.socialInboxProvider.configure(f.admin, { channelId: channel.id, enabled: true });
  }
  const tick = async elapsed => { f.setTime(atMs(elapsed)); await f.app.scanSocialPublishing(); await f.app.waitForIdle(); };
  await tick(0);
  assert.deepEqual(scans, { instagram: [atMs(0)], facebook: [atMs(1500)] });
  const initialBudget = Object.fromEntries(['instagram', 'facebook'].map(platform => [platform, f.app.store.get('socialInboxRequests', `inbox-${platform}`).times.length]));
  // Run the actual server entry point at its normal 15-second cadence. No account
  // may hit Graph again until its own fifteen-minute interval has elapsed.
  for (let elapsed = 15000; elapsed <= 15 * 60000; elapsed += 15000) await tick(elapsed);
  assert.deepEqual(scans, { instagram: [atMs(0), atMs(15 * 60000)], facebook: [atMs(1500)] });
  for (let elapsed = 15 * 60000 + 15000; elapsed <= 16 * 60000; elapsed += 15000) await tick(elapsed);
  assert.deepEqual(scans.facebook, [atMs(1500), atMs(16 * 60000)], 'Facebook is checked at the next minute, not after another global fifteen-minute round');
  for (let elapsed = 16 * 60000 + 15000; elapsed <= 31 * 60000; elapsed += 15000) await tick(elapsed);
  assert.deepEqual(scans, { instagram: [atMs(0), atMs(15 * 60000), atMs(30 * 60000)], facebook: [atMs(1500), atMs(16 * 60000), atMs(31 * 60000)] });
  assert.equal(calls.length, 12, 'minute-level due checks do not add Graph calls between actual account scans');
  for (const platform of ['instagram', 'facebook']) {
    assert.ok(scans[platform].slice(1).every((at, index) => Date.parse(at) - Date.parse(scans[platform][index]) >= 15 * 60000));
    assert.equal(f.app.store.get('socialInboxRequests', `inbox-${platform}`).times.length, initialBudget[platform] + 4, 'only the two due scans add collection requests after initial connection health checks');
    assert.equal(f.app.socialInboxProvider.capability(f.app.store.get('channels', `inbox-${platform}`)).intervalMinutes, 15);
  }
  const state = await f.call('/api/social/workspace?section=overview');
  assert.equal(state.status, 200);
  assert.equal(state.data.runtime.inbox.intervalMs, 60000);
});

test('minute health polling catches accounts starting 1.5 seconds apart without extra Graph calls or idle notifications', async t => {
  const start=startOfSchedule(),atMs=elapsed=>new Date(Date.parse(start)+elapsed).toISOString(),calls={instagram:[],facebook:[]};
  let f;
  f=await fixture(t,async channel=>success(channel),{startAt:start,appOptions:{socialProviderOptions:{
    getCredentials:async channel=>f.app.store.secret('channel:'+channel.id),
    fetchImpl:async(raw,init)=>{
      const url=new URL(raw),platform=url.hostname==='graph.instagram.com'?'instagram':'facebook';
      assert.equal(init.method,'GET');assert.equal(url.pathname,'/v26.0/me');
      calls[platform].push(f.getTime());
      if(platform==='instagram'&&calls.instagram.length===1)f.setTime(atMs(1500));
      return new Response(JSON.stringify(platform==='instagram'?{id:'101',user_id:'100',username:'fixtureinstagram'}:{id:'200',name:'Fixture Facebook'}),{headers:{'content-type':'application/json'}});
    },
  }}});
  let notifications=0;f.app.messenger.notifyCompanyUsers=()=>{notifications++;};
  for(const platform of ['instagram','facebook']){
    const id='health-'+platform,accountId=platform==='instagram'?'100':'200',authType=platform==='instagram'?'instagram-login':'facebook-page';
    f.app.store.put('channels',id,{id,platform,externalId:accountId,handle:'fixture'+platform,active:true,ownerIds:[f.admin.id],connectionVersion:1});
    f.app.store.setSecret('channel:'+id,{accessToken:'fixture-'+platform,accountId,appScopedId:platform==='instagram'?'101':undefined,authType,apiVersion:'v26.0',metaIdentityVersion:1,permissionsVerifiedAt:start,scope:platform==='instagram'?'instagram_business_basic instagram_business_content_publish':'pages_manage_posts pages_read_engagement pages_show_list'});
    f.app.store.put('socialDirectConnections',id,{id,channelId:id,provider:'meta-direct',enabled:true,version:'v1',connectionVersion:1,accountId,authType,updatedBy:f.admin.id});
  }
  const tick=async elapsed=>{f.setTime(atMs(elapsed));await f.app.scanSocialPublishing();await f.app.waitForIdle();};
  await tick(0);
  assert.deepEqual(calls,{instagram:[atMs(0)],facebook:[atMs(1500)]});assert.equal(notifications,1);
  for(let elapsed=15000;elapsed<3600000;elapsed+=15000)await tick(elapsed);
  assert.deepEqual(calls,{instagram:[atMs(0)],facebook:[atMs(1500)]});
  assert.equal(notifications,1,'empty due polls do not invalidate every user notification view');
  await tick(3600000);assert.deepEqual(calls,{instagram:[atMs(0),atMs(3600000)],facebook:[atMs(1500)]});
  for(let elapsed=3615000;elapsed<=3660000;elapsed+=15000)await tick(elapsed);
  assert.deepEqual(calls.facebook,[atMs(1500),atMs(3660000)],'the second account waits at most the next minute instead of an extra hour');
  assert.equal(notifications,3);
  for(const platform of ['instagram','facebook']){
    assert.ok(Date.parse(calls[platform][1])-Date.parse(calls[platform][0])>=3600000);
    assert.equal(f.app.store.get('socialDirectPublishRequests','health-'+platform).times.length,1,'the unchanged rolling budget contains only the due request');
  }
  const state=await f.call('/api/social/workspace?section=overview');assert.equal(state.status,200);assert.equal(state.data.runtime.health.intervalMs,60000);
});

test('initial failure plus three retries exhausts today, and the next daily schedule starts a new cycle', async t => {
  let calls = 0;
  const f = await fixture(t, async () => { calls++; throw failure('NETWORK_ERROR', true); });
  const channel = await f.add();
  const start = f.getTime();
  await f.tick(start);
  for (const elapsed of [5, 25, 85]) await f.tick(atMinutes(start, elapsed));
  assert.equal(calls, 4);
  let saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.retryCount, 3);
  assert.equal(saved.nextRetryAt, null);
  await f.tick(atMinutes(start, 100));
  assert.equal(calls, 4);
  assert.equal((await f.call('/api/state')).data.collection.failed, 1);
  const nextDay = new Date(Date.parse(start) + DAY).toISOString();
  await f.tick(atMinutes(nextDay, -1));
  assert.equal(calls, 4);
  await f.tick(nextDay);
  assert.equal(calls, 5);
  saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.retryCount, 1);
  assert.equal(saved.nextRetryAt, atMinutes(nextDay, 5));
});

for (const [code, expectedKind] of [['AUTH_REQUIRED', 'auth'], ['reconnect_required', 'auth'], ['token_exchange_failed', 'auth'], ['INVALID_CONFIG', 'permanent']]) {
  test(`${code} never triggers automatic repeat attempts even on later days`, async t => {
    let calls = 0;
    const f = await fixture(t, async () => { calls++; throw failure(code); });
    const channel = await f.add();
    const start = f.getTime();
    await f.tick(start);
    const saved = f.app.store.get('channels', channel.id);
    assert.equal(saved.failureKind, expectedKind);
    assert.equal(saved.requiresReconnect, expectedKind === 'auth');
    assert.equal(saved.nextRetryAt, null);
    for (const minutes of [5, 60, 1440, 2880]) await f.tick(atMinutes(start, minutes));
    assert.equal(calls, 1);
    const health = (await f.call('/api/state')).data.collection;
    assert.equal(expectedKind === 'auth' ? health.needsReconnect : health.failed, 1);
  });
}

test('rate limit persists a next-day reservation and cannot create short repeated requests', async t => {
  let calls = 0;
  const f = await fixture(t, async channel => { calls++; if (calls === 1) throw failure('RATE_LIMITED', true); return success(channel); });
  const channel = await f.add();
  const start = f.getTime();
  await f.tick(start);
  assert.equal(f.app.store.get('channels', channel.id).nextRetryAt, atMinutes(start, 1440));
  for (const minutes of [5, 20, 60, 120, 1439]) await f.tick(atMinutes(start, minutes));
  assert.equal(calls, 1);
  await f.tick(atMinutes(start, 1440));
  assert.equal(calls, 2);
  assert.equal(f.app.store.get('channels', channel.id).status, 'success');
});

test('disabled automation holds a due retry and resumes it when enabled', async t => {
  let calls = 0;
  const f = await fixture(t, async channel => { calls++; if (calls === 1) throw failure('TIMEOUT', true); return success(channel); });
  await f.add();
  const start = f.getTime();
  await f.tick(start);
  assert.equal((await f.call('/api/settings', { enabled: false, hourKst: 9 })).status, 200);
  await f.tick(atMinutes(start, 5));
  assert.equal(calls, 1);
  assert.equal((await f.call('/api/state')).data.collection.paused, 1);
  assert.equal((await f.call('/api/settings', { enabled: true, hourKst: 9 })).status, 200);
  await f.tick(atMinutes(start, 6));
  assert.equal(calls, 2);
});

for (const action of ['archive', 'disconnect']) {
  test(`${action} prevents due retries despite previously saved connection information`, async t => {
    let calls = 0;
    const f = await fixture(t, async () => { calls++; throw failure('TIMEOUT', true); });
    const channel = await f.add();
    const start = f.getTime();
    await f.tick(start);
    assert.equal((await f.call(`/api/channels/${channel.id}/${action}`, action === 'archive' ? { active: false } : {})).status, 200);
    await f.tick(atMinutes(start, 5));
    await f.tick(atMinutes(start, 1440));
    assert.equal(calls, 1);
    const saved = f.app.store.get('channels', channel.id);
    assert.equal(action === 'archive' ? saved.active : saved.collectionDisabled, action !== 'archive');
    assert.equal(f.app.store.all('channelSnapshots').length, 0);
    const health = (await f.call('/api/state')).data.collection;
    assert.equal(action === 'archive' ? health.archived : health.needsConnection, 1);
  });
}

test('partial success clears retries without inventing missing values or claiming full success', async t => {
  let calls = 0;
  const f = await fixture(t, async channel => { calls++; if (calls === 1) throw failure('TIMEOUT', true); return success(channel, true); });
  const channel = await f.add();
  const start = f.getTime();
  await f.tick(start);
  await f.tick(atMinutes(start, 5));
  const saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.status, 'partial');
  assert.equal(saved.nextRetryAt, null);
  assert.equal(saved.retryCount, 0);
  assert.equal(saved.requiresReconnect, false);
  assert.equal(saved.lastSuccessAt, undefined);
  assert.equal(f.app.store.all('snapshots')[0].shares, null);
  const health = (await f.call('/api/state')).data.collection;
  assert.equal(health.partialToday, 1);
  assert.equal(health.successToday, 0);
  await f.tick(atMinutes(start, 10));
  assert.equal(calls, 2);
});

test('new direct connection clears an old auth incident, preserves previous observations, and permits validation collection', async t => {
  let calls = 0;
  const f = await fixture(t, async (channel, credentials) => {
    calls++;
    if (calls === 1) throw failure('AUTH_REQUIRED');
    assert.equal(credentials.apiKey, 'fixture-replacement-key');
    return success(channel);
  });
  const channel = await f.add();
  const start = f.getTime();
  const yesterday = atMinutes(start, -1440);
  const old = { id: 'old-observation', channelId: channel.id, date: yesterday.slice(0, 10), checkedAt: yesterday, followers: 42, source: 'api:youtube' };
  f.app.store.put('channelSnapshots', old.id, old);
  f.app.store.put('channels', channel.id, { ...f.app.store.get('channels', channel.id), lastCollectedAt: yesterday, lastSuccessAt: yesterday });
  await f.tick(start);
  assert.equal(f.app.store.get('channels', channel.id).requiresReconnect, true);
  assert.equal((await f.call(`/api/channels/${channel.id}/connection`, { apiKey: 'fixture-replacement-key' })).status, 200);
  const updated = f.app.store.get('channels', channel.id);
  assert.equal(updated.status, 'ready');
  assert.equal(updated.lastCollectedAt, yesterday);
  assert.equal(updated.lastSuccessAt, yesterday);
  assert.deepEqual(f.app.store.get('channelSnapshots', old.id), old);
  for (const field of ['failureKind', 'failureCode', 'lastFailureAt', 'nextRetryAt', 'lastAttemptAt']) assert.equal(updated[field], null, field);
  assert.equal(updated.requiresReconnect, false);
  assert.equal(updated.retryCount, 0);
  assert.equal(calls, 1, 'saving credentials alone does not claim an API verification result');
  await f.tick(atMinutes(start, 1));
  assert.equal(calls, 2);
  assert.equal(f.app.store.get('channels', channel.id).status, 'success');
});

test('a real OAuth transport error maps to temporary retry without being mislabeled as expired authorization', async t => {
  let oauthError;
  try {
    await refreshCredentials('youtube', { accessToken: 'fixture-expired-token', refreshToken: 'fixture-refresh-token', expiresAt: '2000-01-01T00:00:00.000Z' }, { clientId: 'fixture-client', clientSecret: 'fixture-secret' }, { fetchImpl: async () => { throw new Error('fixture offline'); } });
  } catch (error) { oauthError = error; }
  assert.equal(oauthError?.code, 'oauth_unavailable');
  assert.equal(oauthError.retryable, true);
  let calls = 0;
  const f = await fixture(t, async channel => { calls++; if (calls === 1) throw oauthError; return success(channel); });
  const channel = await f.add();
  const start = f.getTime();
  await f.tick(start);
  const saved = f.app.store.get('channels', channel.id);
  assert.equal(saved.failureCode, 'OAUTH_UNAVAILABLE');
  assert.equal(saved.failureKind, 'transient');
  assert.equal(saved.requiresReconnect, false);
  await f.tick(atMinutes(start, 5));
  assert.equal(calls, 2);
  assert.equal(f.app.store.get('channels', channel.id).status, 'success');
});

test('restart marks queued/running work interrupted and schedules bounded recovery for collecting channels', async t => {
  const start = startOfSchedule();
  const restartedAt = atMinutes(start, 2);
  const calls = [];
  const f = await fixture(t, async channel => { calls.push(channel.id); return success(channel); }, { startAt: restartedAt, seed: (store) => {
    const admin = store.createUser({ name: 'Restart admin', email: 'restart@example.test', role: 'admin', password: 'fixture-admin-password' });
    for (const [index, status] of ['queued', 'running'].entries()) {
      const id = `restart-channel-${index}`;
      store.put('channels', id, { id, platform: 'youtube', canonicalUrl: `https://www.youtube.com/@restart${index}`, handle: `restart${index}`, active: true, ownerIds: [admin.id], status: 'collecting', lastAttemptAt: start, createdAt: start, connectionVersion: 0 });
      store.setSecret(`channel:${id}`, { apiKey: 'fixture-public-api-key' });
      store.put('runs', `interrupted-${index}`, { id: `interrupted-${index}`, channelId: id, status, startedAt: start });
    }
  } });
  assert.deepEqual(f.app.store.all('runs').map(run => run.status), ['interrupted', 'interrupted']);
  for (const channel of f.app.store.all('channels')) {
    assert.equal(channel.status, 'error');
    assert.equal(channel.failureKind, 'transient');
    assert.equal(channel.failureCode, 'COLLECTION_INTERRUPTED');
    assert.equal(channel.retryCount, 1);
    assert.equal(channel.lastFailureAt, restartedAt);
    assert.equal(channel.nextRetryAt, atMinutes(restartedAt, 5));
  }
  await f.tick(atMinutes(restartedAt, 4));
  assert.equal(calls.length, 0);
  await f.tick(atMinutes(restartedAt, 5));
  assert.deepEqual(calls, ['restart-channel-0', 'restart-channel-1']);
  assert.ok(f.app.store.all('channels').every(channel => channel.status === 'success' && channel.retryCount === 0 && channel.nextRetryAt === null));
  assert.equal(f.app.store.all('snapshots').length, 2);
});
