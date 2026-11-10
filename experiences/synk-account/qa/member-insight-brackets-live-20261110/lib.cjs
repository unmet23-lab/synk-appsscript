'use strict';
// 공개 묶음(account/dist/platform.js)에서 회원 문장 모듈(atlas/vellum-insight.js) 하나를 찾고, 그 몸통만 따로 돌려 본다.
// patch-live.cjs(갈아 끼우기) · screen.cjs(화면 전후)와 시험용 대역이 함께 쓴다.
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../../../..');
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
// 세션 사본에는 node_modules가 없다 — 공용 작업본의 것을 읽는다(쓰지 않는다).
const SHARED = 공용작업본(ROOT);
const from = [...new Set([ROOT, SHARED])].flatMap(base => [base, path.join(base, '영상'), path.join(base, 'experiences/synk-account')]);
const dep = name => require(require.resolve(name, { paths: from }));
const version = name => require(require.resolve(name + '/package.json', { paths: from })).version;
const acorn = dep('acorn');
const MODULE_KEY = 'atlas/vellum-insight.js';
const parse = code => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', ranges: true });

// esbuild의 __commonJS({"atlas/vellum-insight.js"(exports2,module2){…}}) — 묶음에 하나뿐이어야 한다.
function findModule(code, ast = parse(code)) {
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) walk(child); return; }
    if (node.type === 'Property' && node.key.type === 'Literal' && node.key.value === MODULE_KEY) found.push(node);
    for (const key in node) if (key !== 'type' && node[key] && typeof node[key] === 'object') walk(node[key]);
  })(ast);
  if (found.length !== 1) throw new Error(`${MODULE_KEY} 모듈이 ${found.length}개다(하나여야 한다)`);
  const fn = found[0].value;
  if (fn.type !== 'FunctionExpression' || fn.body.type !== 'BlockStatement' || fn.params.some(p => p.type !== 'Identifier')) throw new Error(`${MODULE_KEY} 모듈 모양이 다르다`);
  return { ast, fn, params: fn.params.map(p => p.name), start: fn.body.start + 1, end: fn.body.end - 1 };
}

// 묶음 속 모듈 몸통을 묶음 밖에서 돌린다 — 바깥 이름을 하나도 못 보므로, 몸통이 스스로 서지 못하면 여기서 터진다.
function loadModule(bundlePath) {
  const code = fs.readFileSync(bundlePath, 'utf8'), at = findModule(code), module2 = { exports: {} };
  new Function(...at.params, code.slice(at.start, at.end))(module2.exports, module2);
  return module2.exports;
}

module.exports = { ROOT, SHARED, MODULE_KEY, dep, version, acorn, parse, findModule, loadModule };
