'use strict';
// Build/check the current Atlas consumers together. Release archives and deployed
// servers are separate artifacts; this tool never publishes or rewrites archives.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const GAMES = Object.freeze(['korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'learning-hub', 'entry-check', 'story-classroom', 'blank-slice', 'talk-rally', 'word-magic']);
// Every tool in docs/마케팅/맞춤도구/build.mjs ships atlas/engine.js as atlas-engine.js next to its dist/<name>.manifest.json.
const TOOL_OUTPUTS = Object.freeze({ computer: 'brief/computer', meeting: 'brief/meeting', katana: 'brief/katana', skills: 'brief/skills', move: 'builds/move', manual: 'builds/manual' });
const WEBSITE_GAMES = Object.freeze({ racing: 'korean-racing', runner: 'korean-runner', rhythm: 'korean-rhythm', 'order-rush': 'order-rush', 'story-classroom': 'story-classroom', 'entry-check': 'entry-check', 'blank-slice': 'blank-slice', 'talk-rally': 'talk-rally' });
// WORLD inlines atlas/ into three esbuild bundles. Each builder owns its output and verifies it with --check.
// The builders resolve esbuild from experiences/synk-account first and fall back to the repo root's, so a
// clean CI checkout (npm ci at the root) checks them like the learning bundles.
const WORLD_BUNDLES = Object.freeze([
  { label: 'WORLD life bundle', build: 'tools/build-world-life.mjs', output: 'experiences/brand-opening/content/life-standalone.mjs' },
  { label: 'WORLD account bundle', build: 'tools/build-world-account.mjs', output: 'experiences/synk-world-app/world-account.bundle.mjs' },
  { label: 'WORLD learning profile core', build: 'tools/build-world-learning-profile.mjs', output: 'experiences/synk-world-app/world-learning-profile-core.mjs' },
]);
// Product modules whose canonical source lives in the product, not in atlas/. They keep an Atlas-style
// global for stored records, so the marker scan would otherwise report them as copies.
const PRODUCT_OWNED = Object.freeze([
  'experiences/relationship-care/care-followup.js', // SynkTrailFollowup: moved out of atlas/trail-followup.js on 2026-10-08 (docs/아틀라스_설계.md §1)
]);
const text = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replace(/\\/g, '/');

function rawCopies(root, websiteRoot) {
  const pairs = [];
  const add = (source, destination, repo = root) => pairs.push({ source: path.join(root, source), destination: path.join(repo, destination), label: `${repo === root ? '' : 'website/'}${destination}` });
  for (const name of ['engine', 'trail', 'personalization']) add(`atlas/${name}.js`, `experiences/path-vr/vendor/${name}.js`);
  for (const name of ['engine', 'personalization']) add(`atlas/${name}.js`, `desktop/assets/launcher/${name}.js`);
  for (const output of Object.values(TOOL_OUTPUTS)) {
    const destination = `docs/마케팅/맞춤도구/dist/${output}/atlas-engine.js`;
    // A clean checkout need not contain every optional marketing build. Once its
    // directory exists, a missing engine is an error, not a silently skipped copy.
    if (fs.existsSync(path.dirname(path.join(root, destination)))) add('atlas/engine.js', destination);
  }
  if (websiteRoot) {
    for (const [slug, game] of Object.entries(WEBSITE_GAMES)) if (fs.existsSync(path.join(websiteRoot, 'dist/try', slug))) {
      add(`experiences/${game}/atlas-learning.js`, `dist/try/${slug}/atlas-learning.js`, websiteRoot);
    }
    // planner-feedback.mjs also imports trail-life and temper-outcomes (served live at synk.im/try/travel/).
    if (fs.existsSync(path.join(websiteRoot, 'dist/try/travel'))) for (const name of ['engine', 'personalization', 'domain', 'interpretation', 'ask', 'travel', 'trail-life', 'temper-outcomes']) {
      add(`atlas/${name}.js`, `dist/try/travel/atlas/${name}.js`, websiteRoot);
    }
  }
  return pairs;
}

// Every file the scan may skip: registered raw copies, generated bundles and product-owned modules.
function ownedFiles(root, pairs) {
  const files = [...pairs.map(row => row.destination), ...GAMES.map(game => `experiences/${game}/atlas-learning.js`), 'experiences/hangul-stage/atlas-learning.js',
    ...WORLD_BUNDLES.map(bundle => bundle.output), ...PRODUCT_OWNED];
  return new Set(files.map(file => path.resolve(root, file)));
}

function unknownCopies(root, owned, { website = false } = {}) {
  const unknown = [], ignored = new Set(['node_modules', '.git', 'qa', 'tests', 'test', 'dist', 'site-package', 'source', 'sources', '__pycache__']);
  const bases = website ? ['dist'] : ['experiences', 'desktop/assets', 'docs/마케팅/맞춤도구/dist'];
  const walk = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (!ignored.has(entry.name) && !entry.name.startsWith('.')) walk(file); continue; }
      if (!/\.(?:js|cjs|mjs)$/.test(entry.name) || fs.statSync(file).size > 2000000 || owned.has(path.resolve(file))) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/Canonical source: SYNK-appsscript\/atlas|Generated from atlas\/|\broot\.Synk(?:Atlas|Trail|Temper|Vellum|Strata|Ask|Flow)\w*\s*=/.test(source)) unknown.push(slash(path.relative(root, file)));
    }
  };
  for (const base of bases) walk(path.join(root, base));
  return unknown.sort();
}

function syncRaw(root, pairs, { check = true } = {}) {
  const problems = [], changed = [];
  // Read all canonical files first; never partially sync after a missing source.
  const rows = pairs.map(pair => ({ ...pair, bytes: fs.readFileSync(pair.source) }));
  for (const row of rows) {
    const same = fs.existsSync(row.destination) && text(fs.readFileSync(row.destination)) === text(row.bytes);
    if (same) continue;
    if (check) problems.push(`${row.label}: missing or differs from canonical source`);
    else { fs.mkdirSync(path.dirname(row.destination), { recursive: true }); fs.writeFileSync(row.destination, row.bytes); changed.push(row.label); }
  }
  // Only update the owned engine entries. Preserve asset/content hashes, dates,
  // and unrelated dirty work in these existing product build manifests.
  const update = (relative, edit) => {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) return;
    const original = JSON.parse(fs.readFileSync(file, 'utf8')), next = structuredClone(original);
    edit(next);
    if (JSON.stringify(next) === JSON.stringify(original)) return;
    if (check) problems.push(`${relative}: engine metadata differs from its actual copy`);
    else { fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n'); changed.push(relative); }
  };
  const descriptor = file => { const bytes = fs.readFileSync(file); return { bytes: bytes.length, sha256: hash(bytes) }; };
  update('desktop/assets/launcher/sources.json', manifest => {
    for (const name of ['engine.js', 'personalization.js']) {
      const row = manifest.assets.find(asset => asset.name === name);
      if (!row) throw new Error(`Missing launcher source metadata: ${name}`);
      const file = path.join(root, 'desktop/assets/launcher', name);
      if (fs.existsSync(file)) Object.assign(row, { source: `atlas/${name}`, ...descriptor(file) });
    }
  });
  for (const [name, output] of Object.entries(TOOL_OUTPUTS)) update(`docs/마케팅/맞춤도구/dist/${name}.manifest.json`, manifest => {
    const file = path.join(root, 'docs/마케팅/맞춤도구/dist', output, 'atlas-engine.js');
    if (fs.existsSync(file)) {
      const row = descriptor(file);
      manifest.atlasEngineSha256 = row.sha256;
      manifest.files['atlas-engine.js'] = row;
    }
  });
  return { problems, changed, copies: rows.length };
}

function runAll({ root, check = true, local = false, talkRoot = path.resolve(root, '../SYNK-talk'), websiteRoot = path.resolve(root, '../SYNK-website') }) {
  const results = [], problems = [];
  if (!local) for (const [name, directory] of [['Talk', talkRoot], ['website', websiteRoot]]) {
    if (!fs.existsSync(path.join(directory, 'package.json'))) throw new Error(`Missing ${name} checkout; use --local explicitly for a local-only check: ${directory}`);
  }
  if (!local && !fs.existsSync(path.join(talkRoot, 'tools/synk-server-build.js'))) {
    throw new Error('Missing Talk server generator: the full copy check requires tools/synk-server-build.js');
  }
  const pairs = rawCopies(root, local ? null : websiteRoot);
  const owned = ownedFiles(root, pairs);
  const unknown = [...unknownCopies(root, owned), ...(!local ? unknownCopies(websiteRoot, owned, { website: true }).map(file => `website/${file}`) : [])];
  // Unknown consumers must be classified before a write can silently omit them.
  if (unknown.length) return { ok: false, scope: local ? 'local' : 'local+talk+website-staging', problems: unknown.map(file => `Unregistered Atlas copy: ${file}`), results };
  const run = (label, args, env = {}) => {
    const result = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 8000000 });
    results.push({ label, command: ['node', ...args], exitCode: result.status, output: (result.stdout + result.stderr).trim() });
    if (result.status !== 0) problems.push(`${label}: ${result.error?.message || (result.stderr || result.stdout).trim()}`);
  };
  run('learning: 9 games', ['tools/build-game-learning.js', ...(check ? ['--check'] : [])]);
  run('learning: Hangul', ['tools/build-hangul-stage.js', ...(check ? ['--check'] : [])]);
  for (const bundle of WORLD_BUNDLES) run(bundle.label, [bundle.build, ...(check ? ['--check'] : [])]);
  // Avoid copying stale bundles when a producer could not rebuild.
  if (!check && problems.length) return { ok: false, scope: local ? 'local' : 'local+talk+website-staging', problems, results };
  const raw = syncRaw(root, pairs, { check });
  results.push({ label: 'raw consumers and engine metadata', ...raw }); problems.push(...raw.problems);
  if (!local) {
    run('Talk app and server', ['tools/sync-atlas.js', '--consumer', 'talk', ...(check ? ['--check'] : [])], { SYNK_TALK_ROOT: talkRoot });
    run('Strata source map', ['tools/strata-build.js', '--check', '--talk-root', talkRoot]);
  }
  return { ok: problems.length === 0, scope: local ? 'local' : 'local+talk+website-staging', generatedBundles: 10 + WORLD_BUNDLES.length, rawCopies: raw.copies, problems, results,
    excluded: ['historical QA/release archives', 'retired website letter', ...(local ? ['Talk checkout', 'website staging', 'Strata sibling source validation'] : []), 'deployed servers and public pages'] };
}
module.exports = { GAMES, TOOL_OUTPUTS, WEBSITE_GAMES, WORLD_BUNDLES, PRODUCT_OWNED, rawCopies, ownedFiles, unknownCopies, syncRaw, runAll };
