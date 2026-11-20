'use strict';
// Synthetic data and hash lists for the clean-Windows exercise (STAGE1_DESIGN.md 4.11 · 7장 D0).
//   node clean-data.cjs make <dir> [MB=100]        deterministic data; prints the summary
//   node clean-data.cjs specials <dir>             the special entries below, into data `make` made (an administrator:
//                                                  symbolic links need the right to make them)
//   node clean-data.cjs list <dir> <out.json>      every file (size, SHA-256), folder and link under <dir>
//   node clean-data.cjs compare <list.json> <dir> [<복구경로.json>]   the same list again under <dir>, links and names
//                                                  Windows cannot hold left out: exit 0 only when equal (and, given the
//                                                  restore's 복구경로.json, when it counts each of them as left out)
//   node clean-data.cjs seal <in> <out> · open <in> <out>   AES-256-GCM with a key from WORKBACKUP_CI_SEED and
//                                                  GITHUB_RUN_ID, for the recovery kits carried between runners
// D0 holds what 7장 asks of every data set: Korean names, an empty folder, a 0-byte file, a path over 260 characters,
// a name with the telemetry-leak marker, small notes, medium pictures and one large incompressible file, and (specials)
// a folder junction, a file and a folder symbolic link and a name ending in a dot. The backup keeps the three links; a
// restore leaves them out and counts them (4.6, restore-tar readManifest — 74a22589a). The name ending in a dot never
// reaches the backup on Windows (see leftOutSaid); the backup tells it (4.2 「이 백업에 담지 못하는 이름」, checked by
// clean-backup.ps1). A file nobody may read is made
// by clean-backup.ps1 for one run only (icacls), since every run would be partial while it stays.
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

// The four special entries (7장): a junction to a folder of the data (the backup must not go through it), a file and a
// folder symbolic link with relative targets, and a file whose name ends in a dot (Node writes every absolute path
// through the long-path prefix, which keeps the dot). Junctions need no right to make; symbolic links need an
// administrator here.
const SPECIALS = { junction: '연결점', fileLink: '링크/메모 링크.txt', folderLink: '링크/폴더 링크', oddName: '끝이 점인 이름.' };
function specials(root) {
  if (!fs.existsSync(path.join(root, '문서', '메모 0', '메모-0.txt')) || !fs.existsSync(path.join(root, '빈 폴더'))) throw Error('specials go into data `make` made');
  fs.symlinkSync(path.join(root, '문서'), path.join(root, SPECIALS.junction), 'junction');
  fs.mkdirSync(path.join(root, '링크'));
  fs.symlinkSync(path.join('..', '문서', '메모 0', '메모-0.txt'), path.join(root, ...SPECIALS.fileLink.split('/')), 'file');
  fs.symlinkSync(path.join('..', '빈 폴더'), path.join(root, ...SPECIALS.folderLink.split('/')), 'dir');
  put(root, SPECIALS.oddName, bytes('odd', 1024));
  if (!fs.readdirSync(root).includes(SPECIALS.oddName)) throw Error('the name ending in a dot was not kept');
  return { made: Object.values(SPECIALS) };
}
/** A name Windows cannot hold as named: a part ending in a dot or a space (restore-tar nameIssue, the part this data uses). */
const oddName = rel => rel.split('/').some(part => /[. ]$/.test(part));

function walk(root) {
  const files = {}, dirs = [], links = [];
  (function go(dir, rel) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${item.name}` : item.name, full = path.join(dir, item.name);
      // Node reports junctions as symbolic links too. Neither is gone through.
      if (item.isSymbolicLink()) links.push(r);
      else if (item.isDirectory()) { dirs.push(r); go(full, r); }
      else if (item.isFile()) { const data = fs.readFileSync(full); files[r] = { size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') }; }
      else throw Error(`special entry: ${r}`);
    }
  })(root, '');
  return { files, dirs: dirs.sort(), links: links.sort() };
}

/** A restore against the list made before the backup: every file and folder back, except the links and the names
 *  Windows cannot hold. Those must not be there at all; they are what the restore says it left out (leftOut). */
function compare(expected, actual) {
  const missing = [], changed = [], extra = [], leftIn = [];
  const links = expected.links || [], odd = Object.keys(expected.files).filter(oddName);
  const underLink = rel => links.some(l => rel.startsWith(`${l}/`));
  for (const [rel, want] of Object.entries(expected.files)) {
    if (oddName(rel)) continue;
    const got = actual.files[rel];
    if (!got) missing.push(rel); else if (got.size !== want.size || got.sha256 !== want.sha256) changed.push(rel);
  }
  for (const rel of Object.keys(actual.files)) {
    if (oddName(rel)) leftIn.push(rel);
    else if (!expected.files[rel] || underLink(rel)) extra.push(rel);
  }
  // A restore makes no link at all and nothing under a name Windows cannot hold (GPT GA1: one under any name, or an odd
  // name back as a folder, passed before). A link of the list must come back as nothing; anything under one would be
  // the link gone through.
  for (const rel of actual.links || []) leftIn.push(rel);
  for (const rel of actual.dirs) if (oddName(rel)) leftIn.push(rel); else if (underLink(rel)) extra.push(rel);
  for (const rel of links) if (actual.files[rel] || actual.dirs.includes(rel)) leftIn.push(rel);
  const dirsMissing = expected.dirs.filter(d => !oddName(d) && !actual.dirs.includes(d));
  const kept = Object.keys(expected.files).length - odd.length;
  leftIn.splice(0, leftIn.length, ...new Set(leftIn));
  return { files: kept, matched: kept - missing.length - changed.length, missing, changed, extra, dirsMissing, leftOut: [...links, ...odd], leftIn,
    ok: !missing.length && !changed.length && !extra.length && !dirsMissing.length && !leftIn.length };
}
/** What 복구경로.json says it left out (each folder's `skipped`) against the links and odd names of the list. A link is
 *  in the backup, so the restore must count it. A name Windows cannot hold never reaches the backup there: restic 0.19.1
 *  left the name ending in a dot out of every snapshot with no error, and the runs were still complete (run 44152169842,
 *  11-18 — counts and the restore listing; how restic loses it is not measured). The backup tells the person instead
 *  (4.2, b18e0775b) and the snapshot still lacks it, so the restore must not count one either; a count of one means
 *  the backup came to keep it. */
function leftOutSaid(leftOut, mapping) {
  const entries = Array.isArray(mapping) ? mapping : [], said = entries.flatMap(e => e?.skipped?.items || []);
  const count = entries.reduce((n, e) => n + (e?.skipped?.count || 0), 0);
  const has = rel => said.some(item => typeof item?.name === 'string' && (item.name === rel || item.name.endsWith(`/${rel}`)));
  const links = leftOut.filter(rel => !oddName(rel)), notBackedUp = leftOut.filter(oddName);
  const unsaid = links.filter(rel => !has(rel)), saidOdd = notBackedUp.filter(has);
  return { expected: links.length, count, unsaid, notBackedUp, saidOdd, ok: count === links.length && !unsaid.length && !saidOdd.length };
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

module.exports = { make, specials, walk, compare, leftOutSaid, seal, open, LEAK_MARKER, SPECIALS };
if (require.main === module) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'make') console.log(JSON.stringify(make(path.resolve(a), b ? Number(b) : 100)));
  else if (mode === 'specials') console.log(JSON.stringify(specials(path.resolve(a))));
  else if (mode === 'list') { const list = walk(path.resolve(a)); fs.writeFileSync(b, JSON.stringify(list, null, 1)); console.log(JSON.stringify({ files: Object.keys(list.files).length, dirs: list.dirs.length })); }
  else if (mode === 'compare') {
    const result = compare(JSON.parse(fs.readFileSync(a, 'utf8')), walk(path.resolve(b)));
    const where = process.argv[5];
    const said = where ? leftOutSaid(result.leftOut, JSON.parse(fs.readFileSync(where, 'utf8'))) : null;
    // Names only of what differs, at most 20 of each — synthetic data, nothing secret.
    const cut = list => list.slice(0, 20);
    console.log(JSON.stringify({ ...result, missing: cut(result.missing), changed: cut(result.changed), extra: cut(result.extra), dirsMissing: cut(result.dirsMissing), ...(said ? { said } : {}) }));
    process.exitCode = result.ok && (!said || said.ok) ? 0 : 1;
  }
  else if (mode === 'seal') fs.writeFileSync(b, seal(fs.readFileSync(a)), { flag: 'wx' });
  else if (mode === 'open') fs.writeFileSync(b, open(fs.readFileSync(a)), { flag: 'wx' });
  else { console.error('usage: clean-data.cjs make|specials|list|compare|seal|open …'); process.exitCode = 64; }
}
