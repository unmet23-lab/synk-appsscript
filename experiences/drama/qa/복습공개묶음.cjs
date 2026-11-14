'use strict';
// 틀린 장면 복습 · 3일 뒤 다시 만나기(2026-11-14, 설계 WORLD올리기-20261102/설계.md §18)의 synk.im/world 공개 재료: 바탕 판과 내 판에서 이 일이 바꾼
// 드라마 파일만 꺼내 공개 빌드(tools/build-world-app-public.mjs)와 같은 손질(pilot.mjs 가져오기 · index.html 참조의 ?v= 토큰, data-drama="world")을
// 두 판에 똑같이 건 두 폴더를 만든다. tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹고 바뀐 파일의 ?v=를 새로 붙인다 —
// 공개본의 남의 공개 변경은 그대로 남는다(자막공개묶음.cjs와 같은 길). 재생 사본(media/)은 바뀌지 않아 싣지 않는다.
//   node experiences/drama/qa/복습공개묶음.cjs <바탕 = 지금 공개본과 같은 원천 커밋> [내 판=HEAD | <커밋> | 작업본(디스크의 파일)] --내바탕 <내 변경이 시작된 커밋>
//   --내바탕: 내 판에서 「내 변경」을 가를 기준(이번 일은 c50e754e6 — 그 위에 커밋해도 같은 값). 바탕과 내바탕 사이에 미공개 커밋이 있으면 그 줄을 덜고
//   「바탕 + (내바탕 → 내 판)」만 싣는다. 바탕과 내바탕의 공개 파일이 다른데 --내바탕이 없으면 멈춘다(커밋 뒤 기본값으로 돌려 미공개 줄이 실리거나
//   내 변경이 빠지지 않게 — 화면 검수 A1).
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const argv = process.argv.slice(2), at = argv.indexOf('--내바탕');
const MINE = at >= 0 ? argv[at + 1] : null;
if (at >= 0) argv.splice(at, 2);
const [BASE, NEW = 'HEAD'] = argv;
if (!BASE) throw Error('바탕 커밋을 준다');
if (at >= 0 && !MINE) throw Error('--내바탕 뒤에 커밋을 준다');
const FS = '작업본';
// 작업본은 autocrlf로 CRLF일 수 있다 — 저장소 판(LF)과 같게 줄끝을 LF로 읽는다(공개본에 CRLF를 올리지 않게, 설계 §17-3).
const disk = (n) => Buffer.from(fs.readFileSync(path.join(ROOT, PILOT, n)).toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const OUT = path.join(공용작업본(ROOT), '.tmp', 'drama-review-pub-20261114');
const PILOT = 'experiences/drama/pilot/';
const NAMES = ['index.html', 'pilot.mjs', 'pilot.css', 'strings.mjs', 'takes.mjs', 'atlas-learning.js', 'world-lesson.json'];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
// 바탕(공개본과 같은 원천 커밋)과 내바탕 사이에 공개 안 한 커밋이 같은 파일을 고쳤으면(11-14 「오늘」 깃발 뒤 갈래 — 11-30 뒤 공개),
// 내 판에서 그 커밋의 줄을 덜어 「바탕 + 내 변경」만 만든다: 3방향(내 판 · 내바탕 · 바탕)에서 겹친 덩이는 내 줄을 두고 내바탕에만 있는 줄을 뺀다.
// 그 뒤 「바탕 → 결과」와 「내바탕 → 내 판」의 바뀐 줄이 같은지 대 보고, 다르면 멈춘다(남의 미공개 줄이 실리거나 내 줄이 빠지지 않게).
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'drama-pub-'));
function diffLines(a, b) {
  const fa = path.join(tmp, 'a'), fb = path.join(tmp, 'b');
  fs.writeFileSync(fa, a); fs.writeFileSync(fb, b);
  let out = '';
  try { out = execFileSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-color', '-U0', fa, fb], { maxBuffer: 1 << 30 }).toString('utf8'); }
  catch (e) { out = e.stdout?.toString('utf8') || ''; }
  return out.split('\n').filter((l) => /^[-+](?![-+]{2} )/.test(l)).sort().join('\n');
}
const mineOf = (n) => (NEW === FS ? disk(n) : git('show', `${NEW}:${PILOT}${n}`));
function dropUnpublished(n, BASE) {
  const mine = mineOf(n), head = git('show', `${MINE}:${PILOT}${n}`), base = git('show', `${BASE}:${PILOT}${n}`);
  const fo = path.join(tmp, 'ours'), fh = path.join(tmp, 'head'), fb = path.join(tmp, 'base');
  fs.writeFileSync(fo, mine); fs.writeFileSync(fh, head); fs.writeFileSync(fb, base);
  let merged;
  try { merged = execFileSync('git', ['-c', 'core.autocrlf=false', 'merge-file', '-p', '--diff3', fo, fh, fb], { maxBuffer: 1 << 30 }).toString('utf8'); }
  catch (e) { merged = e.stdout.toString('utf8'); }
  const out = [], lines = merged.split('\n');
  for (let i = 0; i < lines.length;) {
    if (!lines[i].startsWith('<<<<<<< ')) { out.push(lines[i++]); continue; }
    const ours = [], mid = [], theirs = []; i++;
    while (!lines[i].startsWith('||||||| ')) ours.push(lines[i++]);
    for (i++; lines[i] !== '======='; ) mid.push(lines[i++]);
    for (i++; !lines[i].startsWith('>>>>>>> '); ) theirs.push(lines[i++]);
    i++;
    const unpublished = mid.filter((l) => !theirs.includes(l));
    out.push(...ours.filter((l) => !unpublished.includes(l)));
  }
  const result = Buffer.from(out.join('\n'), 'utf8');
  if (diffLines(base, result) !== diffLines(head, mine)) throw Error(`${n}: 미공개 줄을 덜어 낸 판이 내 변경과 다르다 — 손으로 합친다`);
  console.error(`  ${n}: 바탕 뒤 미공개 커밋의 줄을 덜고 내 변경만 얹었다`);
  return result;
}
const override = {};
// 공개 빌드와 같은 손질 — 그 판 안의 파일 내용으로 토큰을 센다(공개.js가 공개본 값으로 맞춘 뒤 바뀐 파일만 새로 붙인다).
function build(rev) {
  const read = (n) => (rev === NEW && override[n] ? override[n] : rev === FS ? disk(n) : git('show', `${rev}:${PILOT}${n}`));
  const src = Object.fromEntries(NAMES.map((n) => [n, read(n)]));
  const token = (n) => sha(src[n]).slice(0, 12);
  let pilot = src['pilot.mjs'].toString('utf8').replaceAll('../synk-world-home/', './');
  for (const n of ['strings.mjs', 'takes.mjs', 'orbloom.mjs']) {
    const from = `'./${n}'`;
    if (pilot.split(from).length !== 2) throw Error(`${rev}: pilot.mjs 가져오기 없음 ${from}`);
    pilot = pilot.replace(from, `'./${n}?v=${n === 'orbloom.mjs' ? sha(read('orbloom.mjs')).slice(0, 12) : token(n)}'`);
  }
  const out = { ...src, 'pilot.mjs': Buffer.from(pilot, 'utf8') };
  const tokens = { 'pilot.css': token('pilot.css'), 'atlas-learning.js': token('atlas-learning.js'), 'pilot.mjs': sha(out['pilot.mjs']).slice(0, 12) };
  let page = src['index.html'].toString('utf8');
  if (!page.includes('<html lang="ko">')) throw Error(`${rev}: index.html <html lang="ko"> 없음`);
  page = page.replace('<html lang="ko">', '<html lang="ko" data-drama="world">');
  for (const [attr, n] of [['href', 'pilot.css'], ['src', 'atlas-learning.js'], ['src', 'pilot.mjs']]) {
    const from = `${attr}="${n}"`;
    if (page.split(from).length !== 2) throw Error(`${rev}: index.html 참조 없음 ${from}`);
    page = page.replace(from, `${attr}="${n}?v=${tokens[n]}"`);
  }
  out['index.html'] = Buffer.from(page, 'utf8');
  return out;
}
// base · new만 새로 쓴다 — 후보 폴더는 검수에 묶인 배포 증거라 지우지 않는다
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
if (!MINE) throw Error('--내바탕 <내 변경이 시작된 커밋>을 준다 — 바탕과 내 판 사이의 미공개 커밋 줄을 가를 기준이다(화면 검수 A1)');
for (const n of NAMES) if (sha(git('show', `${BASE}:${PILOT}${n}`)) !== sha(git('show', `${MINE}:${PILOT}${n}`))) override[n] = dropUnpublished(n, BASE);
fs.rmSync(tmp, { recursive: true, force: true });
const a = build(BASE), b = build(NEW), items = [];
for (const n of NAMES) {
  // 내용이 같은 파일은 싣지 않는다 — 공개.js가 바뀐 파일을 부르는 index.html · pilot.mjs의 토큰은 따라 고친다.
  if (sha(git('show', `${BASE}:${PILOT}${n}`)) === sha(override[n] || mineOf(n))) continue;
  for (const [dir, files] of [['base', a], ['new', b]]) {
    const file = path.join(OUT, dir, 'world/drama', n);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, files[n]);
  }
  items.push(`world/drama/${n}`);
}
let 후보 = path.join(OUT, '후보');
for (let n = 2; fs.existsSync(후보); n++) 후보 = path.join(OUT, '후보' + n);
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(후보)].join(' '));
