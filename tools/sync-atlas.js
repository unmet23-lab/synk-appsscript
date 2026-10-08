#!/usr/bin/env node
'use strict';
/* Copies the canonical Atlas (atlas/ and strata/) into the apps that ship it.
 * Talk (app + server) vendors its copy because EAS cloud builds and Supabase deploys only see the
 * Talk repository. One run does the whole job there:
 *   1. finds what Talk itself imports from lib/atlas (app, lib, server functions, tools, tests),
 *   2. follows require() in the canonical sources and copies exactly that set,
 *   3. removes copies an earlier sync made that nothing needs any more (never Talk's own files),
 *   4. regenerates Talk's server bundles (the event validator and the account summary) with Talk's
 *      own tools/synk-server-build.js,
 *   5. writes lib/atlas/sync-manifest.json, which Talk's tests check without this repository.
 * Talk is the default consumer. The website letter page has retired and is never recreated by
 * default. --consumer website is only for an older checkout that still owns sync-letter-copy.mjs;
 * that checkout's generator recomputes its letter page's cache keys (`?v=`) after a copy changes.
 * --check changes nothing and lists every difference at once (exit 1 when there is any).
 * --all includes 10 learning bundles, PATH/launcher/tools, Talk and current website staging.
 * --all --local checks/builds only this repository (CI); omitted siblings are explicit.
 * Usage: node tools/sync-atlas.js [--check] [--consumer talk|website]
 *        node tools/sync-atlas.js --all [--check] [--local] */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.includes('--all')) {
  if (args.some(arg => !['--all', '--check', '--local'].includes(arg))) throw new Error('Usage: sync-atlas.js --all [--check] [--local]');
  const result = require('./lib/atlas-copies').runAll({ root, check: args.includes('--check'), local: args.includes('--local'),
    ...(process.env.SYNK_TALK_ROOT ? { talkRoot: path.resolve(process.env.SYNK_TALK_ROOT) } : {}),
    ...(process.env.SYNK_WEBSITE_ROOT ? { websiteRoot: path.resolve(process.env.SYNK_WEBSITE_ROOT) } : {}) });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
let check = false;
const selected = new Set();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') check = true;
  else if (args[i] === '--consumer' && ['talk', 'website'].includes(args[i + 1])) selected.add(args[++i]);
  else throw new Error('Usage: sync-atlas.js [--check] [--consumer talk|website]');
}
const MANIFEST = 'sync-manifest.json';
// The server bundles (Talk's tools/synk-server-build.js) inline these and what they require.
const SERVER_ENTRIES = ['trail.js', 'engine.js', 'account-summary.js', 'strata/index.js', 'strata/maps/topik-i.json', 'strata/topik-i-examples.js'];
const consumers = {
  talk: { repo: process.env.SYNK_TALK_ROOT || path.resolve(root, '../SYNK-talk'), dir: 'lib/atlas', files: talkFiles, manifest: true, server: 'tools/synk-server-build.js' },
  // Explicit legacy support only: the retired letter consumer must still own its generator.
  // Never infer an active consumer from leftover dist files or restore the removed generator.
  website: { repo: process.env.SYNK_WEBSITE_ROOT || path.resolve(root, '../SYNK-website'), dir: 'dist/try/letter/atlas', files: () => ['engine.js', 'experiences.js'], after: 'sync-letter-copy.mjs' },
};
// Git normalizes these JS/JSON text files. Hash logical content so a clean Linux checkout
// and a Windows working copy describe the same engine, regardless of CRLF/LF checkout policy.
const normalized = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');
const sha = buffer => crypto.createHash('sha256').update(normalized(buffer)).digest('hex');
const canonical = name => path.join(root, name.startsWith('strata/') ? name : `atlas/${name}`);
const normal = name => (name === 'strata' ? 'strata/index.js' : /\.(js|json)$/.test(name) ? name : `${name}.js`);
const versionOf = file => (fs.existsSync(file) ? (fs.readFileSync(file, 'utf8').match(/const VERSION = '([^']+)'/) || [])[1] || null : null);

/* What Talk imports from its copy: `lib/atlas/<x>` in app and server code, `./atlas/<x>` from lib/,
 * and `lib/atlas/<x>` in a server function's 동봉.json. The copy itself and build output are skipped. */
function talkImports(repo) {
  const skip = new Set(['node_modules', '.git', 'dist', 'tmp', 'artifacts', '.expo']);
  const found = new Map();
  const add = (name, file) => { const key = normal(name); if (!found.has(key)) found.set(key, new Set()); found.get(key).add(path.relative(repo, file).replace(/\\/g, '/')); };
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !entry.name.startsWith('dist-') && path.relative(repo, full).replace(/\\/g, '/') !== 'lib/atlas') walk(full);
      } else if (/\.(c?js|mjs|tsx?)$/.test(entry.name) && fs.statSync(full).size < 3e6) {
        const source = fs.readFileSync(full, 'utf8');
        for (const m of source.matchAll(/['"](?:[./]*\/)?lib\/atlas\/([^'"]+)['"]/g)) add(m[1], full);
        if (path.relative(repo, path.dirname(full)).replace(/\\/g, '/') === 'lib') for (const m of source.matchAll(/require\(\s*['"]\.\/atlas\/([^'"]+)['"]\s*\)/g)) add(m[1], full);
      } else if (entry.name === '동봉.json') {
        for (const value of Object.values(JSON.parse(fs.readFileSync(full, 'utf8')))) if (typeof value === 'string' && value.startsWith('lib/atlas/')) add(value.slice('lib/atlas/'.length), full);
      }
    }
  };
  walk(repo);
  return found;
}
// Everything those imports load, following require() through the canonical sources.
function talkFiles(repo) {
  const imports = talkImports(repo), need = new Set(), queue = [...imports.keys(), ...SERVER_ENTRIES];
  while (queue.length) {
    const name = queue.shift();
    if (need.has(name)) continue;
    if (!fs.existsSync(canonical(name))) throw new Error(`Talk imports lib/atlas/${name}, which has no canonical source (${[...(imports.get(name) || [])].join(', ')})`);
    need.add(name);
    if (!name.endsWith('.js')) continue;
    for (const m of fs.readFileSync(canonical(name), 'utf8').matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), m[1])).replace(/^\.\.\/strata/, 'strata');
      queue.push(normal(target));
    }
  }
  return [...need].sort();
}

const targets = (selected.size ? [...selected] : ['talk']).map(name => ({ name, ...consumers[name] }));
// Validate every selected consumer, and what each needs, before writing any copies.
for (const t of targets) {
  if (!fs.existsSync(path.join(t.repo, 'package.json'))) throw new Error('Missing consumer: ' + t.repo);
  if (t.after) {
    const generator = path.join(t.repo, t.after);
    if (!fs.existsSync(generator) || !fs.statSync(generator).isFile()) {
      console.error(`Retired website letter consumer: ${generator} is absent. No files were changed. The default consumer is Talk; --consumer website requires an existing legacy letter checkout.`);
      process.exit(1);
    }
  }
}
for (const t of targets) t.need = t.files(t.repo);
const problems = [];
for (const t of targets) {
  const base = path.join(t.repo, t.dir), label = `${path.basename(t.repo)}/${t.dir}`;
  const files = t.need;
  const before = versionOf(path.join(base, 'engine.js'));
  const manifestPath = path.join(base, MANIFEST);
  const previous = t.manifest && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  const hashes = {};
  let changed = 0;
  for (const name of files) {
    const source = fs.readFileSync(canonical(name)), destination = path.join(base, name);
    hashes[name] = sha(source);
    const same = fs.existsSync(destination) && normalized(fs.readFileSync(destination)) === normalized(source);
    if (same) { if (!check) console.log(`unchanged ${label}/${name}`); continue; }
    if (check) { problems.push(`${label}/${name}: ${fs.existsSync(destination) ? 'differs from the canonical source' : 'missing'}`); continue; }
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, source);
    changed += 1;
    console.log(`synced ${label}/${name} ${hashes[name].slice(0, 12)}`);
  }
  // The consumer's own step that depends on these files (the website's cache keys).
  if (t.after && changed) {
    const step = spawnSync(process.execPath, [t.after], { cwd: t.repo, encoding: 'utf8' });
    if (step.status === 0) console.log(`ran ${path.basename(t.repo)}/${t.after}`);
    else problems.push(`${path.basename(t.repo)}/${t.after} failed after the copy: ${(step.stderr || step.stdout).trim().split('\n').at(-1)}`);
  }
  if (!t.manifest) continue;
  // A copy an earlier sync made and nothing needs now. A copy edited inside Talk is kept and reported.
  for (const [name, hash] of Object.entries(previous?.files || {})) {
    if (files.includes(name)) continue;
    const file = path.join(base, name);
    if (!fs.existsSync(file)) continue;
    if (sha(fs.readFileSync(file)) !== hash) { problems.push(`${label}/${name}: no longer needed, but edited in place; left for a person to decide`); continue; }
    if (check) problems.push(`${label}/${name}: no longer needed`);
    else { fs.unlinkSync(file); console.log(`removed ${label}/${name} (no longer imported)`); }
  }
  const after = versionOf(canonical('engine.js'));
  const manifest = JSON.stringify({ source: 'SYNK-appsscript atlas/ + strata/', tool: 'tools/sync-atlas.js', engine: after, files: hashes }, null, 2) + '\n';
  if (check) { if (!fs.existsSync(manifestPath) || normalized(fs.readFileSync(manifestPath)) !== manifest) problems.push(`${label}/${MANIFEST}: out of date`); }
  else if (!fs.existsSync(manifestPath) || normalized(fs.readFileSync(manifestPath)) !== manifest) { fs.writeFileSync(manifestPath, manifest); console.log(`wrote ${label}/${MANIFEST} (${files.length} files)`); }
  // The server bundles are Talk's own generator; it reads the copy just written. An older
  // generator makes one bundle (build), a newer one lists its OUTPUTS (the account summary too).
  const generator = path.join(t.repo, t.server);
  if (fs.existsSync(generator)) {
    delete require.cache[require.resolve(generator)];
    const server = require(generator);
    const outputs = Array.isArray(server.OUTPUTS) ? server.OUTPUTS : [{ file: 'supabase/functions/_shared/synk-atlas.js', build: server.build }];
    if (check) {
      const sources = files.every(name => fs.existsSync(path.join(base, name)) && normalized(fs.readFileSync(path.join(base, name))) === normalized(fs.readFileSync(canonical(name))));
      for (const output of outputs) {
        const bundle = path.join(t.repo, output.file);
        if (sources && (!fs.existsSync(bundle) || normalized(fs.readFileSync(bundle)) !== normalized(output.build()))) problems.push(`${path.basename(t.repo)}/${output.file}: not rebuilt from the copy`);
      }
    } else { server.write(); for (const output of outputs) console.log(`rebuilt ${path.basename(t.repo)}/${output.file}`); }
  }
  if (!check && before !== after) {
    console.log(`engine ${before || '(none)'} -> ${after} in ${label}`);
    console.log('  Older servers reject records from a newer engine: deploy synk-account, synk-learning and events before releasing an app built from this copy.');
  }
}
if (check) {
  if (problems.length) { console.error(`Atlas copies differ (${problems.length}):\n${problems.map(p => `  - ${p}`).join('\n')}\nRun: node tools/sync-atlas.js${selected.size ? [...selected].map(c => ` --consumer ${c}`).join('') : ''}`); process.exitCode = 1; }
  else console.log(`verified ${targets.map(t => t.name).join(', ')}`);
} else if (problems.length) { console.error(problems.map(p => `  - ${p}`).join('\n')); process.exitCode = 1; }
