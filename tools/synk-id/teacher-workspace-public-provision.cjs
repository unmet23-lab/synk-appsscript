#!/usr/bin/env node
'use strict';
// One dedicated Workspace teacher OAuth registration. Existing canonical auth/lock/journal are reused.
// Default is read-only. This never writes the three local runtime configs.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createProvider, journalStore } = require('./provision-apply.cjs');
const { buildProvisionPlan, digest, clientName } = require('./provision-plan.cjs');
const { buildConfigPlan, OUTPUTS } = require('./public-config.cjs');
const { WORKSPACE_TEACHER_CLIENT: TEACHER, LEGACY_CLIENT_IDS } = require('./registry.cjs');
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_OUTPUT = '.tmp/synk-id/teacher-workspace-public-production';
const clone = value => structuredClone(value), object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);
const fail = code => { throw Error(code); };
const exactClient = row => validId(row?.client_id) && row.client_type === 'public' && !row.client_secret && !row.deleted_at && row.revoked !== true
  && (!row.token_endpoint_auth_method || row.token_endpoint_auth_method === 'none') && Array.isArray(row.redirect_uris)
  && row.redirect_uris.length === 1 && row.redirect_uris[0] === TEACHER.redirectUris[0];

function validateSettings(settings) {
  if (!object(settings) || settings.environment !== 'production' || settings.supabaseUrl !== 'https://qiwxeddwwnzkwalpsuty.supabase.co'
    || settings.accountApiUrl && settings.accountApiUrl !== settings.supabaseUrl || settings.portalUrl !== 'https://synk.im/id/') fail('TEACHER_PUBLIC_PRODUCTION_SETTINGS_REQUIRED');
  buildConfigPlan({ ...settings, clients: [], bindings: {} });
}
function validateJournal(journal) {
  if (!object(journal) || journal.version !== 1 || journal.environment !== 'production' || !journal.completedAt
    || !object(journal.mapping) || !object(journal.bindings) || !Array.isArray(journal.attempted)) fail('TEACHER_PUBLIC_COMPLETED_UNIFIED_JOURNAL_REQUIRED');
  const record = journal.publicTeacherWorkspace;
  if (record && (!object(record) || record.version !== 1 || record.registration !== TEACHER.id || record.redirectUri !== TEACHER.redirectUris[0]
    || typeof record.attempted !== 'boolean' || record.clientId !== null && !validId(record.clientId))) fail('TEACHER_PUBLIC_JOURNAL_INVALID');
  if (journal.pendingMapping && (!record?.clientId || digest(journal.pendingMapping) !== digest({ ...journal.mapping, [record.clientId]: TEACHER.product }))) fail('TEACHER_PUBLIC_UNRELATED_PENDING_MAPPING');
}
function inspect(state, clients, remoteDigest) {
  const plan = buildProvisionPlan({ environment: 'production', clients, secretDigest: remoteDigest, existingMapping: state.mapping, bindings: state.bindings });
  if (plan.actions.some(action => action.action !== 'register-public-client')) fail('TEACHER_PUBLIC_EXISTING_REGISTRATIONS_NOT_READY');
  const record = state.publicTeacherWorkspace, name = clientName(TEACHER.id, 'production');
  const named = clients.filter(row => row.client_name === name);
  if (named.length > 1 || named.some(row => !exactClient(row))) fail('TEACHER_PUBLIC_NAME_CONFLICT');
  let found = record.clientId ? clients.find(row => row.client_id === record.clientId) : null;
  if (record.clientId && (!found || !exactClient(found))) fail('TEACHER_PUBLIC_RETURNED_ID_NOT_VERIFIED');
  if (!found && named.length) {
    if (!record.attempted) fail('TEACHER_PUBLIC_EXISTING_REGISTRATION_REQUIRES_REVIEW');
    found = named[0];
  }
  const matching = clients.filter(row => row.redirect_uris?.includes(TEACHER.redirectUris[0]));
  if (matching.some(row => row.client_id !== found?.client_id) || named.some(row => row.client_id !== found?.client_id)) fail('TEACHER_PUBLIC_CALLBACK_CONFLICT');
  if (found && Object.hasOwn(state.mapping, found.client_id) && state.mapping[found.client_id] !== TEACHER.product) fail('TEACHER_PUBLIC_PRODUCT_CONFLICT');
  if (found) record.clientId = found.client_id;
  return found;
}

async function validateCurrentPortal(settings, currentPortal) {
  validateSettings(settings);
  const { validatePortalConfig } = await import(pathToFileURL(path.join(__dirname, 'prepare-portal.mjs')).href);
  const environment = { EXPO_PUBLIC_SUPABASE_URL: settings.supabaseUrl, EXPO_PUBLIC_SUPABASE_ANON_KEY: settings.supabasePublishableKey,
    EXPO_PUBLIC_SYNK_WORLD_OAUTH_CLIENT_ID: LEGACY_CLIENT_IDS.production.world };
  if (!object(currentPortal) || !Array.isArray(currentPortal.authorizationClients)) fail('TEACHER_PUBLIC_CURRENT_PORTAL_REQUIRED');
  return validatePortalConfig(currentPortal, { targetName: 'production', environment, sourceRoot: ROOT });
}
async function buildArtifacts(settings, currentPortal, clientId) {
  await validateCurrentPortal(settings, currentPortal);
  if (!validId(clientId)) fail('TEACHER_PUBLIC_VERIFIED_ID_REQUIRED');
  const config = { version: 1, origin: 'https://workspace.synk.im', env: {
    SYNK_ID_SUPABASE_URL: settings.supabaseUrl, SYNK_ID_ACCOUNT_API_URL: settings.supabaseUrl + '/functions/v1/synk-account',
    SYNK_ID_PUBLISHABLE_KEY: settings.supabasePublishableKey, SYNK_ID_TEACHER_CLIENT_ID: clientId } };
  const authorizationClient = { product: TEACHER.product, clientId, redirectUris: [...TEACHER.redirectUris] };
  const existing = currentPortal.authorizationClients.find(row => row.clientId === clientId);
  if (existing && (existing.product !== TEACHER.product || existing.redirectUris.length !== 1 || existing.redirectUris[0] !== TEACHER.redirectUris[0])) fail('TEACHER_PUBLIC_PORTAL_CONFLICT');
  const portal = clone(currentPortal);
  if (!existing) portal.authorizationClients.push(authorizationClient);
  await validateCurrentPortal(settings, portal);
  return { config, portal };
}

async function provisionTeacherPublic({ api, journal, settings, currentPortal, apply = false, saveJournal, writeArtifacts = async () => [] }) {
  if (typeof apply !== 'boolean' || apply && typeof saveJournal !== 'function') fail('TEACHER_PUBLIC_EXPLICIT_APPLY_AND_JOURNAL_REQUIRED');
  validateSettings(settings); validateJournal(journal);
  // Validate the current portal before remote mutation, without inventing a new ID.
  await validateCurrentPortal(settings, currentPortal);
  const state = clone(journal), originalBindings = digest(state.bindings), originalAttempts = digest(state.attempted);
  state.publicTeacherWorkspace ||= { version: 1, registration: TEACHER.id, redirectUri: TEACHER.redirectUris[0], attempted: false, clientId: null };
  let observed = await api.readDigest();
  if (state.pendingMapping && observed === digest(state.pendingMapping)) { state.mapping = state.pendingMapping; state.pendingMapping = null; }
  if (observed !== digest(state.mapping)) fail('TEACHER_PUBLIC_MAPPING_DRIFT');
  let clients = await api.listClients(), found = inspect(state, clients, observed);
  // A stale/incomplete portal snapshot cannot drop any existing registered app.
  for (const row of clients.filter(row => Object.hasOwn(state.mapping, row.client_id) && row.client_id !== state.publicTeacherWorkspace.clientId)) {
    const portalRow = currentPortal.authorizationClients.find(item => item.clientId === row.client_id);
    if (!portalRow || portalRow.product !== state.mapping[row.client_id] || row.redirect_uris.some(uri => !portalRow.redirectUris.includes(uri))) fail('TEACHER_PUBLIC_EXISTING_PORTAL_REGISTRATION_MISSING');
  }
  await api.verifyFortuneBindings(state.bindings);
  const summary = () => ({ environment: 'production', mode: apply ? 'apply' : 'dry-run', registration: TEACHER.id, product: TEACHER.product, callback: TEACHER.redirectUris[0],
    actualClientId: found?.client_id || null, existingRegistrations: clients.length, registrationNeeded: !found, mappingVerified: true, mappingEntries: Object.keys(state.mapping).length,
    localConfigsWritten: false, existingBindingsPreserved: digest(state.bindings) === originalBindings, liveLoginVerified: false });
  if (!apply) return summary();
  const fresh = async () => { const value = await api.readDigest(); if (value !== digest(state.mapping)) fail('TEACHER_PUBLIC_MAPPING_DRIFT'); return value; };
  if (!found) {
    if (state.publicTeacherWorkspace.attempted) fail('TEACHER_PUBLIC_UNCONFIRMED_CREATE_NO_RETRY');
    await fresh(); clients = await api.listClients(); found = inspect(state, clients, digest(state.mapping));
    if (!found) {
      state.publicTeacherWorkspace.attempted = true; state.publicTeacherWorkspace.outcome = 'pending'; state.publicTeacherWorkspace.attemptedAt = new Date().toISOString(); await saveJournal(clone(state));
      let returned;
      try {
        returned = await api.createClient({ client_name: clientName(TEACHER.id, 'production'), client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...TEACHER.redirectUris] });
        state.publicTeacherWorkspace.outcome = 'response'; if (validId(returned?.client_id)) state.publicTeacherWorkspace.clientId = returned.client_id;
      } catch (error) { state.publicTeacherWorkspace.outcome = 'unconfirmed'; if (Number.isInteger(error.status)) state.publicTeacherWorkspace.httpStatus = error.status; }
      await saveJournal(clone(state)); clients = await api.listClients(); found = inspect(state, clients, digest(state.mapping));
      if (!found || returned?.client_id && returned.client_id !== found.client_id) fail('TEACHER_PUBLIC_CREATE_NOT_VERIFIED');
      await saveJournal(clone(state));
    }
  }
  await fresh(); clients = await api.listClients(); found = inspect(state, clients, digest(state.mapping));
  if (!found) fail('TEACHER_PUBLIC_CREATE_NOT_VERIFIED');
  if (!Object.hasOwn(state.mapping, found.client_id)) {
    state.pendingMapping = { ...state.mapping, [found.client_id]: TEACHER.product }; await saveJournal(clone(state)); await fresh();
    try { await api.writeMapping(state.pendingMapping); } catch { /* Confirm by digest; never blindly POST again. */ }
    if (await api.readDigest() !== digest(state.pendingMapping)) fail('TEACHER_PUBLIC_MAPPING_NOT_VERIFIED');
    state.mapping = state.pendingMapping; state.pendingMapping = null; await saveJournal(clone(state));
  }
  await fresh(); clients = await api.listClients(); found = inspect(state, clients, digest(state.mapping)); await api.verifyFortuneBindings(state.bindings);
  if (digest(state.bindings) !== originalBindings || digest(state.attempted) !== originalAttempts) fail('TEACHER_PUBLIC_EXISTING_JOURNAL_CHANGED');
  const artifacts = await buildArtifacts(settings, currentPortal, found.client_id), files = await writeArtifacts(artifacts);
  state.publicTeacherWorkspace.completedAt = new Date().toISOString(); await saveJournal(clone(state));
  return { ...summary(), files, completedAt: state.publicTeacherWorkspace.completedAt };
}

async function readJson(file) { const info = await fs.stat(file); if (info.size > 1024 * 1024) fail('TEACHER_PUBLIC_INPUT_TOO_LARGE'); try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { fail('TEACHER_PUBLIC_INVALID_JSON'); } }
async function writePublicArtifacts(artifacts, root = ROOT) {
  const workspace = await fs.realpath(root), directory = path.join(workspace, PUBLIC_OUTPUT);
  for (const name of ['', 'config.json', 'portal-config.json']) {
    let current = path.join(directory, name);
    for (;;) { try { if ((await fs.lstat(current)).isSymbolicLink()) fail('TEACHER_PUBLIC_OUTPUT_LINK'); } catch (error) { if (error.code !== 'ENOENT') throw error; } if (current === workspace) break; const next = path.dirname(current); if (next === current) fail('TEACHER_PUBLIC_OUTPUT_OUTSIDE_WORKSPACE'); current = next; }
  }
  await fs.mkdir(directory, { recursive: true }); const changes = [];
  for (const [name, value] of [['config.json', artifacts.config], ['portal-config.json', artifacts.portal]]) {
    const target = path.join(directory, name), content = JSON.stringify(value, null, 2) + '\n'; let previous = null;
    try { previous = await fs.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous === content) { changes.push({ path: path.relative(workspace, target), written: false }); continue; }
    const suffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    if (previous !== null) await fs.writeFile(target + '.backup-' + suffix, previous, { flag: 'wx', mode: 0o600 });
    const temporary = target + '.tmp-' + suffix;
    try { await fs.writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, target); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
    changes.push({ path: path.relative(workspace, target), written: true });
  }
  return changes;
}
function parseArguments(args) {
  const result = { apply: false }; const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]; if (seen.has(key) || !['--운영', '--apply', '--public', '--portal'].includes(key)) fail('TEACHER_PUBLIC_INVALID_ARGUMENTS'); seen.add(key);
    if (key === '--apply') result.apply = true;
    else if (key !== '--운영') { const value = args[++i]; if (!value || value.startsWith('--')) fail('TEACHER_PUBLIC_ARGUMENT_VALUE_REQUIRED'); result[key === '--public' ? 'publicPath' : 'portalPath'] = value; }
  }
  if (!seen.has('--운영') || !result.publicPath || !result.portalPath) fail('TEACHER_PUBLIC_USAGE_REQUIRE_PRODUCTION_PUBLIC_PORTAL'); return result;
}
async function main() {
  const options = parseArguments(process.argv.slice(2)); const settings = await readJson(options.publicPath), currentPortal = await readJson(options.portalPath);
  validateSettings(settings);
  const storage = await journalStore(ROOT, 'production'); validateJournal(storage.journal);
  const api = await createProvider({ environment: 'production', publicSettings: settings, apply: options.apply });
  let lock;
  try {
    if (options.apply) { lock = await fs.open(storage.lockPath, 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString(), registration: TEACHER.id })); }
    // Re-read after locking: never execute against a journal read before another writer finished.
    const journal = await readJson(storage.file);
    const before = await Promise.all(Object.values(OUTPUTS).map(async file => [file, digest(await fs.readFile(path.join(ROOT, file), 'utf8'))]));
    const result = await provisionTeacherPublic({ api, journal, settings, currentPortal, apply: options.apply, saveJournal: storage.saveJournal, writeArtifacts: writePublicArtifacts });
    for (const [file, hash] of before) if (digest(await fs.readFile(path.join(ROOT, file), 'utf8')) !== hash) fail('TEACHER_PUBLIC_LOCAL_CONFIG_CHANGED');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (lock) { await lock.close(); await fs.unlink(storage.lockPath); } }
}
module.exports = { provisionTeacherPublic, buildArtifacts, writePublicArtifacts, parseArguments, exactClient, PUBLIC_OUTPUT };
if (require.main === module) main().catch(error => { console.error(error.code === 'EEXIST' ? 'TEACHER_PUBLIC_OTHER_PROVISIONER_LOCKED' : error.message); process.exitCode = 1; });
