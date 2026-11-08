'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { RESTIC_SHA256 } = require('../src/engine.cjs');
(async () => {
  const [runtimeArg, resticArg, outputArg, googleClientArg] = process.argv.slice(2);
  if (!runtimeArg || !resticArg || !outputArg) throw new Error('Usage: node scripts/package.cjs <electron-dist> <restic.exe> <new-output-directory>');
  if (process.platform !== 'win32') throw new Error('Package on Windows x64.');
  const runtime = path.resolve(runtimeArg), restic = path.resolve(resticArg), output = path.resolve(outputArg);
  const source = path.resolve(__dirname, '..');
  const overlap = (a, b) => a === b || b.startsWith(a + path.sep) || a.startsWith(b + path.sep);
  if ([source, runtime, path.dirname(restic)].some(p => overlap(output.toLowerCase(), p.toLowerCase()))) throw new Error('Output must be separate from source and dependencies.');
  const bytes = await fs.readFile(restic);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== RESTIC_SHA256) throw new Error('Pinned restic executable SHA-256 mismatch.');
  await fs.access(path.join(runtime, 'electron.exe'));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output); // Refuse to overwrite any earlier release.
  for (const name of await fs.readdir(runtime)) await fs.cp(path.join(runtime, name), path.join(output, name), { recursive: true, force: false, errorOnExist: true });
  const application = path.join(output, 'resources', 'app');
  await fs.mkdir(application, { recursive: true });
  for (const name of ['package.json', 'src', 'ui', 'node_modules', 'THIRD_PARTY_NOTICES.txt']) await fs.cp(path.join(source, name), path.join(application, name), { recursive: true, force: false, errorOnExist: true });
  await fs.copyFile(restic, path.join(output, 'resources', 'restic.exe'));
  if (googleClientArg) {
    const { clientConfig } = require('../src/recovery-auth.cjs');
    const config = clientConfig(JSON.parse(await fs.readFile(path.resolve(googleClientArg), 'utf8')));
    // Desktop OAuth public-client config is deliberately injectable; never put
    // user refresh tokens or B2/repository credentials in the distributable.
    await fs.writeFile(path.join(output, 'resources', 'recovery-client.json'), JSON.stringify(config), { flag: 'wx' });
  }
  await fs.copyFile(path.join(source, 'README.md'), path.join(output, '시작안내.md'));
  await fs.rename(path.join(output, 'electron.exe'), path.join(output, 'WorkBackup.exe'));
  const manifest = { app: 'solo-work-backup', version: require('../package.json').version, resticVersion: '0.19.1', resticSha256: RESTIC_SHA256, signed: false, files: {} };
  async function walk(dir) { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const p = path.join(dir, item.name); if (item.isDirectory()) await walk(p); else manifest.files[path.relative(output, p).split(path.sep).join('/')] = crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex'); } }
  await walk(output);
  await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ output, executable: path.join(output, 'WorkBackup.exe'), files: Object.keys(manifest.files).length, resticSha256: RESTIC_SHA256 }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
