// The real Google sign-in of the backup Google project, end to end on the operator PC (STAGE1_DESIGN.md 4.5
// 「봉투 v3와 Google 프로젝트」 · 11장 2주차: 「Rust 판 Google 로그인을 이 PC에서 한 번 해 전체 누름 수를 미리 세고
// 봉투 v3 · 개통을 끝에서 끝까지 본다」).
//
// The provisioning server is not on the company server yet, so this runs the real api and both workers in this
// process against the customer B2 account, with the real Google verifier (audience = the desktop client of the
// backup project). The engine's own parts do the rest: GoogleAuth (PKCE, loopback, `prompt=consent select_account`),
// ProvisionClient and Account.signIn → Account.startProtection, which publishes the real envelope v3 into the
// account's Drive app-only area of the backup project, reads it back and confirms the read key to the server.
// Only restic is left out: the backup engine is a stand-in that holds a repository id and password.
//
// The Google screens are the person's: this tool only writes the sign-in address to <state>/auth-url.txt and waits.
// Afterwards it removes what it made: the envelope files in the Drive app-only area, the trial customer's keys
// (through the key worker, as the server would), and the Google grant (revoke). The invite addresses come from
// WB_TRIAL_INVITES (comma-separated) and are never printed. Prints no secret, bucket name or account number.
// Usage: WB_TRIAL_INVITES=a@x,b@y node tools/google-trial.mjs <state folder>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { authorize } from '../b2-native.mjs';
import { keyHandlers, lazySession } from '../keys-worker.mjs';
import { fileHandlers } from '../files-worker.mjs';
import { rpcServer, rpcClient } from '../rpc.mjs';
import { Store } from '../store.mjs';
import { createApi } from '../server.mjs';
import { createMailer } from '../mail.mjs';
import { createVerifier } from '../google-token.mjs';
import * as secrets from './secret-store.mjs';

const require = createRequire(import.meta.url);
const engineSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'engine', 'src');
const { GoogleAuth, authorize: googleAuthorize } = require(path.join(engineSrc, 'recovery-auth.cjs'));
const { ProvisionClient } = require(path.join(engineSrc, 'provision-client.cjs'));
const { Account } = require(path.join(engineSrc, 'account.cjs'));

const stateDir = process.argv[2];
if (!stateDir || fs.existsSync(path.join(stateDir, 'wb.sqlite'))) throw new Error('Usage: node tools/google-trial.mjs <new state folder>');
const invites = String(process.env.WB_TRIAL_INVITES || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+$/.test(s));
if (!invites.length) throw new Error('WB_TRIAL_INVITES');
fs.mkdirSync(stateDir, { recursive: true });

const report = { at: new Date().toISOString(), steps: {} };
const hidden = [...invites];
const redact = (t) => { let s = String(t ?? ''); for (const v of hidden) if (v) s = s.split(v).join('[…]'); return s; };
const say = (step, value) => { report.steps[step] = value; console.log(redact(JSON.stringify({ step, ...value }))); };

// ── the account, the server's keys and the Google client
const bucket = secrets.get('custBucket');
const audit = secrets.get('custAudit');
const keysKey = secrets.get('custServerKeys');
const filesKey = secrets.get('custServerFiles');
const client = secrets.get('googleClient').installed;
hidden.push(bucket.bucketName, bucket.bucketId, bucket.accountId, audit.keyId, keysKey.keyId, keysKey.applicationKey, filesKey.keyId, filesKey.applicationKey, client.client_id, client.client_secret);
if ((await authorize(filesKey)).accountId !== bucket.accountId) throw new Error('ACCOUNT_MISMATCH');

// ── the real api and workers in this process
const now = () => Date.now();
const listen = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
const ks = crypto.randomBytes(32).toString('hex'), fsec = crypto.randomBytes(32).toString('hex');
const protectedKeyIds = [keysKey.keyId, filesKey.keyId, audit.keyId];
for (const d of ['keys', 'files', 'pc']) fs.mkdirSync(path.join(stateDir, d), { recursive: true });
const keysSrv = rpcServer({ secret: ks, now, handlers: keyHandlers({ withSession: lazySession(keysKey), bucketId: bucket.bucketId, protectedKeyIds, stateDir: path.join(stateDir, 'keys') }) });
const filesSrv = rpcServer({ secret: fsec, now, handlers: fileHandlers({ withSession: lazySession(filesKey), bucketId: bucket.bucketId, stateDir: path.join(stateDir, 'files'), now }) });
const keys = rpcClient({ url: `http://127.0.0.1:${await listen(keysSrv)}/rpc`, secret: ks, now });
const files = rpcClient({ url: `http://127.0.0.1:${await listen(filesSrv)}/rpc`, secret: fsec, now });
const store = new Store(path.join(stateDir, 'wb.sqlite'), { now });
const mailer = createMailer({ store, enabled: false, operator: 'ops@example.invalid', now });
const logs = [];
const api = createApi({ store, keys, files, mailer, now, log: (e) => logs.push(e), verifyGoogle: createVerifier({ audiences: [client.client_id], now }),
  config: { endpoint: `https://s3.${bucket.region}.backblazeb2.com`, bucket: bucket.bucketName, restoreGraceMs: 60000 } });
const srv = api.server();
const base = `http://127.0.0.1:${await listen(srv)}/backup-api/v1/`;
for (const e of invites) store.addInvite(e);

// The engine's server call, the same request shape over plain http to this process.
async function localCall(url, { method = 'GET', body, token = null } = {}) {
  if (!url.startsWith(base)) throw Object.assign(new Error('INVALID'), { code: 'INVALID' });
  const res = await fetch(url, { method, headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch {}
  if (!data || typeof data !== 'object') throw Object.assign(new Error('NETWORK'), { code: res.status >= 500 ? 'NETWORK' : 'INVALID' });
  return { status: res.status, data };
}

// The PC side. Its secrets live only in this run (a random key in memory), in the state folder.
const memKey = crypto.randomBytes(32);
const secretStore = {
  async encrypt(value) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', memKey, iv); const body = Buffer.concat([c.update(String(value), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]); },
  async decrypt(bytes) { const b = Buffer.from(bytes), d = crypto.createDecipheriv('aes-256-gcm', memKey, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); },
};
const urlFile = path.join(stateDir, 'auth-url.txt');
let opened = 0;
const openExternal = async (url) => { opened++; fs.writeFileSync(urlFile, url); console.log(JSON.stringify({ step: 'auth-url', file: urlFile, n: opened })); };
// The backup engine stand-in: what setupCloud would leave after `restic init` (repository id, password).
const engine = {
  config: null, secret: null, marked: null,
  async setupCloud({ repository, credentials, host }) {
    if (!credentials?.keyId) throw new Error('NO_WRITE_KEY');
    this.config = { repositoryId: crypto.randomBytes(32).toString('hex'), provider: { endpoint: repository.endpoint, bucket: repository.bucket, prefix: repository.prefix }, host, mode: 'backup' };
    this.secret = crypto.randomBytes(32).toString('base64url');
  },
  hasRecovery() { return !!this.config; },
  async markEnvelope(v) { this.marked = v; },
};
const pcRoot = path.join(stateDir, 'pc');
// The app waits 5 minutes for the browser; a person called to the screen gets 9 (the server's nonce lives 10).
const authorizeFlow = (c, open, options) => googleAuthorize(c, open, { ...options, timeoutMs: 9 * 60000 });
const auth = new GoogleAuth({ dir: path.join(pcRoot, 'account-v3'), secretStore, client, openExternal, authorizeFlow });
const account = new Account({ root: pcRoot, secretStore, client, openExternal, engine, deviceName: '측정 PC', appVersion: '0.7.0',
  make: { auth: () => auth, provision: (a) => new ProvisionClient({ dir: path.join(pcRoot, 'device'), secretStore: secretStore, auth: a, base, call: localCall }) } });

let customerId = null, ok = false;
try {
  await account.open();
  const t0 = Date.now();
  await account.signIn();
  const p = account.provision.state();
  customerId = p.customerId;
  const signed = Date.now();
  say('sign-in', { ms: signed - t0, browserOpens: opened, connected: p.connected, role: p.role, google: auth.getState().connected, serverCustomers: store.all('select count(*) n from customers')[0].n });
  await account.startProtection({ sources: [] });
  const env = account.envelope.getState();
  const row = store.all('select read_key from customers where id = ?', customerId)[0];
  say('envelope', { ms: Date.now() - signed, verified: !!env.verified?.verifiedAt, engineMarked: !!engine.marked, readKeyConfirmed: !!row?.read_key && env.verified?.readKeyId != null });
  // A new PC's view: the committed envelope is found again by the same Google account.
  const found = await account.envelope.discover();
  say('discover', { committed: found.length, sameCustomer: found.some((f) => f.customer === customerId) });
  ok = true;
} catch (e) {
  say('failed', { code: e.code || e.name, message: redact(e.message).slice(0, 200), serverLog: logs.slice(-5).map((l) => redact(JSON.stringify(l)).slice(0, 200)) });
} finally {
  // ── cleanup: the envelope files, the trial's keys (through the key worker), the Google grant
  const result = { envelopes: 0, envelopeErrors: 0, keys: 0, keyErrors: 0, revoked: false };
  try {
    if (auth.getState().connected) {
      const vault = account.envelope.vault;
      for (const f of await vault.list(auth.tokens.sub)) {
        try { await vault.call(`drive/v3/files/${encodeURIComponent(f.id)}`, { method: 'DELETE' }); result.envelopes++; } catch { result.envelopeErrors++; }
      }
      result.envelopesLeft = (await vault.list(auth.tokens.sub)).length;
    }
  } catch { result.envelopeErrors++; }
  for (const r of customerId ? store.allLiveKeys().filter((x) => x.customer_id === customerId && x.key_id) : []) {
    try { await keys('keys.delete', { keyId: r.key_id }); store.keyDeleted(r.name, 'trial-cleanup'); result.keys++; } catch { result.keyErrors++; }
  }
  if (customerId) {
    const s = await authorize(filesKey);
    const left = await s.listFileVersions({ bucketId: bucket.bucketId, prefix: `c/${customerId}/` });
    result.prefixFiles = (left || []).length;
  }
  try { result.revoked = await auth.revoke(); } catch { result.revokeError = true; }
  say('cleanup', result);
  srv.close(); filesSrv.close(); keysSrv.close(); store.close();
  fs.writeFileSync(path.join(stateDir, 'report.json'), redact(JSON.stringify({ ...report, ok }, null, 2)));
  for (const d of ['pc', 'keys', 'files']) fs.rmSync(path.join(stateDir, d), { recursive: true, force: true });
  for (const f of fs.readdirSync(stateDir)) if (f.startsWith('wb.sqlite')) fs.rmSync(path.join(stateDir, f), { force: true });
}
process.exitCode = ok ? 0 : 1;
