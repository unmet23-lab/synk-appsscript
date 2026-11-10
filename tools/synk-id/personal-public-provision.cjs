#!/usr/bin/env node
'use strict';
// Read-only by default. Explicit --apply appends only selected fixed callbacks
// on existing public clients. No client creation, mapping or permission writes.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createProvider, journalStore } = require('./provision-apply.cjs');
const { buildProvisionPlan, digest } = require('./provision-plan.cjs');
const { PRESERVED_CLIENT_BINDINGS } = require('./registry.cjs');
const ROOT = path.resolve(__dirname, '../..');
const TARGETS = Object.freeze([
  Object.freeze({ product: 'fortune', binding: 'fortune-browser', configKey: 'platform', callback: 'https://synk.im/fortune/', localCallback: 'http://127.0.0.1:4299/', endpoint: 'synk-fortune' }),
]);
const TRAVEL_TARGET = Object.freeze({ product: 'path-travel', binding: 'path-travel-browser', configKey: 'path-travel', callback: 'https://synk.im/try/travel/', localCallback: 'http://127.0.0.1:4303/', endpoint: 'synk-personal?resource=path-travel' });
const PATH_APP_TARGET = Object.freeze({ product: 'path-app', binding: 'path-app-browser', configKey: 'path-app', callback: 'https://synk.im/path/app/', localCallback: 'http://127.0.0.1:4326/', endpoint: 'synk-path?resource=path-app' });
const ALL_TARGETS = Object.freeze([...TARGETS, TRAVEL_TARGET, PATH_APP_TARGET]);
// A completed historical callback is retained verbatim, never selected or
// resumed by this tool. Accept only its known production identity and shape.
const PRESERVED_TARGETS = Object.freeze([
  Object.freeze({ product: 'rehearsal', binding: 'rehearsal-browser', callback: 'https://synk.im/rehearsal/', localCallback: 'http://127.0.0.1:4297/' }),
]);
const clone = value => structuredClone(value), sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = code => { throw Error('PERSONAL_PUBLIC_' + code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uris = value => Array.isArray(value) && value.every(uri => typeof uri === 'string' && uri) && new Set(value).size === value.length;
const same = (a, b) => uris(a) && uris(b) && a.length === b.length && a.every(uri => b.includes(uri));
async function validatePortal(portal) {
  const { readConfig } = await import(pathToFileURL(path.join(ROOT, 'experiences/synk-account/src/core.mjs')).href);
  if (!object(portal) || portal.supabaseUrl !== 'https://qiwxeddwwnzkwalpsuty.supabase.co' || portal.accountApiUrl && portal.accountApiUrl !== portal.supabaseUrl
    || portal.portalUrl !== 'https://synk.im/id/' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(portal.supabasePublishableKey || '')
    || !Array.isArray(portal.authorizationClients) || new Set(portal.authorizationClients.map(row => row.clientId)).size !== portal.authorizationClients.length)
    fail('PRODUCTION_PORTAL_REQUIRED');
  if (!readConfig(portal, portal.portalUrl).configured) fail('INVALID_PORTAL');
}

async function planPersonalPublic({ api, journal, portal, products, apply = false, saveJournal, verifyJournal = async () => {} } = {}) {
  if (typeof apply !== 'boolean') fail('EXPLICIT_APPLY_REQUIRED');
  const wanted = products === undefined ? TARGETS.map(row => row.product) : products;
  if (!Array.isArray(wanted) || !wanted.length || new Set(wanted).size !== wanted.length || wanted.some(product => !ALL_TARGETS.some(row => row.product === product))) fail('UNKNOWN_PRODUCT_SELECTION');
  if (apply && typeof saveJournal !== 'function') fail('PERSISTENT_JOURNAL_REQUIRED');
  await validatePortal(portal);
  if (!object(journal) || journal.version !== 1 || journal.environment !== 'production' || !journal.completedAt || journal.pendingMapping
    || !object(journal.mapping) || !object(journal.bindings)) fail('COMPLETED_JOURNAL_REQUIRED');
  const state = clone(journal), beforePortal = clone(portal), expectedDigest = digest(state.mapping), journalBeforeSha256 = digest(state);
  const selected = ALL_TARGETS.filter(target => wanted.includes(target.product)).map(target => ({ ...target, clientId: state.bindings[target.binding] }));
  for (const target of selected) {
    if (typeof target.clientId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(target.clientId) || state.mapping[target.clientId] !== 'platform'
      || Object.entries(state.bindings).some(([binding, id]) => binding !== target.binding && id === target.clientId)) fail('EXISTING_DISTINCT_BROWSER_BINDINGS_REQUIRED');
  }
  const journalTargets = [...ALL_TARGETS, ...PRESERVED_TARGETS];
  if (state.publicPersonal !== undefined && (!object(state.publicPersonal) || state.publicPersonal.version !== 1 || !object(state.publicPersonal.targets)
    || Object.keys(state.publicPersonal.targets).some(product => !journalTargets.some(target => target.product === product)))) fail('JOURNAL_INVALID');
  for (const target of journalTargets) {
    const entry = state.publicPersonal?.targets[target.product], clientId = state.bindings[target.binding];
    const preserved = PRESERVED_TARGETS.includes(target);
    if (entry !== undefined && (!object(entry) || typeof clientId !== 'string' || entry.clientId !== clientId || state.mapping[clientId] !== 'platform'
      || preserved && (PRESERVED_CLIENT_BINDINGS.find(row => row.id === target.binding)?.knownIds.production !== clientId || entry.outcome !== 'confirmed')
      || entry.callback !== target.callback || entry.attempted !== true
      || !uris(entry.beforeUris) || !entry.beforeUris.includes(target.localCallback) || entry.beforeUris.includes(target.callback)
      || !same(entry.targetUris, [...entry.beforeUris, target.callback]) || !['pending', 'unconfirmed', 'confirmed'].includes(entry.outcome)
      || entry.outcome === 'confirmed' && typeof entry.confirmedAt !== 'string')) fail('JOURNAL_INVALID');
  }
  let providerFingerprint, initiallyRegistered = new Set();
  async function inspect() {
    await verifyJournal();
    if (await api.readDigest() !== expectedDigest) fail('PRODUCT_MAPPING_DRIFT');
    const clients = await api.listClients();
    const plan = buildProvisionPlan({ environment: 'production', clients, secretDigest: expectedDigest, existingMapping: state.mapping, bindings: state.bindings });
    // A newly catalogued unrelated product may still be unregistered. Never create it here.
    if (plan.actions.some(action => action.action !== 'register-public-client')) fail('EXISTING_PRODUCT_MAP_NOT_READY');
    await api.verifyFortuneBindings(state.bindings);
    const observations = selected.map(target => {
      const row = clients.find(item => item.client_id === target.clientId), registration = beforePortal.authorizationClients.find(item => item.clientId === target.clientId);
      if (!row || row.client_type !== 'public' || row.client_secret || row.deleted_at || row.revoked === true || row.token_endpoint_auth_method && row.token_endpoint_auth_method !== 'none'
        || !Array.isArray(row.redirect_uris) || new Set(row.redirect_uris).size !== row.redirect_uris.length || !row.redirect_uris.includes(target.localCallback)) fail('PUBLIC_CLIENT_NOT_VERIFIED');
      // A first dedicated browser registration can precede portal publication.
      // Its identity is still proven by the completed journal, product map and
      // exact provider callback; existing portal entries must agree as before.
      const newDedicatedPortalEntry = !registration && ['path-travel', 'path-app'].includes(target.product);
      if (!newDedicatedPortalEntry && (!registration || registration.product !== 'platform' || !registration.redirectUris.includes(target.localCallback))) fail('EXISTING_PORTAL_BINDING_REQUIRED');
      if (newDedicatedPortalEntry && row.redirect_uris.some(uri => ![target.localCallback, target.callback].includes(uri))) fail('CALLBACK_DRIFT');
      if (clients.some(item => item.client_id !== target.clientId && item.redirect_uris?.includes(target.callback))
        || beforePortal.authorizationClients.some(item => item.clientId !== target.clientId && item.redirectUris.includes(target.callback))) fail('CALLBACK_CONFLICT');
      if (registration && !same(row.redirect_uris.filter(uri => uri !== target.callback), registration.redirectUris.filter(uri => uri !== target.callback))) fail('CALLBACK_DRIFT');
      const attempt = state.publicPersonal?.targets[target.product];
      if (attempt && !same(row.redirect_uris, attempt.beforeUris) && !same(row.redirect_uris, attempt.targetUris)) fail('ATTEMPTED_CALLBACK_DRIFT');
      if ((attempt?.outcome === 'confirmed' || initiallyRegistered.has(target.product)) && !row.redirect_uris.includes(target.callback)) fail('CONFIRMED_CALLBACK_REMOVED');
      return { ...target, beforeUris: [...row.redirect_uris], targetUris: [...new Set([...row.redirect_uris, target.callback])], callbackRegistered: row.redirect_uris.includes(target.callback) };
    });
    // Ignore only these selected additive callbacks. Changes to the client inventory,
    // other callbacks or security properties invalidate this execution's plan.
    const fingerprint = digest(clients.map(row => ({ clientId: row.client_id, type: row.client_type, authMethod: row.token_endpoint_auth_method || 'none',
      secretPresent: Boolean(row.client_secret), deleted: Boolean(row.deleted_at), revoked: row.revoked === true,
      redirectUris: Array.isArray(row.redirect_uris) ? row.redirect_uris.filter(uri => !selected.some(target => target.clientId === row.client_id && target.callback === uri)).sort() : null,
    })).sort((a, b) => a.clientId.localeCompare(b.clientId)));
    if (providerFingerprint && fingerprint !== providerFingerprint) fail('PROVIDER_INVENTORY_DRIFT');
    return { observations, fingerprint, existingRegistrations: clients.length, deferredRegistrations: plan.registrations.filter(row => ['registration-needed', 'binding-required'].includes(row.status)).map(row => row.id) };
  }
  const first = await inspect(); let observed = await inspect();
  if (digest(first) !== digest(observed)) fail('PROVIDER_CHANGED_DURING_PLAN');
  providerFingerprint = observed.fingerprint;
  initiallyRegistered = new Set(observed.observations.filter(row => row.callbackRegistered).map(row => row.product));
  const planned = clone(observed), actions = planned.observations.filter(row => !row.callbackRegistered).map(row => ({ action: 'append-existing-public-callback', product: row.product,
    method: 'PUT', path: '/auth/v1/admin/oauth/clients/' + row.clientId, expectedRedirectUris: row.beforeUris, body: { redirect_uris: row.targetUris } }));
  let providerUpdates = 0;
  if (apply) {
    // An earlier ambiguous attempt must be resolved by an exact readback. It is
    // never permission to send another PUT, even if the callback is absent.
    for (const row of observed.observations) if (state.publicPersonal?.targets[row.product] && !row.callbackRegistered) fail('UNCONFIRMED_UPDATE_NO_RETRY');
    for (const target of selected) {
      observed = await inspect();
      let row = observed.observations.find(item => item.product === target.product), attempt = state.publicPersonal?.targets[target.product];
      if (!row.callbackRegistered) {
        state.publicPersonal ||= { version: 1, targets: {} };
        attempt = state.publicPersonal.targets[target.product] = { clientId: row.clientId, callback: row.callback, beforeUris: row.beforeUris,
          targetUris: row.targetUris, attempted: true, outcome: 'pending' };
        // Persist before the request. A crash after this point must not replay it.
        await saveJournal(clone(state));
        observed = await inspect(); row = observed.observations.find(item => item.product === target.product);
        if (!same(row.beforeUris, attempt.targetUris)) {
          // inspect() checked the latest digest, full inventory, exact callback
          // set and Fortune allowlist after the durable pending entry.
          try { providerUpdates++; await api.updateClient(row.clientId, { redirect_uris: [...attempt.targetUris] }); }
          catch (error) {
            attempt.outcome = 'unconfirmed';
            if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) attempt.httpStatus = error.status;
            await saveJournal(clone(state));
          }
          observed = await inspect(); row = observed.observations.find(item => item.product === target.product);
          if (!same(row.beforeUris, attempt.targetUris)) fail('UPDATE_NOT_VERIFIED');
        }
      }
      if (attempt && attempt.outcome !== 'confirmed') {
        attempt.outcome = 'confirmed'; attempt.confirmedAt = new Date().toISOString();
        await saveJournal(clone(state));
      }
    }
    observed = await inspect();
    if (!observed.observations.every(row => row.callbackRegistered)) fail('UPDATE_NOT_VERIFIED');
  }
  const mergedPortal = clone(beforePortal), configs = {};
  for (const row of observed.observations) {
    let entry = mergedPortal.authorizationClients.find(item => item.clientId === row.clientId);
    if (!entry) { entry = { product: 'platform', clientId: row.clientId, redirectUris: [...row.beforeUris] }; mergedPortal.authorizationClients.push(entry); }
    entry.redirectUris = [...new Set([...entry.redirectUris, row.callback])];
    configs[row.product] = { version: 1, supabaseUrl: portal.supabaseUrl, supabasePublishableKey: portal.supabasePublishableKey,
      accountApiUrl: portal.accountApiUrl || portal.supabaseUrl, portalUrl: portal.portalUrl,
      clients: { [row.configKey]: { clientId: row.clientId, redirectUri: row.callback } },
      authorizationClients: [{ product: 'platform', clientId: row.clientId, redirectUris: [row.callback] }] };
  }
  await validatePortal(mergedPortal);
  return { plan: { version: 1, environment: 'production', mode: apply ? 'apply' : 'dry-run', readOnly: !apply, targets: observed.observations, actions, providerUpdates,
    existingRegistrations: observed.existingRegistrations, deferredRegistrations: observed.deferredRegistrations,
    portalChanged: digest(mergedPortal) !== digest(beforePortal), newClients: 0, productMapChanged: false, fortuneAllowlistChanged: false,
    guards: { mappingDigest: expectedDigest, journalSha256: journalBeforeSha256, journalAfterSha256: digest(state), portalBeforeSha256: digest(beforePortal), selectedProviderSha256: digest(planned.observations), providerInventorySha256: providerFingerprint },
    limitations: { applied: apply, callbackRegistrationsVerified: observed.observations.every(row => row.callbackRegistered), portalPublished: false, userLoginVerified: false,
      applyRequires: 'Explicit --apply after final review; fresh provider and journal checks; ambiguous attempts are read back, never automatically retried.' } }, configs, portal: mergedPortal, beforePortal };
}

async function validateOutput(out, root = ROOT) {
  const workspace = await fs.realpath(root), temporary = path.join(workspace, '.tmp'), output = path.resolve(out), relative = path.relative(temporary, output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('NEW_WORKSPACE_TMP_REQUIRED');
  for (let parent = output; parent !== workspace; parent = path.dirname(parent)) {
    try { const stat = await fs.lstat(parent); if (parent === output) fail('OUTPUT_EXISTS'); if (stat.isSymbolicLink()) fail('OUTPUT_LINK'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return output;
}
async function writeCandidate({ out, result, root = ROOT }) {
  const output = await validateOutput(out, root);
  if (Object.keys(result.configs).some(product => !ALL_TARGETS.some(row => row.product === product))) fail('UNKNOWN_PRODUCT_SELECTION');
  const files = new Map([['plan.json', result.plan], ...Object.entries(result.configs).map(([product, config]) => [product + '-config.json', config]),
    ['portal-config.json', result.portal], ['portal-before.json', result.beforePortal]]);
  const records = [];
  for (const [name, data] of files) { const bytes = JSON.stringify(data, null, 2) + '\n'; files.set(name, bytes); records.push({ name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) }); }
  const sourceFiles = [];
  for (const file of ['tools/synk-id/personal-public-provision.cjs', 'tools/synk-id/provision-apply.cjs', 'tools/synk-id/provision-plan.cjs', 'tools/synk-id/registry.cjs', 'experiences/synk-account/src/core.mjs'])
    sourceFiles.push({ file, sha256: sha(await fs.readFile(path.join(ROOT, file))) });
  files.set('manifest.json', JSON.stringify({ version: 1, preparedAt: new Date().toISOString(), readOnly: result.plan.readOnly, sourceFiles, files: records,
    guardDigests: result.plan.guards, localRuntimeConfigsChanged: false, secretsIncluded: false, applied: result.plan.limitations.applied }, null, 2) + '\n');
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.mkdir(output);
  for (const [name, bytes] of files) await fs.writeFile(path.join(output, name), bytes, { flag: 'wx' });
  return output;
}

function parseArguments(args) {
  const flags = new Set(); let out, product;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (['--운영', '--apply'].includes(flag) && !flags.has(flag)) flags.add(flag);
    else if (flag === '--out' && !out && args[index + 1] && !args[index + 1].startsWith('--')) out = args[++index];
    else if (flag === '--product' && product === undefined && args[index + 1] && ALL_TARGETS.some(row => row.product === args[index + 1])) product = args[++index];
    else fail('USAGE_NODE_PERSONAL_PUBLIC_PROVISION_PRODUCTION_OUT_NEW_TMP_OPTIONAL_APPLY');
  }
  if (!flags.has('--운영') || !out) fail('USAGE_NODE_PERSONAL_PUBLIC_PROVISION_PRODUCTION_OUT_NEW_TMP_OPTIONAL_APPLY');
  return { out, apply: flags.has('--apply'), ...(product === undefined ? {} : { products: [product] }) };
}
async function readLivePortal() {
  const response = await fetch('https://synk.im/id/config.json', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) fail('LIVE_PORTAL_UNAVAILABLE');
  const text = await response.text(); if (text.length > 1024 * 1024) fail('LIVE_PORTAL_TOO_LARGE');
  try { return JSON.parse(text); } catch { fail('INVALID_LIVE_PORTAL_JSON'); }
}
async function runPersonalPublic({ args, root = ROOT, readPortal = readLivePortal, storeFactory = journalStore, providerFactory = createProvider }) {
  const { out, apply, products } = parseArguments(args); await validateOutput(out, root);
  const portal = await readPortal(); await validatePortal(portal);
  const storage = await storeFactory(root, 'production'), api = await providerFactory({ environment: 'production', publicSettings: portal, apply });
  let lock;
  try {
    if (apply) {
      try { lock = await fs.open(storage.lockPath, 'wx', 0o600); }
      catch (error) { if (error.code === 'EEXIST') fail('OTHER_PROVISIONER_LOCKED'); throw error; }
      await lock.writeFile(JSON.stringify({ pid: process.pid, registration: 'personal-public-callbacks', at: new Date().toISOString() }));
    }
    // Read after acquiring the shared lock, and reject any out-of-band edit
    // rather than overwriting another provisioner's unrelated journal fields.
    const journalBytes = await fs.readFile(storage.file), journal = JSON.parse(journalBytes); let expectedJournalSha = sha(journalBytes);
    const verifyJournal = async () => { if (sha(await fs.readFile(storage.file)) !== expectedJournalSha) fail('JOURNAL_CHANGED_DURING_PLAN'); };
    const saveJournal = async value => {
      await verifyJournal(); await storage.saveJournal(value);
      const saved = await fs.readFile(storage.file);
      if (digest(JSON.parse(saved)) !== digest(value)) fail('JOURNAL_WRITE_NOT_VERIFIED');
      expectedJournalSha = sha(saved);
    };
    const result = await planPersonalPublic({ api, journal, portal, products, apply, saveJournal, verifyJournal });
    await verifyJournal(); const output = await writeCandidate({ out, result, root });
    return { output, mode: result.plan.mode, newClients: 0, callbacksNeeded: result.plan.targets.filter(row => !row.callbackRegistered).length,
      providerUpdates: result.plan.providerUpdates, targets: result.plan.targets.map(({ product, clientId, callback, callbackRegistered }) => ({ product, clientId, callback, callbackRegistered })),
      productMapChanged: false, fortuneAllowlistChanged: false, portalChanged: result.plan.portalChanged, applied: result.plan.limitations.applied };
  } finally { if (lock) { await lock.close(); await fs.unlink(storage.lockPath); } }
}
module.exports = { planPersonalPublic, writeCandidate, runPersonalPublic, parseArguments, TARGETS, TRAVEL_TARGET, PATH_APP_TARGET };
if (require.main === module) runPersonalPublic({ args: process.argv.slice(2) }).then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
