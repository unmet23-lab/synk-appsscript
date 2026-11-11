'use strict';
// 기억 동기화 막힘 유지(2026-11-12, README §18 — 말 랠리 검수 H3)의 synk.im 공개 재료. 엔진 고침은 덧댄 공개 묶음에 저절로 안 실린다
// (현장 노트 배포 · 공개). 공개본 전체에서 memory-sync가 든 사본을 표식으로 찾고(목록을 손으로 적지 않는다), 그 구독 첫 줄 하나에만 정본
// atlas/memory-sync.js와 같은 토막 `phase === "blocked" || `를 끼운다 — 묶음 안 나머지 바이트는 그대로다. 묶음 꼴은 둘(띄어 쓴 꼴 · 압축 꼴)이고
// 사본마다 꼭 한 자리여야 한다. 공개본이 바탕 생성물과 같은 사본은 끼운 판이 지금 작업본 생성물과 같은지까지 본다(생성기 길 = 앵커 길).
// 바탕(base 폴더)은 지금 공개본 바이트 그대로라 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-world-engine-20261108/막힘유지_공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-memory-blocked-pub-20261112[-판]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..'), COMMON = 공용작업본(ROOT);
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'HEAD';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `atlas-memory-blocked-pub-20261112${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const liveGit = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => liveGit(['cat-file', '-p', `origin/main:${pub}`]);
const show = (rev, file) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const lf = text => text.replace(/\r\n/g, '\n');
const MARK = 'Atlas memory sync: an authenticated account adapter and transport are required';
const FORMS = Object.freeze([
  { name: '띄어 씀', from: 'if (stopped || change?.kind === "import") return;', to: 'if (stopped || phase === "blocked" || change?.kind === "import") return;' },
  { name: '압축', from: 'if(!(stopped||change?.kind==="import")){', to: 'if(!(stopped||phase==="blocked"||change?.kind==="import")){' },
]);
const FIXED = /stopped\s*\|\|\s*phase\s*===\s*"blocked"\s*\|\|\s*change\?\.kind\s*===\s*"import"/g;
// memory-sync가 든 작업본 생성물(sync-atlas --all이 짓는 것) — 공개본이 그 바탕 판과 같으면 끼운 판은 작업본 판과 같아야 한다.
const GENERATED = Object.freeze([
  ...['blank-slice', 'entry-check', 'hangul-stage', 'korean-racing', 'korean-rhythm', 'korean-runner', 'learning-hub', 'order-rush', 'snap-words', 'story-classroom', 'subway-rush', 'talk-rally', 'word-magic'].map(game => `experiences/${game}/atlas-learning.js`),
  'experiences/drama/pilot/atlas-learning.js', 'experiences/brand-opening/content/life-standalone.mjs', 'experiences/synk-world-app/world-account.bundle.mjs']);

// 그 사본의 기억 동기화 구독 첫 줄(꼭 하나)에 토막을 끼운다. 같은 함수의 phase 선언 뒤이고, 바로 뒤가 저장 실패 처리인지 본다.
function patch(pub, text) {
  const hits = FORMS.flatMap(form => { const out = []; for (let at = text.indexOf(form.from); at >= 0; at = text.indexOf(form.from, at + 1)) out.push({ form, at }); return out; });
  if (hits.length !== 1) throw Error(`${pub}: 기억 동기화 구독 첫 줄이 하나가 아니다(${hits.length})`);
  if ((text.match(FIXED) || []).length) throw Error(`${pub}: 이미 고친 줄이 있다`);
  const { form, at } = hits[0], mark = text.lastIndexOf(MARK, at);
  if (mark < 0) throw Error(`${pub}: 구독 줄 앞에 기억 동기화 표식이 없다`);
  if (!/\bphase\s*=\s*"idle"/.test(text.slice(mark, at))) throw Error(`${pub}: 같은 함수의 phase 선언을 못 찾았다`);
  if (!text.slice(at, at + 400).includes('failedLocalEdits')) throw Error(`${pub}: 구독 줄 뒤가 저장 실패 처리가 아니다`);
  return { text: text.slice(0, at) + form.to + text.slice(at + form.from.length), form: form.name };
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  const found = liveGit(['grep', '-l', '-F', MARK, 'origin/main', '--', '*.js', '*.mjs', '*.cjs']).toString('utf8').split('\n').filter(Boolean)
    .map(line => line.replace(/^origin\/main:/, '')).filter(pub => !pub.startsWith('.github/')).sort();
  // base · new · check만 비운다 — candidate*는 검수 사슬이 묶은 후보(증거)라 남긴다(현장 노트 배포 · 공개).
  for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  const write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const bases = new Map(GENERATED.map(source => [lf(show(BASE, source).toString('utf8')), source]));
  const items = [], ways = {}, blobs = {}, 생성기 = {};
  for (const pub of found) {
    const before = live(pub), text = before.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(before)) throw Error(`${pub}: UTF-8로 그대로 읽히지 않는다`);
    const { text: after, form } = patch(pub, text), source = bases.get(lf(text));
    if (source) {
      if (lf(after) !== lf(fs.readFileSync(path.join(ROOT, source), 'utf8'))) throw Error(`${pub}: 끼운 판이 작업본 생성물 ${source}와 다르다`);
      생성기[pub] = source;
    }
    write('base', pub, before); write('new', pub, Buffer.from(after, 'utf8'));
    items.push(pub); ways[pub] = form; (blobs[sha(before)] ||= []).push(pub);
  }
  if (!items.length) throw Error('공개본에서 기억 동기화 사본을 못 찾았다');
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
      const bytes = live(`${dirOf}/${sibling}`);
      fs.writeFileSync(path.join(check, sibling), bytes); follow.push(...local(bytes.toString('utf8')));
    }
    manifest.push({ pub, name, way: ways[pub], same: blobs[sha(fs.readFileSync(path.join(OUT, 'base', pub)))] });
  }
  fs.writeFileSync(path.join(check, '목록.json'), JSON.stringify(manifest, null, 1) + '\n');
  const sizes = Object.fromEntries(items.map(pub => [pub, [fs.statSync(path.join(OUT, 'base', pub)).size, fs.statSync(path.join(OUT, 'new', pub)).size]]));
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, 생성기, sizes, variants }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 종류: variants.length, 생성기와같음: Object.keys(생성기).length, ways }, null, 1));
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/막힘유지_공개검사.mjs "${check}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { FORMS, patch };
