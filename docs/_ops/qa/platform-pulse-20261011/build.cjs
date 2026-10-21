'use strict';
// Package only the explicitly listed UI files over the installed baseline.
// This creates a personal NSIS installer; it does not close apps or install.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..'), desktop = path.join(root, 'desktop'), qa = __dirname;
const asar = require(path.join(desktop, 'node_modules/@electron/asar'));
const { build, Platform, Arch } = require(path.join(desktop, 'node_modules/electron-builder'));
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const hash = f => digest(fs.readFileSync(f));
const assert = (ok, message) => { if (!ok) throw Error(message); };
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const readJson = f => JSON.parse(fs.readFileSync(path.join(qa, f)));
const walk = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(e => {
  const item = path.join(rel, e.name); return e.isDirectory() ? walk(dir, item) : [item.replaceAll('\\', '/')];
}).sort();
(async () => {
  assert(!fs.existsSync(path.join(qa, 'package-result.json')), 'Preserve earlier build result');
  const prep = readJson('preparation.json'), config = readJson('platform-builder-config.json');
  const plan = readJson('overlay.json');
  const stage = path.join(root, prep.stage), unpacked = path.join(root, prep.prepackaged);
  const baseline = path.join(root, prep.baselineArchive), archive = path.join(unpacked, 'resources/app.asar');
  const installed = path.join(prep.installedProgram, 'resources/app.asar');
  assert(prep.ok && hash(baseline) === prep.baselineSha256 && hash(installed) === prep.baselineSha256, 'Installed baseline changed');
  assert(Array.isArray(plan.files) && plan.files.length > 0 && new Set(plan.files).size === plan.files.length, 'Overlay must list unique UI files');
  assert(!fs.existsSync(config.directories.output), 'Preserve earlier output');
  const oldMembers = readJson('baseline-members.json').files;
  assert(walk(stage).join('\n') === oldMembers.map(f => f.path).sort().join('\n'), 'Stage membership changed before overlay');
  for (const file of oldMembers) assert(hash(path.join(stage, file.path)) === file.sha256, 'Stage baseline differs: ' + file.path);
  const changes = [];
  for (const rel of plan.files) {
    assert(typeof rel === 'string' && /^(renderer\/|assets\/)/.test(rel) && !rel.includes('..') && !rel.includes('\\'), 'Overlay outside UI scope: ' + rel);
    const source = path.join(desktop, rel), target = path.join(stage, rel);
    assert(fs.existsSync(source) && fs.statSync(source).isFile() && !fs.lstatSync(source).isSymbolicLink(), 'Overlay source missing or link: ' + rel);
    const before = fs.existsSync(target) ? hash(target) : null;
    const after = hash(source);
    assert(before !== after, 'Overlay contains unchanged file: ' + rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    changes.push({ path: rel, before, after, added: before === null, bytes: fs.statSync(target).size });
  }
  fs.unlinkSync(archive);
  await asar.createPackage(stage, archive);
  asar.uncache(archive);
  const newFiles = walk(stage), expected = [...new Set([...oldMembers.map(f => f.path), ...plan.files])].sort();
  assert(newFiles.join('\n') === expected.join('\n'), 'Unexpected archive membership');
  const changeMap = new Map(changes.map(f => [f.path, f]));
  for (const file of oldMembers) {
    const actual = digest(asar.extractFile(archive, path.normalize(file.path)));
    assert(actual === (changeMap.get(file.path)?.after || file.sha256), 'Unexpected member bytes: ' + file.path);
  }
  for (const file of changes) assert(digest(asar.extractFile(archive, path.normalize(file.path))) === file.after, 'Overlay package mismatch: ' + file.path);
  const executable = path.join(unpacked, config.executableName + '.exe'), exeSha = hash(executable), asarSha = hash(archive);
  const artifacts = await build({ projectDir: stage, prepackaged: unpacked, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), config, publish: 'never' });
  assert(hash(executable) === exeSha && hash(archive) === asarSha, 'Builder modified payload');
  const installer = artifacts.find(f => f.endsWith('.exe'));
  assert(installer && fs.statSync(installer).size > 1000000, 'Installer missing');
  const result = { completedAt: new Date().toISOString(), ok: true, basis: 'Installed WORLD-book Platform payload', changedMembers: changes,
    asar: { previous: prep.baselineSha256, new: asarSha, fileCount: newFiles.length, added: changes.filter(f => f.added).map(f => f.path) },
    executable: { sha256: exeSha, sameAsPrevious: true },
    installer: { path: path.relative(root, installer).replaceAll('\\', '/'), sha256: hash(installer), bytes: fs.statSync(installer).size, executed: false },
    unchanged: ['SYNKPlatformPreview.exe', 'resources/synk-install.json', 'resources/clients/world.exe', 'resources/clients/messenger.exe', 'runtime.json', 'package.json', 'src/**'],
    version: '0.4.0', appId: config.appId, publish: 'never', publicUpload: false, installerExecuted: false };
  json(path.join(qa, 'package-result.json'), result);
  console.log(JSON.stringify({ ok: true, installer: result.installer, changedMembers: changes.map(f => f.path), asar: asarSha }));
})().catch(error => {
  json(path.join(qa, 'build-failure.json'), { at: new Date().toISOString(), message: error.message });
  console.error(error.stack || error.message); process.exitCode = 1;
});
