// 셋째(③) 공개 때 캐시 10분 동안 생길 수 있는 「새 판과 옛 판이 섞인 모듈 그래프」를 정적 import로 본다(설계 주인 11-20 「셋째 33개 안의 엇갈림」).
//   (가) 새 F → 옛 G: ③의 새 판 F가 ③에서 바뀌는 기존 파일 G에서 받는 이름이 옛 G(지금 라이브)에 모두 있는가
//   (나) 옛 F → 새 G: 라이브의 모든 모듈(③ 밖 포함)이 ③에서 바뀌는 G에서 받는 이름이 새 G에 모두 있는가
//   (다) 새 이름 의존: ③의 새 판이 ③ 밖 파일에서 받는 이름이 그 파일의 공개본(①② 뒤)에 있는가 — ①②가 먼저 올라 생기는 이름은 따로 적는다
// 이름이 빠지면 정적 import는 SyntaxError로 그래프 전체가 서지 않는다. 이름 공간 · 동적 import는 SyntaxError가 아니라 따로 적는다.
//   node import-skew.mjs <라이브 커밋 sha(40자)>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const SCRATCH = 'C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad';
const C3 = process.env.C3 || 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-pub-s3b';
const C1 = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-pub-s1c';
const C2 = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-pub-s2';
const CACHES = [`${SCRATCH}/probe45/live-blobs`, 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs'];
const HEAD = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(HEAD || '')) throw Error('사용법: node import-skew.mjs <라이브 커밋 sha 40자>');
const tree = JSON.parse(fs.readFileSync(process.env.TREE || `${SCRATCH}/live-tree-f2c1.json`, 'utf8'));
const gitSha = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// ── 라이브 바이트(캐시 · 없으면 raw로 받아 git blob sha를 맞춰 본다) ──
const entries = tree.tree.filter(x => x.type === 'blob' && /^(world|atlas)\//.test(x.path) && /\.(m?js)$/.test(x.path));
async function liveBytes(entry) {
  for (const dir of CACHES) {
    const f = path.join(dir, entry.sha);
    if (fs.existsSync(f)) return fs.readFileSync(f);
  }
  const url = `https://raw.githubusercontent.com/unmet23-lab/synk-policy/${HEAD}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url);
  if (!r.ok) throw Error(`${entry.path}: ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (gitSha(bytes) !== entry.sha) throw Error(`${entry.path}: blob sha가 트리와 다르다`);
  fs.mkdirSync(CACHES[0], { recursive: true });
  fs.writeFileSync(path.join(CACHES[0], entry.sha), bytes);
  return bytes;
}
const live = new Map();
for (let i = 0; i < entries.length; i += 12) {
  const part = entries.slice(i, i + 12);
  const got = await Promise.all(part.map(liveBytes));
  part.forEach((e, k) => live.set(e.path, got[k].toString('utf8')));
}

// ── 구문 읽기 ──
function parse(text) {
  for (const sourceType of ['module', 'script']) {
    try {
      return { ast: acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: sourceType === 'script' }), sourceType };
    } catch {}
  }
  return null;
}
const nameOf = n => (n.type === 'Identifier' ? n.name : n.value);
function bindings(pattern, out) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') out.push(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(p => bindings(p.type === 'RestElement' ? p.argument : p.value, out));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(e => bindings(e?.type === 'RestElement' ? e.argument : e, out));
  else if (pattern.type === 'AssignmentPattern') bindings(pattern.left, out);
  else if (pattern.type === 'RestElement') bindings(pattern.argument, out);
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (v && typeof v === 'object') walk(v, visit);
  }
}
function analyze(text) {
  const parsed = parse(text);
  if (!parsed) return { ok: false, imports: [], exports: new Set(), stars: [] };
  const imports = [], exports = new Set(), stars = [];
  if (parsed.sourceType === 'module') for (const node of parsed.ast.body) {
    if (node.type === 'ImportDeclaration') {
      const names = []; let ns = false;
      for (const s of node.specifiers) {
        if (s.type === 'ImportSpecifier') names.push(nameOf(s.imported));
        else if (s.type === 'ImportDefaultSpecifier') names.push('default');
        else ns = true;
      }
      imports.push({ source: node.source.value, names, ns, kind: 'import' });
    } else if (node.type === 'ExportNamedDeclaration') {
      const d = node.declaration;
      if (d?.id) exports.add(d.id.name);
      if (d?.type === 'VariableDeclaration') for (const v of d.declarations) { const out = []; bindings(v.id, out); out.forEach(n => exports.add(n)); }
      for (const s of node.specifiers) exports.add(nameOf(s.exported));
      if (node.source) imports.push({ source: node.source.value, names: node.specifiers.map(s => nameOf(s.local)), ns: false, kind: 're-export' });
    } else if (node.type === 'ExportDefaultDeclaration') exports.add('default');
    else if (node.type === 'ExportAllDeclaration') {
      if (node.exported) exports.add(nameOf(node.exported)); else stars.push(node.source.value);
      imports.push({ source: node.source.value, names: [], ns: true, kind: 'export*' });
    }
  }
  walk(parsed.ast, n => {
    if (n.type === 'ImportExpression') imports.push({ source: n.source.type === 'Literal' ? n.source.value : null, names: [], ns: true, kind: 'dynamic' });
  });
  return { ok: true, module: parsed.sourceType === 'module', imports, exports, stars };
}
function resolve(from, spec) {
  if (typeof spec !== 'string') return null;
  let s = spec.replace(/[?#].*$/, '');
  if (/^https:\/\/synk\.im\//.test(s)) s = s.replace(/^https:\/\/synk\.im/, '');
  if (s.startsWith('/')) return s.slice(1);
  if (s.startsWith('./') || s.startsWith('../')) return path.posix.normalize(path.posix.join(path.posix.dirname(from), s));
  return null;
}

// ── 판 셋: 옛(지금 라이브) · 새(③ 뒤) · ①② 뒤 ──
const plan = JSON.parse(fs.readFileSync(`${C3}/후보.json`, 'utf8'));
const items = plan.항목;
const isJs = p => /\.m?js$/.test(p);
const changed = new Set(items.filter(x => x.종류 !== '새' && isJs(x.경로)).map(x => x.경로));
const added = new Set(items.filter(x => x.종류 === '새' && isJs(x.경로)).map(x => x.경로));
const kinds = [...new Set(items.map(x => x.종류))];
const read = (dir, p) => fs.readFileSync(path.join(dir, p), 'utf8');
const after12 = new Map([...live]);
for (const [dir, p] of [[C1, 'world/brand-opening/world-strings.mjs'], [C2, 'world/brand-opening/world-lang.mjs']]) after12.set(p, read(dir, p));
const oldText = p => live.get(p) ?? null; // ③ 바로 전 — ①② 뒤라 ①② 파일은 after12
const before3 = p => after12.get(p) ?? null;
const newText = p => (changed.has(p) || added.has(p) ? read(C3, p) : before3(p));
const cache = new Map();
const info = (label, p, text) => {
  const k = `${label}:${p}`;
  if (!cache.has(k)) cache.set(k, text == null ? null : analyze(text));
  return cache.get(k);
};
function exportsOf(label, p, textOf, seen = new Set()) {
  if (seen.has(p)) return new Set();
  seen.add(p);
  const a = info(label, p, textOf(p));
  if (!a) return null;
  const out = new Set(a.exports);
  for (const s of a.stars) { const t = resolve(p, s); const sub = t && exportsOf(label, t, textOf, seen); if (sub) for (const n of sub) if (n !== 'default') out.add(n); }
  return out;
}

const report = { live: HEAD.slice(0, 9), 종류: kinds, 바뀌는기존: [...changed], 새파일: [...added], 가: [], 나: [], 다: [], 차례로생김: [], 간선_바뀜끼리: [], 이름공간_동적: [], 못읽음: [] };
// (가) 새 F → 옛 G
for (const f of [...changed, ...added]) {
  const a = info('new', f, newText(f));
  if (!a?.ok) { report.못읽음.push(`새 ${f}`); continue; }
  for (const im of a.imports) {
    const g = resolve(f, im.source);
    if (!g) continue;
    if (changed.has(g)) {
      if (im.ns || im.kind === 'dynamic') { report.이름공간_동적.push(`새 ${f} → ${g} (${im.kind}${im.ns ? ' · 이름 공간' : ''})`); }
      const old = exportsOf('before3', g, before3);
      const miss = old ? im.names.filter(n => !old.has(n)) : ['(옛 G 없음)'];
      if (changed.has(f)) report.간선_바뀜끼리.push(`${f} → ${g} [${im.names.join(',') || im.kind}] 옛 G에 없는 이름 ${miss.length ? miss.join(',') : 0}`);
      if (miss.length) report.가.push(`새 ${f} → 옛 ${g}: ${miss.join(', ')}`);
    } else if (!added.has(g)) {
      // (다) ③ 밖 파일에서 받는 이름
      const now = exportsOf('before3', g, before3);
      const liveNow = exportsOf('live', g, oldText);
      if (!now) { if (im.names.length) report.다.push(`새 ${f} → ${g}: 공개본에 없는 파일`); continue; }
      const miss = im.names.filter(n => !now.has(n));
      if (miss.length) report.다.push(`새 ${f} → ${g}: ${miss.join(', ')}`);
      const fresh = liveNow ? im.names.filter(n => now.has(n) && !liveNow.has(n)) : [];
      if (fresh.length) report.차례로생김.push(`새 ${f} → ${g}: ${fresh.join(', ')}(①② 뒤에 생김)`);
    }
  }
}
// (나) 옛 F(라이브의 모든 모듈) → 새 G
for (const [f, text] of after12) {
  const a = info('before3', f, text);
  if (!a?.ok) continue;
  for (const im of a.imports) {
    const g = resolve(f, im.source);
    if (!g || !changed.has(g)) continue;
    const fresh = exportsOf('new', g, newText);
    const miss = fresh ? im.names.filter(n => !fresh.has(n)) : ['(새 G 없음)'];
    if (miss.length) report.나.push(`옛 ${f} → 새 ${g}: ${miss.join(', ')}`);
    if ((im.ns || im.kind === 'dynamic') && !changed.has(f)) report.이름공간_동적.push(`옛 ${f}(③ 밖) → ${g} (${im.kind}${im.ns ? ' · 이름 공간' : ''})`);
  }
}
const out = process.env.OUT || `${SCRATCH}/probe45/import-skew-s3b.json`;
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(`라이브 ${report.live} · 라이브 모듈 ${live.size} · ③ 바뀌는 기존 JS ${changed.size} · 새 JS ${added.size} · 종류 ${kinds.join('/')}`);
console.log(`(가) 새 F → 옛 G 빠진 이름: ${report.가.length}`); report.가.forEach(x => console.log('  ' + x));
console.log(`(나) 옛 F → 새 G 빠진 이름: ${report.나.length}`); report.나.forEach(x => console.log('  ' + x));
console.log(`(다) ③ 밖 파일에서 받는데 없는 이름: ${report.다.length}`); report.다.forEach(x => console.log('  ' + x));
console.log(`①② 뒤에 생기는 이름(차례로 막음): ${report.차례로생김.length}`); report.차례로생김.forEach(x => console.log('  ' + x));
console.log(`바뀌는 기존 파일끼리의 간선: ${report.간선_바뀜끼리.length}`); report.간선_바뀜끼리.forEach(x => console.log('  ' + x));
console.log(`이름 공간 · 동적 import(SyntaxError 아님): ${report.이름공간_동적.length}`); report.이름공간_동적.forEach(x => console.log('  ' + x));
if (report.못읽음.length) console.log(`못 읽음: ${report.못읽음.join(' · ')}`);
console.log(`→ ${out}`);
