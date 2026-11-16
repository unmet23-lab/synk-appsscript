// Builds the api service (store, workers, mailer, jobs) from environment and secret files.
// Used by main.mjs and admin.mjs.
import crypto from 'node:crypto';
import { Store } from './store.mjs';
import { createVerifier } from './google-token.mjs';
import { rpcClient } from './rpc.mjs';
import { createApi } from './server.mjs';
import { createJobs } from './jobs.mjs';
import { createMailer } from './mail.mjs';
import { need, secretFile, BUCKET_ID } from './config.mjs';

const log = (service) => (e) => console.log(JSON.stringify({ at: new Date().toISOString(), service, ...e }));

export function apiFromEnv(env = process.env) {
  const store = new Store(need('WB_DB', { env }));
  const keys = rpcClient({ url: need('WB_KEYS_URL', { env }), secret: secretFile('WB_KEYS_RPC', { env }) });
  const files = rpcClient({ url: need('WB_FILES_URL', { env }), secret: secretFile('WB_FILES_RPC', { env }) });
  const mailOn = env.WB_MAIL_ENABLED === '1';
  const mailer = createMailer({ store, enabled: mailOn, relayUrl: env.WB_MAIL_RELAY_URL || null, operator: env.WB_OPERATOR_EMAIL || null,
    privateKey: mailOn ? crypto.createPrivateKey(secretFile('WB_MAIL_KEY', { env })) : null });
  const api = createApi({
    store, keys, files, mailer, log: log('api'),
    verifyGoogle: createVerifier({ audiences: need('WB_GOOGLE_AUDIENCES', { env }).split(',').map((s) => s.trim()) }),
    config: { endpoint: need('WB_ENDPOINT', { env, pattern: /^https:\/\/s3\.[a-z]+-[a-z]+-\d{3}\.backblazeb2\.com$/ }), bucket: need('WB_BUCKET', { env, pattern: /^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/ }),
      trustedProxies: (env.WB_TRUSTED_PROXIES || '').split(',').filter(Boolean), minAppVersion: env.WB_MIN_APP_VERSION || '0.7.0', restoreGraceMs: Number(env.WB_RESTORE_GRACE_MS || 60000) },
  });
  const jobs = createJobs({ store, api, keys, files, mailer, log: log('jobs'),
    config: { bucketId: need('WB_BUCKET_ID', { env, pattern: BUCKET_ID }), protectedKeyIds: (env.WB_PROTECTED_KEY_IDS || '').split(',').filter(Boolean), backupDir: env.WB_BACKUP_DIR || null, auditRunsUrl: env.WB_AUDIT_RUNS_URL || null } });
  return { store, api, jobs, keys, files, mailer };
}
