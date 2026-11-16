// The key-work service (STAGE1_DESIGN.md 4.4 표 「서버 · 출입증 일」, 「개통 서버 구현 설계」).
// It alone holds the account's key-making key. It does not take orders blindly:
// the capabilities, the bucket and the name pattern of every key it makes are
// fixed here, the prefix must be a customer prefix, it deletes only keys that it
// could have made, and it keeps its own daily cap on a volume the api cannot touch.
// A taken-over api can therefore make at most DAILY_CAP delete-less customer keys a
// day and delete customer keys — never touch the server's own keys or buckets.
import fs from 'node:fs';
import path from 'node:path';
import { authorize, B2Error } from './b2-native.mjs';
import { rpcServer } from './rpc.mjs';
import { PREFIX, BUCKET_ID, KEY_ID, need, secretFile } from './config.mjs';

export const WRITE_CAPS = ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'];
export const READ_CAPS = ['listBuckets', 'listFiles', 'readFiles'];
export const DAILY_CAP = 50;
export const NAME = /^wb[wr]-[a-z0-9]{20}$/;
const err = (code) => Object.assign(new Error(code), { code });

// Re-authorizes when B2's 24-hour token expires.
export function lazySession(credentials, { authorizeImpl = authorize } = {}) {
  let session = null;
  return async function withSession(fn) {
    session ||= await authorizeImpl(credentials);
    try { return await fn(session); }
    catch (e) {
      if (e instanceof B2Error && e.status === 401 && /expired|bad_auth_token/.test(e.code)) { session = await authorizeImpl(credentials); return fn(session); }
      throw e;
    }
  };
}

function counter(stateDir, now) {
  const file = path.join(stateDir, 'key-days.json');
  return {
    take() {
      const day = new Date(now()).toISOString().slice(0, 10);
      let all = {};
      try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
      const n = (all[day] || 0) + 1;
      if (n > DAILY_CAP) throw err('LIMIT_WORKER_DAY');
      const next = { [day]: n };
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next)); fs.renameSync(tmp, file);
      return n;
    },
  };
}

const ours = (k, bucketId) => NAME.test(k.keyName || '') && PREFIX.test(k.namePrefix || '') && Array.isArray(k.bucketIds) && k.bucketIds.length === 1 && k.bucketIds[0] === bucketId;
const view = (k) => ({ keyId: k.applicationKeyId, keyName: k.keyName, capabilities: k.capabilities || [], bucketIds: k.bucketIds || (k.bucketId ? [k.bucketId] : []), namePrefix: k.namePrefix ?? null, expirationTimestamp: k.expirationTimestamp ?? null });

export function keyHandlers({ withSession, bucketId, protectedKeyIds = [], stateDir, now = () => Date.now() }) {
  if (!BUCKET_ID.test(bucketId)) throw new Error('CONFIG_INVALID:bucketId');
  const guard = new Set(protectedKeyIds);
  const cap = counter(stateDir, now);
  const list = () => withSession((s) => s.listKeys()).then((keys) => keys.map(view));
  return {
    async 'keys.create'({ kind, prefix, name }) {
      if (!['write', 'read'].includes(kind) || !PREFIX.test(prefix || '') || !NAME.test(name || '') || name[2] !== (kind === 'write' ? 'w' : 'r')) throw err('BAD_INPUT');
      cap.take();
      const k = await withSession((s) => s.createKey({ keyName: name, capabilities: kind === 'write' ? WRITE_CAPS : READ_CAPS, bucketIds: [bucketId], namePrefix: prefix }));
      if (!k?.applicationKeyId || !k.applicationKey) throw err('B2_BAD_RESPONSE');
      return { keyId: k.applicationKeyId, applicationKey: k.applicationKey, capabilities: k.capabilities || [] };
    },
    async 'keys.delete'({ keyId }) {
      if (!KEY_ID.test(keyId || '') || guard.has(keyId)) throw err('BAD_INPUT');
      const found = (await list()).find((k) => k.keyId === keyId);
      if (!found) return { deleted: false, missing: true };
      if (!ours(found, bucketId)) throw err('NOT_OURS');
      await withSession((s) => s.deleteKey(keyId));
      return { deleted: true };
    },
    // Deletes a key made under a name whose B2 answer never reached the api.
    async 'keys.deleteByName'({ name }) {
      if (!NAME.test(name || '')) throw err('BAD_INPUT');
      const found = (await list()).filter((k) => k.keyName === name && !guard.has(k.keyId));
      for (const k of found) { if (!ours(k, bucketId)) throw err('NOT_OURS'); await withSession((s) => s.deleteKey(k.keyId)); }
      return { deleted: found.length };
    },
    async 'keys.list'() { return { keys: await list() }; },
    async 'bucket.settings'() {
      const r = await withSession((s) => s.listBuckets());
      const buckets = r.buckets || [];
      const b = buckets.find((x) => x.bucketId === bucketId);
      if (!b) return { bucketCount: buckets.length, found: false };
      const repl = b.replicationConfiguration;
      return {
        bucketCount: buckets.length, found: true, bucketType: b.bucketType, lifecycleRules: b.lifecycleRules || [],
        encryption: b.defaultServerSideEncryption?.isClientAuthorizedToRead === false ? 'unreadable' : b.defaultServerSideEncryption?.value?.mode || 'none',
        replication: repl?.isClientAuthorizedToRead === false ? 'unreadable' : (repl?.value?.asReplicationSource?.replicationRules?.length || 0) + (repl?.value?.asReplicationDestination ? 1 : 0),
        fileLock: b.fileLockConfiguration?.value?.isFileLockEnabled ?? null,
      };
    },
  };
}

export function startKeysWorker({ env = process.env } = {}) {
  const handlers = keyHandlers({
    withSession: lazySession(secretFile('WB_KEYS_B2', { env, json: true })), bucketId: need('WB_BUCKET_ID', { env, pattern: BUCKET_ID }),
    protectedKeyIds: (env.WB_PROTECTED_KEY_IDS || '').split(',').map((s) => s.trim()).filter(Boolean), stateDir: need('WB_STATE_DIR', { env }),
  });
  return rpcServer({ secret: secretFile('WB_KEYS_RPC', { env }), handlers, log: (e) => console.log(JSON.stringify({ at: new Date().toISOString(), service: 'keys', ...e })) })
    .listen(Number(env.WB_PORT || 4191), '0.0.0.0');
}
