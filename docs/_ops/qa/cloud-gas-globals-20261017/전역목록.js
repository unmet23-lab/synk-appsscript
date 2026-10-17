// 사용: node gas_globals.js <저장소> 파일...
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const [repo, ...files] = process.argv.slice(2);
const GAS = ['SpreadsheetApp','PropertiesService','ScriptApp','LockService','UrlFetchApp','Utilities','MailApp','HtmlService','ContentService','Session','console','Logger','CacheService','DriveApp','GmailApp','JSON','Date','Object','Array','Number','String','Math','Set','Error','RegExp','Map','Promise','Symbol','undefined','encodeURIComponent'];
const globals = {}; const refs = {}; const strings = []; const shadows = [];
const parsed = files.map(f => {
  const src = fs.readFileSync(path.join(repo, f), 'utf8');
  return { f, src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true }) };
});
for (const { f, ast } of parsed) {
  for (const n of ast.body) {
    const add = (name, kind, line) => (globals[name] = globals[name] || []).push({ f, line, kind });
    if (n.type === 'FunctionDeclaration') add(n.id.name, 'function', n.loc.start.line);
    else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => d.id.type === 'Identifier' && add(d.id.name, n.kind, d.loc.start.line));
    else if (n.type === 'ClassDeclaration') add(n.id.name, 'class', n.loc.start.line);
    else if (n.type !== 'EmptyStatement') add('<top-level ' + n.type + '>', 'stmt', n.loc.start.line);
  }
}
for (const { f, ast } of parsed) {
  // 참조: 선언 위치가 아닌 Identifier
  walk.fullAncestor(ast, (node, st, anc) => {
    if (node.type === 'Literal' && typeof node.value === 'string') strings.push({ f, line: node.loc.start.line, v: node.value });
    if (node.type === 'TemplateElement') strings.push({ f, line: node.loc.start.line, v: node.value.cooked });
    if (node.type !== 'Identifier') return;
    const p = anc[anc.length - 2];
    if (!p) return;
    if ((p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression') && p.id === node) return;
    if (p.type === 'VariableDeclarator' && p.id === node) return;
    if (p.type === 'MemberExpression' && p.property === node && !p.computed) return;
    if (p.type === 'Property' && p.key === node && !p.computed && !p.shorthand) return;
    (refs[node.name] = refs[node.name] || []).push({ f, line: node.loc.start.line });
  });
  // 지역 선언(인자·변수·내부 함수)이 전역/GAS 이름을 가리는지
  walk.fullAncestor(ast, (node, st, anc) => {
    const inFn = anc.slice(0, -1).some(a => /Function/.test(a.type));
    const check = (id, what) => { if (id && id.type === 'Identifier' && (globals[id.name] || GAS.includes(id.name))) shadows.push({ f, line: id.loc.start.line, name: id.name, what, against: globals[id.name] ? 'project-global' : 'GAS/builtin' }); };
    if (/Function/.test(node.type)) { node.params.forEach(pm => check(pm, 'param')); if (node.type !== 'FunctionDeclaration' || inFn) check(node.id, 'inner-fn'); }
    if (node.type === 'VariableDeclarator' && inFn) check(node.id, 'local');
    if (node.type === 'CatchClause') check(node.param, 'catch');
  });
}
const out = { globals: {}, collisions: [], unreferenced: [], shadows };
for (const [name, decls] of Object.entries(globals)) {
  const r = (refs[name] || []);
  const s = strings.filter(x => x.v.includes(name) && name.length > 2).map(x => ({ f: x.f, line: x.line, snippet: x.v.length > 80 ? '…' + x.v.slice(Math.max(0, x.v.indexOf(name) - 40), x.v.indexOf(name) + name.length + 20) + '…' : x.v }));
  out.globals[name] = { decls, refs: r, stringRefs: s };
  if (decls.length > 1) out.collisions.push({ name, decls });
  if (!r.length) out.unreferenced.push({ name, decls, stringRefs: s });
}
// GAS 내장 이름을 전역으로 다시 선언했는지
out.builtinRedeclared = Object.keys(globals).filter(n => GAS.includes(n));
console.log(JSON.stringify(out, (k, v) => k === 'globals' ? Object.fromEntries(Object.entries(v).map(([n, g]) => [n, { decls: g.decls, refCount: g.refs.length, refs: g.refs, stringRefs: g.stringRefs.length }])) : v, 1));
