'use strict';
// Inspect the NSIS payload without executing the installer.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), qa = __dirname, desktop = path.join(root, 'desktop');
const asar = require(path.join(desktop, 'node_modules/@electron/asar'));
const { UUID } = require(path.join(desktop, 'node_modules/builder-util-runtime'));
const tool = path.join(process.env.LOCALAPPDATA, 'electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe');
const digest = b => crypto.createHash('sha256').update(b).digest('hex'), hash = f => digest(fs.readFileSync(f));
const read = f => JSON.parse(fs.readFileSync(path.join(qa, f)));
const json = (f, v) => fs.writeFileSync(path.join(qa, f), JSON.stringify(v, null, 2) + '\n');
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, ...(detail ? { detail } : {}) }); if (!ok) throw Error(name); };
const walk = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(e => {
  const item = path.join(rel, e.name); return e.isDirectory() ? walk(dir, item) : [item.replaceAll('\\', '/')];
}).sort();
const run = (args, log) => { const result = spawnSync(tool, args, { windowsHide: true, encoding: 'utf8', timeout: 300000 });
  fs.writeFileSync(path.join(qa, log + '.log'), (result.stdout || '') + (result.stderr || '')); check(log + '-exit0', result.status === 0 && !result.error); };
try {
  const result = read('package-result.json'), prep = read('preparation.json'), config = read('platform-builder-config.json');
  const installer = path.join(root, result.installer.path), unpacked = path.join(root, prep.prepackaged);
  const baseline = path.join(root, prep.baselineArchive), extraction = path.join(path.dirname(unpacked), 'extracted-payload');
  check('installer-pinned', hash(installer) === result.installer.sha256 && fs.statSync(installer).size === result.installer.bytes);
  run(['t', installer], 'installer-crc');
  check('fresh-payload-extraction', !fs.existsSync(extraction)); fs.mkdirSync(extraction, { recursive: true });
  run(['x', installer, '-o' + extraction, '-y'], 'payload-extraction');
  const actualFiles = walk(extraction), expectedFiles = walk(unpacked);
  check('payload-file-set', actualFiles.join('\n') === expectedFiles.join('\n'), { files: actualFiles.length });
  check('payload-bytes-equal-build', actualFiles.every(f => hash(path.join(extraction, f)) === hash(path.join(unpacked, f))));
  const oldPayload = read('baseline-payload.json').files, oldMap = new Map(oldPayload.map(f => [f.path, f.sha256]));
  check('payload-membership-preserved', actualFiles.join('\n') === oldPayload.map(f => f.path).sort().join('\n'));
  const changedPayload = actualFiles.filter(f => hash(path.join(extraction, f)) !== oldMap.get(f));
  check('only-app-asar-changed', changedPayload.join('\n') === 'resources/app.asar', changedPayload);
  const archive = path.join(extraction, 'resources/app.asar');
  check('payload-asar-matches-build', hash(archive) === result.asar.new);
  check('baseline-matches-installed-app', hash(baseline) === prep.baselineSha256 && hash(path.join(prep.installedProgram, 'resources/app.asar')) === prep.baselineSha256);
  const oldMembers = read('baseline-members.json').files, oldMembersMap = new Map(oldMembers.map(f => [f.path, f]));
  const archiveFiles = asar.listPackage(archive).map(f => f.replaceAll('\\', '/').replace(/^\//, '')).filter(f => !asar.statFile(archive, path.normalize(f)).files).sort();
  const expectedArchive = [...new Set([...oldMembers.map(f => f.path), ...result.changedMembers.map(f => f.path)])].sort();
  check('archive-membership-exactly-expected', archiveFiles.join('\n') === expectedArchive.join('\n'));
  const changed = [], added = [];
  for (const file of archiveFiles) {
    const actual = digest(asar.extractFile(archive, path.normalize(file))), old = oldMembersMap.get(file);
    if (!old) added.push(file); else if (old.sha256 !== actual) changed.push(file);
  }
  check('changed-members-exactly-approved', changed.join('\n') === result.changedMembers.filter(f => !f.added).map(f => f.path).sort().join('\n'), changed);
  check('added-members-exactly-approved', added.join('\n') === result.changedMembers.filter(f => f.added).map(f => f.path).sort().join('\n'), added);
  for (const file of result.changedMembers) check('overlay-bytes-' + file.path, digest(asar.extractFile(archive, path.normalize(file.path))) === file.after && hash(path.join(desktop, file.path)) === file.after);
  for (const file of ['runtime.json', 'package.json']) check(file + '-preserved', asar.extractFile(archive, file).equals(asar.extractFile(baseline, file)));
  check('all-main-process-source-preserved', oldMembers.filter(f => f.path.startsWith('src/')).every(f => digest(asar.extractFile(archive, path.normalize(f.path))) === f.sha256));
  check('executable-preserved', hash(path.join(extraction, 'SYNKPlatformPreview.exe')) === result.executable.sha256);
  const runtime = JSON.parse(asar.extractFile(archive, 'runtime.json'));
  for (const release of runtime.releases) { const file = path.join(extraction, 'resources/clients', release.installer.relativePath);
    check(release.id + '-child-installer-pin', hash(file) === release.installer.sha256 && fs.statSync(file).size === release.installer.bytes); }
  const oldConfig = JSON.parse(fs.readFileSync(path.join(root, 'docs/_ops/qa/platform-reinstall-worldbook-20261010/platform-builder-config.json')));
  const strip = c => JSON.stringify({ ...c, directories: undefined, win: { ...c.win, icon: undefined } });
  check('builder-settings-preserved', strip(config) === strip(oldConfig));
  check('same-nsis-registration', UUID.v5(config.appId, UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3')) === 'c4ee183e-8850-55ce-9d7f-a3a1acb8c830');
  check('user-data-preserving-nsis-policy', config.nsis.deleteAppDataOnUninstall === false && config.nsis.runAfterFinish === false && config.nsis.perMachine === false && config.nsis.allowElevation === false);
  check('no-public-publish', result.publish === 'never' && result.publicUpload === false && config.publish === null);
  const files = actualFiles.map(file => ({ path: file, bytes: fs.statSync(path.join(extraction, file)).size, sha256: hash(path.join(extraction, file)) }));
  json('payload-manifest.json', { preparedAt: new Date().toISOString(), source: 'Extracted verified NSIS payload', files });
  json('verification.json', { completedAt: new Date().toISOString(), ok: true, checksPassed: checks.length, checks, payloadFiles: files.length, installer: result.installer, installerExecuted: false, publicUpload: false });
  console.log(JSON.stringify({ ok: true, checks: checks.length, payloadFiles: files.length, changedMembers: changed, addedMembers: added }));
} catch (error) {
  json('verification.json', { completedAt: new Date().toISOString(), ok: false, error: error.message, checks });
  console.error(error.stack || error.message); process.exitCode = 1;
}
