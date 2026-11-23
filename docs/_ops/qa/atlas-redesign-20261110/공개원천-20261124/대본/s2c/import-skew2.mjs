// 2단계 공개 때 캐시 10분 동안 생길 수 있는 「새 판과 옛 판이 섞인 모듈 그래프」를 정적 import로 본다(1단계 import-skew.mjs와 같은 셈).
// 바탕(옛) = 지금 라이브 + ①②③ 후보(cand-step1c/pub) = ③이 라이브가 된 뒤. 새 = 바탕 + 2단계 후보(cand-step2/full).
//   (가) 새 F → 옛 G: 2단계에서 바뀌는 F가 2단계에서 바뀌는 G에서 받는 이름이 옛 G에 모두 있는가
//   (나) 옛 F → 새 G: 바탕의 모든 모듈이 2단계에서 바뀌는 G에서 받는 이름이 새 G에 모두 있는가
//   (다) 새 F → 그대로인 G: 이름이 바탕 G에 있는가
// 동적 import의 `.then(({이름…})=>` 꼴도 따로 본다(빠지면 SyntaxError가 아니라 undefined).
//   node import-skew2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const SCRATCH = 'C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad';
const CACHES = [`${SCRATCH}/probe45/live-blobs`, 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs'];
const E1 = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1c/pub';
const S2 = 'D:/SYNK-worktrees/world-export-step2-20261120/.tmp/cand-step2/full';
const tree = new Map(JSON.parse(fs.readFileSync(`${SCRATCH}/probe45/s2c/live-tree.json`, 'utf8')).tree);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');
const isMod = p => /^(world|atlas)\/.*\.mjs$/.test(p);
const old = new Map(), neu = new Map();
for (const [p, sha] of tree) if (isMod(p)) { const c = CACHES.map(x => `${x}/${sha}`).find(f => fs.existsSync(f)); if (!c) throw Error('no blob ' + p); old.set(p, fs.readFileSync(c, 'utf8')); }
for (const f of walk(E1)) { const p = rel(E1, f); if (isMod(p)) old.set(p, fs.readFileSync(f, 'utf8')); }
for (const [p, s] of old) neu.set(p, s);
const changed = [];
for (const f of walk(S2)) { const p = rel(S2, f); if (isMod(p)) { neu.set(p, fs.readFileSync(f, 'utf8')); changed.push(p); } }
const parse = s => { try { return acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { return { error: String(e).slice(0, 120) }; } };
const resolve = (from, spec) => { if (!/^\.\.?\//.test(spec)) return null; const u = new URL(spec.replace(/\?.*$/, ''), 'https://x/' + from); return decodeURIComponent(u.pathname.slice(1)); };
const info = new Map();
function scan(src, p) {
  const ast = parse(src);
  if (ast.error) return { error: ast.error, imports: [], exports: new Set(), star: [] };
  const imports = [], exports = new Set(), star = [];
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') { const t = resolve(p, n.source.value); if (t) imports.push({ t, names: n.specifiers.filter(s => s.type === 'ImportSpecifier').map(s => s.imported.name ?? s.imported.value), def: n.specifiers.some(s => s.type === 'ImportDefaultSpecifier') }); }
    if (n.type === 'ExportNamedDeclaration') {
      if (n.declaration) { const d = n.declaration; if (d.id) exports.add(d.id.name); if (d.declarations) for (const x of d.declarations) if (x.id.type === 'Identifier') exports.add(x.id.name); }
      for (const s of n.specifiers || []) exports.add(s.exported.name ?? s.exported.value);
      if (n.source) { const t = resolve(p, n.source.value); if (t) imports.push({ t, names: (n.specifiers || []).map(s => s.local.name ?? s.local.value), def: false, reexport: true }); }
    }
    if (n.type === 'ExportDefaultDeclaration') exports.add('default');
    if (n.type === 'ExportAllDeclaration') { const t = resolve(p, n.source.value); if (n.exported) exports.add(n.exported.name); else if (t) star.push(t); }
  }
  // 동적 import(...).then(({a,b})=> 꼴
  const dyn = [];
  for (const m of src.matchAll(/import\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.then\(\s*\(\s*\{([^}]*)\}/g)) { const t = resolve(p, m[1]); if (t) dyn.push({ t, names: m[2].split(',').map(x => x.trim().split(':')[0].trim()).filter(Boolean) }); }
  return { imports, exports, star, dyn };
}
const exportsOf = (map, p, seen = new Set()) => { if (seen.has(p)) return new Set(); seen.add(p); const s = map.get(p); if (s == null) return null; const i = scan(s, p); const out = new Set(i.exports); for (const t of i.star) for (const n of exportsOf(map, t, seen) || []) out.add(n); return out; };
const ch = new Set(changed), problems = { 가: [], 나: [], 다: [], 동적: [], 파싱: [] };
for (const [p, s] of neu) {
  const isNew = ch.has(p);
  const i = scan(s, p);
  if (i.error) { if (isNew) problems.파싱.push(`${p}: ${i.error}`); continue; }
  for (const imp of [...i.imports, ...i.dyn.map(d => ({ ...d, dynamic: true }))]) {
    const targetChanged = ch.has(imp.t);
    const check = (map, label) => { const ex = exportsOf(map, imp.t); if (!ex) return problems[label].push(`${p} → ${imp.t}: 파일 없음`); const miss = imp.names.filter(n => !ex.has(n)); if (imp.def && !ex.has('default')) miss.push('default'); if (miss.length) problems[imp.dynamic ? '동적' : label].push(`${p} → ${imp.t}: ${miss.join(', ')}`); };
    if (isNew && targetChanged) { check(old, '가'); check(neu, '다'); }
    else if (isNew && !targetChanged) check(neu, '다');
    else if (!isNew && targetChanged) check(neu, '나');
  }
}
// 옛 F(바탕 판 그대로의 2단계 파일)가 새 G를 받을 때도: 2단계 파일끼리 옛 → 새
for (const p of changed) {
  const i = scan(old.get(p) ?? '', p); if (i.error) continue;
  for (const imp of i.imports) if (ch.has(imp.t)) { const ex = exportsOf(neu, imp.t); const miss = imp.names.filter(n => !ex?.has(n)); if (miss.length) problems.나.push(`(옛 ${p}) → ${imp.t}: ${miss.join(', ')}`); }
}
console.log('2단계에서 바뀌는 모듈', changed.length, changed.join(' '));
for (const [k, v] of Object.entries(problems)) console.log(`(${k}) ${v.length}${v.length ? '\n  ' + v.join('\n  ') : ''}`);
