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
  validCommit(commit); const { state } = config;
  if (['released.json', 'releasing.lock', ...RELEASED.map(name => `${name}.releasing`)].some(name => fs.existsSync(path.join(state, name))))
    throw Error('This candidate state was released or is being released; prepare a new one');
  const root = clone(config);
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
// A candidate state checks one commit plus an overlay beside the scheduled worker, sharing its hashed blobs through a junction.
// Its checkout, Talk pairs and node_modules are 4-6GB and rebuildable (git objects, blobs, overlay source, lock files);
// 11-02 two finished candidates were left at 6.4GB each, so release() removes them once the run folder holds the evidence.
function candidate({ original, state, commit, overlay }) {
  original = path.resolve(original); state = path.resolve(state);
  if (!overlay?.root || !overlay.files?.length) throw Error('A candidate needs an overlay');
  const source = loadConfig(original);
  if (fs.existsSync(state)) throw Error('Use a new candidate state');
  write(path.join(state, 'owner.json'), { version: 1, purpose: 'synk-conditional-qa', state });
  const config = { ...source, state, root: path.join(state, 'workspace/SYNK-appsscript') };
  write(path.join(state, 'config.json'), config); write(path.join(state, 'inputs.json'), read(path.join(original, 'inputs.json')));
  fs.symlinkSync(path.join(original, 'blobs'), path.join(state, 'blobs'), 'junction');
  // Provisional context first: a failed clone, fetch or npm ci still leaves a state that release() and the space guard can free.
  write(path.join(state, 'context.json'), { version: 1, root: config.root, candidate: true, incomplete: true, pinned: [] });
  return prepare(config, commit, { overlay });
}
async function withCandidate(options, run) {
  // The usual path: the candidate lives exactly as long as one run, whose evidence goes to a folder outside the state.
  const state = path.resolve(options.state);
  if (fs.existsSync(state)) throw Error('Use a new candidate state');
  try { return await run(candidate(options)); }
  finally { try { if (fs.existsSync(path.join(state, 'context.json'))) release(state); } catch (error) { console.error(`Candidate not released (the space guard retries): ${error.message}`); } }
}
const RELEASED = ['workspace', 'homework', 'tools', 'empty-hooks'], SCANNED = '.cqa-scanned';
const isLink = entry => { try { return fs.lstatSync(entry).isSymbolicLink(); } catch { return false; } };
function unlink(entry) { try { fs.unlinkSync(entry); } catch { fs.rmdirSync(entry); } } // a directory junction goes with rmdir, never its target
function removeTree(top) {
  // Links (junctions to the shared blobs or the sibling checkout) are cut, never entered. The scanned marker goes last,
  // so a folder that is still partly there is never mistaken for one whose kept/ was not written yet.
  let bytes = 0; const left = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (dir === top && entry.name === SCANNED) continue;
      try {
        if (entry.isSymbolicLink() || isLink(file)) unlink(file);
        else if (entry.isDirectory()) { walk(file); fs.rmdirSync(file); }
        else { const size = fs.lstatSync(file).size; try { fs.unlinkSync(file); } catch { fs.chmodSync(file, 0o666); fs.unlinkSync(file); } bytes += size; }
      } catch (error) { if (left.length < 20) left.push(`${path.relative(top, file)}: ${error.code || error.message}`); }
    }
  })(top);
  if (!left.length) try { fs.rmSync(path.join(top, SCANNED), { force: true }); fs.rmdirSync(top); } catch (error) { left.push(`.: ${error.code || error.message}`); }
  return { bytes, left };
}
function pinnedHashes(state, context) {
  // inputs.json lists every hashed input by area, so a candidate whose prepare() never finished still knows them.
  const rows = new Map(), add = (rel, sha) => { const key = rel.toLowerCase(); rows.set(key, new Set([...(rows.get(key) || []), sha])); };
  for (const row of context.pinned || []) add(path.relative(state, row.file).split(path.sep).join('/'), row.sha256);
  const areas = { app: 'workspace/SYNK-appsscript', talk: 'workspace/SYNK-talk', homework: 'homework/SYNK-talk', tools: 'tools' };
  try { for (const row of read(path.join(state, 'inputs.json')).files) if (areas[row.area]) add(`${areas[row.area]}/${row.file}`, row.sha256); } catch {}
  return rows;
}
function unexpectedFiles(state, context, moved, tops) {
  // Everything outside git objects, pinned blobs and lock-file installs: test output or a hand-made fixture. It is moved to kept/, not deleted.
  const pinned = pinnedHashes(state, context);
  const own = rel => { const [top, ...rest] = rel.split('/'); return path.join(moved[top] || path.join(state, top), ...rest); };
  // A pinned path only counts as rebuildable while its bytes still match the blob it came from.
  const intact = rel => { try { return pinned.get(rel.toLowerCase()).has(hashFile(own(rel))); } catch { return false; } };
  const found = [], skip = rel => rel.split('/').includes('node_modules') || (pinned.has(rel.toLowerCase()) && intact(rel));
  const app = 'workspace/SYNK-appsscript', appRoot = own(app);
  // Nothing reached through a link is ours to move: a junction to another checkout or folder is only cut later.
  const viaLink = rel => rel.split('/').some((_, n, parts) => n < parts.length - 1 && isLink(own(parts.slice(0, n + 1).join('/'))));
  const checkout = tops.includes('workspace') && fs.existsSync(appRoot) && !isLink(appRoot) && !viaLink(app + '/x');
  if (checkout && !fs.existsSync(path.join(appRoot, '.git'))) throw Error('Candidate checkout has no git metadata; tracked files cannot be told apart');
  function walk(rel) {
    if (isLink(own(rel))) return; // a linked top folder or ignored folder points outside the candidate
    let entries; try { entries = fs.readdirSync(own(rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const child = `${rel}/${entry.name}`;
      if (child === app || entry.isSymbolicLink() || isLink(own(child)) || skip(child)) continue;
      if (entry.isDirectory()) walk(child); else found.push(child);
    }
  }
  if (checkout) {
    const fields = git(appRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching'], { encoding: 'buffer', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).toString('utf8').split('\0'); // untrimmed: a leading " M" is a status code
    for (let n = 0; n < fields.length; n++) {
      const field = fields[n]; if (!field) continue;
      const code = field.slice(0, 2), rel = `${app}/${field.slice(3).replace(/\/$/, '')}`;
      if (/[RC]/.test(code)) n++;
      if (code.includes('D') || skip(rel)) continue;
      // An ignored folder is listed whole; a pinned render inside it must not keep gigabytes alive.
      if (field.endsWith('/')) walk(rel); else found.push(rel);
    }
  }
  // The Talk pairs, tools and hooks are not git checkouts: every file there must be a pinned blob or a lock-file install.
  for (const top of tops) walk(top);
  return found.filter(rel => !viaLink(rel)).map(rel => ({ rel, from: own(rel) }));
}
function releasable(state) {
  state = path.resolve(state); assertOwned(state);
  const context = read(path.join(state, 'context.json'));
  if (context.candidate !== true || ['installation.json', 'queue.json', 'runs'].some(name => fs.existsSync(path.join(state, name)))) throw Error('Only a candidate state can be released, never the scheduled worker state');
  if (path.resolve(context.root) !== path.resolve(state, 'workspace/SYNK-appsscript')) throw Error('Invalid candidate context');
  return { state, context };
}
function releasePreview(state) {
  const { context } = releasable(state); state = path.resolve(state);
  if (fs.existsSync(path.join(state, 'released.json'))) return { released: true };
  const tops = RELEASED.filter(name => fs.existsSync(path.join(state, name)) && !isLink(path.join(state, name)));
  return { released: false, remove: tops, kept: unexpectedFiles(state, context, {}, tops).map(row => row.rel) };
}
function keptFiles(state) {
  const found = [];
  (function walk(rel) {
    let entries; try { entries = fs.readdirSync(path.join(state, 'kept', rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) { const child = rel ? `${rel}/${entry.name}` : entry.name; if (entry.isDirectory() && !entry.isSymbolicLink()) walk(child); else found.push(child); }
  })('');
  return found.sort();
}
function release(state) {
  const { context } = releasable(state); state = path.resolve(state);
  if (fs.existsSync(path.join(state, 'released.json'))) return read(path.join(state, 'released.json'));
  // One release at a time: the space guard and a GPT script may both call it. A lock left by a dead process is taken over.
  const lock = path.join(state, 'releasing.lock');
  try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = Number(fs.readFileSync(lock, 'utf8'));
    let alive = false; try { process.kill(owner, 0); alive = true; } catch (probe) { alive = probe.code === 'EPERM'; }
    if (alive) throw Error('Another release of this candidate is running');
    fs.writeFileSync(lock, String(process.pid));
  }
  try {
    // A folder renamed earlier carries SCANNED once its kept/ is complete; one without it, or one renamed now, is scanned now.
    const resumed = name => fs.existsSync(path.join(state, `${name}.releasing`)) && !fs.existsSync(path.join(state, name));
    const needsScan = name => resumed(name) ? !fs.existsSync(path.join(state, `${name}.releasing`, SCANNED)) : fs.existsSync(path.join(state, name)) && !isLink(path.join(state, name));
    // Before renaming anything: a checkout that still has to be scanned must still have its git metadata.
    if (needsScan('workspace')) {
      const app = path.join(state, resumed('workspace') ? 'workspace.releasing' : 'workspace', 'SYNK-appsscript');
      if (fs.existsSync(app) && !isLink(app) && !fs.existsSync(path.join(app, '.git'))) throw Error('Candidate checkout has no git metadata; tracked files cannot be told apart');
    }
    // Renaming fails on Windows while a process still has a file or its working directory inside, so a running candidate is refused.
    const moved = {}, tops = [], renamed = [];
    for (const name of RELEASED) {
      const from = path.join(state, name), to = `${from}.releasing`;
      if (resumed(name)) { moved[name] = to; if (needsScan(name)) tops.push(name); continue; }
      if (!fs.existsSync(from) || isLink(from)) continue;
      try { fs.renameSync(from, to); moved[name] = to; tops.push(name); renamed.push(name); }
      catch (error) { for (const back of renamed) fs.renameSync(moved[back], path.join(state, back)); throw Error(`Candidate is still in use (${name}: ${error.code})`); }
    }
    if (tops.length) {
      for (const { rel, from } of unexpectedFiles(state, context, moved, tops)) {
        // An earlier interrupted call may already have kept a file at this path: never overwrite it, keep both.
        let to = path.join(state, 'kept', rel); for (let n = 2; fs.existsSync(to); n++) to = `${path.join(state, 'kept', rel)}.${n}`;
        fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to);
      }
      for (const name of tops) fs.writeFileSync(path.join(moved[name], SCANNED), new Date().toISOString());
    }
    if (isLink(path.join(state, 'blobs'))) unlink(path.join(state, 'blobs'));
    let bytes = 0; const left = [];
    for (const [name, at] of Object.entries(moved)) { const done = removeTree(at); bytes += done.bytes; left.push(...done.left.map(row => `${name}/${row}`)); }
    const receipt = { version: 1, at: new Date().toISOString(), removed: Object.keys(moved), bytes, kept: keptFiles(state), left };
    // Locked leftovers keep the state open: the next call, or the space guard, finishes deleting them.
    if (left.length) write(path.join(state, 'release-left.json'), receipt);
    else { write(path.join(state, 'released.json'), receipt); fs.rmSync(path.join(state, 'release-left.json'), { force: true }); }
    return receipt;
  } finally { fs.rmSync(lock, { force: true }); }
}
module.exports = { read, write, git, hashFile, provision, loadConfig, clone, prepare, postcheck, materialize, verifyBlob, dependencyInstall, assertOwned, candidate, withCandidate, release, releasePreview };
if (require.main === module) {
  const [command, state, flag] = process.argv.slice(2);
  if (command !== 'release' || !state) { console.error('usage: node tools/conditional-qa/inputs.cjs release <candidate state> [--preview]'); process.exitCode = 2; }
  else try { console.log(JSON.stringify(flag === '--preview' ? releasePreview(state) : release(state))); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
