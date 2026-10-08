// Offline packaging for the existing dating host. No registration, install,
// provider evaluation, upload, database copy or deployment is performed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATING_PUBLIC_FILES } from '../experiences/atlas-lab/dating-public.mjs';

export const DATING_PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const serverFiles = [
  'atlas/ask.js', 'atlas/conditional-preference.js', 'atlas/domain.js',
  'atlas/engine.js', 'atlas/personalization.js', 'atlas/temper-outcomes.js', 'atlas/trail.js',
  'experiences/learning-hub/server.mjs', 'experiences/synk-account/src/core.mjs',
  ...['appointments', 'dating-admission', 'dating-adult', 'dating-auth', 'dating-lifecycle',
    'dating-public', 'dating-restore', 'dating-runtime', 'dating-server', 'dating-service',
    'dating-shutdown', 'dating-store', 'dating-transport', 'discovery', 'introduction-guidance',
    'introductions', 'journey-host', 'meeting-alignment', 'meeting-regions', 'meeting',
    'product-experience', 'public-profile', 'reconnect'].map(name => `experiences/atlas-lab/${name}.mjs`),
];
export const DATING_PACKAGE_FILES = Object.freeze([...new Set([
  ...serverFiles, ...DATING_PUBLIC_FILES.map(name => 'experiences' + name),
  'tools/atlas-dating-backup.mjs',
  'experiences/atlas-lab/dating-reconcile.mjs',
  ...['Caddyfile', 'synk-dating.service', 'runtime.env.example', 'account.public.example.json']
    .map(name => 'experiences/atlas-lab/deploy/' + name),
])].sort());

const MANIFEST = 'dating-package.json', MAX_TOTAL = 32 * 1024 * 1024, MAX_MANIFEST = 65536;
// Keep the CJS engine modules independent of a destination parent's package type.
const generated = new Map([['package.json', Buffer.from('{\n  "private": true,\n  "type": "commonjs"\n}\n')]]);
export const DATING_PACKAGE_CONTENTS = Object.freeze([...DATING_PACKAGE_FILES, ...generated.keys()].sort());
const digest = data => createHash('sha256').update(data).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const within = (root, target) => { const relative = path.relative(root, target); return relative === '' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };
async function realDirectory(target) {
  const stat = await fs.lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.relative(target, await fs.realpath(target)) !== '') fail('package-linked-directory');
}
async function bytes(root, name, maximum = MAX_TOTAL) {
  const filename = path.join(root, name), stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || path.relative(filename, await fs.realpath(filename)) !== '') fail('package-linked-file');
  if (stat.size > maximum) fail('package-size-limit');
  const result = await fs.readFile(filename);
  if (result.length > maximum) fail('package-size-limit');
  return result;
}
async function listFiles(root, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail('package-linked-file');
    if (entry.isDirectory()) {
      if (!DATING_PACKAGE_CONTENTS.some(file => file.startsWith(name + '/'))) fail('package-unexpected-files');
      result.push(...await listFiles(root, name));
    } else if (entry.isFile()) result.push(name);
    else fail('package-unexpected-files');
    if (result.length > DATING_PACKAGE_CONTENTS.length + 1) fail('package-unexpected-files');
  }
  return result.sort();
}
const expectedNames = [...DATING_PACKAGE_CONTENTS, MANIFEST].sort();

export async function verifyDatingPackage(directory, expectedManifestSha256) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('package-absolute-path-required');
  if (!/^[a-f0-9]{64}$/.test(expectedManifestSha256 || '')) fail('package-trusted-hash-required');
  const root = path.resolve(directory); await realDirectory(root);
  const data = await bytes(root, MANIFEST, MAX_MANIFEST);
  if (digest(data) !== expectedManifestSha256) fail('package-manifest-changed');
  let manifest;
  try { manifest = JSON.parse(data); } catch { fail('package-invalid-manifest'); }
  if (manifest?.version !== 1 || manifest?.kind !== 'synk-dating-runtime'
    || manifest?.entry !== 'experiences/atlas-lab/dating-server.mjs'
    || !Array.isArray(manifest.files) || manifest.files.length !== DATING_PACKAGE_CONTENTS.length) fail('package-invalid-manifest');
  const names = await listFiles(root);
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) fail('package-unexpected-files');
  let totalBytes = 0;
  for (const [index, name] of DATING_PACKAGE_CONTENTS.entries()) {
    const file = manifest.files[index];
    if (file?.path !== name || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256 || '')) fail('package-invalid-manifest');
    const content = await bytes(root, name);
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL) fail('package-size-limit');
    if (file.bytes !== content.length || file.sha256 !== digest(content)) fail('package-file-changed');
  }
  return { verified: true, files: manifest.files.length, totalBytes, manifestSha256: expectedManifestSha256,
    deployed: false, runtimeTested: false, providerTested: false };
}

export async function buildDatingPackage(directory, { sourceRoot = DATING_PACKAGE_ROOT } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('package-absolute-path-required');
  const root = path.resolve(sourceRoot), output = path.resolve(directory);
  await realDirectory(root); await realDirectory(path.dirname(output));
  // A package can never be built into this checkout or over an existing target.
  if (within(root, output) || within(output, root)) fail('package-outside-checkout-required');
  let exists = false;
  try { await fs.lstat(output); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) fail('package-target-exists');
  const entries = [], content = new Map(); let totalBytes = 0;
  for (const name of DATING_PACKAGE_CONTENTS) {
    const data = generated.get(name) || await bytes(root, name); totalBytes += data.length;
    if (totalBytes > MAX_TOTAL) fail('package-size-limit');
    content.set(name, data); entries.push({ path: name, bytes: data.length, sha256: digest(data) });
  }
  const manifest = { version: 1, kind: 'synk-dating-runtime', entry: 'experiences/atlas-lab/dating-server.mjs', files: entries };
  const data = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await fs.mkdir(output, { mode: 0o700 }); // Exclusive claim; never merge/overwrite.
  try {
    for (const name of DATING_PACKAGE_CONTENTS) {
      const target = path.join(output, name);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, content.get(name), { flag: 'wx', mode: 0o600 });
    }
    // Concurrent source changes invalidate the package before its manifest exists.
    for (const file of entries) if (digest(generated.get(file.path) || await bytes(root, file.path)) !== file.sha256) fail('package-source-changed');
    await fs.writeFile(path.join(output, MANIFEST), data, { flag: 'wx', mode: 0o600 });
    return await verifyDatingPackage(output, digest(data));
  } catch (error) {
    // Keep the claimed directory for diagnosis; do not recursively remove paths.
    // No successful result/hash is returned. Only verify can admit a completed copy.
    fail(error.code?.startsWith('package-') ? error.code : 'package-build-incomplete');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, directory, expectedHash, ...extra] = process.argv.slice(2);
    if (extra.length || !['build', 'verify'].includes(command) || command === 'build' && expectedHash !== undefined) fail('package-arguments');
    const result = command === 'build' ? await buildDatingPackage(directory) : await verifyDatingPackage(directory, expectedHash);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: { code: /^package-[a-z-]+$/.test(error?.code || '') ? error.code : 'package-io-failed' } }));
    process.exitCode = 1;
  }
}
