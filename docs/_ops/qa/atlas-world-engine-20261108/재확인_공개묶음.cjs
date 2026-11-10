'use strict';
// 재확인 내구성(temper-followup-3, 2026-11-08)의 synk.im 공개 재료. 엔진 고침은 공개본에 저절로 안 실린다(현장 노트 배포 · 공개) — 공개본을 훑어 엔진 사본을 전부 찾고,
//   ① 공개본이 생성기 그대로인 묶음(바탕 생성물 = 공개본)은 지금 작업본 생성물로,
//   ② 그 밖(모듈마다 공백을 줄인 판 · 덧댄 계정 · 생활 묶음 · LAB)은 파서로 모듈 경계를 찾아 atlas/temper · learning-ledger · game-learning 세 모듈만 새 판으로 바꿔 끼운다
//      (묶음 안 나머지 바이트는 그대로). 바꾸기 전 세 모듈이 바탕(master) 판과 어떻게 다른지 토큰으로 견줘 목록.json 「기존차이」에 남긴다 — 앞 단계 고침 · 이름 꼬리뿐이어야 한다.
//      생활 묶음의 Core만 탭 임대 공유(11-02) 전 판이라 모듈째 바꾸면 그 일까지 실린다 — readFollowups · compact 두 함수만 바꿔 끼운다.
//   ③ 소비: world/world-learning-followups.mjs · world/life-followups.mjs(바탕 → 작업본), 생활 묶음 안 사본은 앵커 둘.
// 바탕(base)은 지금 공개본 바이트 그대로라 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인_공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-followup3-pub-20261108[-판]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..'), COMMON = 공용작업본(ROOT);
const acorn = require(path.join(COMMON, 'node_modules', 'acorn')), es = require(path.join(COMMON, 'node_modules', 'esbuild'));
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'origin/master';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `atlas-followup3-pub-20261108${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const liveGit = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => { try { return liveGit(['cat-file', '-p', `origin/main:${pub}`]); } catch { return null; } };
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const MODULES = Object.freeze(['atlas/temper.js', 'atlas/learning-ledger.js', 'atlas/game-learning.js']);
const CORE = 'atlas/game-learning.js', CORE_FUNCTIONS = Object.freeze(['readFollowups', 'compact']);
// 생활 묶음 Core는 두 함수만 바꿔 끼우므로, 그 밖에서 이번 판이 고친 importEvents의 세 자리(서버에만 남는 도움 → Temper.lateHelp)는
// 앵커로 옮긴다 — 옮길 글은 새 판 Core 모듈에 그대로 있어야 한다(셋째 사슬 GPT GA2: 두 함수만 바꾸면 이 고침이 생활 묶음에 안 실렸다).
const LIFE_CORE_EDITS = Object.freeze([
  ['late=[],gone=[],skipped=[];', 'late=[],gone=[],skipped=[],lent=[];'],
  ['if(event.type==="record.excluded")gone.push(event.targetId);continue', 'if(event.type==="record.excluded")gone.push(event.targetId);if(event.type==="practice.helped")lent.push(event);continue'],
  ['ledger=Ledger.demote(ledger,{late,excluded:gone,strays:skipped.length},id=>known.get(id));',
    'ledger=Ledger.demote(ledger,{late,excluded:gone,strays:skipped.length},id=>known.get(id));if(lent.length&&ledger?.followups)ledger={...ledger,followups:Temper.lateHelp(ledger.followups,lent)};'],
  // refresh: 다른 탭이 먼저 쓴 장부와 합칠 때 어느 표가 남든 재확인 표시를 옮겨 붙인다(셋째 사슬 아르곤 A2 — Temper.carryMarks).
  ['ledger=Ledger.reconcile(ledger,theirs)||(order<0?theirs:ledger);',
    'const ours=ledger;ledger=Ledger.reconcile(ours,theirs)||(order<0?theirs:ours);if(ledger?.followups){const table=Temper.carryMarks(ledger.followups,[ours?.followups,theirs?.followups]);if(table!==ledger.followups)ledger={...ledger,followups:table}}'],
]);
// 공개 경로 → 생성기 원천(있으면 ① 길). 없는 것은 ② 길.
const GENERATED = Object.freeze({ 'world/blank-slice/atlas-learning.js': 'experiences/blank-slice/atlas-learning.js', 'world/entry-check/atlas-learning.js': 'experiences/entry-check/atlas-learning.js',
  'world/order-rush/atlas-learning.js': 'experiences/order-rush/atlas-learning.js', 'world/snap-words/atlas-learning.js': 'experiences/snap-words/atlas-learning.js',
  'world/subway-rush/atlas-learning.js': 'experiences/subway-rush/atlas-learning.js', 'world/drama/atlas-learning.js': 'experiences/drama/pilot/atlas-learning.js' });
// 생활 묶음 안 재확인 공급 사본(옛 followupRows) — 원천 world-learning-followups.mjs와 같은 뜻으로.
const LIFE = 'world/brand-opening/content/life-standalone.mjs';
const LIFE_EDITS = Object.freeze([
  ['const limited = projection.evidenceComplete !== true || projection.coverage?.limited === true || projection.coverage?.retentionLimited === true;',
    'const limited = projection.evidenceComplete !== true || projection.coverage?.retentionLimited === true;'],
  ['return { available: true, limited, rows: rows2.sort((a, b) => Number(b.status === "due") - Number(a.status === "due") || Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 12) };',
    'const rank = (row) => row.status === "due" ? row.available ? 2 : 1 : 0;\n  return { available: true, limited, rows: rows2.sort((a, b) => rank(b) - rank(a) || Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 12) };'],
]);

// 묶음 안 __commonJS 모듈: 경로 → { 이름, 함수 값 범위 }.
function wrappers(text, sourceType) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }), out = new Map();
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'VariableDeclarator' && n.init?.type === 'CallExpression' && n.init.callee?.type === 'Identifier' && /__commonJS/.test(n.init.callee.name) && n.init.arguments[0]?.type === 'ObjectExpression') {
      const p = n.init.arguments[0].properties[0], key = p.key.value ?? p.key.name;
      if (typeof key === 'string' && !out.has(key)) out.set(key, { name: n.id.name, start: p.value.start, end: p.value.end });
      return;
    }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  return out;
}
// 새 판 세 모듈(공백만 줄임, 이름은 그대로). 게임 브라우저 입구로 지어 묶음 안 꼴과 같게.
function newModules() {
  const text = es.buildSync({ stdin: { contents: "module.exports=require('./atlas/game-learning.js');", resolveDir: ROOT, loader: 'js' }, absWorkingDir: ROOT, bundle: true, write: false, format: 'iife', globalName: 'X', platform: 'browser', charset: 'utf8', target: 'es2022', minifyWhitespace: true, legalComments: 'none', logLevel: 'silent' }).outputFiles[0].text;
  const W = wrappers(text, 'script'), names = new Map([...W].map(([key, w]) => [w.name, key]));
  return { modules: Object.fromEntries(MODULES.map(key => { const w = W.get(key); if (!w) throw Error(`새 판에 없다: ${key}`); return [key, text.slice(w.start, w.end)]; })), names };
}
// 모듈 값 안의 이름 붙은 함수 선언의 범위(하나뿐이어야 한다).
function declared(text, start, end, name, label) {
  const ast = acorn.parse(`x={m${text.slice(start, end)}}`, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }), found = [], shift = start - 4;
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) found.push({ start: n.start + shift, end: n.end + shift });
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (found.length !== 1) throw Error(`${label}: 함수 ${name}이 하나가 아니다(${found.length})`);
  return found[0];
}
function swap(pub, bytes, fresh) {
  const text = bytes.toString('utf8'), W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script');
  const edits = MODULES.flatMap(key => {
    const target = W.get(key); if (!target) throw Error(`${pub}: 모듈이 없다 ${key}`);
    if (pub === LIFE && key === CORE) return CORE_FUNCTIONS.map(name => {
      const there = declared(text, target.start, target.end, name, pub), source = fresh.modules[key], mine = declared(source, 0, source.length, name, '새 판');
      return { start: there.start, end: there.end, body: source.slice(mine.start, mine.end) };
    });
    // 새 판의 require_* 이름을 이 묶음의 이름으로.
    const body = fresh.modules[key].replace(/\brequire_[\w$]+\b/g, name => {
      const source = fresh.names.get(name), there = source && W.get(source);
      if (!there) throw Error(`${pub}: ${key}가 부르는 ${name}(${source})이 이 묶음에 없다`);
      return there.name;
    });
    return [{ start: target.start, end: target.end, body }];
  }).sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.body + out.slice(e.end);
  if (pub === LIFE) for (const [from, to] of LIFE_CORE_EDITS) {
    if (!fresh.modules[CORE].includes(to)) throw Error(`새 판 Core에 없는 글이다(손으로 옮긴 글이 원천과 갈림): ${to.slice(0, 60)}`);
    const count = out.split(from).length - 1; if (count !== 1) throw Error(`${pub}: Core 앵커가 하나가 아니다(${count}): ${from.slice(0, 60)}`);
    out = out.replace(from, () => to);
  }
  return out;
}
// 바꾸기 전 세 모듈이 바탕 판과 어떻게 다른가: 공백을 맞추고 require_ 꼬리 · module2 · exports2를 지운 뒤 토큰으로 견준다. 이름 꼬리만 다른 조각은 세지 않는다.
const squeeze = code => es.transformSync(`globalThis.__m=function${code};`, { minifySyntax: true, minifyWhitespace: true, charset: 'utf8', target: 'es2022', legalComments: 'none' }).code
  .replace(/\b(module|exports)\d+\b/g, '$1').replace(/(require_[A-Za-z_]+?)\d+\(\)/g, '$1()');
const tok = s => s.match(/[A-Za-z_$][\w$]*|\d+|"(?:[^"\\]|\\.)*"|\s+|./g);
function chunks(a, b) {
  const A = tok(a), B = tok(b), out = []; let i = 0, j = 0, lost = null;
  while (i < A.length || j < B.length) {
    if (i < A.length && A[i] === B[j]) { i += 1; j += 1; continue; }
    let found = false;
    for (let k = 1; k < 800 && !found; k++) for (let l = 0; l <= k && !found; l++) {
      const x = i + l, y = j + (k - l);
      if (x < A.length && y < B.length && A[x] === B[y] && A.slice(x, x + 6).join('') === B.slice(y, y + 6).join('')) { out.push([A.slice(i, x).join('').slice(0, 160), B.slice(j, y).join('').slice(0, 160)]); i = x; j = y; found = true; }
    }
    if (!found) { lost = ['(여기서 못 맞춤) ' + A.slice(i, i + 30).join(''), B.slice(j, j + 30).join('')]; break; }
  }
  // 이름 꼬리만 다른 조각(window ↔ window2, DAY3 ↔ DAY 등)은 뺀다.
  return [...out.filter(([x, y]) => x.replace(/\d+/g, '') !== y.replace(/\d+/g, '')), ...(lost ? [lost] : [])];
}
function differences(pub, bytes, baseText) {
  const text = bytes.toString('utf8'), W = wrappers(text, pub.endsWith('.mjs') ? 'module' : 'script'), B = wrappers(baseText, 'script'), out = {};
  for (const key of MODULES) { const w = W.get(key), b = B.get(key); out[key] = chunks(squeeze(text.slice(w.start, w.end)), squeeze(baseText.slice(b.start, b.end))); }
  return out;
}
function baseBuild() {
  const dir = fs.mkdtempSync(path.join(TMP, 'atlas-base-'));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', BASE, 'atlas', 'strata'], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x'], { input: tar, cwd: dir, stdio: ['pipe', 'ignore', 'ignore'] });
    return es.buildSync({ stdin: { contents: "module.exports=require('./atlas/game-learning.js');", resolveDir: dir, loader: 'js' }, absWorkingDir: dir, bundle: true, write: false, format: 'iife', globalName: 'X', platform: 'browser', charset: 'utf8', target: 'es2022', minifyWhitespace: true, legalComments: 'none', logLevel: 'silent' }).outputFiles[0].text;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  // 공개본 전 경로에서 엔진 사본을 찾는다 — 목록을 손으로 적지 않는다.
  const found = liveGit(['grep', '-l', 'learning-ledger-1', 'origin/main']).toString('utf8').split('\n').filter(Boolean).map(line => line.replace(/^origin\/main:/, '')).filter(p => /\.(js|mjs)$/.test(p));
  const old = found.filter(p => /temper-followup-[12]\b/.test(live(p).toString('utf8')));
  if (old.length !== found.length) throw Error(`판 표시가 없는 사본: ${found.filter(p => !old.includes(p)).join(', ')}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  const fresh = newModules(), write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const items = [], ways = {}, blobs = {}, 기존차이 = {}, baseText = baseBuild();
  for (const pub of found) {
    const before = live(pub), source = GENERATED[pub];
    if (!blobs[sha(before)]) 기존차이[pub] = differences(pub, before, baseText);
    let after, way;
    const baseGenerated = source && show(BASE, source);
    if (baseGenerated && baseGenerated.equals(before)) { after = fs.readFileSync(path.join(ROOT, source)); way = '생성기'; }
    else { after = Buffer.from(swap(pub, before, fresh)); way = '모듈'; }
    if (pub === LIFE) {
      let text = after.toString('utf8');
      for (const [from, to] of LIFE_EDITS) { const count = text.split(from).length - 1; if (count !== 1) throw Error(`생활 묶음 앵커가 하나가 아니다(${count}): ${from.slice(0, 60)}`); text = text.replace(from, () => to); }
      after = Buffer.from(text); way += '+공급 앵커';
    }
    if (!after.toString('utf8').includes('temper-followup-3')) throw Error(`${pub}: 새 판 표시가 없다`);
    if (/temper-followup-[12]"/.test(after.toString('utf8'))) throw Error(`${pub}: 옛 판 표시가 남았다`);
    if (/\.retention\(/.test(after.toString('utf8'))) throw Error(`${pub}: 없어진 Ledger.retention을 부른다`);
    if (pub === LIFE && after.toString('utf8').includes('__synkAtlasHistoryLease')) throw Error(`${pub}: 탭 임대 공유까지 실렸다`);
    write('base', pub, before); write('new', pub, after);
    items.push(pub); ways[pub] = way; (blobs[sha(before)] ||= []).push(pub);
  }
  // 소비 모듈 둘: 바탕 → 작업본(공개본이 바탕과 같아야 한다).
  for (const [src, pub] of [['experiences/synk-world-app/world-learning-followups.mjs', 'world/world-learning-followups.mjs'], ['experiences/synk-world-app/life-followups.mjs', 'world/life-followups.mjs']]) {
    const base = show(BASE, src), now = live(pub), after = fs.readFileSync(path.join(ROOT, src));
    if (!base || !now || !base.equals(now)) throw Error(`${pub}: 바탕이 공개본과 다르다 — 공개본의 원천을 바탕으로 다시 잡는다`);
    if (base.equals(after)) throw Error(`${pub}: 바뀌지 않았다`);
    write('base', pub, base); write('new', pub, after); items.push(pub); ways[pub] = '소비';
  }
  // 검사 폴더: 묶음 종류마다 새 판 · 공개본 한 벌 + 소비 모듈 새 판 · 공개본.
  const check = path.join(OUT, 'check'); fs.mkdirSync(check, { recursive: true });
  const variants = Object.values(blobs).map(list => list[0]), manifest = [];
  for (const pub of variants) { const name = pub.replace(/[\\/]/g, '__'); fs.copyFileSync(path.join(OUT, 'new', pub), path.join(check, `new__${name}`)); fs.copyFileSync(path.join(OUT, 'base', pub), path.join(check, `live__${name}`)); manifest.push({ pub, name, same: blobs[sha(fs.readFileSync(path.join(OUT, 'base', pub)))] }); }
  fs.copyFileSync(path.join(OUT, 'new', 'world/world-learning-followups.mjs'), path.join(check, 'new__world-learning-followups.mjs'));
  fs.copyFileSync(path.join(OUT, 'base', 'world/world-learning-followups.mjs'), path.join(check, 'live__world-learning-followups.mjs'));
  fs.copyFileSync(path.join(OUT, 'new', 'world/life-followups.mjs'), path.join(check, 'new__life-followups.mjs'));
  fs.copyFileSync(path.join(OUT, 'base', 'world/life-followups.mjs'), path.join(check, 'live__life-followups.mjs'));
  // 계정 묶음이 부르는 같은 폴더의 공개본 모듈(그 모듈이 부르는 것까지)을 따라 옮긴다 — 손으로 적은 목록은 남이 새 모듈을 더하면 낡는다(11-09 말하기 E가 world-speaking-engine.mjs를 더함).
  const follow = ['world-life-engine.mjs', 'life-content.mjs'], copied = new Set();
  const local = text => [...text.matchAll(/(?:import|export)[^;"']*?from\s*["']\.\/([^"'\/]+\.mjs)["']/g)].map(m => m[1]);
  follow.push(...local(fs.readFileSync(path.join(OUT, 'new', 'world/world-account.bundle.mjs'), 'utf8')));
  while (follow.length) {
    const name = follow.shift(); if (copied.has(name)) continue; copied.add(name);
    const bytes = live(`world/${name}`); if (!bytes) throw Error(`공개본에 없다: world/${name}`);
    fs.writeFileSync(path.join(check, name), bytes); follow.push(...local(bytes.toString('utf8')));
  }
  fs.copyFileSync(path.join(OUT, 'new', 'world/world-account.bundle.mjs'), path.join(check, 'world-account.bundle.mjs'));
  fs.copyFileSync(path.join(OUT, 'new', 'world/world-learning-followups.mjs'), path.join(check, 'world-learning-followups.mjs'));
  fs.writeFileSync(path.join(check, '목록.json'), JSON.stringify(manifest, null, 1) + '\n');
  const sizes = Object.fromEntries(items.map(pub => [pub, [fs.statSync(path.join(OUT, 'base', pub)).size, fs.statSync(path.join(OUT, 'new', pub)).size]]));
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, sizes, variants, 기존차이 }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 엔진사본: found.length, 종류: variants.length, ways }, null, 1));
  for (const [pub, table] of Object.entries(기존차이)) console.log(`기존차이 ${pub}: ${MODULES.map(key => `${key.replace('atlas/', '')} ${table[key].length}`).join(' · ')}`);
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/재확인_공개검사.mjs "${check}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { MODULES, GENERATED, LIFE_EDITS, LIFE_CORE_EDITS, swap, wrappers, squeeze, chunks };
