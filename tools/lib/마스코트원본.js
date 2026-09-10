'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'docs', 'Loom_자산', '옷');
const PLAN = path.join(ROOT, 'docs', '_ops', '마스코트_Drive이관_20260910', 'pack-plan.json');
let cachedPlan;
let cachedManaged;

function plan() {
  if (!cachedPlan) cachedPlan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  return cachedPlan;
}

function relative(file) {
  const absolute = path.resolve(file);
  const rel = path.relative(SOURCE, absolute);
  if (!rel || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function archivedFiles(prefix) {
  const clean = String(prefix).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return plan().packs.flatMap(pack => pack.files)
    .map(row => row.path)
    .filter(file => file === clean || file.startsWith(clean + '/'));
}

function isArchived(file) {
  const rel = relative(file);
  if (!rel) return false;
  if (!cachedManaged) cachedManaged = new Set(plan().packs.flatMap(pack => pack.files).map(row => row.path));
  return cachedManaged.has(rel);
}

function ensureFiles(files) {
  const wanted = [...new Set(files.map(relative).filter(Boolean))];
  const missing = wanted.filter(rel => isArchived(path.join(SOURCE, rel)) && !fs.existsSync(path.join(SOURCE, rel)));
  if (!missing.length) return { requested: wanted.length, restored: 0 };
  const run = spawnSync('python', ['-B', path.join(ROOT, 'tools', 'drive-mascot-archive.py'),
    'restore-many', ...missing], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  if (run.status !== 0) throw new Error((run.stderr || run.stdout || '마스코트 원본 복원 실패').trim());
  process.stdout.write(run.stdout);
  return { requested: wanted.length, restored: missing.length };
}

function names(folder) {
  const absolute = path.resolve(folder);
  const probe = relative(path.join(absolute, '_placeholder'));
  const local = fs.existsSync(absolute) ? fs.readdirSync(absolute) : [];
  if (!probe) return [...new Set(local)].sort();
  const rel = probe.replace(/\/_placeholder$/, '');
  const fromArchive = archivedFiles(rel).map(file => path.posix.basename(file));
  return [...new Set([...local, ...fromArchive])].sort();
}

module.exports = { archivedFiles, ensureFiles, isArchived, names };
