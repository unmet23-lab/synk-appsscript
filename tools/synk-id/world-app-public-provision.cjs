#!/usr/bin/env node
'use strict';
// Append the 3D WORLD shell callback to the existing WORLD browser client. Never create a
// client, write the product map, or replace another product's public settings.
const fs = require('node:fs/promises'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createProvider, journalStore } = require('./provision-apply.cjs');
const { digest } = require('./provision-plan.cjs');
const ROOT = path.resolve(__dirname, '../..');
const CALLBACK = 'https://synk.im/world/';
const LOCAL_CALLBACK = 'http://127.0.0.1:4280/synk-account/client.html?product=world';
const LEARNING_URL = 'https://synk.im/try/learning-hub/';
const PORTAL_URL = 'https://synk.im/id/';
const PROJECT_URL = 'https://qiwxeddwwnzkwalpsuty.supabase.co';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uris = value => Array.isArray(value) && value.every(uri => typeof uri === 'string' && uri.length > 0) && new Set(value).size === value.length;
const same = (a, b) => uris(a) && uris(b) && a.length === b.length && a.every(value => b.includes(value));
const fail = code => { throw Error('WORLD_PUBLIC_' + code); };

async function validatePublic(config) {
  const { readConfig, PRODUCTS } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-account/src/core.mjs')).href);
  if (!object(config) || config.supabaseUrl !== PROJECT_URL || config.portalUrl !== PORTAL_URL
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey || '')) fail('PRODUCTION_CONFIG_REQUIRED');
  if (!readConfig(config, PORTAL_URL).configured || !object(config.clients) || Object.keys(config.clients).some(key => !PRODUCTS[key])
    || !Array.isArray(config.authorizationClients) || config.authorizationClients.some(row => !row.clientId || !uris(row.redirectUris))
    || new Set(config.authorizationClients.map(row => row.clientId)).size !== config.authorizationClients.length) fail('INVALID_PUBLIC_CONFIG');
}

async function provisionWorldAppPublic({ api, journal, portal, account, apply = false, saveJournal, verifyJournal = async () => {} } = {}) {
  if (typeof apply !== 'boolean') fail('EXPLICIT_APPLY_REQUIRED');
  if (apply && typeof saveJournal !== 'function') fail('PERSISTENT_JOURNAL_REQUIRED');
  await validatePublic(portal);
  await validatePublic(account);
  if (account.supabasePublishableKey !== portal.supabasePublishableKey
    || (account.accountApiUrl || account.supabaseUrl) !== (portal.accountApiUrl || portal.supabaseUrl)) fail('ACCOUNT_PORTAL_DRIFT');
  if (!object(journal) || journal.version !== 1 || journal.environment !== 'production' || !journal.completedAt || journal.pendingMapping
    || !object(journal.mapping) || !object(journal.bindings)) fail('COMPLETED_JOURNAL_REQUIRED');
  const state = structuredClone(journal), expectedDigest = digest(state.mapping), clientId = state.bindings['world-browser'];
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(clientId) || state.mapping[clientId] !== 'world'
    || Object.entries(state.bindings).some(([binding, id]) => binding !== 'world-browser' && id === clientId)) fail('WORLD_BINDING_REQUIRED');
  const registration = portal.authorizationClients.find(row => row.clientId === clientId);
  if (!registration || registration.product !== 'world' || !registration.redirectUris.includes(LOCAL_CALLBACK)) fail('EXISTING_PORTAL_BINDING_REQUIRED');
  const accountRegistration = account.authorizationClients.find(row => row.clientId === clientId);
  if (account.clients.world?.clientId && account.clients.world.clientId !== clientId
    || accountRegistration && (accountRegistration.product !== 'world'
      || accountRegistration.redirectUris.some(uri => uri !== CALLBACK && !registration.redirectUris.includes(uri)))) fail('ACCOUNT_WORLD_BINDING_DRIFT');
  if ([...portal.authorizationClients, ...account.authorizationClients].some(row => row.clientId !== clientId && row.redirectUris.includes(CALLBACK))) fail('CALLBACK_CONFLICT');
  const existing = state.publicWorldApp;
  if (existing !== undefined && (!object(existing) || existing.version !== 1 || existing.clientId !== clientId || existing.callback !== CALLBACK
    || existing.attempted !== true || !uris(existing.beforeUris) || !existing.beforeUris.includes(LOCAL_CALLBACK) || existing.beforeUris.includes(CALLBACK)
    || !same(existing.targetUris, [...existing.beforeUris, CALLBACK]) || !['pending', 'unconfirmed', 'verified'].includes(existing.outcome)
    || existing.outcome === 'verified' && typeof existing.completedAt !== 'string')) fail('JOURNAL_INVALID');

  let inventoryFingerprint, initiallyRegistered = false;
  async function inspect() {
    await verifyJournal();
    if (await api.readDigest() !== expectedDigest) fail('PRODUCT_MAPPING_DRIFT');
    const clients = await api.listClients();
    if (!Array.isArray(clients) || clients.some(row => typeof row?.client_id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(row.client_id))
      || new Set(clients.map(row => row.client_id)).size !== clients.length) fail('INVALID_PROVIDER_INVENTORY');
    const row = clients.find(item => item.client_id === clientId);
    if (!row || row.client_type !== 'public' || row.client_secret || row.deleted_at || row.revoked === true
      || row.token_endpoint_auth_method && row.token_endpoint_auth_method !== 'none'
      || !uris(row.redirect_uris) || !row.redirect_uris.includes(LOCAL_CALLBACK)) fail('PUBLIC_CLIENT_NOT_VERIFIED');
    if (clients.some(item => item.client_id !== clientId && item.redirect_uris?.includes(CALLBACK))) fail('CALLBACK_CONFLICT');
    if (row.redirect_uris.some(uri => uri !== CALLBACK && !registration.redirectUris.includes(uri))) fail('UNPUBLISHED_CALLBACK_DRIFT');
    if (registration.redirectUris.some(uri => uri !== CALLBACK && !row.redirect_uris.includes(uri))) fail('REMOVED_CALLBACK_DRIFT');
    if (existing && !same(row.redirect_uris, existing.beforeUris) && !same(row.redirect_uris, existing.targetUris)) fail('ATTEMPTED_CALLBACK_DRIFT');
    if ((existing?.outcome === 'verified' || initiallyRegistered) && !row.redirect_uris.includes(CALLBACK)) fail('CONFIRMED_CALLBACK_REMOVED');
    const fingerprint = digest(clients.map(item => ({ clientId: item.client_id, type: item.client_type, authMethod: item.token_endpoint_auth_method || 'none',
      secretPresent: Boolean(item.client_secret), deleted: Boolean(item.deleted_at), revoked: item.revoked === true,
      redirectUris: Array.isArray(item.redirect_uris) ? item.redirect_uris.filter(uri => item.client_id !== clientId || uri !== CALLBACK).slice().sort() : null,
    })).sort((a, b) => a.clientId.localeCompare(b.clientId)));
    if (inventoryFingerprint && fingerprint !== inventoryFingerprint) fail('PROVIDER_INVENTORY_DRIFT');
    return { row, count: clients.length, fingerprint };
  }

  let observed = await inspect();
  inventoryFingerprint = observed.fingerprint;
  initiallyRegistered = observed.row.redirect_uris.includes(CALLBACK);
  observed = await inspect();
  const beforeUris = existing?.beforeUris || observed.row.redirect_uris.filter(uri => uri !== CALLBACK), targetUris = [...beforeUris, CALLBACK];
  let providerUpdates = 0;
  if (apply && !observed.row.redirect_uris.includes(CALLBACK)) {
    if (existing) fail('UNCONFIRMED_UPDATE_NO_RETRY');
    state.publicWorldApp = { version: 1, clientId, callback: CALLBACK, beforeUris, targetUris, attempted: true, outcome: 'pending' };
    // Persist before dispatch. An ambiguous response may only be reconciled by GET.
    await saveJournal(structuredClone(state));
    observed = await inspect();
    if (!same(observed.row.redirect_uris, targetUris)) {
      if (!same(observed.row.redirect_uris, beforeUris)) fail('CALLBACK_DRIFT');
      try { providerUpdates++; await api.updateClient(clientId, { redirect_uris: [...targetUris] }); }
      catch (error) {
        state.publicWorldApp.outcome = 'unconfirmed';
        if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) state.publicWorldApp.httpStatus = error.status;
        await saveJournal(structuredClone(state));
      }
      observed = await inspect();
      if (!same(observed.row.redirect_uris, targetUris)) fail('UPDATE_NOT_VERIFIED');
    }
  }
  if (apply) {
    observed = await inspect();
    if (!same(observed.row.redirect_uris, targetUris)) fail('UPDATE_NOT_VERIFIED');
    if (state.publicWorldApp && state.publicWorldApp.outcome !== 'verified') {
      state.publicWorldApp.outcome = 'verified';
      state.publicWorldApp.completedAt = new Date().toISOString();
      await saveJournal(structuredClone(state));
    }
  }

  const merged = structuredClone(portal), config = structuredClone(account);
  const mergedRegistration = merged.authorizationClients.find(row => row.clientId === clientId);
  mergedRegistration.redirectUris = [...new Set([...registration.redirectUris, CALLBACK])];
  config.clients.world = { clientId, redirectUri: CALLBACK };
  config.learningUrl = LEARNING_URL;
  const entryIndex = config.authorizationClients.findIndex(row => row.clientId === clientId);
  if (entryIndex < 0) config.authorizationClients.push(structuredClone(mergedRegistration));
  else config.authorizationClients[entryIndex] = structuredClone(mergedRegistration);
  await validatePublic(merged);
  await validatePublic(config);
  return { summary: { version: 1, environment: 'production', mode: apply ? 'apply' : 'dry-run', clientId, callback: CALLBACK, beforeUris, targetUris,
    callbackRegistered: observed.row.redirect_uris.includes(CALLBACK), existingRegistrations: observed.count, portalRegistrations: merged.authorizationClients.length,
    providerUpdates, newClients: 0, productMapChanged: false, localConfigsWritten: false, userLoginVerified: false,
    portalBeforeSha256: digest(portal), accountBeforeSha256: digest(account), providerInventorySha256: inventoryFingerprint }, config, portal: merged };
}

function parseArgs(args) {
  if (!Array.isArray(args) || args.some(arg => !['--운영', '--apply'].includes(arg)) || new Set(args).size !== args.length || !args.includes('--운영')) fail('USAGE_REQUIRE_PRODUCTION');
  return { apply: args.includes('--apply') };
}
async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  async function readPublic(url) {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail('LIVE_CONFIG_UNAVAILABLE');
    const text = await response.text();
    if (Buffer.byteLength(text) > 1024 * 1024) fail('LIVE_CONFIG_TOO_LARGE');
    let value; try { value = JSON.parse(text); } catch { fail('LIVE_CONFIG_INVALID'); }
    await validatePublic(value);
    return value;
  }
  const [portal, account] = await Promise.all([readPublic(PORTAL_URL + 'config.json'), readPublic('https://synk.im/account/config.json')]);
  const storage = await journalStore(ROOT, 'production'), api = await createProvider({ environment: 'production', publicSettings: portal, apply });
  let lock;
  try {
    if (apply) { lock = await fs.open(storage.lockPath, 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid, registration: 'world-app-public-callback' })); }
    const journal = JSON.parse(await fs.readFile(storage.file, 'utf8'));
    let expectedJournal = digest(journal);
    const verifyJournal = async () => { if (digest(JSON.parse(await fs.readFile(storage.file, 'utf8'))) !== expectedJournal) fail('LOCAL_JOURNAL_DRIFT'); };
    const saveJournal = async value => { await verifyJournal(); await storage.saveJournal(value); expectedJournal = digest(value); };
    const result = await provisionWorldAppPublic({ api, journal, portal, account, apply, saveJournal, verifyJournal });
    const out = path.join(ROOT, '.tmp/synk-id', 'world-app-public-' + (apply ? 'applied-' : 'candidate-') + new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + process.pid);
    await fs.mkdir(out, { recursive: true });
    for (const [name, value] of [['plan.json', result.summary], ['config.json', result.config], ['portal-config.json', result.portal], ['portal-before.json', portal], ['account-before.json', account]])
      await fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
    console.log(JSON.stringify({ ...result.summary, output: out }, null, 2));
  } finally { if (lock) { await lock.close(); await fs.unlink(storage.lockPath); } }
}
module.exports = { provisionWorldAppPublic, CALLBACK, LOCAL_CALLBACK, LEARNING_URL, parseArgs };
if (require.main === module) main().catch(error => { console.error(error.code === 'EEXIST' ? 'WORLD_PUBLIC_OTHER_PROVISIONER_LOCKED' : error.message); process.exitCode = 1; });
