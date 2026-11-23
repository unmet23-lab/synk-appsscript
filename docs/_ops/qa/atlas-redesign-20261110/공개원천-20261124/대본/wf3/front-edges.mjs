// 앞면 모듈(world-front-entry.mjs · world-front/*)과 ③ 파일 사이의 정적 import 간선을 양쪽으로 뽑고, 받는 이름이 상대 판에 모두 있는지 본다(설계 주인 11-20).
//   C3=<③ 후보 꾸러미> TREE=<라이브 나무 json> node front-edges.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const SCRATCH = 'C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad';
const C3 = process.env.C3, tree = JSON.parse(fs.readFileSync(process.env.TREE, 'utf8'));
const CACHES = [`${SCRATCH}/probe45/live-blobs`, 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs'];
const liveOf = new Map();
for (const e of tree.tree.filter(x => x.type === 'blob' && /^(world|atlas)\/.*\.m?js$/.test(x.path))) {
  const dir = CACHES.find(d => fs.existsSync(path.join(d, e.sha)));
  if (dir) liveOf.set(e.path, fs.readFileSync(path.join(dir, e.sha), 'utf8'));
}
const parse = t => { for (const st of ['module', 'script']) { try { return acorn.parse(t, { ecmaVersion: 'latest', sourceType: st, allowHashBang: true, allowAwaitOutsideFunction: true }); } catch {} } return null; };
const nameOf = n => (n.type === 'Identifier' ? n.name : n.value);
function analyze(text) {
  const ast = text && parse(text); if (!ast) return null;
  const imports = [], exports = new Set();
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') imports.push({ source: node.source.value, names: node.specifiers.filter(s => s.type !== 'ImportNamespaceSpecifier').map(s => s.type === 'ImportDefaultSpecifier' ? 'default' : nameOf(s.imported)), ns: node.specifiers.some(s => s.type === 'ImportNamespaceSpecifier') });
    else if (node.type === 'ExportNamedDeclaration') {
      const d = node.declaration; if (d?.id) exports.add(d.id.name);
      if (d?.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id.type === 'Identifier') exports.add(v.id.name);
      for (const s of node.specifiers) exports.add(nameOf(s.exported));
      if (node.source) imports.push({ source: node.source.value, names: node.specifiers.map(s => nameOf(s.local)), ns: false });
    } else if (node.type === 'ExportDefaultDeclaration') exports.add('default');
    else if (node.type === 'ExportAllDeclaration') imports.push({ source: node.source.value, names: [], ns: true });
  }
  const dyn = []; (function walk(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); if (n.type === 'ImportExpression') dyn.push(n.source.type === 'Literal' ? n.source.value : '(식)'); for (const k of Object.keys(n)) if (k !== 'type' && n[k] && typeof n[k] === 'object') walk(n[k]); })(ast);
  return { imports, exports, dyn };
}
const resolve = (from, spec) => { if (typeof spec !== 'string') return null; let s = spec.replace(/[?#].*$/, '').replace(/^https:\/\/synk\.im/, ''); if (s.startsWith('/')) return s.slice(1); if (/^\.\.?\//.test(s)) return path.posix.normalize(path.posix.join(path.posix.dirname(from), s)); return null; };
const plan = JSON.parse(fs.readFileSync(`${C3}/후보.json`, 'utf8'));
const three = new Map(plan.항목.filter(x => /\.m?js$/.test(x.경로)).map(x => [x.경로, x.종류]));
const newText = p => (three.has(p) ? fs.readFileSync(path.join(C3, p), 'utf8') : liveOf.get(p) ?? null);
const isFront = p => p === 'world/world-front-entry.mjs' || p.startsWith('world/world-front/');
const fronts = [...liveOf.keys()].filter(isFront).sort();
const lines = [];
lines.push(`라이브 앞면 JS ${fronts.length}개: ${fronts.join(' · ')}`);
lines.push(`③ 안의 앞면 파일: ${[...three.keys()].filter(isFront).join(' · ') || '없음'}`);
let edges = 0, missing = 0;
// 앞면 F(라이브) → ③ G(새 판)
for (const f of fronts) {
  const a = analyze(liveOf.get(f));
  if (!a) { lines.push(`못 읽음 ${f}`); continue; }
  const targets = a.imports.map(im => ({ ...im, g: resolve(f, im.source) }));
  for (const im of targets) if (im.g && three.has(im.g)) {
    edges++; const ex = analyze(newText(im.g))?.exports ?? new Set(); const miss = im.names.filter(n => !ex.has(n)); missing += miss.length;
    lines.push(`앞면 ${f} → ③ ${im.g}(${three.get(im.g)}) [${im.names.join(',') || (im.ns ? '이름 공간' : '-')}] 새 판에 없는 이름 ${miss.length ? miss.join(',') : 0}`);
  }
  for (const d of a.dyn) { const g = resolve(f, d); lines.push(`앞면 ${f} 동적 import ${d}${g && three.has(g) ? ` → ③ ${g}` : ''}`); }
  lines.push(`  (${f}의 정적 import ${targets.length}개: ${targets.map(t => t.g || t.source).join(' · ') || '없음'})`);
}
// ③ F(새 판) → 앞면 G(라이브)
for (const [f] of three) {
  const a = analyze(newText(f)); if (!a) { lines.push(`못 읽음 ③ ${f}`); continue; }
  for (const im of a.imports) { const g = resolve(f, im.source); if (g && isFront(g)) { edges++; const ex = analyze(liveOf.get(g))?.exports ?? new Set(); const miss = im.names.filter(n => !ex.has(n)); missing += miss.length; lines.push(`③ ${f} → 앞면 ${g} [${im.names.join(',') || '이름 공간'}] 라이브에 없는 이름 ${miss.length ? miss.join(',') : 0}`); } }
  for (const d of a.dyn) { const g = resolve(f, d); if (g && isFront(g)) { edges++; lines.push(`③ ${f} 동적 import → 앞면 ${g}(라이브에 ${liveOf.has(g) ? '있음' : '없음'})`); } }
}
lines.push(`간선 ${edges} · 빠진 이름 ${missing}`);
console.log(lines.join('\n'));
