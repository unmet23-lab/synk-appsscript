'use strict';
// 후보 모듈의 「선언 없이 쓰는 이름」(자유 변수)을 라이브 같은 파일과 견준다 — 3방향으로 얹은 새 길 조각이 라이브에 없는 다른 일의
// 이름(예: launching · active · hangulMigrationPort)을 부르면 그 길에서 ReferenceError가 난다. 새 파일은 자유 변수 목록을 그대로 보인다.
//   node scope.cjs <후보 new/world 폴더> <라이브 캐시 폴더>
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const acorn = require(require.resolve('acorn', { paths: ['C:/Users/q1212/Documents/SYNK-appsscript/node_modules'] }));

function freeNames(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const free = new Map();
  const S = (parent, fn) => ({ vars: new Set(), parent, fn });
  const ref = (name, scope, node) => {
    for (let s = scope; s; s = s.parent) if (s.vars.has(name)) return;
    if (!free.has(name)) free.set(name, []);
    free.get(name).push(node.loc.start.line);
  };
  const declare = (p, s) => {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': s.vars.add(p.name); break;
      case 'ObjectPattern': p.properties.forEach(q => (q.type === 'RestElement' ? declare(q.argument, s) : declare(q.value, s))); break;
      case 'ArrayPattern': p.elements.forEach(e => declare(e, s)); break;
      case 'AssignmentPattern': declare(p.left, s); break;
      case 'RestElement': declare(p.argument, s); break;
    }
  };
  const defaults = (p, s) => {
    if (!p) return;
    switch (p.type) {
      case 'ObjectPattern': p.properties.forEach(q => { if (q.type === 'RestElement') return defaults(q.argument, s); if (q.computed) walk(q.key, s); defaults(q.value, s); }); break;
      case 'ArrayPattern': p.elements.forEach(e => defaults(e, s)); break;
      case 'AssignmentPattern': defaults(p.left, s); walk(p.right, s); break;
      case 'RestElement': defaults(p.argument, s); break;
    }
  };
  const assign = (p, s) => {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': ref(p.name, s, p); break;
      case 'MemberExpression': walk(p, s); break;
      case 'ObjectPattern': p.properties.forEach(q => { if (q.type === 'RestElement') return assign(q.argument, s); if (q.computed) walk(q.key, s); assign(q.value, s); }); break;
      case 'ArrayPattern': p.elements.forEach(e => assign(e, s)); break;
      case 'AssignmentPattern': assign(p.left, s); walk(p.right, s); break;
      case 'RestElement': assign(p.argument, s); break;
    }
  };
  const hoistVar = (node, s) => {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type)) return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') node.declarations.forEach(d => declare(d.id, s));
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(x => hoistVar(x, s));
      else if (v && typeof v.type === 'string') hoistVar(v, s);
    }
  };
  const hoistBlock = (stmts, s) => {
    for (const st of stmts) {
      if (st.type === 'ImportDeclaration') { st.specifiers.forEach(sp => s.vars.add(sp.local.name)); continue; }
      const d = st.type === 'ExportNamedDeclaration' || st.type === 'ExportDefaultDeclaration' ? st.declaration : st;
      if (!d) continue;
      if (d.type === 'VariableDeclaration' && d.kind !== 'var') d.declarations.forEach(x => declare(x.id, s));
      else if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) s.vars.add(d.id.name);
    }
  };
  function walk(node, scope) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Program': { const s = S(null, true); hoistVar(node, s); hoistBlock(node.body, s); node.body.forEach(n => walk(n, s)); return; }
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
        const s = S(scope, true);
        if (node.type === 'FunctionExpression' && node.id) s.vars.add(node.id.name);
        if (node.type !== 'ArrowFunctionExpression') s.vars.add('arguments');
        node.params.forEach(p => declare(p, s));
        node.params.forEach(p => defaults(p, s));
        if (node.body.type === 'BlockStatement') { hoistVar(node.body, s); hoistBlock(node.body.body, s); node.body.body.forEach(n => walk(n, s)); }
        else walk(node.body, s);
        return;
      }
      case 'BlockStatement': case 'StaticBlock': { const s = S(scope, false); hoistBlock(node.body, s); node.body.forEach(n => walk(n, s)); return; }
      case 'SwitchStatement': {
        walk(node.discriminant, scope);
        const s = S(scope, false);
        hoistBlock(node.cases.flatMap(c => c.consequent), s);
        node.cases.forEach(c => { if (c.test) walk(c.test, s); c.consequent.forEach(n => walk(n, s)); });
        return;
      }
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const s = S(scope, false);
        const init = node.init || node.left;
        if (init && init.type === 'VariableDeclaration') {
          if (init.kind !== 'var') init.declarations.forEach(d => declare(d.id, s));
          init.declarations.forEach(d => { defaults(d.id, s); if (d.init) walk(d.init, s); });
        } else if (init) { if (node.type === 'ForStatement') walk(init, s); else assign(init, s); }
        for (const k of ['test', 'update', 'right', 'body']) if (node[k]) walk(node[k], s);
        return;
      }
      case 'CatchClause': { const s = S(scope, false); if (node.param) { declare(node.param, s); defaults(node.param, s); } walk(node.body, s); return; }
      case 'ClassDeclaration': case 'ClassExpression': {
        const s = S(scope, false);
        if (node.id) s.vars.add(node.id.name);
        if (node.superClass) walk(node.superClass, scope);
        node.body.body.forEach(m => walk(m, s));
        return;
      }
      case 'VariableDeclaration': node.declarations.forEach(d => { defaults(d.id, scope); if (d.init) walk(d.init, scope); }); return;
      case 'Identifier': ref(node.name, scope, node); return;
      case 'MemberExpression': walk(node.object, scope); if (node.computed) walk(node.property, scope); return;
      case 'Property': if (node.computed) walk(node.key, scope); walk(node.value, scope); return;
      case 'MethodDefinition': case 'PropertyDefinition': if (node.computed) walk(node.key, scope); if (node.value) walk(node.value, scope); return;
      case 'LabeledStatement': walk(node.body, scope); return;
      case 'BreakStatement': case 'ContinueStatement': case 'ImportDeclaration': case 'ExportAllDeclaration':
      case 'MetaProperty': case 'PrivateIdentifier': case 'Super': case 'ThisExpression': return;
      case 'ExportNamedDeclaration':
        if (node.declaration) walk(node.declaration, scope);
        else if (!node.source) node.specifiers.forEach(sp => ref(sp.local.name, scope, sp.local));
        return;
      case 'ExportDefaultDeclaration': walk(node.declaration, scope); return;
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier' || node.left.type === 'MemberExpression') walk(node.left, scope);
        else assign(node.left, scope);
        walk(node.right, scope);
        return;
      default:
        for (const k of Object.keys(node)) {
          if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
          const v = node[k];
          if (Array.isArray(v)) v.forEach(x => walk(x, scope));
          else if (v && typeof v.type === 'string') walk(v, scope);
        }
    }
  }
  walk(ast, null);
  return free;
}
module.exports = { freeNames };

if (require.main === module) {
  const CAND = path.resolve(process.argv[2]), CACHE = process.argv[3];
  const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
  const tree = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'], { maxBuffer: 1 << 28, env }).toString('utf8'));
  const liveSha = new Map(tree.tree.filter(t => t.type === 'blob' && t.path.startsWith('world/')).map(t => [t.path.slice(6), t.sha]));
  const walkDir = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walkDir(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walkDir(CAND).map(f => path.relative(CAND, f).replace(/\\/g, '/')).filter(f => /\.m?js$/.test(f));
  let bad = 0;
  const seenNew = new Map();
  for (const f of files) {
    const cand = freeNames(fs.readFileSync(path.join(CAND, f), 'utf8'));
    const sha = liveSha.get(f);
    if (sha) {
      const live = freeNames(fs.readFileSync(path.join(CACHE, sha), 'utf8'));
      const added = [...cand.keys()].filter(n => !live.has(n));
      console.log(`${f}: 라이브에 없던 자유 변수 ${added.length}${added.length ? ' — ' + added.map(n => n + '@' + cand.get(n).slice(0, 4).join(',')).join(' ') : ''}`);
      bad += added.length;
    } else {
      for (const [n, lines] of cand) { if (!seenNew.has(n)) seenNew.set(n, []); seenNew.get(n).push(f + '@' + lines[0]); }
    }
  }
  console.log('\n새 파일들의 자유 변수(전역이어야 한다):');
  for (const [n, where] of [...seenNew].sort()) console.log('  ', n.padEnd(24), where.slice(0, 3).join(' '));
  process.exitCode = bad ? 1 : 0;
}
