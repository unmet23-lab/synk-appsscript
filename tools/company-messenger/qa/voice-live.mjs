// LiveKit Cloud + a dedicated HTTPS tunnel for the disposable voice fixture.
// Credentials are supplied explicitly through Node's --env-file, never copied
// to reports, command arguments, the tunnel process, or the production app.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createVoiceFixture, voiceFixtureProfiles } from './voice-fixture.mjs';
import { createLiveKitVoiceProvider } from '../voice-livekit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
export const voiceLiveEnvFile = join(homedir(), 'SYNK_보안', 'voice-live-test.env');
const names = Object.freeze({
  url: 'SYNK_VOICE_TEST_LIVEKIT_URL', key: 'SYNK_VOICE_TEST_LIVEKIT_API_KEY', secret: 'SYNK_VOICE_TEST_LIVEKIT_API_SECRET',
  origin: 'SYNK_VOICE_TEST_HTTPS_ORIGIN', binary: 'SYNK_VOICE_TEST_NGROK_BIN', token: 'SYNK_VOICE_TEST_NGROK_AUTHTOKEN',
});
const fail = code => Object.assign(new Error(code), { code });
const safeFailure = error => /^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code || '') ? error.code : 'VOICE_LIVE_SETUP_FAILED';

export async function initializeVoiceLiveEnv(path = voiceLiveEnvFile) {
  const target = resolve(path);
  const lexical = relative(root, target);
  if (!lexical || !lexical.startsWith('..') && !isAbsolute(lexical)) throw fail('PRIVATE_ENV_MUST_BE_OUTSIDE_REPOSITORY');
  await mkdir(dirname(target), { recursive: true });
  const parent = await realpath(dirname(target)), repo = await realpath(root);
  const distance = relative(repo, parent);
  if (!distance || !distance.startsWith('..') && !isAbsolute(distance)) throw fail('PRIVATE_ENV_MUST_BE_OUTSIDE_REPOSITORY');
  await writeFile(target, '# Dedicated test projects only. Never paste keys into chat or Git.\n' +
    Object.values(names).map(name => name + '=').join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  return { envFile: target, configured: false, overwritten: false };
}

export async function inspectVoiceLiveConfig(env, { tunnel = true } = {}) {
  const missing = Object.values(tunnel ? names : { url: names.url, key: names.key, secret: names.secret }).filter(name => typeof env[name] !== 'string' || !env[name].trim());
  const problems = [];
  let origin;
  if (!missing.some(name => [names.url, names.key, names.secret].includes(name))) {
    try { createLiveKitVoiceProvider({ url: env[names.url], apiKey: env[names.key], apiSecret: env[names.secret] }); }
    catch { problems.push('INVALID_TEST_LIVEKIT_CONFIG'); }
  }
  if (tunnel && env[names.origin]) {
    try {
      const url = new URL(env[names.origin]);
      if (url.protocol !== 'https:' || url.origin !== env[names.origin] || url.username || url.password ||
        ['synk.im', 'www.synk.im', 'workspace.synk.im', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.hostname.endsWith('.test') || url.hostname.endsWith('.invalid')) throw fail('INVALID_TEST_HTTPS_ORIGIN');
      origin = url.origin;
    } catch { problems.push('INVALID_TEST_HTTPS_ORIGIN'); }
  }
  if (tunnel && env[names.binary]) {
    try { if (!isAbsolute(env[names.binary]) || !(await stat(env[names.binary])).isFile()) throw fail('NGROK_BINARY_NOT_FOUND'); }
    catch { problems.push('NGROK_BINARY_NOT_FOUND'); }
  }
  return { configured: missing.length === 0 && problems.length === 0, missing, problems, ...(origin ? { origin } : {}), mediaVerified: false };
}

export async function checkVoiceLiveCloud(env, { fetch: fetcher } = {}) {
  const config = await inspectVoiceLiveConfig(env, { tunnel: false });
  if (!config.configured) throw fail('TEST_LIVEKIT_CONFIG_REQUIRED');
  const provider = createLiveKitVoiceProvider({ url: env[names.url], apiKey: env[names.key], apiSecret: env[names.secret], ...(fetcher ? { fetch: fetcher } : {}) });
  // Read one nonexistent, randomly named room. No room creation, participant,
  // token issuance, media traffic, Agents, recordings or egress jobs.
  await provider.listParticipants('synk-voice-qa-probe-' + randomUUID());
  return { cloudControlReadVerified: true, roomsCreated: 0, participantsCreated: 0, mediaVerified: false };
}

async function unusedPort() {
  const probe = createServer();
  await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port; await new Promise(done => probe.close(done)); return port;
}

export function voiceTunnelEnvironment(env) {
  const childEnv = {};
  for (const name of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) {
    if (env[name]) childEnv[name] = env[name];
  }
  childEnv.NGROK_AUTHTOKEN = env[names.token];
  return childEnv;
}

export async function startVoiceTunnel({ env, origin, localUrl, directory, signal, spawnImpl = spawn, fetchImpl = fetch, timeoutMs = 25000 }) {
  const apiPort = await unusedPort(), configPath = join(directory, 'voice-ngrok.yml');
  // Separate config and API listener: never attach to/stop an existing agent.
  // The local HTTP inspector is disabled because it could retain passwords,
  // cookies, room JWTs, E2EE responses and webhook Authorization headers.
  await writeFile(configPath, 'version: "2"\nweb_addr: "127.0.0.1:' + apiPort + '"\n', { flag: 'wx', mode: 0o600 });
  signal?.throwIfAborted();
  const child = spawnImpl(env[names.binary], ['http', localUrl, '--url=' + origin, '--config=' + configPath,
    '--inspect=false', '--log=stdout', '--log-format=json'], { shell: false, windowsHide: true, env: voiceTunnelEnvironment(env), stdio: ['ignore', 'pipe', 'pipe'] });
  let exited = false, spawnFailed = false, errorCode = 'NGROK_AGENT_EXITED';
  const exit = new Promise(done => {
    child.once('exit', () => { exited = true; done(); });
    child.once('error', () => { exited = true; spawnFailed = true; done(); });
  });
  // Drain and discard raw agent output. Only a bounded vendor error code may
  // reach the user; authentication tokens/HTTP contents never reach a report.
  const discard = chunk => { const match = String(chunk).match(/ERR_NGROK_[0-9]{1,8}/); if (match) errorCode = match[0]; };
  child.stdout?.on('data', discard); child.stderr?.on('data', discard);
  let stopping;
  const stop = () => stopping ||= (async () => {
    if (exited) return;
    child.kill('SIGTERM');
    let timer; try {
      await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(fail('NGROK_AGENT_STOP_PENDING')), 5000); })]);
    } finally { clearTimeout(timer); }
  })();
  try {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      signal?.throwIfAborted();
      if (exited) throw fail(spawnFailed ? 'NGROK_EXECUTABLE_FAILED' : errorCode);
      try {
        const response = await fetchImpl('http://127.0.0.1:' + apiPort + '/api/tunnels', { redirect: 'error', signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          let bytes = 0, chunks = [];
          for await (const chunk of response.body || []) { bytes += chunk.length; if (bytes > 65536) throw fail('NGROK_AGENT_RESPONSE_TOO_LARGE'); chunks.push(chunk); }
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (Array.isArray(result.tunnels) && result.tunnels.some(item => item.proto === 'https' && item.public_url === origin && item.config?.addr === localUrl)) {
            signal?.throwIfAborted();
            if (exited) throw fail(errorCode);
            return { pid: child.pid, agentReady: true, browserHttpsVerified: false, exit, stop };
          }
        } else await response.body?.cancel();
      } catch (error) { signal?.throwIfAborted(); if (error?.code === 'NGROK_AGENT_RESPONSE_TOO_LARGE') throw error; }
      await delay(200, undefined, { signal });
    }
    throw fail('NGROK_HTTPS_START_TIMEOUT');
  } catch (error) {
    try { await stop(); } catch { throw Object.assign(fail('NGROK_AGENT_STOP_PENDING'), { tunnelPid: child.pid }); }
    throw error;
  }
}

export async function startVoiceLive({ env = process.env, port = 4299, profile = 'standard', out, signal, livekitFetch, tunnelStarter = startVoiceTunnel } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535 || [4191, 4197].includes(port) || !Object.hasOwn(voiceFixtureProfiles, profile)) throw fail('INVALID_VOICE_QA_OPTIONS');
  const config = await inspectVoiceLiveConfig(env);
  if (!config.configured) throw fail('VOICE_TEST_CONFIG_INCOMPLETE');
  const cloud = await checkVoiceLiveCloud(env, { fetch: livekitFetch }); signal?.throwIfAborted();
  let fixture, tunnel, exported, stopping;
  async function stop() {
    return stopping ||= (async () => {
      let cleanup, httpsCleanupPending = false;
      // Keep the webhook tunnel until remote revocation has been attempted.
      try { cleanup = fixture ? await fixture.stop() : { cleanupPending: false, retainedDirectory: null }; }
      catch { cleanup = { cleanupPending: true, retainedDirectory: fixture?.directory || null }; }
      finally { if (tunnel) try { await tunnel.stop(); } catch { httpsCleanupPending = true; } }
      if (httpsCleanupPending) cleanup = { ...cleanup, httpsCleanupPending: true, tunnelPid: tunnel.pid };
      if (exported) await writeFile(join(exported, 'run.json'), JSON.stringify({ ...fixture.manifest, running: false, ...cleanup }, null, 2));
      return cleanup;
    })();
  }
  try {
    fixture = await createVoiceFixture({ mode: 'livekit', profile, port, origin: config.origin, env, livekitFetch }); signal?.throwIfAborted();
    const parent = resolve(here, '../../../.tmp'); await mkdir(parent, { recursive: true });
    const requestedOutput = resolve(out || join(parent, 'voice-live-' + randomUUID()));
    await fixture.exportReports(requestedOutput); exported = requestedOutput;
    tunnel = await tunnelStarter({ env, origin: config.origin, localUrl: fixture.manifest.localBind, directory: fixture.directory, signal });
    signal?.throwIfAborted();
    const readiness = { ...cloud, httpsAgentReady: true, browserHttpsVerified: false, cloudWebhookConfigured: false, mediaVerified: false };
    await writeFile(join(exported, 'environment.json'), JSON.stringify(readiness, null, 2), { flag: 'wx' });
    return { fixture, tunnel, stop, summary: { ...readiness, url: config.origin, webhookUrl: config.origin + '/messenger/api/voice/webhook',
      pid: process.pid, tunnelPid: tunnel.pid, credentialsFile: fixture.manifest.credentialsFile, fixtureDirectory: fixture.directory, evidenceDirectory: exported } };
  } catch (error) {
    const cleanup = await stop();
    if (cleanup.cleanupPending) throw Object.assign(fail('VOICE_CLEANUP_PENDING'), { retainedDirectory: cleanup.retainedDirectory });
    if (cleanup.httpsCleanupPending) throw fail('NGROK_AGENT_STOP_PENDING');
    throw error;
  }
}

export function parseVoiceLiveArgs(args) {
  const result = {};
  for (const arg of args) {
    if (['--init', '--check', '--check-cloud', '--help'].includes(arg)) result[arg.slice(2)] = true;
    else if (/^--(port|profile|out)=/.test(arg)) { const at = arg.indexOf('='); result[arg.slice(2, at)] = arg.slice(at + 1); }
    else throw fail('UNKNOWN_VOICE_LIVE_ARGUMENT');
  }
  if (['init', 'check', 'check-cloud', 'help'].filter(key => result[key]).length > 1) throw fail('AMBIGUOUS_VOICE_LIVE_ACTION');
  if (result.port !== undefined) { if (!/^\d+$/.test(result.port)) throw fail('INVALID_VOICE_QA_PORT'); result.port = Number(result.port); }
  return result;
}

async function main() {
  const args = parseVoiceLiveArgs(process.argv.slice(2));
  if (args.help) { console.log('node --env-file=PRIVATE_ENV tools/company-messenger/qa/voice-live.mjs [--check|--check-cloud] [--port=4299] [--profile=standard|short|budget] [--out=NEW_DIRECTORY]\nCreate a blank private env file: node tools/company-messenger/qa/voice-live.mjs --init'); return; }
  if (args.init) { console.log(JSON.stringify(await initializeVoiceLiveEnv())); return; }
  if (args.check) { const report = await inspectVoiceLiveConfig(process.env); console.log(JSON.stringify(report)); process.exitCode = report.configured ? 0 : 2; return; }
  if (args['check-cloud']) { console.log(JSON.stringify(await checkVoiceLiveCloud(process.env))); return; }
  const abort = new AbortController();
  const interrupted = () => abort.abort();
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  let live;
  try {
    live = await startVoiceLive({ ...args, signal: abort.signal }); console.log(JSON.stringify(live.summary));
    await Promise.race([live.tunnel.exit, new Promise(done => { if (abort.signal.aborted) done(); else abort.signal.addEventListener('abort', done, { once: true }); })]);
    if (!abort.signal.aborted) throw fail('NGROK_AGENT_EXITED');
  } finally {
    if (live) { const cleanup = await live.stop(); console.log(JSON.stringify(cleanup)); process.exitCode = cleanup.cleanupPending || cleanup.httpsCleanupPending ? 2 : 0; }
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error(JSON.stringify({ error: safeFailure(error), ...(error?.retainedDirectory ? { cleanupPending: true, retainedDirectory: error.retainedDirectory } : {}),
    ...(Number.isSafeInteger(error?.tunnelPid) ? { httpsCleanupPending: true, tunnelPid: error.tunnelPid } : {}) }));
  process.exitCode = 2;
});
