// 공개본 계정 묶음(synk.im/account/dist/platform.js)의 계정 라이브러리 모듈을 master 판으로 갈아 끼우는 공용 부품.
// 공개본은 10-14~16 GPT 릴리스 빌드에 글·모듈을 얹어 온 묶음이라 master로 다시 묶으면 남의 미공개 기능이 나간다(현장 노트 배포_공개).
// 그래서 두 구역만 바꾼다.
//   A = 자료 모듈 platform-library-data — 공개본에서 personal-data가 부르므로 __esm으로 싸인 꼴(init_platform_library_data)
//   R = 계정 노트 → 라이브러리 계정 → 보기 모듈(사이의 init 호출 포함). master 판이면 state·personal-state·recovery도 이 안에 든다.
// 충돌 환경: 공개본에서 두 구역 밖에 선언된 최상위 이름 전부를 맨 앞 모듈이 먼저 선언해 esbuild가 내 모듈 이름에 같은 번호를 붙이게 한다.
// product-account·document-sync는 그 모듈로 잇고(공개본 이름 그대로), personal-data는 __esm으로 싸인 작은 대역으로 둔다.
'use strict';
const fs = require('node:fs'), path = require('node:path');
// git 밖 의존성은 이 PC 공용 작업본에 있다(워크트리에는 node_modules가 없다).
const SHARED = 'C:/Users/q1212/Documents/SYNK-appsscript';
const from = (name, ...dirs) => require(require.resolve(name, { paths: [...dirs, path.resolve(__dirname, '../..'), SHARED + '/experiences/synk-account', SHARED + '/영상'] }));
const esbuild = from('esbuild'), acorn = from('acorn');
const SRC = 'experiences/synk-account/src';
// esbuild 도우미 이름은 충돌 목록에서 뺀다(내 컴파일의 도우미는 버리고 공개본 것을 그대로 쓴다).
const RUNTIME = /^__(create|defProp|getOwnPropDesc|getOwnPropNames|getProtoOf|hasOwnProp|esm|commonJS|export|copyProps|toESM|toCommonJS|require|reExport|publicField|name|async|await)$/;
// 10-22 계정 포털 공개(synk-policy 641fb16)가 이 구역을 master 빌드 환경에서 컴파일해, 공개본에 없는 최상위 이름 text3이 번호를 차지했다.
const PHANTOM = ['text3'];

function names(pattern, out = []) {
  if (!pattern) return out;
  if (pattern.type === 'Identifier') out.push(pattern.name);
  else if (pattern.type === 'ObjectPattern') for (const p of pattern.properties) names(p.type === 'RestElement' ? p.argument : p.value, out);
  else if (pattern.type === 'ArrayPattern') for (const e of pattern.elements) names(e, out);
  else if (pattern.type === 'RestElement') names(pattern.argument, out);
  else if (pattern.type === 'AssignmentPattern') names(pattern.left, out);
  return out;
}
/** 묶음의 바깥 IIFE 최상위 문장 목록: [{type, start, end, declared[]}] */
function statements(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest' });
  const call = ast.body.length === 1 ? ast.body[0].expression : null, fn = call?.callee;
  if (call?.type !== 'CallExpression' || !['ArrowFunctionExpression', 'FunctionExpression'].includes(fn?.type) || fn.body.type !== 'BlockStatement') throw Error('expected (()=>{...})()');
  return fn.body.body.map(st => {
    const declared = [];
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) names(d.id, declared);
    else if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) declared.push(st.id.name);
    return { type: st.type, start: st.start, end: st.end, declared };
  });
}
/** 공개본의 두 구역(문장 번호) — A: emptyPlatformLibrary … init_platform_library_data, R: (init_personal_data();) var operations … mountPlatformLibrary */
function regions(code, list = statements(code)) {
  const at = name => list.findIndex(st => st.declared.includes(name));
  const a0 = at('emptyPlatformLibrary'), a1 = at('init_platform_library_data');
  const ops = list.findIndex(st => st.declared.includes('operations') && code.startsWith('var operations=Object.freeze({load:"personalLoad"', st.start));
  const r0 = ops > 0 && code.slice(list[ops - 1].start, list[ops - 1].end) === 'init_personal_data();' ? ops - 1 : ops, r1 = at('mountPlatformLibrary');
  if ([a0, a1, ops, r1].some(i => i < 0) || a1 <= a0 || a1 - a0 > 6 || r1 <= r0) throw Error('regions ' + [a0, a1, ops, r0, r1]);
  return { A: [a0, a1], R: [r0, r1] };
}

async function compile({ srcRoot, collide, pretty }) {
  const stub = `import { validatePlatformLibrary } from ${JSON.stringify('./' + SRC + '/platform-library-data.mjs')};export function validatePersonalState(resource, value) { return validatePlatformLibrary(value); }`;
  const result = await esbuild.build({
    absWorkingDir: srcRoot, bundle: true, write: false, platform: 'browser', format: 'iife', target: ['es2022'], charset: 'utf8', minifyWhitespace: !pretty, logLevel: 'silent',
    // 보기 모듈은 이름으로 불러야 내보내기 객체가 생기지 않는다. personal-data 대역을 늦게 불러 자료 모듈을 __esm으로 싸이게 한다.
    stdin: { contents: `import * as __collide_ns from "collide";import { mountPlatformLibrary as __mount } from ${JSON.stringify('./' + SRC + '/platform-library-view.mjs')};globalThis.__keep=[__collide_ns,__mount];globalThis.__lazy=()=>import("./personal-data.mjs");`, resolveDir: srcRoot, sourcefile: '<stdin>', loader: 'js' },
    plugins: [{ name: 'live-env', setup(b) {
      b.onResolve({ filter: /^collide$|^\.\/(product-account|document-sync)\.mjs$/ }, () => ({ path: 'collide', namespace: 'collide' }));
      b.onResolve({ filter: /^\.\/personal-data\.mjs$/ }, () => ({ path: 'personal-data.mjs', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'collide' }, () => ({ contents: [...collide].map(n => `export var ${n}=1;`).join(''), loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, loader: 'js', resolveDir: srcRoot }));
    } }],
  });
  if (result.errors.length) throw Error(result.errors.map(e => e.text).join('\n'));
  return result.outputFiles[0].text;
}
// 펴서 지은 판의 모듈 주석(// 경로)으로 문장마다 주인 모듈을 매긴다(줄인 판과 문장 차례가 같다).
function owners(prettyText) {
  const comments = [];
  acorn.parse(prettyText, { ecmaVersion: 'latest', onComment: (block, text, start) => { if (!block) comments.push({ start, text: text.trim() }); } });
  return statements(prettyText).map(st => { let owner = null; for (const c of comments) { if (c.start < st.start) owner = c.text; else break; } return owner; });
}

/** srcRoot(experiences/synk-account/src가 든 뿌리)의 라이브러리 모듈을 공개본 환경에서 컴파일한다 → { A, R } 글과 확인 결과 */
async function build({ srcRoot, live }) {
  const list = statements(live), { A, R } = regions(live, list);
  const inRegion = i => (i >= A[0] && i <= A[1]) || (i >= R[0] && i <= R[1]);
  const kept = new Set(list.flatMap((st, i) => inRegion(i) ? [] : st.declared));
  const collide = new Set([...[...kept].filter(n => !RUNTIME.test(n) && n !== 'validatePersonalState' && n !== 'init_personal_data'), ...PHANTOM]);
  const [minText, prettyText] = await Promise.all([compile({ srcRoot, collide, pretty: false }), compile({ srcRoot, collide, pretty: true })]);
  const out = statements(minText), own = owners(prettyText);
  if (out.length !== own.length) throw Error('statement count differs between pretty and minified builds: ' + out.length + ' / ' + own.length);
  const is = (i, file) => own[i] === SRC + '/' + file;
  // 충돌 목록 이름이 그대로여야 한다(바뀌면 내 코드가 그 이름을 전역으로 부르거나 같은 이름을 최상위에 선언한 것).
  const collideOut = new Set(out.filter((st, i) => own[i] === 'collide:collide').flatMap(st => st.declared));
  const mine = ['account-notebook.mjs', 'platform-library-account.mjs', 'platform-library-view.mjs', 'platform-library-state.mjs', 'personal-state.mjs', 'platform-library-recovery.mjs'];
  const dataIdx = out.map((st, i) => i).filter(i => is(i, 'platform-library-data.mjs'));
  const mineIdx = out.map((st, i) => i).filter(i => mine.some(f => is(i, f)));
  const span = []; for (let i = mineIdx[0]; i <= mineIdx.at(-1); i++) span.push(i);
  const text = i => minText.slice(out[i].start, out[i].end);
  const R2 = span.filter(i => !is(i, 'platform-library-data.mjs'));
  return {
    list, regions: { A, R }, kept,
    renamedCollide: [...collide].filter(n => !collideOut.has(n)),
    stray: span.filter(i => !mine.some(f => is(i, f)) && !is(i, 'platform-library-data.mjs')).map(i => ({ i, owner: own[i], text: text(i).slice(0, 80) })),
    A: dataIdx.map(text).join(''), R: R2.map(text).join(''),
    Rstatements: R2.map(i => ({ ...out[i], owner: own[i] })),
    outputNames: new Set([...dataIdx, ...R2].flatMap(i => out[i].declared)),
  };
}

/** 묶음의 「선언 없이 쓰는 이름」(전역 참조) — 후보가 공개본에 없는 미선언 참조를 새로 만들지 않았는지 견준다. */
function globalsOf(code) {
  const eslintScope = from('eslint-scope');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', ranges: true });
  const through = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script', fallback: 'iteration' }).globalScope.through;
  return new Set(through.map(ref => ref.identifier.name));
}

/** 후보 묶음에서 라이브러리 코드를 떼어 ESM 모듈 글로 — master 시험을 공개될 바이트에 그대로 돌리기 위해.
 *  esbuild 도우미 · 공개본 문서 동기화(그대로 남는 모듈) · A · R. 제품 계정은 계정 노트의 기본 인자로만 이름이 나오고
 *  보기 모듈이 늘 accountFactory를 넘기므로, 부르면 멈추는 대역을 둔다. */
function testModule(code) {
  const list = statements(code), at = name => { const i = list.findIndex(st => st.declared.includes(name)); if (i < 0) throw Error('missing ' + name); return i; };
  const pick = new Set(['__defProp', '__getOwnPropNames', '__esm', 'validRevision', 'failure', 'messages', 'documentSyncErrorMessage', 'createDocumentSync'].map(at));
  const { A, R } = regions(code, list);
  for (let i = A[0]; i <= A[1]; i++) pick.add(i);
  for (let i = R[0]; i <= R[1]; i++) pick.add(i);
  return '// 후보 묶음에서 뗀 계정 라이브러리 코드(시험용)\nvar createProductAccount=()=>{throw new Error("createProductAccount is not part of the library")};\n'
    + [...pick].sort((a, b) => a - b).map(i => code.slice(list[i].start, list[i].end)).join('\n')
    + '\nexport { mountPlatformLibrary, emptyPlatformLibrary, validatePlatformLibrary, updatePlatformLibrary, projectPlatformLibrary, PLATFORM_APP_IDS, ACTIVE_PLATFORM_APP_IDS, PLATFORM_LIBRARY_LIMITS, createLibraryRecovery, libraryDraft, validatePlatformLibraryState, platformLibraryAccount, createDocumentSync };\n';
}

module.exports = { SHARED, from, esbuild, acorn, statements, regions, build, globalsOf, testModule };
