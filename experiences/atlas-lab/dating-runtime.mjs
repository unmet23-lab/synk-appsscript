// Explicit loopback or HTTPS reverse-proxy startup configuration. Inspection never imports an adult
// provider, opens a database, binds a listener or sends an account request.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../synk-account/src/core.mjs';
import { createDatingAdultVerifier } from './dating-adult.mjs';
import { createDatingAccountVerifier } from './dating-auth.mjs';
import { createDatingLifecycleVerifier } from './dating-lifecycle.mjs';
import { createDatingTransport } from './dating-transport.mjs';

const messages = Object.freeze({
  'dating-runtime-arguments': 'Choose no arguments, --check-config, --check-restore or --resume-after-restore.',
  'dating-runtime-mode': 'Choose demo or account explicitly.',
  'dating-runtime-account-file': 'A readable public account JSON file is required.',
  'dating-runtime-account-config': 'A registered public SYNK OAuth configuration is required.',
  'dating-runtime-callback': 'This local host requires a fixed http://127.0.0.1:<port>/atlas-lab/dating.html callback without query or fragment.',
  'dating-runtime-port': 'Use an integer listening port from 1 to 65535; only demo permits 0.',
  'dating-runtime-port-mismatch': 'The account listening port must match the registered callback port.',
  'dating-runtime-transport': 'Configure an exact HTTPS public origin and explicit trusted proxy IP addresses together in account mode.',
  'dating-runtime-public-callback': 'The registered callback must match the configured HTTPS origin and /atlas-lab/dating.html exactly.',
  'dating-runtime-public-storage': 'An HTTPS proxy host requires an explicit private listening port and separate database path.',
  'dating-runtime-account-only': 'Lifecycle and adult verification are available only in explicit account mode.',
  'dating-runtime-lifecycle': 'A dedicated 32 to 256 character lifecycle token is required.',
  'dating-runtime-adult-file': 'The adult verifier must be an existing local .mjs or .js server adapter.',
  'dating-runtime-adult-contract': 'The adult adapter must export a default required server verification contract.',
  'dating-runtime-operators': 'Configured operator identifiers are invalid.',
  'dating-runtime-restore-config': 'Restore inspection requires account mode, an explicit database, paired evidence and independent latest evidence paths.',
  'dating-runtime-restore-command': 'Configured restore evidence requires --check-restore or --resume-after-restore; inspection alone does not start the service.',
  'dating-runtime-restore-rejected': 'Restore admission failed. Keep the service stopped and inspect the trusted evidence and database.',
  'dating-runtime-start': 'The local dating server could not start. Review its configuration and listening port.'
});
function fail(code) { throw Object.assign(new Error(messages[code]), { code }); }
export function datingRuntimeError(error) {
  const code = Object.hasOwn(messages, error?.code) ? error.code : 'dating-runtime-start';
  return { code, message: messages[code] };
}
export function datingRestoreEnvironment(accountConfig) {
  const config = readConfig(accountConfig, 'http://127.0.0.1/atlas-lab/dating.html');
  return { accountApiUrl: new URL(config.accountApiUrl).href, clientId: config.clients.platform.clientId,
    issuer: 'synk-account', audience: 'atlas-dating' };
}
const identifier = value => /^[A-Za-z0-9_.:@-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

export async function readDatingRuntimeConfig(env = process.env, { cwd = process.cwd() } = {}) {
  const mode = env.SYNK_DATING_MODE || 'demo';
  if (!['demo', 'account'].includes(mode)) fail('dating-runtime-mode');
  let restore;
  if (Object.hasOwn(env, 'SYNK_DATING_RESTORE_EVIDENCE') || Object.hasOwn(env, 'SYNK_DATING_RESTORE_LATEST')) {
    if (mode !== 'account' || !env.SYNK_DATING_DB?.trim() || !env.SYNK_DATING_RESTORE_EVIDENCE?.trim() || !env.SYNK_DATING_RESTORE_LATEST?.trim()) fail('dating-runtime-restore-config');
    restore = { evidencePath: path.resolve(cwd, env.SYNK_DATING_RESTORE_EVIDENCE), latestEvidencePath: path.resolve(cwd, env.SYNK_DATING_RESTORE_LATEST) };
    if (restore.evidencePath === restore.latestEvidencePath) fail('dating-runtime-restore-config');
  }
  let transport;
  if (Object.hasOwn(env, 'SYNK_DATING_PUBLIC_ORIGIN') || Object.hasOwn(env, 'SYNK_DATING_TRUSTED_PROXIES')) {
    try {
      if (typeof env.SYNK_DATING_PUBLIC_ORIGIN !== 'string' || !env.SYNK_DATING_PUBLIC_ORIGIN
        || typeof env.SYNK_DATING_TRUSTED_PROXIES !== 'string' || !env.SYNK_DATING_TRUSTED_PROXIES) throw new Error();
      const checked = createDatingTransport({ mode, publicOrigin: env.SYNK_DATING_PUBLIC_ORIGIN,
        trustedProxyIPs: env.SYNK_DATING_TRUSTED_PROXIES.split(',').map(value => value.trim()) });
      transport = { publicOrigin: checked.publicOrigin, trustedProxyIPs: [...checked.trustedProxyIPs] };
    } catch { fail('dating-runtime-transport'); }
    if (!env.SYNK_DATING_PORT || !env.SYNK_DATING_DB?.trim()) fail('dating-runtime-public-storage');
  }
  const accountOnly = !!env.SYNK_DATING_LIFECYCLE_TOKEN || !!env.SYNK_DATING_ADULT_ADAPTER;
  if (mode !== 'account' && accountOnly) fail('dating-runtime-account-only');
  let accountConfig = { version: 1 }, callbackPort;
  if (mode === 'account') {
    try {
      if (typeof env.SYNK_DATING_ACCOUNT_CONFIG !== 'string' || !env.SYNK_DATING_ACCOUNT_CONFIG.trim()) throw new Error();
      const filename = path.resolve(cwd, env.SYNK_DATING_ACCOUNT_CONFIG), stat = await fs.stat(filename);
      if (!stat.isFile() || stat.size > 65536) throw new Error();
      accountConfig = JSON.parse(await fs.readFile(filename, 'utf8'));
    } catch { fail('dating-runtime-account-file'); }
    let config;
    try {
      config = readConfig(accountConfig, 'http://127.0.0.1/atlas-lab/dating.html');
      if (!config.configured || typeof config.clients.platform.clientId !== 'string' || !config.clients.platform.clientId.trim()
        || !config.clients.platform.redirectUri) throw new Error();
      createDatingAccountVerifier(config); // Validate the account API contract without sending a request.
    } catch { fail('dating-runtime-account-config'); }
    const callback = new URL(config.clients.platform.redirectUri);
    if (transport) {
      if (callback.href !== transport.publicOrigin + '/atlas-lab/dating.html') fail('dating-runtime-public-callback');
    } else {
      if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' || callback.pathname !== '/atlas-lab/dating.html'
        || callback.search || callback.hash || !callback.port) fail('dating-runtime-callback');
      callbackPort = Number(callback.port);
    }
  }
  const rawPort = env.SYNK_DATING_PORT ?? String(callbackPort ?? 0);
  if (typeof rawPort !== 'string' || !/^(0|[1-9][0-9]{0,4})$/.test(rawPort)
    || Number(rawPort) > 65535 || mode === 'account' && Number(rawPort) === 0) fail('dating-runtime-port');
  const port = Number(rawPort);
  if (mode === 'account' && !transport && port !== callbackPort) fail('dating-runtime-port-mismatch');
  const operatorIds = (env.SYNK_DATING_OPERATORS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (operatorIds.some(value => !identifier(value))) fail('dating-runtime-operators');
  let lifecycle;
  if (env.SYNK_DATING_LIFECYCLE_TOKEN) {
    lifecycle = { token: env.SYNK_DATING_LIFECYCLE_TOKEN, issuer: 'synk-account', audience: 'atlas-dating' };
    try { createDatingLifecycleVerifier(lifecycle); } catch { fail('dating-runtime-lifecycle'); }
  }
  let adultAdapterPath;
  if (env.SYNK_DATING_ADULT_ADAPTER) {
    try {
      adultAdapterPath = path.resolve(cwd, env.SYNK_DATING_ADULT_ADAPTER);
      if (!['.mjs', '.js'].includes(path.extname(adultAdapterPath)) || !(await fs.stat(adultAdapterPath)).isFile()) throw new Error();
    } catch { fail('dating-runtime-adult-file'); }
  }
  return { mode, accountConfig, port, host: '127.0.0.1', operatorIds, lifecycle, adultAdapterPath, transport, restore,
    databasePath: env.SYNK_DATING_DB ? path.resolve(cwd, env.SYNK_DATING_DB) : undefined };
}

export function inspectDatingRuntimeConfig(config) {
  return { configured: true, mode: config.mode, host: config.host, port: config.port,
    accountConfigured: config.mode === 'account', callbackPortMatched: config.transport ? null : config.mode === 'account',
    transportMode: config.transport ? 'https-reverse-proxy' : 'local', publicOrigin: config.transport?.publicOrigin || null,
    callbackOriginMatched: config.transport ? true : null,
    lifecycleConfigured: !!config.lifecycle, adultAdapterPresent: !!config.adultAdapterPath,
    adultAdapterContractChecked: false, providerTested: false, databaseOpened: false, listening: false,
    restoreConfigured: !!config.restore, restoreChecked: false };
}

export async function loadDatingAdultAdapter(filename) {
  if (!filename) return undefined;
  try {
    // A trusted local server module, never a remote URL or browser-supplied file.
    // --check-config deliberately does not evaluate its top-level code.
    const value = (await import(pathToFileURL(filename).href)).default;
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).some(key => !['required', 'issuer', 'verify', 'timeoutMs', 'admission'].includes(key))) throw new Error();
    createDatingAdultVerifier(value); // Validate the contract without calling verify.
    return { required: value.required, issuer: value.issuer, verify: value.verify,
      ...(value.timeoutMs === undefined ? {} : { timeoutMs: value.timeoutMs }),
      ...(value.admission === undefined ? {} : { admission: { ...value.admission } }) };
  } catch { fail('dating-runtime-adult-contract'); }
}

export function readDatingRuntimeArguments(args) {
  if (!Array.isArray(args) || args.length > 1 || args.length === 1 && !['--check-config', '--check-restore', '--resume-after-restore'].includes(args[0])) fail('dating-runtime-arguments');
  return { checkOnly: args[0] === '--check-config', checkRestore: args[0] === '--check-restore', resumeAfterRestore: args[0] === '--resume-after-restore' };
}

export function assertDatingRestoreCommand(config, command) {
  if (command.checkOnly) return;
  if (!!config.restore !== !!(command.checkRestore || command.resumeAfterRestore)) fail('dating-runtime-restore-command');
}
