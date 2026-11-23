// Add the work-backup copy rule to the company backup bucket's lifecycle (server/README.md 「매일 사본」).
// The bucket name is an argument (the repository is public). Without --실행 it only reads and shows
// what it would write. With --실행 it writes the whole rule list back under the metageneration it
// read, then reads again and checks every earlier rule is still there, unchanged, plus the new one.
// host-install.mjs start calls check() and refuses to turn the daily copy on without the rule.
//   node tools/backup-bucket-rule.mjs <bucket> [--실행]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const PROJECT = 'synk-bake-unmet27';
export const PREFIX = 'company/workbackup/';
export const RULE = { action: { type: 'Delete' }, condition: { age: 14, matchesPrefix: [PREFIX] } };
// Compare by content, not key order (GCS may answer the same rule with its fields reordered).
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const overlaps = (p) => PREFIX.startsWith(p) || p.startsWith(PREFIX);

// What would make the copies stay longer than 30 days, or go earlier than 14 (soft delete 7 + lag 1 + 14 = 22).
export function problems(bucket) {
  const out = [];
  if (bucket.versioning?.enabled) out.push('VERSIONING_ON');
  if (Number(bucket.softDeletePolicy?.retentionDurationSeconds || 0) > 7 * 86400) out.push('SOFT_DELETE_LONGER_THAN_7_DAYS');
  if (bucket.retentionPolicy) out.push('RETENTION_POLICY');
  if (bucket.defaultEventBasedHold) out.push('DEFAULT_EVENT_HOLD');
  if (bucket.objectRetention?.mode === 'Enabled') out.push('OBJECT_RETENTION');
  const others = (bucket.lifecycle?.rule || []).filter((r) => !same(r, RULE));
  // Any other rule that can act on our prefix (wider, equal or narrower) — ours must be the only one.
  for (const r of others) {
    const prefixes = r.condition?.matchesPrefix || [];
    if (!prefixes.length || prefixes.some(overlaps)) out.push('OTHER_RULE_ON_PREFIX:' + JSON.stringify(r));
  }
  return out;
}

export function plan(bucket) {
  const rules = bucket.lifecycle?.rule || [];
  const present = rules.some((r) => same(r, RULE));
  return { before: rules, after: present ? rules : [...rules, RULE], changed: !present, problems: problems(bucket) };
}

async function session() {
  const policy = require_('../../../../tools/모델정책.js');
  if (policy.벌텍스프로젝트() !== PROJECT) throw new Error('PROJECT_MISMATCH');
  return { authorization: 'Bearer ' + await policy.벌텍스토큰(), 'x-goog-user-project': PROJECT, 'content-type': 'application/json' };
}

async function read(name, headers) {
  const url = `https://storage.googleapis.com/storage/v1/b/${name}?fields=lifecycle,metageneration,softDeletePolicy,versioning,retentionPolicy,defaultEventBasedHold,objectRetention`;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('BUCKET_READ_' + r.status);
  return r.json();
}

const NAME = /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/;

// Read-only: true when our rule is there and nothing else keeps or removes the copies otherwise.
export async function check(name) {
  if (!NAME.test(name || '')) throw new Error('BUCKET_NAME');
  const p = plan(await read(name, await session()));
  return { ok: !p.changed && !p.problems.length, ...p };
}

async function main() {
  const [name, flag] = process.argv.slice(2);
  if (!NAME.test(name || '')) throw new Error('usage: backup-bucket-rule.mjs <bucket> [--실행]');
  const headers = await session();
  const bucket = await read(name, headers);
  const p = plan(bucket);
  const report = { metageneration: bucket.metageneration, softDeleteSeconds: bucket.softDeletePolicy?.retentionDurationSeconds, ...p };
  if (p.problems.length) throw new Error('REFUSED ' + p.problems.join(' '));
  if (flag === '--실행' && p.changed) {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${name}?ifMetagenerationMatch=${bucket.metageneration}&fields=lifecycle,metageneration`,
      { method: 'PATCH', headers, body: JSON.stringify({ lifecycle: { rule: p.after } }), signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('BUCKET_PATCH_' + r.status);
    const back = await read(name, headers);
    if (!same(back.lifecycle?.rule, p.after) || problems(back).length) throw new Error('READBACK_MISMATCH');
    report.written = { metageneration: back.metageneration, rules: back.lifecycle.rule };
  }
  console.log(JSON.stringify(report, null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
