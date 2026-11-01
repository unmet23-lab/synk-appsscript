'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { sha256, relativePath, within } = require('./contract.cjs');
const { REPO, validCommit } = require('./github.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.writing', JSON.stringify(value, null, 2) + '\n'); fs.renameSync(file + '.writing', file); }
function git(root, args, options = {}) { const result = cp.execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20, ...options }); return Buffer.isBuffer(result) ? result : result.trim(); }
function assertOwned(state) { const marker = read(path.join(state, 'owner.json')); if (marker.version !== 1 || marker.purpose !== 'synk-conditional-qa' || path.resolve(marker.state) !== path.resolve(state)) throw Error('Private QA directory is not owned by this worker'); }
function hashFile(file) { return sha256(fs.readFileSync(file)); }
function provision({ state, audit, originalWorktree, sourceRepo, talkRepo, caddy, cryptoModule }) {
  state = path.resolve(state); sourceRepo = path.resolve(sourceRepo);
  if (within(sourceRepo, state) || state === sourceRepo) throw Error('Private QA inputs cannot be stored in the public repository');
  if (fs.existsSync(state)) assertOwned(state);
  else { fs.mkdirSync(state, { recursive: true }); write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state }); }
  const catalog = [];
  function add(area, file, source, expected) {
    relativePath(file);
    const data = fs.readFileSync(source), sha = sha256(data);
    if (expected && sha !== expected) throw Error(`Original evidence has changed: ${area}/${file}`);
    const blob = path.join(state, 'blobs', sha);
    fs.mkdirSync(path.dirname(blob), { recursive: true });
    if (!fs.existsSync(blob)) fs.writeFileSync(blob, data, { flag: 'wx' });
    else if (hashFile(blob) !== sha) throw Error('Immutable input blob changed');
    catalog.push({ area, file, sha256: sha, bytes: data.length, source });
  }
  for (const row of read(path.join(audit, 'prepared-inputs.json')).records) {
    if (!within(originalWorktree, row.destination)) throw Error('Audit input escapes its original workspace');
    const file = path.relative(originalWorktree, row.destination).split(path.sep).join('/');
    if (file.endsWith('.wasm') && file.includes('/rust/target/')) continue; // Hosted CI compiles current Rust source.
    add('app', file, row.source, row.sha256);
  }
  // Previously the worktree found these via git-common-dir. A genuinely separate clone needs pinned copies.
  for (const name of ['full-a-v14.mp4', 'full-a-v14_final.mp4']) {
    const file = `docs/마케팅/yuhobuilds_세션공유_20261017/remotion/out/${name}`;
    add('app', file, path.join(sourceRepo, file));
  }
  const local = read(path.join(audit, 'talk-local-inputs.json'));
  for (const row of local.records) add('talk', row.file.replaceAll('\\', '/'), path.join(audit, 'local-pair/SYNK-talk', row.file), row.sha256);
  const homework = read(path.join(audit, 'talk-homework-inputs.json'));
  for (const row of homework.records) add('homework', row.file.replaceAll('\\', '/'), path.join(audit, 'homework-pair/SYNK-talk', row.file), row.sha256);
  add('tools', 'caddy.exe', caddy); add('tools', 'crypto.cjs', cryptoModule);
  const manifest = { version: 1, createdAt: new Date().toISOString(), frozenCommit: read(path.join(audit, 'prepared-inputs.json')).frozenCommit,
    talkCommit: local.sourceCommit, homeworkCommit: homework.commit, files: catalog };
  write(path.join(state, 'inputs.json'), manifest);
  const config = { version: 1, repo: REPO, state, sourceRepo, talkRepo: path.resolve(talkRepo), root: path.join(state, 'workspace/SYNK-appsscript') };
  write(path.join(state, 'config.json'), config);
  return { files: catalog.length, bytes: catalog.reduce((sum, row) => sum + row.bytes, 0), inputDigest: sha256(JSON.stringify(manifest)) };
}
function loadConfig(state) { assertOwned(state); const config = read(path.join(state, 'config.json')); if (config.version !== 1 || config.repo !== REPO || path.resolve(config.state) !== path.resolve(state) || path.resolve(config.root) !== path.resolve(state, 'workspace/SYNK-appsscript')) throw Error('Invalid worker configuration'); return config; }
function clone(config) {
  const { root, state } = config; assertOwned(state);
  if (!fs.existsSync(path.join(root, '.git'))) {
    if (fs.existsSync(root) && fs.readdirSync(root).length) throw Error('Refusing to overwrite an existing checkout');
    fs.mkdirSync(path.dirname(root), { recursive: true });
    git(path.dirname(root), ['clone', '--shared', '--no-checkout', config.sourceRepo, root]);
    const hooks = path.join(state, 'empty-hooks'); fs.mkdirSync(hooks, { recursive: true });
    git(root, ['config', 'core.hooksPath', hooks]); git(root, ['config', 'core.autocrlf', 'true']);
    git(root, ['config', 'core.longpaths', 'true']);
    git(root, ['remote', 'set-url', 'origin', `https://github.com/${REPO}.git`]);
    git(root, ['sparse-checkout', 'set', '--no-cone', '--stdin'], { input: '/*\n!/docs/캐릭터/\n!/docs/홍보물/\n!/docs/라디오/\n' });
  }
  if (git(root, ['remote', 'get-url', 'origin']).toLowerCase() !== `https://github.com/${REPO}.git`.toLowerCase()) throw Error('Unexpected validation remote');
  if (!fs.existsSync(path.join(root, '.git/index'))) {
    git(root, ['read-tree', '-mu', 'HEAD']);
  }
  return root;
}
function verifyBlob(state, row) {
  if (!/^[a-f0-9]{64}$/.test(row.sha256)) throw Error('Invalid input hash');
  relativePath(row.file);
  const source = path.join(state, 'blobs', row.sha256);
  if (hashFile(source) !== row.sha256) throw Error(`Input mismatch: ${row.area}/${row.file}`);
  return source;
}
function materialize(state, rows, target, { tracked = new Set() } = {}) {
  const copied = [];
  for (const row of rows) {
    const source = verifyBlob(state, row), destination = path.join(target, row.file);
    if (!within(target, destination)) throw Error('Input escapes target');
    // Current tracked source always wins over a historical compatibility fixture.
    if (tracked.has(row.file)) continue;
    if (fs.existsSync(destination)) { if (hashFile(destination) !== row.sha256) throw Error(`Existing fixture changed: ${row.file}`); }
    else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL); }
    copied.push({ file: destination, sha256: row.sha256 });
  }
  return copied;
}
function dependencyInstall(folder, state) {
  const lock = path.join(folder, 'package-lock.json');
  if (!fs.existsSync(lock)) throw Error('Reproducible dependencies require a lock file');
  const digest = sha256(fs.readFileSync(lock)), receipt = path.join(folder, 'node_modules/.conditional-qa-lock');
  if (fs.existsSync(receipt) && fs.readFileSync(receipt, 'utf8') === digest) return;
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!fs.existsSync(npm)) throw Error('npm-cli.js was not found beside Node');
  const env = { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };
  for (const key of Object.keys(env)) if (/^(?:GH_TOKEN|GITHUB_TOKEN|SYNK_)/.test(key)) delete env[key];
  const fd = fs.openSync(path.join(state, 'dependency-install.log'), 'a');
  try { cp.execFileSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: folder, env, windowsHide: true, timeout: 600_000, stdio: ['ignore', fd, fd] }); }
  finally { fs.closeSync(fd); }
  fs.writeFileSync(receipt, digest);
}
function siblingLink(pair, root) {
  const link = path.join(pair, 'SYNK-appsscript');
  if (fs.existsSync(link)) { if (fs.realpathSync(link).toLowerCase() !== fs.realpathSync(root).toLowerCase()) throw Error('Unexpected sibling workspace link'); }
  else fs.symlinkSync(root, link, 'junction');
}
function postcheck(context) {
  for (const row of context.pinned) if (hashFile(row.file) !== row.sha256) throw Error('A validation input changed during execution');
  return true;
}
function prepare(config, commit, { overlay, refreshTalk = true } = {}) {
  validCommit(commit); const { state } = config, root = clone(config);
  if (git(root, ['status', '--porcelain', '--untracked-files=no'])) throw Error('Validation checkout has modified tracked files');
  git(root, ['checkout', '--detach', commit]);
  const manifest = read(path.join(state, 'inputs.json'));
  const tracked = new Set(git(root, ['ls-files', '-z']).split('\0'));
  const pinned = materialize(state, manifest.files.filter(row => row.area === 'app'), root, { tracked });
  const pair = path.join(state, 'workspace'), localTalk = path.join(pair, 'SYNK-talk'), homeworkTalk = path.join(state, 'homework/SYNK-talk');
  // The runtime and homework snapshots are explicit compatibility inputs from the completed audit.
  pinned.push(...materialize(state, manifest.files.filter(row => row.area === 'talk'), localTalk));
  pinned.push(...materialize(state, manifest.files.filter(row => row.area === 'homework'), homeworkTalk));
  pinned.push(...materialize(state, manifest.files.filter(row => row.area === 'tools'), path.join(state, 'tools')));
  siblingLink(path.dirname(homeworkTalk), root);
  // This one comparison is against the real current backend scope, not a copied frontend table.
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)unmet23-lab\/SYNK-talk(?:\.git)?$/i.test(git(config.talkRepo, ['remote', 'get-url', 'origin']))) throw Error('Unexpected Talk source remote');
  if (refreshTalk) git(config.talkRepo, ['fetch', 'origin', 'master']);
  const talkCommit = git(config.talkRepo, ['rev-parse', 'refs/remotes/origin/master']); validCommit(talkCommit);
  const scope = git(config.talkRepo, ['show', `${talkCommit}:lib/town-scope.js`], { encoding: 'buffer' });
  const scopePath = path.join(localTalk, 'lib/town-scope.js');
  fs.mkdirSync(path.dirname(scopePath), { recursive: true }); fs.writeFileSync(scopePath, scope);
  pinned.push({ file: scopePath, sha256: sha256(scope) });
  if (overlay) for (const file of overlay.files) { relativePath(file); const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(overlay.root, file), dest); }
  dependencyInstall(root, state); dependencyInstall(localTalk, state); dependencyInstall(homeworkTalk, state);
  const context = { version: 1, root, localTalk, homeworkTalk, candidate: Boolean(overlay), pinned, talkCommit,
    inputDigest: sha256(JSON.stringify({ manifest, talkCommit, scopeHash: sha256(scope) })),
    env: { SYNK_QA_CADDY: path.join(state, 'tools/caddy.exe'), SYNK_QA_CRYPTO_MODULE: path.join(state, 'tools/crypto.cjs'),
      NODE_PATH: [path.join(localTalk, 'node_modules'), path.join(root, 'node_modules')].join(path.delimiter) } };
  write(path.join(state, 'context.json'), context); return context;
}
module.exports = { read, write, git, hashFile, provision, loadConfig, clone, prepare, postcheck, materialize, verifyBlob, dependencyInstall, assertOwned };
