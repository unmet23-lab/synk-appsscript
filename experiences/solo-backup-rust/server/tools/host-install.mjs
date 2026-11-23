// Install and run the work-backup services on the company writer node (server/README.md 「회사 서버에서」).
// Runs on the operator PC. Sends host/wb-host.py with one action through the pinned SSH path
// (`sudo python3 -`) and saves the answer. Secret values come from the operator-PC DPAPI store and
// travel only inside the SSH standard input; nothing here prints a secret, a bucket name or an address.
//
//   node tools/host-install.mjs plan|status|probe
//   node tools/host-install.mjs files|start|stop --실행
//   node tools/host-install.mjs secrets --실행 [--바꿈]     (yuho's go-ahead first: it puts the B2 keys on the server)
//   node tools/host-install.mjs start --실행 --다시          (restart the three services onto new files)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.dirname(here);
const host = path.join(server, 'host');
const REMOTE = process.env.SYNK_REMOTE_TOOL || 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/platform-ha-20261011/remote-app-current-v1.cjs';
const ACTIONS = new Set(['plan', 'status', 'probe', 'files', 'secrets', 'start', 'stop']);
const WRITES = new Set(['files', 'secrets', 'start', 'stop']);
const HOST_FILES = ['box.conf.in', 'synk-wb-api.service.in', 'synk-wb-keys.service.in', 'synk-wb-files.service.in', 'synk-wb-offsite.service.in', 'synk-wb-offsite.timer', 'resolv.conf'];
const OPERATOR = 'founder@synk.im';
const AUDIT_RUNS = 'https://api.github.com/repos/unmet23-lab/synk-appsscript/actions/workflows/workbackup-audit.yml/runs?per_page=5';

const b64 = (file) => fs.readFileSync(file).toString('base64');

// The app is exactly what the image copied: the top-level *.mjs of server/ (Dockerfile COPY *.mjs).
export function payload() {
  const app = {};
  for (const name of fs.readdirSync(server).filter((n) => /^[a-z0-9-]+\.mjs$/.test(n)).sort()) app[name] = b64(path.join(server, name));
  const hostFiles = Object.fromEntries(HOST_FILES.map((n) => [n, b64(path.join(host, n))]));
  return { app, offsite: { 'wb-offsite.py': b64(path.join(host, 'wb-offsite.py')) }, host: hostFiles };
}

// settings.env per role: non-secret values only (config.mjs refuses WB_SECRET names).
export function settingsFor({ bucket, keysKey, filesKey, audit, client }) {
  const protectedIds = [keysKey.keyId, filesKey.keyId, audit.keyId].join(',');
  const common = `WB_BUCKET_ID=${bucket.bucketId}\n`;
  return {
    api: `# Work-backup api settings (server/README.md). Written by tools/host-install.mjs.\n${common}WB_PROTECTED_KEY_IDS=${protectedIds}\n`
      + `WB_ENDPOINT=https://s3.${bucket.region}.backblazeb2.com\nWB_BUCKET=${bucket.bucketName}\nWB_GOOGLE_AUDIENCES=${client.client_id}\n`
      + `WB_OPERATOR_EMAIL=${OPERATOR}\nWB_AUDIT_RUNS_URL=${AUDIT_RUNS}\n`,
    keys: `# Work-backup keys worker settings.\n${common}WB_PROTECTED_KEY_IDS=${protectedIds}\n`,
    files: `# Work-backup files worker settings.\n${common}`,
  };
}

export function secretsFor({ keysKey, filesKey }, random = () => crypto.randomBytes(32).toString('hex')) {
  const keysRpc = random(), filesRpc = random();
  const key = (k) => JSON.stringify({ keyId: k.keyId, applicationKey: k.applicationKey });
  return {
    api: { 'wb-keys-rpc': keysRpc, 'wb-files-rpc': filesRpc },
    keys: { 'wb-keys-b2': key(keysKey), 'wb-keys-rpc': keysRpc },
    files: { 'wb-files-b2': key(filesKey), 'wb-files-rpc': filesRpc },
  };
}

export function script(request) {
  const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
  return `import json, base64\nREQUEST = json.loads(base64.b64decode('${encoded}').decode())\n` + fs.readFileSync(path.join(host, 'wb-host.py'), 'utf8');
}

async function main() {
  const [action, ...flags] = process.argv.slice(2);
  if (!ACTIONS.has(action)) throw new Error('usage: host-install.mjs plan|status|probe|files|secrets|start|stop [--실행] [--바꿈] [--다시]');
  if (WRITES.has(action) && !flags.includes('--실행')) throw new Error(`${action} changes the server: add --실행`);
  const request = { action, payload: payload(), replace: flags.includes('--바꿈'), restart: flags.includes('--다시') };
  if (action === 'secrets') {
    const secrets = await import('./secret-store.mjs');
    const parts = { bucket: secrets.get('custBucket'), audit: secrets.get('custAudit'), keysKey: secrets.get('custServerKeys'), filesKey: secrets.get('custServerFiles'), client: secrets.get('googleClient').installed };
    request.secrets = secretsFor(parts);
    request.settings = settingsFor(parts);
  }
  const remote = createRequire(import.meta.url)(REMOTE);
  const answer = await remote('primary', script(request), 300000);
  const dir = path.resolve(process.env.WB_HOST_RECORD || path.join(server, '../../../.tmp/workbackup-host'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${action}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(answer, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ saved: file, ...answer }, null, 1).slice(0, 6000));
  if (answer.error) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
