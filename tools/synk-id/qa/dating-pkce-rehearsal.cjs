#!/usr/bin/env node
'use strict';
// Preparation is the default. --run is rehearsal-only and requires an actual
// completed provisioning journal. No credentials are read merely on import.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { isDeepStrictEqual } = require('node:util');
const os = require('node:os');
const { CLIENTS } = require('../registry.cjs');
const { matchesClient, digest } = require('../provision-plan.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,256}$/;
const SAFE = Symbol('safe-rehearsal-error');
const NAMES = ['dating-browser'];
const LIMITS = Object.freeze({ paidAI: false, realAccounts: false, physicalDevices: false, browserUI: false, publicConsentPortalUI: false, nativeVault: false, adultProvider: false, centralLifecycleDelivery: false, accountPurgeVerified: false });
function fail(code) { throw Object.assign(new Error(code), { code, [SAFE]: true }); }
function need(value, code) { if (!value) fail(code); }
const errorCode = error => error?.[SAFE] === true ? error.code : 'PROBE_FAILED';

function validateInputs(settings, journal, credentials, env) {
  const ref = credentials.리허설REF;
  need(/^[a-z0-9]+$/.test(ref) && ref !== credentials.운영REF && env?.SUPABASE_PROJECT_REF === ref, 'REHEARSAL_ONLY');
  need(credentials.만료판정(env).상태 === 'ok' && typeof env.SUPABASE_ACCESS_TOKEN === 'string' && !!env.SUPABASE_ACCESS_TOKEN, 'GUARDED_CREDENTIAL_REQUIRED');
  const base = `https://${ref}.supabase.co`;
  need(settings?.version === 1 && settings.environment === 'rehearsal' && settings.supabaseUrl === base
    && (!settings.accountApiUrl || settings.accountApiUrl === base), 'PUBLIC_REHEARSAL_REQUIRED');
  let portal; try { portal = new URL(settings.portalUrl); } catch { fail('INVALID_REHEARSAL_PORTAL'); }
  need(portal.protocol === 'https:' && portal.pathname === '/id-rehearsal/' && !portal.username && !portal.password && !portal.search && !portal.hash, 'INVALID_REHEARSAL_PORTAL');
  need(journal?.version === 1 && journal.environment === 'rehearsal' && journal.pendingMapping === null
    && Number.isFinite(Date.parse(journal.completedAt)) && journal.bindings && journal.mapping, 'COMPLETED_PROVISION_JOURNAL_REQUIRED');
  const registrations = NAMES.map(name => {
    const wanted = CLIENTS.find(row => row.id === name), id = journal.bindings[name];
    need(wanted && CLIENT_ID.test(id || '') && journal.mapping[id] === 'platform', 'REGISTERED_DATING_CLIENT_REQUIRED');
    if (settings.bindings?.[name] !== undefined) need(settings.bindings[name] === id, 'PUBLIC_CLIENT_BINDING_MISMATCH');
    const rows = (settings.clients || []).filter(row => row.registration === name || row.client_id === id);
    need(rows.length <= 1 && (!rows.length || rows[0].client_id === id && matchesClient(wanted, rows[0])), 'PUBLIC_CLIENT_BINDING_MISMATCH');
    return { name, wanted, id, redirectUri: wanted.redirectUris[0] };
  });
  need(new Set(registrations.map(row => row.id)).size === 1, 'DATING_OAUTH_CLIENT_REQUIRED');
  return { ref, base, portal, registrations };
}

async function readResponse(response, max = 4 * 1024 * 1024 + 32768) {
  need(response?.headers && response.body, 'INVALID_HTTP_RESPONSE');
  const length = Number(response.headers.get('content-length'));
  need(!Number.isFinite(length) || length <= max, 'RESPONSE_TOO_LARGE');
  const chunks = [], reader = response.body.getReader(); let size = 0;
  try {
    for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; need(size <= max, 'RESPONSE_TOO_LARGE'); chunks.push(Buffer.from(next.value)); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { fail('INVALID_HTTP_JSON'); }
}

const memory = () => { const map = new Map(); return { setItem: (key, value) => map.set(key, value), getItem: key => map.get(key) ?? null, removeItem: key => map.delete(key), size: () => map.size }; };

/** Starts only a fresh private SQLite store on loopback; no injected verifier. */
async function createLocalProduct({ accountConfig, createDatingServer, localFetch = globalThis.fetch }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-pkce-'));
  const removeDirectory = async () => {
    const resolved = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir());
    need(path.dirname(resolved).toLowerCase() === temp.toLowerCase() && path.basename(resolved).startsWith('synk-dating-pkce-'), 'UNSAFE_LOCAL_CLEANUP_PATH');
    await fs.rm(resolved, { recursive: true, force: true });
  };
  let server;
  try {
    server = createDatingServer({ mode: 'account', accountConfig, databasePath: path.join(directory, 'account.sqlite') });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  } catch (error) {
    if (server) await new Promise(resolve => server.close(resolve));
    await removeDirectory(); throw error;
  }
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    fetch: (url, options = {}) => {
      need(typeof url === 'string' && url.startsWith('/api/atlas-dating/'), 'LOCAL_DATING_ROUTE_REQUIRED');
      return localFetch(origin + url, { ...options, redirect: 'error', headers: { ...options.headers, Origin: origin } });
    },
    async close() {
      await new Promise(resolve => server.close(resolve));
      await removeDirectory();
    },
  };
}

/** HTTP is injected for offline tests. Only main supplies the real guarded provider. */
async function runRehearsal({ settings, journal, credentials, env, fetcher, core, createDatingAccount, createProduct, recordAuthIds = async () => {} }) {
  const target = validateInputs(settings, journal, credentials, env), { base, ref, portal, registrations } = target;
  const report = { mode: 'provider-pkce-rehearsal', environment: 'rehearsal', syntheticAccountsOnly: true, checks: [],
    authorizationResponses: { consentRequired: 0, alreadyApproved: 0 }, cleanup: null, limitations: { ...LIMITS }, ok: false };
  const check = (label, condition) => { need(condition, label); report.checks.push(label); };
  const fetchBounded = async (url, options = {}) => {
    const parsed = new URL(url);
    need([base, 'https://api.supabase.com'].includes(parsed.origin), 'UNTRUSTED_REQUEST_TARGET');
    return fetcher(url, { ...options, redirect: 'error', credentials: 'omit', signal: options.signal || AbortSignal.timeout(25000) });
  };
  const request = async (url, headers = {}, method = 'GET', body) => {
    const response = await fetchBounded(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await readResponse(response) };
  };
  const checked = async (url, headers, method, body) => { const result = await request(url, headers, method, body); need(result.status >= 200 && result.status < 300, 'PROVIDER_HTTP_FAILED'); return result.body; };
  const management = `https://api.supabase.com/v1/projects/${ref}`, manager = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` };
  const project = await checked(management, manager);
  need(project.id === ref && project.name === 'synk-core-rehearsal' && project.status === 'ACTIVE_HEALTHY', 'REMOTE_REHEARSAL_MISMATCH');
  const secrets = await checked(management + '/secrets', manager);
  need(Array.isArray(secrets) && secrets.find(row => row.name === 'SYNK_OAUTH_CLIENT_PRODUCTS')?.value === digest(journal.mapping), 'PROVISION_MAPPING_DRIFT');
  const functions = await checked(management + '/functions', manager);
  need(Array.isArray(functions) && ['synk-account'].every(slug => functions.some(row => row.slug === slug && row.status === 'ACTIVE' && row.verify_jwt === true)), 'ACTIVE_ACCOUNT_FUNCTION_REQUIRED');
  const keys = await checked(management + '/api-keys?reveal=true', manager);
  need(Array.isArray(keys), 'PROVIDER_KEYS_REQUIRED');
  const serviceKey = (keys.find(row => row.type === 'secret') || keys.find(row => row.name === 'service_role'))?.api_key;
  need(typeof serviceKey === 'string' && !!serviceKey, 'PROVIDER_KEYS_REQUIRED');
  const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, pub = settings.supabasePublishableKey;
  for (const registration of registrations) {
    const actual = await checked(base + '/auth/v1/admin/oauth/clients/' + registration.id, admin);
    need(actual.client_id === registration.id && matchesClient(registration.wanted, actual), 'PROVIDER_CLIENT_MISMATCH');
    registration.config = core.readConfig({ version: 1, supabaseUrl: base, supabasePublishableKey: pub, portalUrl: portal.href, clients: { platform: { clientId: registration.id, redirectUri: registration.redirectUri } } }, registration.redirectUri);
    need(registration.config.configured, 'PUBLIC_KEY_REQUIRED');
  }
  const nonce = crypto.randomUUID();
  const accounts = [0, 1].map(index => ({ email: `dating-pkce-${nonce}-${index}@example.invalid`, password: crypto.randomBytes(32).toString('base64url'), authId: null, token: null, attempted: false }));
  const api = (token, endpoint, body) => request(base + '/functions/v1/' + endpoint, { apikey: pub, Authorization: `Bearer ${token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.1.0' }, body === undefined ? 'GET' : 'POST', body);
  const login = async account => {
    const session = await checked(base + '/auth/v1/token?grant_type=password', { apikey: pub }, 'POST', { email: account.email, password: account.password });
    need(session.user?.id === account.authId && typeof session.access_token === 'string', 'SYNTHETIC_LOGIN_MISMATCH');
    account.token = session.access_token; return session.access_token;
  };
  let product;
  const clients = [];
  const oauth = async account => {
    const registration = registrations[0], storage = memory();
    const location = { href: registration.redirectUri, assign(value) { this.destination = value; } };
    const client = createDatingAccount({ storage, location, replaceURL: value => { location.href = value; }, fetcher: async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('/api/atlas-dating/')) return product.fetch(url, options);
      return fetchBounded(url, options);
    } });
    clients.push(client);
    await client.start(); await client.signIn();
    const begin = new URL(location.destination);
    need(begin.origin === base && begin.pathname === '/auth/v1/oauth/authorize' && begin.searchParams.get('code_challenge_method') === 'S256', 'DATING_PKCE_REQUIRED');
    // Follow no provider/portal redirect. The registered portal is checked, but its UI is not loaded.
    const response = await fetcher(begin, { redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(25000) });
    let redirect; try { redirect = new URL(response.headers.get('location')); } catch { fail('CONSENT_PORTAL_REQUIRED'); }
    await response.body?.cancel();
    need(response.status === 302 && redirect.origin === portal.origin && redirect.pathname === portal.pathname && !redirect.username && !redirect.password && !redirect.hash, 'CONSENT_PORTAL_REQUIRED');
    const authorizationId = redirect.searchParams.get('authorization_id');
    need(CLIENT_ID.test(authorizationId || '') && redirect.searchParams.getAll('authorization_id').length === 1, 'AUTHORIZATION_ID_REQUIRED');
    const headers = { apikey: pub, Authorization: `Bearer ${account.token}` };
    const details = await checked(base + '/auth/v1/oauth/authorizations/' + authorizationId, headers);
    need(details && typeof details === 'object' && !Array.isArray(details), 'INVALID_AUTHORIZATION_RESPONSE');
    let callback;
    // Supabase returns OAuthAuthorizationDetails or, for an existing grant,
    // OAuthRedirect. Never reinterpret mismatching client details as a redirect.
    // https://supabase.com/docs/reference/javascript/oauth-server-getauthorizationdetails
    if (Object.hasOwn(details, 'authorization_id')) {
      need(details.authorization_id === authorizationId && details.client?.id === registration.id
        && !Object.hasOwn(details, 'redirect_url')
        && (!Object.hasOwn(details, 'redirect_uri') || details.redirect_uri === registration.redirectUri), 'AUTHORIZATION_CLIENT_MISMATCH');
      const consent = await checked(base + '/auth/v1/oauth/authorizations/' + authorizationId + '/consent', headers, 'POST', { action: 'approve' });
      callback = consent?.redirect_url; report.authorizationResponses.consentRequired++;
    } else {
      need(Object.keys(details).length === 1 && typeof details.redirect_url === 'string', 'INVALID_AUTHORIZATION_RESPONSE');
      callback = details.redirect_url; report.authorizationResponses.alreadyApproved++;
    }
    need(typeof callback === 'string', 'INVALID_AUTHORIZATION_REDIRECT');
    // Both response types pass through the same exact registered callback and
    // pending state/PKCE checks before the token endpoint is called.
    location.href = core.trustedConsentRedirect(callback, registration.config, registration.id);
    await client.start();
    const stored = JSON.parse(storage.getItem('synk.oauth.session.dating'));
    const token = stored?.session?.access_token;
    let claims; try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { fail('INVALID_OAUTH_TOKEN'); }
    need(claims.sub === account.authId && claims.client_id === registration.id && claims.iss === base + '/auth/v1', 'OAUTH_OWNER_CLIENT_MISMATCH');
    // Diagnostics only; the actual central endpoint and local default verifier authenticate below.
    const verified = await api(token, 'synk-account');
    need(verified.status === 200 && verified.body?.ok === true && verified.body.account?.status === 'active' && UUID.test(verified.body.account?.synk_user_id), 'VERIFIED_SYNTHETIC_ACCOUNT_REQUIRED');
    need(client.snapshot().signedIn && !new URL(location.href).searchParams.has('code') && !storage.getItem('dating.synk.oauth.pending.platform'), 'CLEAN_CALLBACK_REQUIRED');
    return { client, storage, token, owner: verified.body.account.synk_user_id };
  };
  let phase = 'create-synthetic-accounts';
  try {
    for (const account of accounts) {
      account.attempted = true;
      const created = await checked(base + '/auth/v1/admin/users', admin, 'POST', { email: account.email, password: account.password, email_confirm: true, app_metadata: { synk_dating_pkce_probe: nonce }, user_metadata: { synk_signup: { version: 'synk-signup-1', learning: false } } });
      need(UUID.test(created.id) && created.email === account.email && created.app_metadata?.synk_dating_pkce_probe === nonce, 'INVALID_CREATED_AUTH_ID'); account.authId = created.id;
      await recordAuthIds(accounts.map(row => row.authId).filter(Boolean));
      await login(account);
    }
    phase = 'local-product-start';
    product = await createProduct({ accountConfig: { version: 1, supabaseUrl: base, accountApiUrl: base,
      supabasePublishableKey: pub, portalUrl: portal.href, clients: { platform: { clientId: registrations[0].id, redirectUri: registrations[0].redirectUri } } } });
    phase = 'oauth-pkce';
    const a = await oauth(accounts[0]), second = await oauth(accounts[0]), b = await oauth(accounts[1]);
    check('TWO_PKCE_SESSIONS_SAME_OWNER', a.owner === second.owner && a.owner !== b.owner);
    const call = async (session, action, expectedRevision, expected = 200) => {
      try {
        const result = await session.client.request(action ? '/action' : '/state', action ? { requestId: crypto.randomUUID(), expectedRevision, action } : undefined);
        need(expected === 200 && result.ok === true && result.view?.accountId === session.owner && Number.isSafeInteger(result.view.revision), 'DATING_OWNER_ENVELOPE_MISMATCH');
        return result;
      } catch (error) {
        if (expected !== 200 && error.status === expected) return { rejected: true, code: error.code };
        throw error;
      }
    };
    const profile = { nickname: '합성 만남 시험', region: '합성 지역', intro: '실제 사람이 아닌 연결 시험입니다.' };
    phase = 'dating-roundtrip';
    const empty = await call(a), otherEmpty = await call(b);
    check('FRESH_SYNTHETIC_ACCOUNTS_EMPTY', empty.view.revision === 0 && !empty.view.profile.nickname && otherEmpty.view.revision === 0 && !otherEmpty.view.profile.nickname);
    const saved = await call(a, { kind: 'onboard', profile, declared: true, consents: { profilePublic: false, receiveInvitations: false, storePreferences: false } }, 0);
    check('ATOMIC_PRIVATE_ONBOARDING_SAVE', saved.view.revision === 1 && saved.view.onboarding.complete === true && Object.values(saved.view.consents).every(value => value === false));
    const restored = await call(second);
    check('SECOND_SESSION_EXACT_RESTORE', restored.view.revision === 1 && isDeepStrictEqual(restored.view.profile, saved.view.profile));
    check('OTHER_ACCOUNT_ISOLATED', !(await call(b)).view.profile.nickname);
    const action = { kind: 'profile', profile: { ...profile, intro: '합성 수정 원문', values: {}, required: [], expirations: {} } };
    const stale = await call(second, action, 0, 409);
    check('STALE_CAS_PRESERVES_DATA', stale.code === 'revision-conflict' && isDeepStrictEqual((await call(a)).view.profile, saved.view.profile));
    const race = await Promise.allSettled([call(a, action, 1), call(second, action, 1)]);
    check('CONCURRENT_CAS_SINGLE_WINNER', race.filter(row => row.status === 'fulfilled').length === 1 && race.filter(row => row.status === 'rejected' && row.reason.status === 409).length === 1 && (await call(second)).view.revision === 2);
    await a.client.signOut();
    check('LOCAL_LOGOUT_CLEARS_ONLY_ITS_SESSION', !a.client.snapshot().signedIn && a.storage.getItem('synk.oauth.session.dating') === null && second.client.snapshot().signedIn && (await call(second)).view.revision === 2);
    const removed = await call(second, { kind: 'delete' }, 2);
    check('PRODUCT_DELETE_TOMBSTONE', removed.view.deleted === true && removed.view.revision === 3 && (await call(second)).view.deleted === true);
    const deleted = await call(second, action, 2, 410);
    check('STALE_CANNOT_REVIVE_DELETED_DATA', deleted.code === 'account-deleted' && (await call(second)).view.deleted === true);
    report.roundtripPassed = true;
  } catch (error) { report.error = errorCode(error); }
  finally {
    const issues = []; let requested = 0, verifiedPending = 0;
    const attempt = async (label, work) => { try { await work(); } catch { issues.push(label); } };
    const attempted = accounts.filter(row => row.attempted);
    // Exact generated emails + admin-owned marker recover an acknowledged-lost create.
    // This is a bounded SELECT; no list-users, remote SQL mutation, or global purge.
    if (attempted.length) await attempt('CREATED_ID_DISCOVERY', async () => {
      const emails = attempted.map(row => `'${row.email}'`).join(',');
      const rows = await checked(management + '/database/query', manager, 'POST', { query: `/* dating-pkce:discover */ select id,email from auth.users where email in (${emails}) and raw_app_meta_data->>'synk_dating_pkce_probe'='${nonce}'` });
      need(Array.isArray(rows) && rows.length <= attempted.length && new Set(rows.map(row => row.id)).size === rows.length && new Set(rows.map(row => row.email)).size === rows.length, 'INVALID_CLEANUP_DISCOVERY');
      for (const row of rows) {
        const account = attempted.find(item => item.email === row.email);
        need(account && UUID.test(row.id) && (!account.authId || account.authId === row.id), 'INVALID_CLEANUP_DISCOVERY'); account.authId = row.id;
      }
      await recordAuthIds(attempted.map(row => row.authId).filter(Boolean));
    });
    for (const account of attempted.filter(row => row.authId)) await attempt('SYNTHETIC_DELETE_REQUEST', async () => {
      const verified = await checked(base + '/auth/v1/admin/users/' + account.authId, admin);
      need(verified.id === account.authId && verified.email === account.email && verified.app_metadata?.synk_dating_pkce_probe === nonce, 'CLEANUP_OWNER_MARKER_MISMATCH');
      // OAuth logout may also have revoked the session originally used for
      // consent. Reauthenticate this exact synthetic, marker-checked account.
      await login(account);
      const before = await api(account.token, 'synk-account'), owner = before.body?.account?.synk_user_id;
      need(before.status === 200 && UUID.test(owner), 'CLEANUP_ACCOUNT_UNVERIFIED');
      const owned = await checked(management + '/database/query', manager, 'POST', { query: `/* dating-pkce:owner */ select exists(select 1 from engine.synk_auth_links l where l.auth_user_id='${account.authId}'::uuid and l.synk_user_id='${owner}'::uuid) and not exists(select 1 from engine.synk_auth_links other where other.synk_user_id='${owner}'::uuid and other.auth_user_id<>'${account.authId}'::uuid) as exclusively_owned` });
      need(Array.isArray(owned) && owned.length === 1 && owned[0].exclusively_owned === true, 'CLEANUP_ACCOUNT_NOT_EXCLUSIVE');
      const requestId = crypto.randomUUID();
      const deletion = await api(account.token, 'synk-account', { action: 'delete-request', request_id: requestId });
      need(deletion.status === 200 && deletion.body?.ok === true && deletion.body.request?.request_id === requestId && deletion.body.request?.kind === 'delete' && ['pending', 'processing'].includes(deletion.body.request.status), 'DELETE_REQUEST_NOT_CONFIRMED');
      requested++;
      const status = await api(account.token, 'synk-account');
      need(status.status === 200 && status.body?.account?.synk_user_id === owner && status.body.account.status === 'deletion-requested', 'DELETE_PENDING_NOT_VERIFIED'); verifiedPending++;
    });
    const known = attempted.filter(row => row.authId).length;
    if (known !== attempted.length) issues.push('UNCONFIRMED_CREATE_OUTCOME');
    report.cleanup = { attemptedAccounts: attempted.length, knownSyntheticAccounts: known, deleteRequestsAccepted: requested, verifiedDeletionPending: verifiedPending,
      requestsComplete: issues.length === 0 && requested === known, authUsersMayRemain: known > 0 || issues.length > 0,
      datingDocumentDeletionVerified: report.checks.includes('PRODUCT_DELETE_TOMBSTONE'), localDatabaseRemoved: false,
      deletionGraceDays: 7, purgeVerified: false, issues };
    clients.forEach(client => client.dispose());
    if (product) await attempt('LOCAL_PRODUCT_CLEANUP', async () => { await product.close(); report.cleanup.localDatabaseRemoved = true; });
    report.cleanup.requestsComplete = report.cleanup.requestsComplete && issues.length === 0;
    report.phase = phase; report.passed = report.checks.length;
    report.ok = report.roundtripPassed === true && report.cleanup.requestsComplete;
  }
  return report;
}

function parseArgs(args) { need(Array.isArray(args) && (args.length === 0 || args.length === 1 && args[0] === '--run'), 'ONLY_EXPLICIT_RUN_SUPPORTED'); return args.length === 1; }
async function readInput(file) { const info = await fs.stat(file); need(info.size <= 1024 * 1024, 'INPUT_TOO_LARGE'); return JSON.parse(await fs.readFile(file, 'utf8')); }
async function main(args = process.argv.slice(2)) {
  if (!parseArgs(args)) return { mode: 'prepare', environment: 'rehearsal', remoteRun: false, syntheticAccounts: 2,
    inputs: ['.tmp/synk-id/public-rehearsal.json', 'tools/synk-id/state/provision-rehearsal.json'], limitations: { ...LIMITS },
    note: 'Explicit --run creates only two synthetic accounts. Cleanup requests normal seven-day deletion; it does not prove account purge, public consent portal UI, or physical-device UI.' };
  const { credentials } = require('../lib.js');
  const settings = await readInput(path.join(ROOT, '.tmp/synk-id/public-rehearsal.json'));
  const journal = await readInput(path.join(ROOT, 'tools/synk-id/state/provision-rehearsal.json'));
  const previousRef = process.env.SUPABASE_PROJECT_REF; let env;
  try { process.env.SUPABASE_PROJECT_REF = credentials.리허설REF; env = credentials.읽기('dating-pkce-rehearsal', { args: ['--run'] }); }
  finally { if (previousRef === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = previousRef; }
  const core = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-account/src/core.mjs')));
  const { createDatingAccount } = await import(pathToFileURL(path.join(ROOT, 'experiences/atlas-lab/dating-account.mjs')));
  const { createDatingServer } = await import(pathToFileURL(path.join(ROOT, 'experiences/atlas-lab/dating-server.mjs')));
  const directory = path.join(ROOT, 'output/dating-pkce-rehearsal');
  const realRoot = await fs.realpath(ROOT); let ancestor = directory;
  for (;;) {
    try { const resolved = await fs.realpath(ancestor), relative = path.relative(realRoot, resolved); need(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'UNSAFE_CLEANUP_FILE_PATH'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `synthetic-auth-${crypto.randomUUID()}.json`);
  const recordAuthIds = async authIds => { need(authIds.length <= 2 && authIds.every(value => UUID.test(value)), 'INVALID_CLEANUP_IDS'); await fs.writeFile(file, JSON.stringify({ authIds }) + '\n', { mode: 0o600 }); };
  return runRehearsal({ settings, journal, credentials, env, fetcher: fetch, core, createDatingAccount, createProduct: options => createLocalProduct({ ...options, createDatingServer }), recordAuthIds });
}
if (require.main === module) main().then(report => { console.log(JSON.stringify(report, null, 2)); if (report.ok === false) process.exitCode = 1; }).catch(error => { console.error(JSON.stringify({ ok: false, error: errorCode(error) })); process.exitCode = 1; });
module.exports = { parseArgs, validateInputs, runRehearsal, createLocalProduct, main };
