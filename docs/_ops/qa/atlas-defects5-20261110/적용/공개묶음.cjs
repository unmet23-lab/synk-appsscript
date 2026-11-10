'use strict';
// Atlas 결함 다섯 고침(2026-11-10, 설계 §5)의 synk.im 공개 재료. 재확인_공개묶음.cjs(11-08)를 본떴다 — 엔진 고침은 덧댄 공개 묶음에
// 저절로 안 실린다(현장 노트 배포 · 공개 「덧댄 공개 묶음에는 엔진 고침도 저절로 실리지 않는다」).
//   공개본 전체에서 엔진 사본(Core 표식 · 계정 호스트 표식)을 찾고 — 목록을 손으로 적지 않는다 —
//   ① 공개본 = 바탕 생성물인 파일은 지금 작업본 생성물로(줄끝은 공개본 것을 따른다),
//   ② 그 밖은 파서로 __commonJS 모듈 경계를 찾아 atlas/learning.js · atlas/vellum.js · 계정 호스트(world-learning-host)를 새 판으로
//      바꿔 끼우고, atlas/game-learning.js는 접기 막는 줄 하나만 앵커로 고친다(묶음 안 나머지 바이트는 그대로). 바꾸기 전 모듈이 바탕 판과
//      어떻게 다른지 토큰으로 견줘 목록.json 「기존차이」에 남긴다 — 이름 꼬리 말고 다른 것이 있으면 통째 바꾸기가 그 차이까지 싣는다.
//   ③ world/brand-opening/world-strings.mjs는 공개본 + (바탕 → 작업본)을 git merge-file로.
// 바탕(base 폴더)은 지금 공개본 바이트 그대로라 공개.js 3방향이 곧 새 판이다.
//   node docs/_ops/qa/atlas-defects5-20261110/적용/공개묶음.cjs [--바탕 <커밋>] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-defects5-pub-20261110[-판]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../../..'), COMMON = 공용작업본(ROOT);
const acorn = require(path.join(COMMON, 'node_modules', 'acorn')), es = require(path.join(COMMON, 'node_modules', 'esbuild'));
const argv = process.argv.slice(2), opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const 판 = opt('--판') || '', BASE = opt('--바탕') || 'HEAD';
if (판 && !/^[A-Za-z0-9_-]{1,40}$/.test(판)) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const TMP = path.join(COMMON, '.tmp'), OUT = path.join(TMP, `atlas-defects5-pub-20261110${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const liveGit = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const live = pub => { try { return liveGit(['cat-file', '-p', `origin/main:${pub}`]); } catch { return null; } };
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const lf = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
// 공개본 줄끝을 따른다: 공개본에 CR이 없으면 새 판의 CR을 뺀다.
const eolLike = (bytes, like) => like.includes(13) ? bytes : lf(bytes);

const CORE_MARK = 'Core: invalid learning candidate', HOST_MARK = 'Verified WORLD account required';
const HOST_SOURCE = 'experiences/synk-account/src/generated/world-learning-host.cjs';
const SWAP = Object.freeze(['atlas/learning.js', 'atlas/vellum.js']), STORE = 'atlas/game-learning.js', FLOW = 'atlas/game-flow.js';
// 순간 맞춤(설계 §3-2 v0.4): 위 다섯 창에서 1분 안의 다시(Core recommend().waiting)를 뺀다. 묶음 꼴 둘(공백 줄임 · 그대로).
function flowEdit(text, w, pub) {
  const body = text.slice(w.start, w.end), re = /const ranked\s*=\s*\[recommendation\.selected,\s*\.\.\.recommendation\.alternatives\]\s*\.slice\(0,\s*within\);/g, hits = [...body.matchAll(re)];
  if (hits.length !== 1) throw Error(`${pub}: 순간 맞춤 창 줄이 하나가 아니다(${hits.length})`);
  const hit = hits[0], spaced = /\s/.test(hit[0]);
  const to = spaced ? 'const ranked = [recommendation.selected, ...recommendation.alternatives.filter((c) => !recommendation.waiting?.includes(c.id))].slice(0, within);'
    : 'const ranked=[recommendation.selected,...recommendation.alternatives.filter(c=>!recommendation.waiting?.includes(c.id))].slice(0,within);';
  return { start: w.start + hit.index, end: w.start + hit.index + hit[0].length, body: to };
}
const isHost = key => /(^|\/)(src\/generated\/world-learning-host\.cjs|account\/world-learning-host\.js)$/.test(key);
// 공개 경로 → 생성기 원천(공개본 = 바탕 생성물이면 ① 길).
const GENERATED = Object.freeze({
  'world/blank-slice/atlas-learning.js': 'experiences/blank-slice/atlas-learning.js', 'world/entry-check/atlas-learning.js': 'experiences/entry-check/atlas-learning.js',
  'world/order-rush/atlas-learning.js': 'experiences/order-rush/atlas-learning.js', 'world/snap-words/atlas-learning.js': 'experiences/snap-words/atlas-learning.js',
  'world/subway-rush/atlas-learning.js': 'experiences/subway-rush/atlas-learning.js', 'world/drama/atlas-learning.js': 'experiences/drama/pilot/atlas-learning.js',
  'world/hangul-stage/atlas-learning.js': 'experiences/hangul-stage/atlas-learning.js', 'world/korean-rhythm/atlas-learning.js': 'experiences/korean-rhythm/atlas-learning.js',
  'world/korean-runner/atlas-learning.js': 'experiences/korean-runner/atlas-learning.js',
  'world/snap-words/learning.mjs': 'experiences/snap-words/learning.mjs' });
const STRINGS = ['world/brand-opening/world-strings.mjs', 'experiences/brand-opening/world-strings.mjs'];

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
const sourceTypeOf = pub => (pub.endsWith('.mjs') ? 'module' : 'script');
const hostKey = W => { const keys = [...W.keys()].filter(isHost); if (keys.length > 1) throw Error(`호스트 모듈이 둘 이상: ${keys}`); return keys[0] || null; };
// 새 판(또는 바탕 판) 모듈 — 게임 브라우저 입구와 같은 꼴(공백만 줄임)으로 짓는다.
function build(dir) {
  const opts = { absWorkingDir: dir, bundle: true, write: false, format: 'iife', globalName: 'X', platform: 'browser', charset: 'utf8', target: 'es2022', minifyWhitespace: true, legalComments: 'none', logLevel: 'silent' };
  const text = es.buildSync({ ...opts, stdin: { contents: `module.exports=[require('./atlas/game-learning.js'),require('./${HOST_SOURCE}')];`, resolveDir: dir, loader: 'js' } }).outputFiles[0].text;
  const W = wrappers(text, 'script'), names = new Map([...W].map(([key, w]) => [w.name, key])), host = hostKey(W);
  const modules = Object.fromEntries([...SWAP, STORE].map(key => { const w = W.get(key); if (!w) throw Error(`판에 없다: ${key}`); return [key, text.slice(w.start, w.end)]; }));
  if (!host) throw Error('판에 호스트 모듈이 없다'); modules.host = text.slice(W.get(host).start, W.get(host).end);
  return { modules, names };
}
function baseBuild() {
  const dir = fs.mkdtempSync(path.join(TMP, 'atlas5-base-'));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', BASE, 'atlas', 'strata', HOST_SOURCE], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x'], { input: tar, cwd: dir, stdio: ['pipe', 'ignore', 'ignore'] });
    return build(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// 접기 막는 줄(설계 §2): 묶음 꼴마다 하나. `complete`는 묶음에서 이름이 바뀔 수 있어 `=historyComplete` 자리에서 읽는다.
function storeEdit(text, w, pub) {
  const body = text.slice(w.start, w.end), name = /([\w$]+)\s*=\s*historyComplete\b/.exec(body)?.[1];
  if (!name) throw Error(`${pub}: game-learning에서 complete 이름을 못 찾았다`);
  const forms = [/if\s*\(\s*!folding\s*\|\|\s*paged\s*\)\s*return\s*;/g];
  const hits = forms.flatMap(re => [...body.matchAll(re)]);
  if (hits.length !== 1) throw Error(`${pub}: 접기 막는 줄이 하나가 아니다(${hits.length})`);
  const hit = hits[0], spaced = /\s/.test(hit[0]);
  const to = spaced ? `if (!folding || paged && !${name}) return;` : `if(!folding||paged&&!${name})return;`;
  return { start: w.start + hit.index, end: w.start + hit.index + hit[0].length, body: to };
}
// 계정 호스트(설계 §1): `shared`와 개인 기억 `ownStorage`가 저장소 열거(key · length)를 같은 확인을 거쳐 넘기게 한다. 묶음마다 이름이
// 다르므로(check2 · own3) 파서로 자리와 이름을 읽는다 — shared의 getItem 첫 호출이 확인 함수, 그 return의 대상이 저장소다.
function hostEdits(text, w, pub) {
  const shift = w.start - 4, ast = acorn.parse(`x={m${text.slice(w.start, w.end)}}`, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  const found = { shared: [], own: [] };
  (function walk(n, parent) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(x => walk(x, parent)); return; }
    if (n.type === 'VariableDeclarator' && n.id?.name === 'shared' && n.init?.type === 'ObjectExpression' && n.init.properties.some(p => (p.key?.name ?? p.key?.value) === 'getItem')) found.shared.push({ n, statement: parent });
    if (n.type === 'VariableDeclarator' && n.id?.name === 'ownStorage') found.own.push({ n });
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v, n.type === 'VariableDeclaration' ? n : parent); }
  })(ast, null);
  if (found.shared.length !== 1 || found.own.length !== 1) throw Error(`${pub}: 호스트 shared · ownStorage가 하나씩이 아니다(${found.shared.length} · ${found.own.length})`);
  const { n: shared, statement } = found.shared[0], getItem = shared.init.properties.find(p => (p.key?.name ?? p.key?.value) === 'getItem').value.body.body;
  // 꼴 둘: `check();return storage.getItem(key)` · `return check(), storage.getItem(key)`.
  let call = getItem.find(s => s.type === 'ExpressionStatement')?.expression, ret = getItem.find(s => s.type === 'ReturnStatement')?.argument;
  if (ret?.type === 'SequenceExpression') { call = call || ret.expressions[0]; ret = ret.expressions.at(-1); }
  const check = call?.type === 'CallExpression' && call.callee.type === 'Identifier' ? call.callee.name : null, store = ret?.callee?.object?.type === 'Identifier' ? ret.callee.object.name : null;
  if (!check || !store) throw Error(`${pub}: 호스트 확인 함수 · 저장소 이름을 못 읽었다(${check} · ${store})`);
  const own = found.own[0].n, ownStore = /([\w$]+)\.storage\[/.exec(text.slice(own.init.start + shift, own.init.end + shift))?.[1];
  if (!ownStore) throw Error(`${pub}: ownStorage의 기억 이름을 못 읽었다`);
  const spaced = /\n\s/.test(text.slice(statement.start + shift, statement.end + shift));
  const define = spaced
    ? `const enumerated = (target, store) => {\n  if (typeof store?.key !== "function" || !("length" in store)) return target;\n  Object.defineProperty(target, "length", { enumerable: true, get() {\n    ${check}();\n    return store.length;\n  } });\n  target.key = (index) => {\n    ${check}();\n    return store.key(index);\n  };\n  return target;\n};\n`
    : `const enumerated=(target,store)=>{if(typeof store?.key!=="function"||!("length"in store))return target;Object.defineProperty(target,"length",{enumerable:!0,get(){${check}();return store.length}});target.key=index=>(${check}(),store.key(index));return target};`;
  const at = (node, body) => ({ start: node.start + shift, end: node.end + shift, body });
  return [
    { start: statement.start + shift, end: statement.start + shift, body: define },
    at(shared.init, `enumerated(${text.slice(shared.init.start + shift, shared.init.end + shift)},${store})`),
    at(own.init, `enumerated(${text.slice(own.init.start + shift, own.init.end + shift)},${ownStore}.storage)`),
  ];
}
function swap(pub, bytes, fresh) {
  const text = bytes.toString('utf8'), W = wrappers(text, sourceTypeOf(pub)), edits = [];
  const rename = (source, label) => source.replace(/\brequire_[\w$]+\b/g, name => {
    const key = fresh.names.get(name), there = key && W.get(key);
    if (!there) throw Error(`${pub}: ${label}가 부르는 ${name}(${key})이 이 묶음에 없다`);
    return there.name;
  });
  const core = W.get('atlas/learning.js');
  if (core) {
    for (const key of SWAP) { const w = W.get(key); if (!w) throw Error(`${pub}: 모듈이 없다 ${key}`); edits.push({ start: w.start, end: w.end, body: rename(fresh.modules[key], key) }); }
    const store = W.get(STORE); if (!store) throw Error(`${pub}: 모듈이 없다 ${STORE}`); edits.push(storeEdit(text, store, pub));
    const flow = W.get(FLOW); if (!flow) throw Error(`${pub}: 모듈이 없다 ${FLOW}`); edits.push(flowEdit(text, flow, pub));
  }
  // 호스트는 공개본마다 판이 달라(연결 끊기 · 재확인 인자 전 판, 손으로 덧댄 판) 통째로 바꾸지 않고 이번 고침 두 자리만 고친다.
  const host = hostKey(W);
  if (host) edits.push(...hostEdits(text, W.get(host), pub));
  if (!edits.length) throw Error(`${pub}: 바꿀 모듈이 없다`);
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.body + out.slice(e.end);
  return { out, has: { core: !!core, host: !!host } };
}
// 바꾸기 전 모듈이 바탕 판과 어떻게 다른가: 공백을 맞추고 require_ 꼬리 · module2 · exports2를 지운 뒤 토큰으로 견준다. 이름 꼬리만 다른 조각은 세지 않는다.
const squeeze = code => es.transformSync(`globalThis.__m=function${code};`, { minifySyntax: true, minifyWhitespace: true, charset: 'utf8', target: 'es2022', legalComments: 'none' }).code
  .replace(/\b(module|exports)\d+\b/g, '$1').replace(/(require_[A-Za-z_]+?)\d+\(\)/g, '$1()');
const tok = s => s.match(/[A-Za-z_$][\w$]*|\d+|"(?:[^"\\]|\\.)*"|\s+|./g) || [];
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
  return [...out.filter(([x, y]) => x.replace(/\d+/g, '') !== y.replace(/\d+/g, '')), ...(lost ? [lost] : [])];
}
function differences(pub, bytes, base) {
  const text = bytes.toString('utf8'), W = wrappers(text, sourceTypeOf(pub)), out = {};
  const keys = [...(W.has('atlas/learning.js') ? [...SWAP, STORE] : []), ...(hostKey(W) ? ['host'] : [])];
  for (const key of keys) { const w = key === 'host' ? W.get(hostKey(W)) : W.get(key); out[key] = chunks(squeeze(text.slice(w.start, w.end)), squeeze(base.modules[key])); }
  return out;
}
function merge3(liveBytes, baseBytes, newBytes, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas5-merge-')), [l, b, n] = ['live', 'base', 'new'].map(x => path.join(dir, x));
  try {
    fs.writeFileSync(l, lf(liveBytes)); fs.writeFileSync(b, lf(baseBytes)); fs.writeFileSync(n, lf(newBytes));
    try { execFileSync('git', ['merge-file', '-q', l, b, n], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (error) { throw Error(`${label}: 3방향 충돌 ${error.status}곳 — 손으로 맞추지 말고 자리부터 본다`); }
    return eolLike(fs.readFileSync(l), liveBytes);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function main() {
  const head = liveGit(['rev-parse', 'origin/main']).toString('utf8').trim();
  const grep = mark => liveGit(['grep', '-l', '-F', mark, 'origin/main']).toString('utf8').split('\n').filter(Boolean).map(line => line.replace(/^origin\/main:/, '')).filter(p => /\.(m?js|cjs)$/.test(p) && !p.startsWith('.github/'));
  const engine = [...new Set([...grep(CORE_MARK), ...grep(HOST_MARK)])].sort();
  // base · new · check만 비운다 — candidate*는 검수 사슬이 묶은 후보(증거)라 남긴다(현장 노트 배포 · 공개).
  for (const dir of ['base', 'new', 'check']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  const fresh = build(ROOT), base = baseBuild(), write = (dir, pub, bytes) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const items = [], ways = {}, blobs = {}, 기존차이 = {};
  for (const pub of engine) {
    const before = live(pub), source = GENERATED[pub], baseGenerated = source && show(BASE, source);
    let after, way;
    if (baseGenerated && lf(baseGenerated).equals(lf(before))) { after = eolLike(fs.readFileSync(path.join(ROOT, source)), before); way = '생성기'; }
    else {
      if (!blobs[sha(before)]) 기존차이[pub] = differences(pub, before, base);
      const swapped = swap(pub, before, fresh); after = Buffer.from(swapped.out); way = `모듈(${[swapped.has.core && 'Core', swapped.has.host && '호스트'].filter(Boolean).join('+')})`;
    }
    const text = after.toString('utf8');
    if (text.includes(CORE_MARK)) {
      if (!text.includes('learning-priority-5') || text.includes('learning-priority-4')) throw Error(`${pub}: 정책판이 5가 아니다`);
      if (/if\s*\(\s*!folding\s*\|\|\s*paged\s*\)\s*return/.test(text)) throw Error(`${pub}: 접기 막는 줄이 남았다`);
      // Core와 Vellum은 함께 간다: 정책판 5의 이유(retry · step-up · new-format)를 모르는 Vellum이면 추천이 던진다(설계 §5).
      if (!/["']step-up["']\s*:/.test(text) || !/["']new-format["']\s*:/.test(text) || !/\bretry\s*:\s*`/.test(text)) throw Error(`${pub}: Vellum이 새 이유를 모른다`);
      // Core가 내는 기다림 목록과 그것을 읽는 순간 맞춤 창은 함께 간다.
      if (!/waiting\s*:\s*ranked\.filter/.test(text) || !/recommendation\.waiting\?\.includes/.test(text)) throw Error(`${pub}: 기다림 목록 · 순간 맞춤 창이 함께 안 실렸다`);
    }
    if (text.includes(HOST_MARK) && !/enumerated\s*=\s*\(/.test(text)) throw Error(`${pub}: 호스트가 열거를 넘기지 않는다`);
    write('base', pub, before); write('new', pub, after);
    items.push(pub); ways[pub] = way; (blobs[sha(before)] ||= []).push(pub);
  }
  // 찰칵 낱말 원천(낱말 태그): 공개본 = 바탕이어야 한다.
  for (const pub of ['world/snap-words/learning.mjs']) {
    const before = live(pub), baseBytes = show(BASE, GENERATED[pub]);
    if (!before || !baseBytes || !lf(before).equals(lf(baseBytes))) throw Error(`${pub}: 공개본이 바탕과 다르다`);
    const after = eolLike(fs.readFileSync(path.join(ROOT, GENERATED[pub])), before);
    if (!after.toString('utf8').includes('WORD_CONCEPT')) throw Error(`${pub}: 낱말 태그가 없다`);
    write('base', pub, before); write('new', pub, after); items.push(pub); ways[pub] = '생성기(원천)';
  }
  // 번역 표: 공개본 + (바탕 → 작업본).
  {
    const [pub, src] = STRINGS, before = live(pub), merged = merge3(before, show(BASE, src), fs.readFileSync(path.join(ROOT, src)), pub);
    for (const key of ['msg.vellum.step-up', 'msg.vellum.new-format', 'msg.vellum.retry']) if (!merged.toString('utf8').includes(`'${key}'`)) throw Error(`${pub}: ${key}가 없다`);
    write('base', pub, before); write('new', pub, merged); items.push(pub); ways[pub] = '3방향';
  }
  // 검사 폴더: 엔진 묶음 종류마다 새 판 · 공개본 한 벌. ESM 묶음이 부르는 같은 폴더의 공개본 모듈은 따라 옮긴다(손으로 적은 목록은 남이 모듈을 더하면 낡는다).
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
  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head, base: BASE, items, ways, sizes, variants, 기존차이 }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head, 파일: items.length, 엔진사본: engine.length, 종류: variants.length, ways }, null, 1));
  for (const [pub, table] of Object.entries(기존차이)) console.log(`기존차이 ${pub}: ${Object.entries(table).map(([k, n]) => `${k.replace("atlas/", "")} ${n.length}`).join(' · ')}`);
  console.log(`끼운 판 돌리기: node docs/_ops/qa/atlas-defects5-20261110/적용/공개검사.mjs "${check}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
if (require.main === module) main();
module.exports = { wrappers, swap, build, storeEdit, GENERATED };
