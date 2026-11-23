// 앞면 모듈이 ①②에서 바뀌는 파일(world-strings · world-lang)에서 받는 이름이 ①② 판에 모두 있는지 본다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const SCRATCH = 'C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad';
const tree = JSON.parse(fs.readFileSync(process.env.TREE, 'utf8'));
const CACHES = [`${SCRATCH}/probe45/live-blobs`, 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs'];
const live = new Map();
for (const e of tree.tree.filter(x => x.type === 'blob' && /^world\/.*\.m?js$/.test(x.path))) { const d = CACHES.find(d => fs.existsSync(path.join(d, e.sha))); if (d) live.set(e.path, fs.readFileSync(path.join(d, e.sha), 'utf8')); }
const C1 = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-pub-s1c', C2 = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-pub-s2';
const after = new Map([['world/brand-opening/world-strings.mjs', fs.readFileSync(`${C1}/world/brand-opening/world-strings.mjs`, 'utf8')], ['world/brand-opening/world-lang.mjs', fs.readFileSync(`${C2}/world/brand-opening/world-lang.mjs`, 'utf8')]]);
const ast = t => acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' });
const exportsOf = t => { const s = new Set(); for (const n of ast(t).body) { if (n.type === 'ExportNamedDeclaration') { if (n.declaration?.id) s.add(n.declaration.id.name); if (n.declaration?.declarations) for (const v of n.declaration.declarations) if (v.id.type === 'Identifier') s.add(v.id.name); for (const sp of n.specifiers) s.add(sp.exported.name ?? sp.exported.value); } else if (n.type === 'ExportDefaultDeclaration') s.add('default'); } return s; };
const resolve = (from, spec) => spec.startsWith('/') ? spec.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec.replace(/[?#].*$/, '')));
let bad = 0;
for (const [f, text] of live) {
  for (const n of ast(text).body) {
    if (n.type !== 'ImportDeclaration' && !(n.type === 'ExportNamedDeclaration' && n.source)) continue;
    const g = resolve(f, n.source.value);
    if (!after.has(g)) continue;
    const names = n.specifiers.filter(s => s.type !== 'ImportNamespaceSpecifier').map(s => s.type === 'ImportDefaultSpecifier' ? 'default' : (s.imported ?? s.local).name ?? (s.imported ?? s.local).value);
    const ex = exportsOf(after.get(g)), miss = names.filter(x => !ex.has(x)); bad += miss.length;
    if (/world-front/.test(f) || miss.length) console.log(`${f} → ${g}(①② 판) [${names.join(',')}] 없는 이름 ${miss.length ? miss.join(',') : 0}`);
  }
}
console.log(`라이브 모듈 전체에서 ①② 파일로 가는 간선의 빠진 이름: ${bad}`);
