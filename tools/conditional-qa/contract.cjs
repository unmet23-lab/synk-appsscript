'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const CONTEXT = 'conditional-qa/local';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const key = row => `${row.file}\0${row.name}`;
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value) || /^[a-z]:/i.test(value) || value.split('/').some(x => !x || x === '.' || x === '..')) throw Error('Invalid repository-relative path');
  return value;
}
function readManifest(root) {
  const bytes = fs.readFileSync(path.join(root, 'tools/conditional-qa/cases.json'));
  const manifest = JSON.parse(bytes);
  if (manifest.version !== 1 || !Array.isArray(manifest.cases) || manifest.cases.length !== manifest.expectedCount || manifest.expectedCount < 113) throw Error('Conditional QA inventory is incomplete');
  const ids = new Set(), keys = new Set();
  for (const row of manifest.cases) {
    relativePath(row.file);
    if (!/\.test\.(?:cjs|mjs|js)$/.test(row.file) || !/^S\d{3,}$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || !['windows', 'linux', 'local'].includes(row.route) || !['default', 'client', 'homework'].includes(row.profile)) throw Error(`Invalid case: ${row.id}`);
    if (ids.has(row.id) || keys.has(key(row))) throw Error(`Duplicate case: ${row.id}`);
    ids.add(row.id); keys.add(key(row));
  }
  for (let n = 1; n <= 113; n++) if (!ids.has(`S${String(n).padStart(3, '0')}`)) throw Error('An original conditional case is missing');
  return { ...manifest, digest: sha256(JSON.stringify(manifest)) };
}
function eventPath(file, root) {
  if (!file) return '';
  try { return path.relative(root, file.startsWith('file:') ? fileURLToPath(file) : path.resolve(root, file)).split(path.sep).join('/'); } catch { return ''; }
}
function judge(cases, events, { root, exitCode, timedOut = false } = {}) {
  const failures = events.filter(e => e.event === 'test:fail');
  const rows = cases.map(row => {
    const seen = events.filter(e => e.name === row.name && eventPath(e.file, root) === row.file && ['test:pass', 'test:fail'].includes(e.event));
    const passed = seen.length === 1 && seen[0].event === 'test:pass' && !seen[0].skip && !seen[0].todo;
    return { id: row.id, file: row.file, name: row.name, status: passed ? 'pass' : seen.length === 0 ? 'missing' : seen.length !== 1 ? 'duplicate' : seen[0].skip || seen[0].todo ? 'skipped' : 'fail', durationMs: seen[0]?.duration_ms };
  });
  return { ok: exitCode === 0 && !timedOut && failures.length === 0 && rows.every(r => r.status === 'pass'), expected: rows.length,
    passed: rows.filter(r => r.status === 'pass').length, exitCode, timedOut, unexpectedFailures: failures.map(e => ({ file: eventPath(e.file, root), name: e.name, error: e.error })), rows };
}
function unknownSkips(manifest, rows, root) {
  const known = new Set(manifest.cases.map(key));
  return rows.filter(row => (row.type || row.종류 || 'test') !== 'suite').map(row => ({ file: row.파일 || eventPath(row.file, root), name: row.시험 || row.name, reason: row.까닭 || row.skip })).filter(row => !known.has(key(row)));
}
function coverage(receipt, { commit, digest, cases }) {
  if (!receipt || receipt.version !== 1 || receipt.candidate || receipt.commit !== commit || receipt.manifestDigest !== digest || receipt.ok !== true || receipt.expected !== cases.length || receipt.passed !== cases.length || receipt.sourceUnchanged !== true || !Array.isArray(receipt.rows)) return false;
  const expected = new Set(cases.map(key));
  return receipt.rows.length === expected.size && receipt.rows.every(row => row.status === 'pass' && expected.delete(key(row))) && expected.size === 0;
}
function within(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
module.exports = { CONTEXT, sha256, key, relativePath, readManifest, eventPath, judge, unknownSkips, coverage, within };
