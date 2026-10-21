'use strict';
// Read the installed application only. Copy the pinned program payload into a new
// staging folder; do not read the normal user profile, close apps, or install.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const qa = __dirname;
const desktop = path.join(root, 'desktop');
const asar = require(path.join(desktop, 'node_modules/@electron/asar'));
const previous = path.join(root, 'docs/_ops/qa/platform-reinstall-worldbook-20261010');
const installed = path.join(process.env.LOCALAPPDATA, 'Programs/SYNKPlatformPreview');
const output = path.join(root, '.tmp/platform-pulse-20261011/platform');
const stage = path.join(output, 'stage');
const unpacked = path.join(output, 'win-unpacked');
const baseline = path.join(output, 'baseline-app.asar');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const hash = f => digest(fs.readFileSync(f));
const json = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const assert = (ok, message) => { if (!ok) throw Error(message); };
const relative = f => path.relative(root, f).replaceAll('\\', '/');
try {
  assert(!fs.existsSync(output), 'Preserve existing preparation; output already exists');
  const previousResult = JSON.parse(fs.readFileSync(path.join(previous, 'package-result.json')));
  const previousPayload = JSON.parse(fs.readFileSync(path.join(previous, 'payload-manifest.json')));
  const installedAsar = path.join(installed, 'resources/app.asar');
  const baselineSha = hash(installedAsar);
  assert(baselineSha === previousResult.asar.new, 'Installed app is no longer the verified WORLD-book baseline');
  const files = previousPayload.files.map(f => {
    const source = path.resolve(installed, f.path);
    assert(source.startsWith(installed + path.sep), 'Payload path outside program folder');
    assert(!fs.lstatSync(source).isSymbolicLink(), 'Payload link is not allowed: ' + f.path);
    assert(hash(source) === f.sha256 && fs.statSync(source).size === f.bytes, 'Installed baseline changed: ' + f.path);
    return f;
  });
  const processes = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
    "@(Get-CimInstance Win32_Process -Filter \"Name='SYNKPlatformPreview.exe'\" | Select-Object ProcessId,Name,ExecutablePath) | ConvertTo-Json -Compress"],
    { encoding: 'utf8', windowsHide: true }) || '[]');
  fs.mkdirSync(unpacked, { recursive: true });
  for (const file of files) {
    const target = path.join(unpacked, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(installed, file.path), target);
    assert(hash(target) === file.sha256, 'Copied payload differs: ' + file.path);
  }
  fs.copyFileSync(installedAsar, baseline);
  asar.extractAll(baseline, stage);
  const members = asar.listPackage(baseline).map(f => f.replaceAll('\\', '/').replace(/^\//, '')).sort();
  const sourceComparison = [];
  const baselineMembers = [];
  for (const member of members) {
    const file = path.join(stage, member);
    if (!fs.statSync(file).isFile()) continue;
    const bytes = asar.extractFile(baseline, path.normalize(member));
    assert(bytes.equals(fs.readFileSync(file)), 'Extracted member differs: ' + member);
    const installedHash = digest(bytes);
    baselineMembers.push({ path: member, bytes: bytes.length, sha256: installedHash });
    const source = path.join(desktop, member);
    const sourceHash = fs.existsSync(source) && fs.statSync(source).isFile() ? hash(source) : null;
    if (sourceHash !== installedHash) sourceComparison.push({ path: member, installed: installedHash, source: sourceHash });
  }
  assert(hash(installedAsar) === baselineSha, 'Installed app changed during preparation');
  const previousConfig = JSON.parse(fs.readFileSync(path.join(previous, 'platform-builder-config.json')));
  const config = { ...previousConfig, directories: { app: stage, output: path.join(output, 'dist'), buildResources: path.join(stage, 'assets') },
    win: { ...previousConfig.win, icon: path.join(stage, 'assets/platform.ico') } };
  json(path.join(qa, 'platform-builder-config.json'), config);
  json(path.join(qa, 'baseline-members.json'), { files: baselineMembers });
  json(path.join(qa, 'baseline-payload.json'), { files });
  const result = { preparedAt: new Date().toISOString(), ok: true, baselineSha256: baselineSha,
    installedProgram: installed, baselineArchive: relative(baseline), stage: relative(stage), prepackaged: relative(unpacked),
    payloadFiles: files.length, archiveFiles: baselineMembers.length, sourceComparison, processes,
    sourceChangesCopied: false, installedProgramModified: false, processesTerminated: false,
    normalProfileRead: false, vaultRead: false, publicUpload: false };
  json(path.join(qa, 'preparation.json'), result);
  console.log(JSON.stringify({ ok: true, baselineSha256: baselineSha, stage: result.stage,
    payloadFiles: result.payloadFiles, archiveFiles: result.archiveFiles, sourceDifferences: sourceComparison.map(f => f.path),
    runningPlatformProcesses: Array.isArray(processes) ? processes.length : (processes ? 1 : 0) }));
} catch (error) {
  json(path.join(qa, 'preparation-failure.json'), { at: new Date().toISOString(), error: error.message });
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
