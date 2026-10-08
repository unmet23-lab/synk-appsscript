#!/usr/bin/env node
'use strict';
// Default read-only. Add one dedicated customer client and one staff callback;
// preserve the shared journal, full product map and every existing callback.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createProvider, journalStore } = require('./provision-apply.cjs');
const { buildProvisionPlan, digest, clientName } = require('./provision-plan.cjs');
const { buildConfigPlan, OUTPUTS } = require('./public-config.cjs');
const { COMPANY_CLOUD: COMPANY, LEGACY_CLIENT_IDS } = require('./registry.cjs');
const ROOT = path.resolve(__dirname, '../..'), PUBLIC_OUTPUT = '.tmp/synk-id/company-public-production';
const clone = value => structuredClone(value), object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);
const fail = code => { throw Error('COMPANY_PUBLIC_' + code); };
const sameUris = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && new Set(a).size === a.length && a.every(uri => b.includes(uri));
const exactCustomer = row => validId(row?.client_id) && row.client_type === 'public' && !row.client_secret && !row.deleted_at && row.revoked !== true
  && (!row.token_endpoint_auth_method || row.token_endpoint_auth_method === 'none') && sameUris(row.redirect_uris, COMPANY.customer.redirectUris);

function validateSettings(settings) {
  if (!object(settings) || settings.environment !== 'production' || settings.supabaseUrl !== 'https://qiwxeddwwnzkwalpsuty.supabase.co'
    || settings.accountApiUrl && settings.accountApiUrl !== settings.supabaseUrl || settings.portalUrl !== 'https://synk.im/id/') fail('PRODUCTION_SETTINGS_REQUIRED');
  buildConfigPlan({ ...settings, clients: [], bindings: {} });
}
function validateJournal(journal) {
  if (!object(journal) || journal.version !== 1 || journal.environment !== 'production' || !journal.completedAt
    || !object(journal.mapping) || !object(journal.bindings) || !Array.isArray(journal.attempted)) fail('COMPLETED_UNIFIED_JOURNAL_REQUIRED');
  const entry = journal.publicCompany, staffId = journal.bindings[COMPANY.staff.registration];
  if (!validId(staffId) || journal.mapping[staffId] !== COMPANY.staff.product) fail('STAFF_BINDING_REQUIRED');
  if (entry && (!object(entry) || entry.version !== 1 || entry.origin !== COMPANY.origin || !object(entry.customer) || !object(entry.staff)
    || entry.customer.registration !== COMPANY.customer.id || typeof entry.customer.attempted !== 'boolean'
    || entry.customer.clientId !== null && !validId(entry.customer.clientId)
    || entry.staff.clientId !== staffId || entry.staff.redirectUri !== COMPANY.staff.redirectUri || typeof entry.staff.attempted !== 'boolean')) fail('JOURNAL_INVALID');
  if (entry?.staff.attempted && (!Array.isArray(entry.staff.beforeUris) || !entry.staff.beforeUris.length
    || !sameUris(entry.staff.targetUris, [...new Set([...entry.staff.beforeUris, COMPANY.staff.redirectUri])])
    || entry.staff.beforeUris.includes(COMPANY.staff.redirectUri))) fail('STAFF_JOURNAL_INVALID');
  if (journal.pendingMapping && (!entry?.customer.clientId || digest(journal.pendingMapping) !== digest({ ...journal.mapping, [entry.customer.clientId]: COMPANY.customer.product }))) fail('UNRELATED_PENDING_MAPPING');
}
async function validatePortal(settings, currentPortal) {
  validateSettings(settings);
  const { validatePortalConfig } = await import(pathToFileURL(path.join(__dirname, 'prepare-portal.mjs')).href);
  const environment = { EXPO_PUBLIC_SUPABASE_URL: settings.supabaseUrl, EXPO_PUBLIC_SUPABASE_ANON_KEY: settings.supabasePublishableKey,
    EXPO_PUBLIC_SYNK_WORLD_OAUTH_CLIENT_ID: LEGACY_CLIENT_IDS.production.world };
  if (!object(currentPortal) || !Array.isArray(currentPortal.authorizationClients)) fail('CURRENT_PORTAL_REQUIRED');
  return validatePortalConfig(currentPortal, { targetName: 'production', environment, sourceRoot: ROOT });
}
function inspect(state, clients, remoteDigest, portal) {
  const plan = buildProvisionPlan({ environment: 'production', clients, secretDigest: remoteDigest, existingMapping: state.mapping, bindings: state.bindings });
  // Newly added catalogue entries without canonical bindings are another task.
  // Existing bindings/legacy identities are still validated by the shared plan;
  // never register unrelated apps or repair their mapping in this workflow.
  if (plan.actions.some(action => action.action !== 'register-public-client')) fail('EXISTING_REGISTRATIONS_NOT_READY');
  const deferredRegistrations = plan.registrations.filter(row => ['registration-needed', 'binding-required'].includes(row.status)).map(row => row.id);
  const entry = state.publicCompany, staff = clients.find(row => row.client_id === entry.staff.clientId);
  if (!staff || clients.some(row => row.client_id !== staff.client_id && row.redirect_uris?.includes(COMPANY.staff.redirectUri))) fail('STAFF_CALLBACK_CONFLICT');
  if (entry.staff.attempted && !sameUris(staff.redirect_uris, entry.staff.beforeUris) && !sameUris(staff.redirect_uris, entry.staff.targetUris)) fail('STAFF_CALLBACK_DRIFT');
  const record = entry.customer, named = clients.filter(row => row.client_name === clientName(COMPANY.customer.id, 'production'));
  if (named.length > 1 || named.some(row => !exactCustomer(row))) fail('CUSTOMER_NAME_CONFLICT');
  let customer = record.clientId ? clients.find(row => row.client_id === record.clientId) : null;
  if (record.clientId && (!customer || !exactCustomer(customer))) fail('RETURNED_ID_NOT_VERIFIED');
  if (!customer && named.length) { if (!record.attempted) fail('EXISTING_REGISTRATION_REQUIRES_REVIEW'); customer = named[0]; }
  if (clients.some(row => row.redirect_uris?.includes(COMPANY.customer.redirectUris[0]) && row.client_id !== customer?.client_id)
    || named.some(row => row.client_id !== customer?.client_id)) fail('CUSTOMER_CALLBACK_CONFLICT');
  if (customer && (Object.values(state.bindings).includes(customer.client_id) || Object.hasOwn(state.mapping, customer.client_id) && state.mapping[customer.client_id] !== COMPANY.customer.product)) fail('CUSTOMER_PRODUCT_CONFLICT');
  if (customer) record.clientId = customer.client_id;
  for (const row of clients.filter(row => Object.hasOwn(state.mapping, row.client_id) && row.client_id !== customer?.client_id)) {
    const registered = portal.authorizationClients.find(item => item.clientId === row.client_id);
    if (!registered || registered.product !== state.mapping[row.client_id] || row.redirect_uris.some(uri => !registered.redirectUris.includes(uri)
      && !(row.client_id === staff.client_id && entry.staff.attempted && uri === COMPANY.staff.redirectUri))) fail('EXISTING_PORTAL_REGISTRATION_MISSING');
  }
  return { staff, customer, deferredRegistrations };
}
async function buildArtifacts(settings, currentPortal, customerId, staffId) {
  await validatePortal(settings, currentPortal);
  if (!validId(customerId) || !validId(staffId) || customerId === staffId) fail('VERIFIED_DISTINCT_IDS_REQUIRED');
  const portal = clone(currentPortal), staff = portal.authorizationClients.find(row => row.clientId === staffId);
  if (!staff || staff.product !== COMPANY.staff.product) fail('STAFF_PORTAL_REQUIRED');
  staff.redirectUris = [...new Set([...staff.redirectUris, COMPANY.staff.redirectUri])];
  const previous = portal.authorizationClients.find(row => row.clientId === customerId);
  if (previous && (previous.product !== COMPANY.customer.product || !sameUris(previous.redirectUris, COMPANY.customer.redirectUris))) fail('CUSTOMER_PORTAL_CONFLICT');
  if (!previous) portal.authorizationClients.push({ product: COMPANY.customer.product, clientId: customerId, redirectUris: [...COMPANY.customer.redirectUris] });
  await validatePortal(settings, portal);
  const api = settings.supabaseUrl + '/functions/v1/synk-account';
  const config = { version: 1, origin: COMPANY.origin, env: {
    SYNK_COMPANY_DOMAIN: new URL(COMPANY.origin).hostname,
    SYNK_ID_ACCOUNT_API_URL: api, SYNK_ID_PUBLISHABLE_KEY: settings.supabasePublishableKey, SYNK_ID_SUPABASE_URL: settings.supabaseUrl, SYNK_ID_MESSENGER_CLIENT_ID: staffId,
    SYNK_ID_CUSTOMER_ACCOUNT_API_URL: api, SYNK_ID_CUSTOMER_PUBLISHABLE_KEY: settings.supabasePublishableKey, SYNK_ID_CUSTOMER_SUPABASE_URL: settings.supabaseUrl,
    SYNK_ID_CUSTOMER_CLIENT_ID: customerId, SYNK_ID_CUSTOMER_REDIRECT_URI: COMPANY.customer.redirectUris[0],
  } };
  return { config, portal };
}
async function provisionCompanyPublic({ api, journal, settings, currentPortal, apply = false, saveJournal = async () => {}, writeArtifacts = async () => [] }) {
  validateSettings(settings); validateJournal(journal); await validatePortal(settings, currentPortal);
  const state = clone(journal), preserved = clone(journal);
  for (const key of ['mapping', 'pendingMapping', 'publicCompany']) delete preserved[key];
  state.publicCompany ||= { version: 1, origin: COMPANY.origin,
    customer: { registration: COMPANY.customer.id, attempted: false, clientId: null },
    staff: { clientId: state.bindings[COMPANY.staff.registration], redirectUri: COMPANY.staff.redirectUri, attempted: false } };
  let observed = await api.readDigest();
  if (state.pendingMapping && observed === digest(state.pendingMapping)) { state.mapping = state.pendingMapping; state.pendingMapping = null; }
  if (observed !== digest(state.mapping)) fail('MAPPING_DRIFT');
  let clients = await api.listClients(), found = inspect(state, clients, observed, currentPortal);
  await api.verifyFortuneBindings(state.bindings);
  const summary = () => ({ environment: 'production', mode: apply ? 'apply' : 'dry-run', origin: COMPANY.origin,
    customer: { registration: COMPANY.customer.id, clientId: found.customer?.client_id || null, product: COMPANY.customer.product, redirectUri: COMPANY.customer.redirectUris[0], registrationNeeded: !found.customer },
    staff: { registration: COMPANY.staff.registration, clientId: found.staff.client_id, product: COMPANY.staff.product, redirectUri: COMPANY.staff.redirectUri, callbackNeeded: !found.staff.redirect_uris.includes(COMPANY.staff.redirectUri) },
    existingRegistrations: clients.length, mappingEntries: Object.keys(state.mapping).length, mappingVerified: true, deferredRegistrations: found.deferredRegistrations, localConfigsWritten: false, liveLoginVerified: false });
  if (!apply) return summary();
  const fresh = async () => {
    const value = await api.readDigest(); if (value !== digest(state.mapping)) fail('MAPPING_DRIFT');
    clients = await api.listClients(); found = inspect(state, clients, value, currentPortal); await api.verifyFortuneBindings(state.bindings); return found;
  };
  await fresh();
  const staffRecord = state.publicCompany.staff;
  if (!found.staff.redirect_uris.includes(COMPANY.staff.redirectUri)) {
    if (staffRecord.attempted) fail('UNCONFIRMED_STAFF_UPDATE_NO_RETRY');
    staffRecord.beforeUris = [...found.staff.redirect_uris]; staffRecord.targetUris = [...staffRecord.beforeUris, COMPANY.staff.redirectUri];
    staffRecord.attempted = true; staffRecord.outcome = 'pending'; await saveJournal(clone(state));
    await fresh();
    // Another writer may already have applied the exact union after the read.
    if (!sameUris(found.staff.redirect_uris, staffRecord.targetUris)) {
      try { await api.updateClient(staffRecord.clientId, { redirect_uris: staffRecord.targetUris }); }
      catch (error) { staffRecord.outcome = 'unconfirmed'; if (Number.isInteger(error.status)) staffRecord.httpStatus = error.status; }
      await saveJournal(clone(state)); await fresh();
      if (!sameUris(found.staff.redirect_uris, staffRecord.targetUris)) fail('STAFF_UPDATE_NOT_VERIFIED');
    }
    staffRecord.outcome = 'verified'; await saveJournal(clone(state));
  }
  if (staffRecord.attempted && sameUris(found.staff.redirect_uris, staffRecord.targetUris) && staffRecord.outcome !== 'verified') {
    staffRecord.outcome = 'verified'; await saveJournal(clone(state));
  }
  const record = state.publicCompany.customer;
  await fresh();
  if (!found.customer) {
    if (record.attempted) fail('UNCONFIRMED_CREATE_NO_RETRY');
    record.attempted = true; record.outcome = 'pending'; await saveJournal(clone(state)); await fresh();
    if (!found.customer) {
      let returned;
      try {
        returned = await api.createClient({ client_name: clientName(COMPANY.customer.id, 'production'), client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: [...COMPANY.customer.redirectUris] });
        record.outcome = 'response'; if (validId(returned?.client_id)) record.clientId = returned.client_id;
      } catch (error) { record.outcome = 'unconfirmed'; if (Number.isInteger(error.status)) record.httpStatus = error.status; }
      await saveJournal(clone(state)); await fresh();
      if (!found.customer || returned?.client_id && returned.client_id !== found.customer.client_id) fail('CREATE_NOT_VERIFIED');
      await saveJournal(clone(state));
    }
  }
  await fresh();
  if (!found.customer) fail('CREATE_NOT_VERIFIED');
  if (record.outcome !== 'verified') { record.outcome = 'verified'; await saveJournal(clone(state)); }
  if (!Object.hasOwn(state.mapping, found.customer.client_id)) {
    state.pendingMapping = { ...state.mapping, [found.customer.client_id]: COMPANY.customer.product }; await saveJournal(clone(state)); await fresh();
    try { await api.writeMapping(state.pendingMapping); } catch { /* Confirm by digest; never replay an ambiguous write. */ }
    if (await api.readDigest() !== digest(state.pendingMapping)) fail('MAPPING_NOT_VERIFIED');
    state.mapping = state.pendingMapping; state.pendingMapping = null; await saveJournal(clone(state));
  }
  await fresh();
  const unchanged = clone(state); for (const key of ['mapping', 'pendingMapping', 'publicCompany']) delete unchanged[key];
  if (digest(unchanged) !== digest(preserved)) fail('EXISTING_JOURNAL_CHANGED');
  const artifacts = await buildArtifacts(settings, currentPortal, found.customer.client_id, found.staff.client_id), files = await writeArtifacts(artifacts);
  state.publicCompany.completedAt = new Date().toISOString(); await saveJournal(clone(state));
  return { ...summary(), files, completedAt: state.publicCompany.completedAt };
}
async function readJson(file) { const info = await fs.stat(file); if (info.size > 1024 * 1024) fail('INPUT_TOO_LARGE'); try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { fail('INVALID_JSON'); } }
async function writePublicArtifacts(artifacts, root = ROOT) {
  const workspace = await fs.realpath(root), directory = path.join(workspace, PUBLIC_OUTPUT);
  for (const name of ['', 'config.json', 'portal-config.json']) {
    let current = path.join(directory, name);
    for (;;) { try { if ((await fs.lstat(current)).isSymbolicLink()) fail('OUTPUT_LINK'); } catch (error) { if (error.code !== 'ENOENT') throw error; } if (current === workspace) break; const next = path.dirname(current); if (next === current) fail('OUTPUT_OUTSIDE_WORKSPACE'); current = next; }
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
  const result = { apply: false }, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]; if (seen.has(key) || !['--운영', '--apply', '--public', '--portal'].includes(key)) fail('INVALID_ARGUMENTS'); seen.add(key);
    if (key === '--apply') result.apply = true;
    else if (key !== '--운영') { const value = args[++i]; if (!value || value.startsWith('--')) fail('ARGUMENT_VALUE_REQUIRED'); result[key === '--public' ? 'publicPath' : 'portalPath'] = value; }
  }
  if (!seen.has('--운영') || !result.publicPath || !result.portalPath) fail('USAGE_REQUIRE_PRODUCTION_PUBLIC_PORTAL'); return result;
}
async function main() {
  const options = parseArguments(process.argv.slice(2)), settings = await readJson(options.publicPath), currentPortal = await readJson(options.portalPath);
  validateSettings(settings); const storage = await journalStore(ROOT, 'production'); validateJournal(storage.journal);
  const api = await createProvider({ environment: 'production', publicSettings: settings, apply: options.apply }); let lock;
  try {
    if (options.apply) { lock = await fs.open(storage.lockPath, 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString(), registration: COMPANY.customer.id })); }
    const journal = await readJson(storage.file);
    const before = await Promise.all(Object.values(OUTPUTS).map(async file => [file, digest(await fs.readFile(path.join(ROOT, file), 'utf8'))]));
    const result = await provisionCompanyPublic({ api, journal, settings, currentPortal, apply: options.apply, saveJournal: storage.saveJournal, writeArtifacts: writePublicArtifacts });
    for (const [file, hash] of before) if (digest(await fs.readFile(path.join(ROOT, file), 'utf8')) !== hash) fail('LOCAL_CONFIG_CHANGED');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (lock) { await lock.close(); await fs.unlink(storage.lockPath); } }
}
module.exports = { provisionCompanyPublic, buildArtifacts, writePublicArtifacts, parseArguments, PUBLIC_OUTPUT };
if (require.main === module) main().catch(error => { console.error(error.code === 'EEXIST' ? 'COMPANY_PUBLIC_OTHER_PROVISIONER_LOCKED' : error.message); process.exitCode = 1; });
