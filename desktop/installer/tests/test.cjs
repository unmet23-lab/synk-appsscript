'use strict';

// This harness builds a tiny, uniquely identified installer. It never installs,
// uninstalls or rewrites the real SYNK Platform registration or application.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { createRequire } = require('node:module');

const repo = path.resolve(__dirname, '../../..');
const installerRoot = path.resolve(__dirname, '..');
const get = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
const builderRoot = path.resolve(get('builder') || path.join(repo, '.tmp/platform-performance-20261012/policy/.github/desktop-preview'));
const dependencies = createRequire(path.join(builderRoot, 'package.json'));
const assert = (value, message) => { if (!value) throw new Error(message); };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function execute(file, args, options = {}) {
  const result = cp.spawnSync(file, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 8e6, ...options });
  assert(!result.error && result.status === 0, 'Command failed: ' + path.basename(file) + '\n' + (result.error || result.stderr || result.stdout));
  return result.stdout;
}

async function prepare() {
  assert(process.platform === 'win32', 'Native Windows is required for the installer integration test.');
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const guid = crypto.randomUUID();
  const name = 'SYNKSignalFixture' + token;
  const directory = path.join(repo, '.tmp', 'signal-installer-test-' + token);
  assert(!fs.existsSync(directory), 'Refusing to reuse an existing test directory.');
  fs.mkdirSync(directory, { recursive: true });
  const payload = path.join(directory, 'payload');
  const project = path.join(directory, 'project');
  const output = path.join(directory, 'backend');
  fs.mkdirSync(path.join(payload, 'resources'), { recursive: true });
  fs.mkdirSync(project);
  json(path.join(project, 'package.json'), { name: name.toLowerCase(), version: '0.0.1', private: true, author: 'SYNK', description: 'Isolated signal installer acceptance fixture', main: 'index.js' });
  fs.writeFileSync(path.join(project, 'index.js'), '// Fixture; no Electron runtime is executed.\n');
  const fixtureSource = path.join(directory, 'Fixture.cs');
  fs.writeFileSync(fixtureSource, `using System; using System.IO; using System.Threading;
class Fixture { [STAThread] static int Main(string[] args) {
  if (args.Length == 2 && args[0] == "--hold") {
    Directory.CreateDirectory(args[1]); File.WriteAllText(Path.Combine(args[1], "ready"), "fixture ready");
    while (!File.Exists(Path.Combine(args[1], "stop"))) Thread.Sleep(40);
    return 0;
  }
  File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "fixture-launched"), "launched");
  return 0;
}}
`);
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execute(csc, ['/nologo', '/target:winexe', '/platform:x64', '/out:' + path.join(payload, name + '.exe'), fixtureSource]);
  fs.writeFileSync(path.join(payload, 'resources/app.asar'), 'tiny isolated fixture archive\n');
  const metadata = { clientId: 'platform', mode: 'development', appId: 'im.synk.signal.fixture.' + token, version: '0.0.1', arch: 'x64', platform: 'win32', sourceHash: 'fixture-' + token };
  json(path.join(payload, 'resources/synk-install.json'), metadata);
  fs.writeFileSync(path.join(payload, 'LICENSE.fixture.txt'), 'Disposable test payload; no account or application data.\n');
  const safetyInclude = path.resolve(get('safety-include') || path.join(installerRoot, 'signal-safety.nsh'));
  assert(fs.existsSync(safetyInclude), 'Production NSIS safety include missing: ' + safetyInclude);
  const { build, Platform, Arch } = dependencies('electron-builder');
  const config = {
    appId: metadata.appId, productName: name, executableName: name,
    electronVersion: '44.5.1', npmRebuild: false, forceCodeSigning: false,
    directories: { app: project, output }, artifactName: 'signal-fixture-backend.exe',
    win: { target: [{ target: 'nsis', arch: ['x64'] }], signExecutable: false },
    nsis: { guid, include: safetyInclude, oneClick: false, perMachine: false, allowElevation: false,
      allowToChangeInstallationDirectory: false, runAfterFinish: false,
      deleteAppDataOnUninstall: false, createDesktopShortcut: true, createStartMenuShortcut: true,
      shortcutName: name },
    publish: null
  };
  const artifacts = await build({ projectDir: project, prepackaged: payload, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), config, publish: 'never' });
  const backend = artifacts.find(file => file.endsWith('.exe'));
  assert(backend && fs.existsSync(backend), 'Fixture backend was not generated.');
  const files = [name + '.exe', 'resources/app.asar', 'resources/synk-install.json', 'LICENSE.fixture.txt'].map(relativePath => ({ path: relativePath, sha256: sha(path.join(payload, relativePath)), bytes: fs.statSync(path.join(payload, relativePath)).size }));
  const manifest = { fixture: true, token, guid, name, appId: metadata.appId, version: metadata.version, directory,
    payload, backend, backendSHA256: sha(backend), backendBytes: fs.statSync(backend).size,
    installDirectory: path.join(directory, 'installed'), executableName: name + '.exe',
    registryKey: 'Software\\' + guid, uninstallRegistryKey: 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' + guid,
    shortcutName: name, csc, minFreeBytes: 16 * 1024 * 1024, files };
  json(path.join(directory, 'fixture.json'), manifest);
  json(path.join(directory, 'build-config.json'), config);
  return manifest;
}

async function main() {
  const fixture = get('fixture') ? JSON.parse(fs.readFileSync(path.resolve(get('fixture')), 'utf8')) : await prepare();
  assert(fixture.fixture === true && /^SYNKSignalFixture[0-9a-f]{12}$/.test(fixture.name), 'Not an isolated fixture manifest.');
  assert(fixture.appId.startsWith('im.synk.signal.fixture.') && fixture.guid !== 'im.synk.platform.preview', 'Refusing a production application identity.');
  const fixtureFile = path.join(fixture.directory, 'fixture.json');
  if (process.argv.includes('--prepare-only')) { console.log(JSON.stringify({ prepared: true, fixtureFile })); return; }
  const engineSource = path.join(installerRoot, 'InstallerEngine.cs');
  assert(fs.existsSync(engineSource), 'Production engine source missing.');
  const testExe = path.join(fixture.directory, 'SignalInstallerTests.exe');
  execute(fixture.csc, ['/nologo', '/target:exe', '/platform:x64', '/out:' + testExe,
    '/r:System.Web.Extensions.dll', '/r:System.Core.dll', '/r:System.Runtime.Serialization.dll', engineSource, path.join(__dirname, 'Tests.cs')]);
  const stdout = execute(testExe, [fixtureFile], { timeout: 180000 });
  fs.writeFileSync(path.join(fixture.directory, 'test-output.txt'), stdout);
  console.log(stdout.trim());
  console.log(JSON.stringify({ fixtureFile, report: path.join(fixture.directory, 'test-results.json') }));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { prepare };
