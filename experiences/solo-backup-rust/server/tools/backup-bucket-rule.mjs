// Add the work-backup copy rule to the company backup bucket's lifecycle (server/README.md 「매일 사본」).
// The bucket name is an argument (the repository is public). Without --실행 it only reads and shows
// what it would write. With --실행 it writes the whole rule list back under the metageneration it
// read, then reads again and checks every earlier rule is still there, unchanged, plus the new one.
//   node tools/backup-bucket-rule.mjs <bucket> [--실행]
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const PROJECT = 'synk-bake-unmet27';
export const RULE = { action: { type: 'Delete' }, condition: { age: 14, matchesPrefix: ['company/workbackup/'] } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function plan(bucket) {
  const rules = bucket.lifecycle?.rule || [];
  // The work-backup prefix must not already be under some other delete rule we did not write.
  const others = rules.filter((r) => !same(r, RULE));
  if (others.some((r) => (r.condition?.matchesPrefix || []).some((p) => 'company/workbackup/'.startsWith(p) && p !== 'company/workbackup/'))) throw new Error('PREFIX_ALREADY_COVERED');
  if (others.some((r) => !(r.condition?.matchesPrefix || []).length)) throw new Error('BUCKET_WIDE_RULE_PRESENT');
  return { before: rules, after: rules.some((r) => same(r, RULE)) ? rules : [...rules, RULE], changed: !rules.some((r) => same(r, RULE)) };
}

async function main() {
  const [name, flag] = process.argv.slice(2);
  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(name || '')) throw new Error('usage: backup-bucket-rule.mjs <bucket> [--실행]');
  const policy = require_('../../../../tools/모델정책.js');
  if (policy.벌텍스프로젝트() !== PROJECT) throw new Error('PROJECT_MISMATCH');
  const headers = { authorization: 'Bearer ' + await policy.벌텍스토큰(), 'x-goog-user-project': PROJECT, 'content-type': 'application/json' };
  const url = `https://storage.googleapis.com/storage/v1/b/${name}?fields=lifecycle,metageneration,softDeletePolicy,versioning`;
  const read = async () => { const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('BUCKET_READ_' + r.status); return r.json(); };
  const bucket = await read();
  const p = plan(bucket);
  const report = { metageneration: bucket.metageneration, softDeleteSeconds: bucket.softDeletePolicy?.retentionDurationSeconds, versioning: !!bucket.versioning?.enabled, ...p };
  if (bucket.versioning?.enabled) throw new Error('VERSIONING_ON — the 30-day sum no longer holds');
  if (Number(bucket.softDeletePolicy?.retentionDurationSeconds || 0) > 7 * 86400) throw new Error('SOFT_DELETE_LONGER_THAN_7_DAYS');
  if (flag === '--실행' && p.changed) {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${name}?ifMetagenerationMatch=${bucket.metageneration}&fields=lifecycle,metageneration`,
      { method: 'PATCH', headers, body: JSON.stringify({ lifecycle: { rule: p.after } }), signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('BUCKET_PATCH_' + r.status);
    const back = await read();
    if (!same(back.lifecycle?.rule, p.after)) throw new Error('READBACK_MISMATCH');
    report.written = { metageneration: back.metageneration, rules: back.lifecycle.rule };
  }
  console.log(JSON.stringify(report, null, 1));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
