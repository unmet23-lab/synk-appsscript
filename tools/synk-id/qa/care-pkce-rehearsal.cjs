#!/usr/bin/env node
'use strict';
// Preparation is the default. --run is rehearsal-only and requires an actual
// completed provisioning journal. No credentials are read merely on import.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { isDeepStrictEqual } = require('node:util');
const { CLIENTS } = require('../registry.cjs');
const { matchesClient, digest } = require('../provision-plan.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,256}$/;
const SAFE = Symbol('safe-rehearsal-error');
const NAMES = ['care-browser', 'care-native'];
const LIMITS = Object.freeze({ paidAI: false, realAccounts: false, physicalDevices: false, browserUI: false, nativeVault: false, accountPurgeVerified: false });
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
    need(wanted && CLIENT_ID.test(id || '') && journal.mapping[id] === 'platform', 'REGISTERED_CARE_CLIENT_REQUIRED');
    if (settings.bindings?.[name] !== undefined) need(settings.bindings[name] === id, 'PUBLIC_CLIENT_BINDING_MISMATCH');
    const rows = (settings.clients || []).filter(row => row.registration === name || row.client_id === id);
    need(rows.length <= 1 && (!rows.length || rows[0].client_id === id && matchesClient(wanted, rows[0])), 'PUBLIC_CLIENT_BINDING_MISMATCH');
    return { name, wanted, id, redirectUri: wanted.redirectUris[0] };
  });
  need(new Set(registrations.map(row => row.id)).size === 2, 'DISTINCT_OAUTH_CLIENTS_REQUIRED');
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

async function careFixture(care, at) {
  let state = care.emptyState();
  state.people.push(care.makePerson({ id: 'synthetic-person', name: '합성 친구', group: 'friend' }));
  state = care.captureSource(state, { personId: 'synthetic-person', title: '합성 시험 원문', text: '함께 걸었던 합성 강변.', memories: [{ kind: 'memory', text: '함께 걸었던 합성 강변', sourceQuote: '함께 걸었던 합성 강변' }] }, at);
  const memorySelection = { memoryId: state.memories[0].id, use: 'shared-memory', confirmed: true };
  const draft = care.generateCheckinDraft(state.people[0], { state, memorySelection, approach: 'warm' });
  state = care.recordDraft(state, { personId: 'synthetic-person', eventId: '', eventType: 'checkin', text: draft.text, originalText: draft.text, memorySelection }, at);
  state = care.rememberDraft(state, { personId: 'synthetic-person', eventId: '', eventType: 'checkin', text: draft.text }, at);
  state = care.recordPreparation(state, { personId: 'synthetic-person', eventId: '', recommendedAction: 'contact' }, at);
  return care.importBackup(state);
}

/** HTTP is injected for offline tests. Only main supplies the real guarded provider. */
async function runRehearsal({ settings, journal, credentials, env, fetcher, core, care, recordAuthIds = async () => {} }) {
  const target = validateInputs(settings, journal, credentials, env), { base, ref, portal, registrations } = target;
  const report = { mode: 'provider-pkce-rehearsal', environment: 'rehearsal', syntheticAccountsOnly: true, checks: [], cleanup: null, limitations: { ...LIMITS }, ok: false };
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
  need(Array.isArray(functions) && ['synk-account', 'synk-care'].every(slug => functions.some(row => row.slug === slug && row.status === 'ACTIVE' && row.verify_jwt === true)), 'ACTIVE_ACCOUNT_CARE_FUNCTIONS_REQUIRED');
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
  const data = await careFixture(care, new Date().toISOString());
  need(data.events.length === 0 && data.drafts[0].eventType === 'checkin', 'CANONICAL_FIXTURE_REQUIRED');
  const nonce = crypto.randomUUID();
  const accounts = [0, 1].map(index => ({ email: `care-pkce-${nonce}-${index}@example.invalid`, password: crypto.randomBytes(32).toString('base64url'), authId: null, token: null, attempted: false }));
  const api = (token, endpoint, body) => request(base + '/functions/v1/' + endpoint, { apikey: pub, Authorization: `Bearer ${token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.1.0' }, body === undefined ? 'GET' : 'POST', body);
  const login = async account => {
    const session = await checked(base + '/auth/v1/token?grant_type=password', { apikey: pub }, 'POST', { email: account.email, password: account.password });
    need(session.user?.id === account.authId && typeof session.access_token === 'string', 'SYNTHETIC_LOGIN_MISMATCH');
    account.token = session.access_token; return session.access_token;
  };
  const oauth = async (account, name) => {
    const registration = registrations.find(row => row.name === name), config = registration.config;
    const map = new Map(), storage = { setItem: (k, v) => map.set(k, v), getItem: k => map.get(k) ?? null, removeItem: k => map.delete(k) };
    const begin = await core.beginOAuth({ config, product: 'platform', storage, cryptoAPI: crypto.webcrypto });
    // Read the redirect but never navigate it, invoke a desktop callback, or send a bearer to it.
    const response = await fetcher(begin, { redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(25000) });
    let redirect; try { redirect = new URL(response.headers.get('location')); } catch { fail('CONSENT_PORTAL_REQUIRED'); }
    await response.body?.cancel();
    need(response.status === 302 && redirect.origin === portal.origin && redirect.pathname === portal.pathname && !redirect.username && !redirect.password && !redirect.hash, 'CONSENT_PORTAL_REQUIRED');
    const authorizationId = redirect.searchParams.get('authorization_id');
    need(CLIENT_ID.test(authorizationId || '') && redirect.searchParams.getAll('authorization_id').length === 1, 'AUTHORIZATION_ID_REQUIRED');
    const headers = { apikey: pub, Authorization: `Bearer ${account.token}` };
    const details = await checked(base + '/auth/v1/oauth/authorizations/' + authorizationId, headers);
    need(details.client?.id === registration.id, 'AUTHORIZATION_CLIENT_MISMATCH');
    const consent = await checked(base + '/auth/v1/oauth/authorizations/' + authorizationId + '/consent', headers, 'POST', { action: 'approve' });
    const fields = core.consumeCallback({ config, product: 'platform', url: consent.redirect_url, storage });
    const tokens = await core.tokenRequest(config, fields, async (url, options) => {
      const result = await fetchBounded(url, options), json = await readResponse(result, 65536);
      return { ok: result.ok, json: async () => json };
    });
    let claims; try { claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString('utf8')); } catch { fail('INVALID_OAUTH_TOKEN'); }
    need(claims.sub === account.authId && claims.client_id === registration.id && claims.iss === base + '/auth/v1', 'OAUTH_OWNER_CLIENT_MISMATCH');
    // Decoded claims are diagnostics; the Edge account and care APIs verify the token next.
    const verified = await api(tokens.access_token, 'synk-account');
    need(verified.status === 200 && verified.body?.ok === true && UUID.test(verified.body.account?.synk_user_id), 'VERIFIED_SYNTHETIC_ACCOUNT_REQUIRED');
    return { token: tokens.access_token, owner: verified.body.account.synk_user_id };
  };
  let phase = 'create-synthetic-accounts';
  try {
    for (const account of accounts) {
      account.attempted = true;
      const created = await checked(base + '/auth/v1/admin/users', admin, 'POST', { email: account.email, password: account.password, email_confirm: true, app_metadata: { synk_care_pkce_probe: nonce }, user_metadata: { synk_signup: { version: 'synk-signup-1', learning: false } } });
      need(UUID.test(created.id) && created.email === account.email && created.app_metadata?.synk_care_pkce_probe === nonce, 'INVALID_CREATED_AUTH_ID'); account.authId = created.id;
      await recordAuthIds(accounts.map(row => row.authId).filter(Boolean));
      await login(account);
    }
    phase = 'oauth-pkce';
    const a = await oauth(accounts[0], 'care-browser'), second = await oauth(accounts[0], 'care-native'), b = await oauth(accounts[1], 'care-browser');
    check('BROWSER_NATIVE_PKCE_SAME_OWNER', a.owner === second.owner && a.owner !== b.owner);
    const call = async (session, body, expected = 200) => {
      const response = await api(session.token, 'synk-care', body);
      need(response.status === expected, 'UNEXPECTED_CARE_HTTP_STATUS');
      if (expected === 200) need(response.body?.ok === true && response.body.scope === 'synk-care' && response.body.accountId === session.owner && Number.isSafeInteger(response.body.revision), 'CARE_OWNER_ENVELOPE_MISMATCH');
      else need(response.body?.error?.code === 'REVISION_CONFLICT', 'CARE_CONFLICT_REQUIRED');
      return response.body;
    };
    phase = 'care-roundtrip';
    const empty = await call(a), otherEmpty = await call(b);
    check('FRESH_SYNTHETIC_ACCOUNTS_EMPTY', empty.state === null && empty.revision === 0 && otherEmpty.state === null && otherEmpty.revision === 0);
    const saved = await call(a, { action: 'save', expected_revision: 0, state: data });
    check('MEMORY_CHECKIN_DRAFT_SAVE', saved.revision === 1 && isDeepStrictEqual(saved.state, data));
    const restored = await call(second);
    check('NATIVE_SESSION_EXACT_RESTORE', restored.revision === 1 && isDeepStrictEqual(restored.state, data));
    check('OTHER_ACCOUNT_ISOLATED', (await call(b)).state === null);
    await call(second, { action: 'save', expected_revision: 0, state: data }, 409);
    check('STALE_CAS_PRESERVES_DATA', isDeepStrictEqual((await call(a)).state, data));
    const concurrent = await Promise.all([api(a.token, 'synk-care', { action: 'save', expected_revision: 1, state: data }), api(second.token, 'synk-care', { action: 'save', expected_revision: 1, state: data })]);
    check('CONCURRENT_CAS_SINGLE_WINNER', concurrent.map(row => row.status).sort().join(',') === '200,409');
    const removed = await call(a, { action: 'delete', expected_revision: 2 });
    check('DELETE_TOMBSTONE', removed.state === null && removed.revision === 3 && (await call(second)).state === null);
    await call(second, { action: 'save', expected_revision: 2, state: data }, 409);
    const final = await call(a);
    check('STALE_CANNOT_REVIVE_DELETED_DATA', final.state === null && final.revision === 3);
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
      const rows = await checked(management + '/database/query', manager, 'POST', { query: `/* care-pkce:discover */ select id,email from auth.users where email in (${emails}) and raw_app_meta_data->>'synk_care_pkce_probe'='${nonce}'` });
      need(Array.isArray(rows) && rows.length <= attempted.length && new Set(rows.map(row => row.id)).size === rows.length && new Set(rows.map(row => row.email)).size === rows.length, 'INVALID_CLEANUP_DISCOVERY');
      for (const row of rows) {
        const account = attempted.find(item => item.email === row.email);
        need(account && UUID.test(row.id) && (!account.authId || account.authId === row.id), 'INVALID_CLEANUP_DISCOVERY'); account.authId = row.id;
      }
      await recordAuthIds(attempted.map(row => row.authId).filter(Boolean));
    });
    for (const account of attempted.filter(row => row.authId)) await attempt('SYNTHETIC_DELETE_REQUEST', async () => {
      const verified = await checked(base + '/auth/v1/admin/users/' + account.authId, admin);
      need(verified.id === account.authId && verified.email === account.email && verified.app_metadata?.synk_care_pkce_probe === nonce, 'CLEANUP_OWNER_MARKER_MISMATCH');
      if (!account.token) await login(account);
      const before = await api(account.token, 'synk-account'), owner = before.body?.account?.synk_user_id;
      need(before.status === 200 && UUID.test(owner), 'CLEANUP_ACCOUNT_UNVERIFIED');
      const owned = await checked(management + '/database/query', manager, 'POST', { query: `/* care-pkce:owner */ select exists(select 1 from engine.synk_auth_links l where l.auth_user_id='${account.authId}'::uuid and l.synk_user_id='${owner}'::uuid) and not exists(select 1 from engine.synk_auth_links other where other.synk_user_id='${owner}'::uuid and other.auth_user_id<>'${account.authId}'::uuid) as exclusively_owned` });
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
      careDocumentDeletionVerified: report.checks.includes('DELETE_TOMBSTONE'), privateCareDataMayRemain: !report.checks.includes('DELETE_TOMBSTONE'),
      deletionGraceDays: 7, purgeVerified: false, issues };
    report.phase = phase; report.passed = report.checks.length;
    report.ok = report.roundtripPassed === true && report.cleanup.requestsComplete;
  }
  return report;
}

function parseArgs(args) { need(Array.isArray(args) && (args.length === 0 || args.length === 1 && args[0] === '--run'), 'ONLY_EXPLICIT_RUN_SUPPORTED'); return args.length === 1; }
async function readInput(file) { const info = await fs.stat(file); need(info.size <= 1024 * 1024, 'INPUT_TOO_LARGE'); return JSON.parse(await fs.readFile(file, 'utf8')); }
async function main(args = process.argv.slice(2)) {
  if (!parseArgs(args)) return { mode: 'prepare', environment: 'rehearsal', remoteRun: false, syntheticAccounts: 2,
    inputs: ['.tmp/synk-id/public-rehearsal.json', '.tmp/synk-id/provision-rehearsal.json'], limitations: { ...LIMITS },
    note: 'Explicit --run creates only two synthetic accounts. Cleanup requests normal seven-day deletion; it does not prove account purge or browser/native device UI.' };
  const { credentials } = require('../lib.js');
  const settings = await readInput(path.join(ROOT, '.tmp/synk-id/public-rehearsal.json'));
  const journal = await readInput(path.join(ROOT, '.tmp/synk-id/provision-rehearsal.json'));
  const previousRef = process.env.SUPABASE_PROJECT_REF; let env;
  try { process.env.SUPABASE_PROJECT_REF = credentials.리허설REF; env = credentials.읽기('care-pkce-rehearsal', { args: ['--run'] }); }
  finally { if (previousRef === undefined) delete process.env.SUPABASE_PROJECT_REF; else process.env.SUPABASE_PROJECT_REF = previousRef; }
  const core = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-account/src/core.mjs')));
  const care = await import(pathToFileURL(path.join(ROOT, 'experiences/relationship-care/model.mjs')));
  const directory = path.join(ROOT, 'output/care-pkce-rehearsal');
  const realRoot = await fs.realpath(ROOT); let ancestor = directory;
  for (;;) {
    try { const resolved = await fs.realpath(ancestor), relative = path.relative(realRoot, resolved); need(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'UNSAFE_CLEANUP_FILE_PATH'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `synthetic-auth-${crypto.randomUUID()}.json`);
  const recordAuthIds = async authIds => { need(authIds.length <= 2 && authIds.every(value => UUID.test(value)), 'INVALID_CLEANUP_IDS'); await fs.writeFile(file, JSON.stringify({ authIds }) + '\n', { mode: 0o600 }); };
  return runRehearsal({ settings, journal, credentials, env, fetcher: fetch, core, care, recordAuthIds });
}
if (require.main === module) main().then(report => { console.log(JSON.stringify(report, null, 2)); if (report.ok === false) process.exitCode = 1; }).catch(error => { console.error(JSON.stringify({ ok: false, error: errorCode(error) })); process.exitCode = 1; });
module.exports = { parseArgs, validateInputs, runRehearsal, careFixture, main };
