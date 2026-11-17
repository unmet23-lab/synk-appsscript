'use strict';
// 재확인 내구성 후속(2026-11-17, 설계 관문 §7)의 synk.im 공개 재료. 엔진 고침은 덧댄 공개 묶음에 저절로 안 실린다(현장 노트 배포 · 공개).
// 공개본 전체에서 엔진 사본을 표식(learning-ledger-1)으로 찾고(목록을 손으로 적지 않는다),
//   ① 공개본이 바탕 생성물과 같은 사본(줄끝은 걷고 견준다)은 지금 작업본 생성물로(생성기 길),
//   ② 그 밖(덧댄 계정 · 생활 묶음 · LAB · id · 타운)은 파서로 모듈 경계를 찾아 atlas/temper.js 모듈만 새 판으로 바꿔 끼우고, Core(compact)의
//      대체 표 한 줄에만 `fs`를 옮기는 토막을 앵커로 끼운다(모듈 길 — 묶음 안 나머지 바이트는 그대로, 틀은 인계_공개묶음.cjs · 막힘유지_공개묶음.cjs).
// 바꾸기 전 Temper 모듈이 바탕 판과 어떻게 다른지 토큰으로 견줘 목록.json 「기존차이」에 남긴다. 바탕(base 폴더)은 지금 공개본 바이트 그대로라
// 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인후속_공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-followup-after-pub-20261117[-판]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const { wrappers, squeeze, chunks } = require('./재확인_공개묶음.cjs');
const ROOT = path.resolve(__dirname, '../../../..'), COMMON = 공용작업본(ROOT);
const es = require(path.join(COMMON, 'node_modules', 'esbuild'));
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'HEAD';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `atlas-followup-after-pub-20261117${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const liveGit = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => { try { return liveGit(['cat-file', '-p', `origin/main:${pub}`]); } catch { return null; } };
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const lf = text => String(text).replace(/\r\n/g, '\n');
const MODULES = Object.freeze(['atlas/temper.js']);
// Core compact의 대체 표(읽기가 예외를 낸 접기) — 앞 표의 fs를 옮긴다. 묶음 꼴은 둘(압축 · 띄어 씀)이고 사본마다 꼭 한 자리여야 한다.
const CORE_FORMS = Object.freeze([
  { name: '압축', from: 'floor:ledger.cutoff,rows:Array.isArray(ledger.followups?.rows)?ledger.followups.rows:[]}',
    to: 'floor:ledger.cutoff,...ledger.followups?.fs?{fs:ledger.followups.fs}:{},rows:Array.isArray(ledger.followups?.rows)?ledger.followups.rows:[]}' },
  { name: '띄어 씀', from: 'floor: ledger.cutoff, rows: Array.isArray(ledger.followups?.rows) ? ledger.followups.rows : [] }',
    to: 'floor: ledger.cutoff, ...ledger.followups?.fs ? { fs: ledger.followups.fs } : {}, rows: Array.isArray(ledger.followups?.rows) ? ledger.followups.rows : [] }' },
]);
// 새 판에만 있는 글 · 없어진 글(끼운 뒤 공백을 걷고 확인).
const MARKS = Object.freeze(['lateStarts', 'markAhead', 'byTime', 'unsure.add(', 'standing(t)!==standing(a)', 'fs:ledger.followups.fs', 'trailKeys', 'known.set(cell', 'at>=row.at&&at<expires', '!!pair.l||pair.at<=cutoff']);
const GONE = Object.freeze(['floor:ledger.cutoff,rows:Array.isArray(ledger.followups?.rows)']);
const flat = text => String(text).replace(/\s+/g, '');
// Temper가 든 작업본 생성물(sync-atlas --all이 짓는 것) — 공개본이 그 바탕 판과 같으면 새 판은 작업본 판 그대로다.
const GENERATED = Object.freeze([
  ...['blank-slice', 'entry-check', 'hangul-stage', 'korean-racing', 'korean-rhythm', 'korean-runner', 'learning-hub', 'order-rush', 'snap-words', 'story-classroom', 'subway-rush', 'talk-rally', 'word-magic'].map(game => `experiences/${game}/atlas-learning.js`),
  'experiences/drama/pilot/atlas-learning.js', 'experiences/brand-opening/content/life-standalone.mjs', 'experiences/synk-world-app/world-account.bundle.mjs']);
const build = dir => es.buildSync({ stdin: { contents: "module.exports=require('./atlas/game-learning.js');", resolveDir: dir, loader: 'js' }, absWorkingDir: dir, bundle: true, write: false, format: 'iife', globalName: 'X', platform: 'browser', charset: 'utf8', target: 'es2022', minifyWhitespace: true, legalComments: 'none', logLevel: 'silent' }).outputFiles[0].text;
function newModules() {
  const text = build(ROOT), W = wrappers(text, 'script'), names = new Map([...W].map(([key, w]) => [w.name, key]));
  return { modules: Object.fromEntries(MODULES.map(key => { const w = W.get(key); if (!w) throw Error(`새 판에 없다: ${key}`); return [key, text.slice(w.start, w.end)]; })), names };
}
function baseBuild() {
  const dir = fs.mkdtempSync(path.join(TMP, 'atlas-base-'));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', BASE, 'atlas', 'strata'], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x'], { input: tar, cwd: dir, stdio: ['pipe', 'ignore', 'ignore'] });
    return build(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// Temper 모듈을 새 판으로(새 판의 require_* 이름은 이 묶음의 이름으로), 그다음 Core 대체 표 한 자리.
function swap(pub, text, fresh) {
  const W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script');
  const edits = MODULES.map(key => {
    const target = W.get(key); if (!target) throw Error(`${pub}: 모듈이 없다 ${key}`);
    const body = fresh.modules[key].replace(/\brequire_[\w$]+\b/g, name => {
      const source = fresh.names.get(name), there = source && W.get(source);
      if (!there) throw Error(`${pub}: ${key}가 부르는 ${name}(${source})이 이 묶음에 없다`);
      return there.name;
    });
    return { start: target.start, end: target.end, body };
  }).sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.body + out.slice(e.end);
  const hits = CORE_FORMS.flatMap(form => { const at = []; for (let i = out.indexOf(form.from); i >= 0; i = out.indexOf(form.from, i + 1)) at.push({ form, at: i }); return at; });
  if (hits.length !== 1) throw Error(`${pub}: Core 대체 표가 하나가 아니다(${hits.length})`);
  const { form, at } = hits[0];
  if (!out.slice(Math.max(0, at - 400), at).includes('sealFollowups(read')) throw Error(`${pub}: 대체 표 앞이 sealFollowups 읽기가 아니다`);
  return { text: out.slice(0, at) + form.to + out.slice(at + form.from.length), form: form.name };
}
function differences(pub, text, baseText) {
  const W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script'), B = wrappers(baseText, 'script'), out = {};
  for (const key of MODULES) { const w = W.get(key), b = B.get(key); out[key] = chunks(squeeze(text.slice(w.start, w.end)), squeeze(baseText.slice(b.start, b.end))); }
  return out;
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  const found = liveGit(['grep', '-l', 'learning-ledger-1', 'origin/main', '--', '*.js', '*.mjs']).toString('utf8').split('\n').filter(Boolean)
    .map(line => line.replace(/^origin\/main:/, '')).filter(pub => !pub.startsWith('.github/')).sort();
  const stale = found.filter(pub => !/temper-followup-3\b/.test(live(pub).toString('utf8')));
  if (stale.length) throw Error(`판 표시가 temper-followup-3이 아닌 사본: ${stale.join(', ')}`);
  // base · new · check만 비운다 — candidate*는 검수 사슬이 묶은 후보(증거)라 남긴다(현장 노트 배포 · 공개).
  for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  const write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const bases = new Map(GENERATED.map(source => [show(BASE, source), source]).filter(([bytes]) => bytes).map(([bytes, source]) => [lf(bytes.toString('utf8')), source]));
  const fresh = newModules(), baseText = baseBuild(), items = [], ways = {}, blobs = {}, 생성기 = {}, 기존차이 = {};
  for (const pub of found) {
    const before = live(pub), text = before.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(before)) throw Error(`${pub}: UTF-8로 그대로 읽히지 않는다`);
    const source = bases.get(lf(text));
    let after, way;
    if (source) { after = Buffer.from(lf(fs.readFileSync(path.join(ROOT, source), 'utf8')), 'utf8'); way = '생성기'; 생성기[pub] = source; }
    else { const swapped = swap(pub, text, fresh); after = Buffer.from(swapped.text, 'utf8'); way = `모듈 · Core ${swapped.form}`; if (!blobs[sha(before)]) 기존차이[pub] = differences(pub, text, baseText); }
    const flatAfter = flat(after.toString('utf8'));
    for (const mark of MARKS) if (!flatAfter.includes(flat(mark))) throw Error(`${pub}: 새 판 글이 없다 「${mark}」`);
    for (const gone of GONE) if (flatAfter.includes(flat(gone))) throw Error(`${pub}: 옛 판 글이 남았다 「${gone}」`);
    write('base', pub, before); write('new', pub, after);
    items.push(pub); ways[pub] = way; (blobs[sha(before)] ||= []).push(pub);
  }
  if (!items.length) throw Error('공개본에서 엔진 사본을 못 찾았다');
  // 검사 폴더: 묶음 종류마다 새 판 · 공개본 한 벌. ESM 묶음이 부르는 같은 폴더의 공개본 모듈은 따라 옮긴다(손으로 적은 목록은 남이 모듈을 더하면 낡는다).
  const check = path.join(OUT, 'check'); fs.mkdirSync(check, { recursive: true });
  const variants = Object.values(blobs).map(list => list[0]), manifest = [];
  const local = text => [...text.matchAll(/(?:import|export)[^;"']*?from\s*["']\.\/([^"'\/]+\.mjs)["']/g)].map(m => m[1]);
  for (const pub of variants) {
    const name = pub.replace(/[\\/]/g, '__'), dirOf = path.posix.dirname(pub);
    fs.copyFileSync(path.join(OUT, 'new', pub), path.join(check, `new__${name}`)); fs.copyFileSync(path.join(OUT, 'base', pub), path.join(check, `live__${name}`));
    const follow = pub.endsWith('.mjs') ? local(fs.readFileSync(path.join(OUT, 'new', pub), 'utf8')) : [], copied = new Set();
    while (follow.length) {
      const sibling = follow.shift(); if (copied.has(sibling)) continue; copied.add(sibling);
      const bytes = live(`${dirOf}/${sibling}`); if (!bytes) throw Error(`공개본에 없다: ${dirOf}/${sibling}`);
      fs.writeFileSync(path.join(check, sibling), bytes); follow.push(...local(bytes.toString('utf8')));
    }
    manifest.push({ pub, name, way: ways[pub], same: blobs[sha(fs.readFileSync(path.join(OUT, 'base', pub)))] });
  }
  fs.writeFileSync(path.join(check, '목록.json'), JSON.stringify(manifest, null, 1) + '\n');
  const sizes = Object.fromEntries(items.map(pub => [pub, [fs.statSync(path.join(OUT, 'base', pub)).size, fs.statSync(path.join(OUT, 'new', pub)).size]]));
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, 생성기, sizes, variants, 기존차이 }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 종류: variants.length, 생성기와같음: Object.keys(생성기).length, ways }, null, 1));
  for (const [pub, table] of Object.entries(기존차이)) console.log(`기존차이 ${pub}: ${MODULES.map(key => `${key.replace('atlas/', '')} ${table[key].length}`).join(' · ')}`);
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/재확인후속_공개검사.mjs "${check}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { MODULES, CORE_FORMS, swap };
