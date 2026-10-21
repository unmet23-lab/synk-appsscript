'use strict';
// Product QA evidence only: no scheduling, model calls, publishing or source edits.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const CODE = /\.(?:[cm]?js|json|html|css|glsl|wgsl)$/i;
const SKIP = new Set(['.git', '.local', 'node_modules', 'qa', 'artifacts', '__pycache__']);
const slash = value => value.replace(/\\/g, '/');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function localImports(source) {
  // Keep quoted strings intact while removing comments. Only literal local module
  // specifiers are followed; computed imports and package/remote modules are not guessed.
  const code = source.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g, (match, quoted) => quoted || ' ');
  const imports = [...code.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?(['"])(\.[^'"]+)\1/g),
    ...code.matchAll(/\b(?:import|require)\s*\(\s*(['"])(\.[^'"]+)\1\s*\)/g)];
  return [...new Set(imports.map(match => match[2].split(/[?#]/)[0]))];
}
function inside(root, file) {
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('QA source is outside its repository');
  return slash(relative);
}
function sourceSnapshot(root, inputs) {
  root = fs.realpathSync(root);
  const files = new Map(), missingDependencies = [];
  function visit(input, explicit = false) {
    const file = path.resolve(root, input), relative = inside(root, file);
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw Error('QA source links are unsupported: ' + relative);
    inside(root, fs.realpathSync(file));
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(file, { withFileTypes: true })) if (!SKIP.has(entry.name)) visit(path.join(relative, entry.name));
    } else if (stat.isFile() && (explicit || CODE.test(file)) && !files.has(relative)) {
      const bytes = fs.readFileSync(file); files.set(relative, { path: relative, bytes: bytes.length, sha256: hash(bytes) });
      if (/\.[cm]?js$/i.test(file)) for (const specifier of localImports(bytes.toString('utf8'))) {
        const candidate = path.resolve(path.dirname(file), specifier); inside(root, candidate);
        const resolved = [candidate, ...['.js', '.cjs', '.mjs', '.json'].map(ext => candidate + ext), ...['index.js', 'index.cjs', 'index.mjs', 'index.json'].map(name => path.join(candidate, name))]
          .find(item => fs.existsSync(item) && fs.statSync(item).isFile());
        if (resolved) visit(resolved, true);
        else missingDependencies.push({ from: relative, specifier });
      }
    }
  }
  if (!Array.isArray(inputs) || inputs.length === 0) throw Error('QA sources must be explicit');
  const normalized = [...new Set(inputs.map(input => inside(root, path.resolve(root, input))))].sort();
  for (const input of normalized) visit(input, true);
  const rows = [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  missingDependencies.sort((a, b) => (a.from + a.specifier).localeCompare(b.from + b.specifier, 'en'));
  return { inputs: normalized, scope: 'code-and-config', dependencyScope: 'literal-local-imports-and-requires', exclusions: [...SKIP], missingDependencies, files: rows, hash: hash(JSON.stringify({ files: rows, missingDependencies })) };
}
function readEvidence({ root, manifestPath }) {
  root = fs.realpathSync(root);
  const file = path.resolve(root, manifestPath);
  inside(root, file); inside(root, fs.realpathSync(file));
  if (fs.statSync(file).size > 8 * 1024 * 1024) throw Error('QA evidence is too large');
  const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (evidence.schemaVersion !== 1 || !Array.isArray(evidence.source?.inputs) || !Array.isArray(evidence.source?.files)) throw Error('Unsupported QA evidence');
  for (const input of evidence.source.inputs) inside(root, path.resolve(root, input));
  for (const item of evidence.source.files) {
    inside(root, path.resolve(root, item.path));
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('Invalid QA source hash');
  }
  return evidence;
}
function compareSnapshot(before, after) {
  const previous = new Map(before.files.map(row => [row.path, row.sha256]));
  const current = new Map(after.files.map(row => [row.path, row.sha256]));
  const changed = [], added = [], removed = [];
  for (const [file, value] of current) if (!previous.has(file)) added.push(file); else if (previous.get(file) !== value) changed.push(file);
  for (const file of previous.keys()) if (!current.has(file)) removed.push(file);
  const unresolvedChanged = JSON.stringify(before.missingDependencies || []) !== JSON.stringify(after.missingDependencies || []);
  return { state: changed.length || added.length || removed.length || unresolvedChanged ? 'stale' : 'fresh', changed, added, removed, missingDependencies: after.missingDependencies || [], checkedAt: new Date().toISOString(), sourceHash: after.hash };
}
function freshness({ root, manifestPath }) {
  try { const evidence = readEvidence({ root, manifestPath }); return compareSnapshot(evidence.source, sourceSnapshot(root, evidence.source.inputs)); }
  catch (error) { return { state: 'unavailable', checkedAt: new Date().toISOString(), reason: error.message }; }
}
function createQaRun({ root, label, sources, target = {}, synthetic = true, env = process.env }) {
  root = fs.realpathSync(root);
  if (!/^[a-z0-9][a-z0-9-]{0,70}$/.test(label)) throw Error('Invalid QA label');
  for (const input of sources || []) if (!fs.existsSync(path.resolve(root, input))) throw Error('Missing QA source: ' + input);
  const source = sourceSnapshot(root, sources);
  if (!source.files.length) throw Error('QA source scope is empty');
  const base = path.resolve(root, env.SYNK_QA_OUT || '.tmp/qa-runs');
  const relative = inside(root, base);
  if (relative !== '.tmp' && !relative.startsWith('.tmp/')) throw Error('QA output must be inside the repository .tmp directory');
  fs.mkdirSync(base, { recursive: true }); inside(path.join(root, '.tmp'), fs.realpathSync(base));
  const requested = env.SYNK_QA_RUN_ID || new Date().toISOString().replace(/[^0-9TZ]/g, '') + '-' + process.pid;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(requested)) throw Error('Invalid QA run ID');
  const out = fs.mkdtempSync(path.join(base, label + '-' + requested + '-'));
  const manifestPath = path.join(out, 'qa-evidence.json'), dataDirectory = path.join(out, 'data');
  fs.mkdirSync(dataDirectory);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 5000 });
  const evidence = { schemaVersion: 1, label, runId: path.basename(out), startedAt: new Date().toISOString(), finishedAt: null,
    status: 'running', target, syntheticAccount: Boolean(synthetic), liveProviderCalls: false,
    sourceVersion: { head: git.status === 0 ? git.stdout.trim() : null }, source,
    runtime: { dataDirectory: inside(root, dataDirectory) },
    limitations: ['Source freshness covers declared code/configuration and literal local module dependencies, not every media byte.', 'Computed module paths and remote/package dependencies are not inferred; missing literal dependencies are listed separately.', 'Synthetic browser QA does not establish real-device, listening or learner outcomes.'] };
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(evidence, null, 2) + '\n');
  save();
  return { out, dataDirectory, manifestPath, evidence,
    update({ target: nextTarget, runtime } = {}) { Object.assign(evidence.target, nextTarget); Object.assign(evidence.runtime, runtime); save(); },
    finish({ ok, checks = null, error = null } = {}) {
      evidence.status = ok ? 'passed' : 'failed'; evidence.finishedAt = new Date().toISOString();
      evidence.result = { ok: Boolean(ok), checks, ...(error ? { error: String(error) } : {}) };
      try { evidence.finishedSource = compareSnapshot(source, sourceSnapshot(root, source.inputs)); }
      catch (failure) { evidence.finishedSource = { state: 'unavailable', reason: failure.message }; }
      save(); return evidence;
    }
  };
}
if (require.main === module) {
  const [flag, manifestPath] = process.argv.slice(2);
  if (flag !== '--check' || !manifestPath) { console.error('Usage: node tools/lib/qa-evidence.cjs --check <qa-evidence.json>'); process.exitCode = 2; }
  else { const result = freshness({ root: path.resolve(__dirname, '../..'), manifestPath }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.state === 'fresh' ? 0 : result.state === 'stale' ? 1 : 2; }
}
module.exports = { createQaRun, sourceSnapshot, readEvidence, freshness };
