import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { initializeVoiceLiveEnv, inspectVoiceLiveConfig, checkVoiceLiveCloud, startVoiceTunnel, startVoiceLive, voiceTunnelEnvironment, parseVoiceLiveArgs } from '../qa/voice-live.mjs';

const env = () => ({ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
  SYNK_VOICE_TEST_LIVEKIT_URL: 'wss://qa-fixture.livekit.cloud', SYNK_VOICE_TEST_LIVEKIT_API_KEY: 'QAfixture123',
  SYNK_VOICE_TEST_LIVEKIT_API_SECRET: 'only-synthetic-test-secret-not-a-real-key-12345',
  SYNK_VOICE_TEST_HTTPS_ORIGIN: 'https://voice-qa.ngrok-free.app', SYNK_VOICE_TEST_NGROK_BIN: process.execPath,
  SYNK_VOICE_TEST_NGROK_AUTHTOKEN: 'synthetic-ngrok-token-not-real',
  SYNK_VOICE_LIVEKIT_API_SECRET: 'production-config-must-not-be-inherited',
});

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'synk-voice-live-test-'));
  t.after(async () => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep) && path.split(sep).at(-1).startsWith('synk-voice-live-test-')); await rm(path, { recursive: true, force: true }); });
  return path;
}

function fakeAgent() {
  const child = new EventEmitter(); child.pid = 991122; child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.killCount = 0;
  child.kill = () => { child.killCount++; queueMicrotask(() => child.emit('exit', 0)); return true; };
  return child;
}

test('private template refuses repository paths and existing files; local checks expose only missing field names', async t => {
  const parent = await directory(t), path = join(parent, 'voice.env');
  await initializeVoiceLiveEnv(path); const original = await readFile(path, 'utf8');
  assert.ok(original.includes('SYNK_VOICE_TEST_LIVEKIT_API_SECRET=\n'));
  await assert.rejects(initializeVoiceLiveEnv(path), { code: 'EEXIST' }); assert.equal(await readFile(path, 'utf8'), original);
  await assert.rejects(initializeVoiceLiveEnv(resolve('tools/company-messenger/qa/forbidden.env')), { code: 'PRIVATE_ENV_MUST_BE_OUTSIDE_REPOSITORY' });
  const absent = await inspectVoiceLiveConfig({ SYNK_VOICE_LIVEKIT_URL: env().SYNK_VOICE_TEST_LIVEKIT_URL });
  assert.equal(absent.configured, false); assert.equal(absent.missing.length, 6);
  const good = await inspectVoiceLiveConfig(env()); assert.equal(good.configured, true); assert.equal(good.mediaVerified, false);
  const text = JSON.stringify(good); assert.equal(text.includes(env().SYNK_VOICE_TEST_LIVEKIT_API_SECRET), false);
  for (const origin of ['https://workspace.synk.im', 'https://voice-qa.example.test', 'http://voice-qa.ngrok-free.app', 'https://voice-qa.ngrok-free.app/extra']) {
    assert.equal((await inspectVoiceLiveConfig({ ...env(), SYNK_VOICE_TEST_HTTPS_ORIGIN: origin })).configured, false);
  }
});

test('Cloud connectivity checks only a random nonexistent room and never create rooms, media or tokens for clients', async () => {
  let calls = 0;
  const result = await checkVoiceLiveCloud(env(), { fetch: async (url, request) => {
    calls++; assert.equal(url.endsWith('/twirp/livekit.RoomService/ListParticipants'), true);
    const claims = JSON.parse(Buffer.from(request.headers.Authorization.slice(7).split('.')[1], 'base64url'));
    assert.equal(claims.video.roomAdmin, true); assert.equal(claims.video.roomJoin, undefined);
    assert.ok(JSON.parse(request.body).room.startsWith('synk-voice-qa-probe-'));
    return Response.json({ code: 'not_found' }, { status: 404 });
  } });
  assert.equal(calls, 1); assert.equal(result.cloudControlReadVerified, true); assert.equal(result.roomsCreated, 0); assert.equal(result.mediaVerified, false);
  await assert.rejects(checkVoiceLiveCloud(env(), { fetch: async () => Response.json({ error: env().SYNK_VOICE_TEST_LIVEKIT_API_SECRET }, { status: 401 }) }), error => {
    assert.equal(String(error).includes(env().SYNK_VOICE_TEST_LIVEKIT_API_SECRET), false); return error.status === 503;
  });
});

test('owned HTTPS agent gets no LiveKit credentials or token command arguments and accepts only the exact origin/upstream', async t => {
  const parent = await directory(t), child = fakeAgent(), origin = env().SYNK_VOICE_TEST_HTTPS_ORIGIN, localUrl = 'http://127.0.0.1:4299';
  let wrongFirst = true, requests = 0;
  const tunnel = await startVoiceTunnel({ env: env(), origin, localUrl, directory: parent, spawnImpl(binary, args, options) {
    assert.equal(binary, process.execPath); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(args.includes('--inspect=false'), true); assert.equal(args.join(' ').includes(env().SYNK_VOICE_TEST_NGROK_AUTHTOKEN), false);
    assert.equal(Object.keys(options.env).some(name => /LIVEKIT/.test(name)), false);
    assert.equal(options.env.NGROK_AUTHTOKEN, env().SYNK_VOICE_TEST_NGROK_AUTHTOKEN); return child;
  }, fetchImpl: async url => {
    requests++; assert.equal(new URL(url).hostname, '127.0.0.1');
    const wrong = wrongFirst; wrongFirst = false;
    return Response.json({ tunnels: [{ proto: 'https', public_url: wrong ? 'https://other.ngrok-free.app' : origin, config: { addr: localUrl } }] });
  } });
  assert.ok(requests >= 2); assert.equal(tunnel.browserHttpsVerified, false);
  const config = await readFile(join(parent, 'voice-ngrok.yml'), 'utf8'); assert.ok(config.includes('127.0.0.1:')); assert.equal(config.includes(env().SYNK_VOICE_TEST_NGROK_AUTHTOKEN), false);
  await tunnel.stop(); await tunnel.stop(); assert.equal(child.killCount, 1);
});

test('HTTPS startup cancellation terminates only its owned child and does not forward raw provider errors', async t => {
  const parent = await directory(t), child = fakeAgent(), abort = new AbortController();
  await assert.rejects(startVoiceTunnel({ env: env(), origin: env().SYNK_VOICE_TEST_HTTPS_ORIGIN, localUrl: 'http://127.0.0.1:4299', directory: parent,
    signal: abort.signal, spawnImpl: () => child, fetchImpl: async () => { abort.abort(); throw new Error('not public'); } }), { name: 'AbortError' });
  assert.equal(child.killCount, 1);
});

test('live launcher exercises the isolated HTTP app, preserves evidence, and leaves all device scenarios unverified', async t => {
  const parent = await directory(t), output = join(parent, 'evidence'); let networkCalls = 0, tunnelStopped = 0, finish;
  const live = await startVoiceLive({ env: env(), port: 0, out: output,
    livekitFetch: async () => { networkCalls++; return Response.json({ code: 'not_found' }, { status: 404 }); },
    tunnelStarter: async () => ({ pid: 991122, exit: new Promise(done => { finish = done; }), stop: async () => { tunnelStopped++; finish(); } }),
  }); t.after(() => live.stop());
  const response = await live.fixture.clients.host('/messenger/api/bootstrap'); assert.ok(response.user.id);
  const readiness = JSON.parse(await readFile(join(output, 'environment.json'), 'utf8'));
  assert.equal(readiness.cloudControlReadVerified, true); assert.equal(readiness.browserHttpsVerified, false); assert.equal(readiness.mediaVerified, false);
  const cases = JSON.parse(await readFile(join(output, 'results.json'), 'utf8')); assert.ok(cases.cases.every(row => row.status === 'not_run'));
  for (const filename of ['environment.json', 'run.json', 'results.json']) {
    const report = await readFile(join(output, filename), 'utf8');
    for (const name of ['SYNK_VOICE_TEST_LIVEKIT_API_SECRET', 'SYNK_VOICE_TEST_NGROK_AUTHTOKEN']) assert.equal(report.includes(env()[name]), false);
  }
  const stopped = await live.stop(); assert.equal(stopped.cleanupPending, false); assert.equal(tunnelStopped, 1); assert.equal(networkCalls, 1);
  await assert.rejects(access(live.fixture.directory), { code: 'ENOENT' }); await access(join(output, 'results.json'));
  assert.equal(JSON.parse(await readFile(join(output, 'run.json'), 'utf8')).running, false);
});

test('failed tunnel startup closes its fixture and retains an honest lifecycle report', async t => {
  const parent = await directory(t), output = join(parent, 'evidence'); let fixtureDirectory;
  await assert.rejects(startVoiceLive({ env: env(), port: 0, out: output,
    livekitFetch: async () => Response.json({ code: 'not_found' }, { status: 404 }),
    tunnelStarter: async ({ directory }) => { fixtureDirectory = directory; throw Object.assign(new Error('not public'), { code: 'NGROK_HTTPS_START_TIMEOUT' }); },
  }), { code: 'NGROK_HTTPS_START_TIMEOUT' });
  await assert.rejects(access(fixtureDirectory), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(join(output, 'run.json'), 'utf8')).running, false);
});

test('an existing evidence folder cannot be overwritten even by startup error cleanup', async t => {
  const parent = await directory(t), path = join(parent, 'run.json'), original = '{"belongsTo":"another-test"}\n';
  await writeFile(path, original);
  let tunnelCalls = 0;
  await assert.rejects(startVoiceLive({ env: env(), port: 0, out: parent,
    livekitFetch: async () => Response.json({ code: 'not_found' }, { status: 404 }),
    tunnelStarter: async () => { tunnelCalls++; throw new Error('Must not run'); },
  }), { code: 'EEXIST' });
  assert.equal(await readFile(path, 'utf8'), original); assert.equal(tunnelCalls, 0);
});

test('invalid live options cannot trigger Cloud calls, and tunnel environment never inherits production credentials', async () => {
  let calls = 0;
  await assert.rejects(startVoiceLive({ env: env(), port: 4191, livekitFetch: async () => { calls++; } }), { code: 'INVALID_VOICE_QA_OPTIONS' }); assert.equal(calls, 0);
  const child = voiceTunnelEnvironment({ ...env(), SYNK_VOICE_LIVEKIT_API_SECRET: 'production', NODE_OPTIONS: '--inspect', NGROK_AUTHTOKEN: 'production-ngrok' });
  assert.equal(child.NODE_OPTIONS, undefined); assert.equal(child.SYNK_VOICE_LIVEKIT_API_SECRET, undefined); assert.equal(child.NGROK_AUTHTOKEN, env().SYNK_VOICE_TEST_NGROK_AUTHTOKEN);
  assert.throws(() => parseVoiceLiveArgs(['--check', '--check-cloud']), { code: 'AMBIGUOUS_VOICE_LIVE_ACTION' });
  assert.throws(() => parseVoiceLiveArgs(['--port=no']), { code: 'INVALID_VOICE_QA_PORT' });
  assert.throws(() => parseVoiceLiveArgs(['--host=0.0.0.0']), { code: 'UNKNOWN_VOICE_LIVE_ARGUMENT' });
});
