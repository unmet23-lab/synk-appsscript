'use strict';
// Synthetic data and hash lists for the clean-Windows exercise (STAGE1_DESIGN.md 4.11 · 7장 D0).
//   node clean-data.cjs make <dir> [MB=100]        deterministic data; prints the summary
//   node clean-data.cjs list <dir> <out.json>      every file (size, SHA-256) and folder under <dir>
//   node clean-data.cjs compare <list.json> <dir>  the same list again under <dir>: exit 0 only when equal
//   node clean-data.cjs seal <in> <out> · open <in> <out>   AES-256-GCM with a key from WORKBACKUP_CI_SEED and
//                                                  GITHUB_RUN_ID, for the recovery kits carried between runners
// D0 holds what 7장 asks of every data set that the 0.7.0 engine can already restore: Korean names, an empty
// folder, a 0-byte file, a path over 260 characters, a name with the telemetry-leak marker, small notes, medium
// pictures and one large incompressible file. Still left out, because 0.7.0's restore stops at them (restore-tar
// readManifest — junctions and links) or they need decisions of the 「옮겨 오기」 work (T16): folder junctions,
// file and folder symbolic links, names ending in a dot, a file nobody may read. They come in with that work.
// Synthetic only — the lists may be public; the sealed kits may not be opened without the seed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const LEAK_MARKER = 'SWB-LEAK-7f3a';

function bytes(seed, n) { const b = Buffer.alloc(n); let o = 0, i = 0; while (o < n) { const h = crypto.createHash('sha256').update(`${seed}:${i++}`).digest(); h.copy(b, o); o += h.length; } return b; }
function put(root, rel, data) { const p = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return data.length; }

function make(root, mb = 100) {
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw Error('make needs a new or empty folder');
  const target = mb * 1048576; let total = 0, files = 0;
  const add = (rel, data) => { total += put(root, rel, data); files++; };
  for (let i = 0; i < 400; i++) add(`문서/메모 ${Math.floor(i / 50)}/메모-${i}.txt`, bytes(`small${i}`, 512 + (i * 7919) % 65536));
  for (let i = 0; total < target * 0.6; i++) add(`사진/사진-${i}.jpg`, bytes(`medium${i}`, (1 + i % 6) * 1048576));
  add('큰 파일/보관.bin', bytes('large', Math.max(1048576, target - total - 2 * 1048576)));
  add('빈 파일.txt', Buffer.alloc(0));
  fs.mkdirSync(path.join(root, '빈 폴더'), { recursive: true });
  add(`측정/${LEAK_MARKER}-고객이름.txt`, bytes('marker', 4096));
  // A path well over MAX_PATH (Node prefixes long absolute paths itself).
  let deep = '긴 경로';
  while (path.join(root, deep).length < 300) deep += '/폴더이름이꽤긴편인한글폴더';
  add(`${deep}/끝에 있는 파일.txt`, bytes('deep', 2048));
  add('잠글 문서/계약서.docx', bytes('locked', 256 * 1024));
  return { files, bytes: total, longestPath: path.join(root, deep).length + 12 };
}

function walk(root) {
  const files = {}, dirs = [];
  (function go(dir, rel) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${item.name}` : item.name, full = path.join(dir, item.name);
      if (item.isSymbolicLink()) throw Error(`link in data: ${r}`);
      if (item.isDirectory()) { dirs.push(r); go(full, r); }
      else if (item.isFile()) { const data = fs.readFileSync(full); files[r] = { size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') }; }
      else throw Error(`special entry: ${r}`);
    }
  })(root, '');
  return { files, dirs: dirs.sort() };
}

function compare(expected, actual) {
  const missing = [], changed = [], extra = [];
  for (const [rel, want] of Object.entries(expected.files)) {
    const got = actual.files[rel];
    if (!got) missing.push(rel); else if (got.size !== want.size || got.sha256 !== want.sha256) changed.push(rel);
  }
  for (const rel of Object.keys(actual.files)) if (!expected.files[rel]) extra.push(rel);
  const dirsMissing = expected.dirs.filter(d => !actual.dirs.includes(d));
  return { files: Object.keys(expected.files).length, matched: Object.keys(expected.files).length - missing.length - changed.length, missing, changed, extra, dirsMissing,
    ok: !missing.length && !changed.length && !extra.length && !dirsMissing.length };
}

function key() {
  const seed = process.env.WORKBACKUP_CI_SEED, run = process.env.GITHUB_RUN_ID;
  if (!seed || !run) throw Error('WORKBACKUP_CI_SEED and GITHUB_RUN_ID are needed');
  return Buffer.from(crypto.hkdfSync('sha256', seed, run, 'workbackup-clean-windows kit v1', 32));
}
function seal(input) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(input), c.final()]);
  return Buffer.concat([Buffer.from('SWBK1'), iv, c.getAuthTag(), body]);
}
function open(sealed) {
  if (sealed.subarray(0, 5).toString() !== 'SWBK1') throw Error('not a sealed kit');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), sealed.subarray(5, 17)); d.setAuthTag(sealed.subarray(17, 33));
  return Buffer.concat([d.update(sealed.subarray(33)), d.final()]);
}

module.exports = { make, walk, compare, seal, open, LEAK_MARKER };
if (require.main === module) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'make') console.log(JSON.stringify(make(path.resolve(a), b ? Number(b) : 100)));
  else if (mode === 'list') { const list = walk(path.resolve(a)); fs.writeFileSync(b, JSON.stringify(list, null, 1)); console.log(JSON.stringify({ files: Object.keys(list.files).length, dirs: list.dirs.length })); }
  else if (mode === 'compare') {
    const result = compare(JSON.parse(fs.readFileSync(a, 'utf8')), walk(path.resolve(b)));
    // Names only of what differs, at most 20 of each — synthetic data, nothing secret.
    const cut = list => list.slice(0, 20);
    console.log(JSON.stringify({ ...result, missing: cut(result.missing), changed: cut(result.changed), extra: cut(result.extra), dirsMissing: cut(result.dirsMissing) }));
    process.exitCode = result.ok ? 0 : 1;
  }
  else if (mode === 'seal') fs.writeFileSync(b, seal(fs.readFileSync(a)), { flag: 'wx' });
  else if (mode === 'open') fs.writeFileSync(b, open(fs.readFileSync(a)), { flag: 'wx' });
  else { console.error('usage: clean-data.cjs make|list|compare|seal|open …'); process.exitCode = 64; }
}
