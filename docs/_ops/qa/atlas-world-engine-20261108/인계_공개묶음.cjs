'use strict';
// 동기화 인계 · 재확인의 늦은 도움(2026-11-10, 인계와_늦은도움_설계.md)의 synk.im 공개 재료. 엔진 고침은 공개본에 저절로 안 실린다(현장 노트 배포 · 공개).
// 공개본을 훑어 엔진 사본을 전부 찾고,
//   ① 공개본이 생성기 그대로인 묶음(바탕 생성물 = 공개본)은 지금 작업본 생성물로,
//   ② 그 밖(덧댄 계정 · 생활 묶음 · LAB · 모듈만 바꿔 끼운 WORLD 게임)은 파서로 모듈 경계를 찾아 atlas/temper · learning-sync 두 모듈만 새 판으로 바꿔 끼운다
//      (묶음 안 나머지 바이트는 그대로 — 틀은 재확인_공개묶음.cjs). 바꾸기 전 두 모듈이 바탕(master) 판과 어떻게 다른지 토큰으로 견줘 목록.json 「기존차이」에 남긴다.
// 바탕(base)은 지금 공개본 바이트 그대로라 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-world-engine-20261108/인계_공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-handover-pub-20261110[-판]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const { GENERATED, wrappers, squeeze, chunks } = require('./재확인_공개묶음.cjs');
const ROOT = path.resolve(__dirname, '../../../..'), COMMON = 공용작업본(ROOT);
const es = require(path.join(COMMON, 'node_modules', 'esbuild'));
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'origin/master';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `atlas-handover-pub-20261110${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const liveGit = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => { try { return liveGit(['cat-file', '-p', `origin/main:${pub}`]); } catch { return null; } };
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const lf = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
const MODULES = Object.freeze(['atlas/temper.js', 'atlas/learning-sync.js']);
// 새 판에만 있는 글 · 없어진 글(끼운 뒤 확인).
const MARKS = Object.freeze(['metLate(', 'the outbox was removed or changed outside this context', 'if(adopt()||asked!==era)continue']);
const GONE = Object.freeze(['helpedAt.get(', 'outbox was removed by another context']);
const flat = text => String(text).replace(/\s+/g, '');
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
function swap(pub, bytes, fresh) {
  const text = bytes.toString('utf8'), W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script');
  const edits = MODULES.map(key => {
    const target = W.get(key); if (!target) throw Error(`${pub}: 모듈이 없다 ${key}`);
    // 새 판의 require_* 이름을 이 묶음의 이름으로.
    const body = fresh.modules[key].replace(/\brequire_[\w$]+\b/g, name => {
      const source = fresh.names.get(name), there = source && W.get(source);
      if (!there) throw Error(`${pub}: ${key}가 부르는 ${name}(${source})이 이 묶음에 없다`);
      return there.name;
    });
    return { start: target.start, end: target.end, body };
  }).sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.body + out.slice(e.end);
  return out;
}
function differences(pub, bytes, baseText) {
  const text = bytes.toString('utf8'), W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script'), B = wrappers(baseText, 'script'), out = {};
  for (const key of MODULES) { const w = W.get(key), b = B.get(key); out[key] = chunks(squeeze(text.slice(w.start, w.end)), squeeze(baseText.slice(b.start, b.end))); }
  return out;
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  const found = liveGit(['grep', '-l', 'learning-ledger-1', 'origin/main']).toString('utf8').split('\n').filter(Boolean).map(line => line.replace(/^origin\/main:/, '')).filter(p => /\.(js|mjs)$/.test(p));
  const stale = found.filter(p => !/temper-followup-3\b/.test(live(p).toString('utf8')));
  if (stale.length) throw Error(`판 표시가 temper-followup-3이 아닌 사본: ${stale.join(', ')}`);
  for (const name of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, name), { recursive: true, force: true }); // candidate*(검수가 묶은 후보)는 지우지 않는다
  const fresh = newModules(), write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const items = [], ways = {}, blobs = {}, 기존차이 = {}, baseText = baseBuild();
  for (const pub of found) {
    const before = live(pub), source = GENERATED[pub];
    if (!blobs[sha(before)]) 기존차이[pub] = differences(pub, before, baseText);
    const baseGenerated = source && show(BASE, source);
    let after, way;
    // 줄끝만 다른 공개본(덧댄 판의 CRLF)도 생성기 판으로 본다 — 견줄 때는 줄끝을 걷는다.
    if (baseGenerated && lf(baseGenerated).equals(lf(before))) { after = lf(fs.readFileSync(path.join(ROOT, source))); way = '생성기'; }
    else { after = Buffer.from(swap(pub, before, fresh)); way = '모듈'; }
    const text = flat(after.toString('utf8'));
    for (const mark of MARKS) if (!text.includes(flat(mark))) throw Error(`${pub}: 새 판 글이 없다 「${mark}」`);
    for (const gone of GONE) if (text.includes(flat(gone))) throw Error(`${pub}: 옛 판 글이 남았다 「${gone}」`);
    write('base', pub, before); write('new', pub, after);
    items.push(pub); ways[pub] = way; (blobs[sha(before)] ||= []).push(pub);
  }
  // 검사 폴더: 묶음 종류마다 새 판 · 공개본 한 벌.
  const check = path.join(OUT, 'check'); fs.mkdirSync(check, { recursive: true });
  const variants = Object.values(blobs).map(list => list[0]), manifest = [];
  for (const pub of variants) { const name = pub.replace(/[\\/]/g, '__'); fs.copyFileSync(path.join(OUT, 'new', pub), path.join(check, `new__${name}`)); fs.copyFileSync(path.join(OUT, 'base', pub), path.join(check, `live__${name}`)); manifest.push({ pub, name, same: blobs[sha(fs.readFileSync(path.join(OUT, 'base', pub)))] }); }
  // 계정 묶음이 부르는 같은 폴더의 공개본 모듈(그 모듈이 부르는 것까지)을 따라 옮긴다 — 손으로 적은 목록은 남이 새 모듈을 더하면 낡는다.
  const follow = ['world-life-engine.mjs', 'life-content.mjs'], copied = new Set();
  const local = text => [...text.matchAll(/(?:import|export)[^;"']*?from\s*["']\.\/([^"'\/]+\.mjs)["']/g)].map(m => m[1]);
  if (items.includes('world/world-account.bundle.mjs')) follow.push(...local(fs.readFileSync(path.join(OUT, 'new', 'world/world-account.bundle.mjs'), 'utf8')));
  while (follow.length) {
    const name = follow.shift(); if (copied.has(name)) continue; copied.add(name);
    const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`);
    fs.writeFileSync(path.join(check, name), bytes); follow.push(...local(bytes.toString('utf8')));
  }
  fs.writeFileSync(path.join(check, '목록.json'), JSON.stringify(manifest, null, 1) + '\n');
  const sizes = Object.fromEntries(items.map(pub => [pub, [fs.statSync(path.join(OUT, 'base', pub)).size, fs.statSync(path.join(OUT, 'new', pub)).size]]));
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, sizes, variants, 기존차이 }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 종류: variants.length, ways }, null, 1));
  for (const [pub, table] of Object.entries(기존차이)) console.log(`기존차이 ${pub}: ${MODULES.map(key => `${key.replace('atlas/', '')} ${table[key].length}`).join(' · ')}`);
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/인계_공개검사.mjs "${check}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { MODULES, swap };
