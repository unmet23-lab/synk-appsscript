'use strict';
// 회사 릴리스 계보 실측 — 임시 폴더에 가짜 .tmp를 만들어, 부모 승인 재검증이 실제로 읽는 폴더와 정적 코드 닫힘만 잡히는지 본다.
// 실제 .tmp·운영 기록은 건드리지 않는다.
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const L = require('../tools/company-release/lineage.cjs');

function fixture(t) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lineage-test-'));
  t.after(() => fs.rmSync(방, { recursive: true, force: true }));
  const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기', '20261029');
  const 쓰기 = (상대, 글) => { const p = path.join(임시, 상대); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); return p; };
  const 옮기기 = (이름) => { fs.mkdirSync(대기, { recursive: true }); fs.renameSync(path.join(임시, 이름), path.join(대기, 이름)); };
  // 봉인된 부모 승인 입력(완료판 보존본) — 재검증이 읽을 옛 기록을 절대 경로로 가리킨다.
  const 입력 = 쓰기('completed-p-20261029/evidence/approval.json', JSON.stringify({ evidence: path.join(임시, 'old-evidence-20261012', 'e.json') }));
  쓰기('old-evidence-20261012/e.json', '{"ok":true}');
  // 부모 판 승인 모듈: 입력을 읽고, 기록은 fs.promises.realpath로만 건드리고(GA3), 없는 자리를 물어보고, 더 옛 판으로 내려간다.
  쓰기('p-38-release-20261029/rearm/approval.cjs', [
    "const fs=require('node:fs'),path=require('node:path');const older=require('../../q-37-release-20261028/rearm/approval.cjs');",
    'module.exports={async loadApproval(file){const input=JSON.parse(fs.readFileSync(file,"utf8"));await fs.promises.realpath(input.evidence);',
    "fs.existsSync(path.join(__dirname,'../../probe-gone-20261009/x.json'));",
    'const a=await older.loadApproval();return {...a,deploymentChain:[...a.deploymentChain,38]};}};',
  ].join('\n'));
  // 옛 판 모듈은 저장소 쪽(.tmp 위)으로도 올라가 부른다 — 정리 대기로 옮겨져도 그 길이 저장소로 풀려야 한다(r2 GA2).
  쓰기('q-37-release-20261028/rearm/approval.cjs', [
    "const path=require('node:path'),{pathToFileURL}=require('node:url');require('../../../tools/cjs-helper.cjs');",
    "module.exports={async loadApproval(){require('../../ha-lib-20261011/remote.cjs');const m=await import(pathToFileURL(path.join(__dirname,'../../esm-lib-20261012/policy.mjs')).href);return {deploymentChain:[36,m.p+36]};}};",
  ].join('\n'));
  쓰기('ha-lib-20261011/remote.cjs', '// 접속 도우미');
  쓰기('esm-lib-20261012/policy.mjs', "import {q} from '../esm-deep-20261011/q.mjs';\nimport {h} from '../../tools/helper.mjs';\nexport const p = q * h;");
  쓰기('esm-deep-20261011/q.mjs', 'export const q = 1;');
  쓰기('../tools/helper.mjs', 'export const h = 1;');
  쓰기('../tools/cjs-helper.cjs', 'module.exports = 1;');
  // 지금 판: 부모 핀 · 부모 승인 모듈을 previous로 부름 · 원격 단계 도구가 다른 옛 도우미를 부름 · 기록 json에는 출처 언급뿐.
  쓰기('r-39-release-20261030/deployment/parent-arm-pin.json', JSON.stringify({ approval: { path: 입력, sha256: crypto.createHash('sha256').update(fs.readFileSync(입력)).digest('hex') } }));
  쓰기('r-39-release-20261030/rearm/approval.cjs', "const previous=require('../../p-38-release-20261029/rearm/approval.cjs');module.exports={...previous};");
  쓰기('r-39-release-20261030/deployment/operator.cjs', [
    "const remote=()=>require('../../static-lib-20261013/runtime-deployment/common.cjs');",
    "const pre=()=>require('../qa/preflight.cjs');",
  ].join('\n'));
  // 판 안이지만 처음 훑기에서 건너뛰는 qa/의 도구가 다른 옛 도우미를 부른다(GA2).
  쓰기('r-39-release-20261030/qa/preflight.cjs', "require('../../qa-lib-20261009/x.cjs')");
  쓰기('qa-lib-20261009/x.cjs', '//');
  쓰기('static-lib-20261013/runtime-deployment/common.cjs', "require('./inner.cjs');const pre=require('path').resolve(__dirname,'../../static-deep-20261012/preflight.py');");
  쓰기('static-lib-20261013/runtime-deployment/inner.cjs', '//');
  쓰기('static-deep-20261012/preflight.py', '# 읽기만');
  // 폴더만 가리키고 그 안 파일은 path.join으로 한 겹 더 내려가 부르는 꼴(GA1) — 확장자 없이 적거나 index.js를 폴더 이름으로 부른다(r3b GA1).
  쓰기('r-39-release-20261030/rearm/collector.cjs', "const D=require('path').resolve(__dirname,'../../dir-lib-20261011');const pre=()=>require(require('path').join(D,'deployment','reader'));const pack=()=>require(require('path').join(D,'pack'));");
  쓰기('dir-lib-20261011/deployment/reader.js', "require('../../dir-deep-20261010/helper.cjs')");
  쓰기('dir-deep-20261010/helper.cjs', '//');
  쓰기('dir-lib-20261011/pack/index.js', "require('../../index-deep-20261003/x.cjs')");
  쓰기('index-deep-20261003/x.cjs', '//');
  // 계산한 경로로 코드를 부르는 로더가 폴더 맨 위를 돈다(r3b GA2 · 괄호 앞 공백 r4 GA2).
  쓰기('r-39-release-20261030/rearm/plugin-loader.cjs', "const fs=require('fs'),path=require('path');const D3=path.resolve(__dirname,'../../root-loader-20261002');for(const n of fs.readdirSync(D3))require (path.join(D3,n));");
  // 글자 require만 있고(괄호 안 공백) 맨 위를 도는 파일은 로더가 아니다(r4 GA1).
  쓰기('r-39-release-20261030/deployment/tree-check.cjs', [
    "const fs=require( 'fs'),path=require('path');",
    "const T=path.resolve(__dirname,'../../tree-root-20261001');",
    "for(const n of fs.readdirSync(T))fs.statSync(path.join(T,n));",
  ].join('\n'));
  쓰기('tree-root-20261001/gen.cjs', "const from='../tree-noise-20260930/x';");
  쓰기('tree-noise-20260930/x.cjs', '//');
  // 토크나이저가 놓치는 꼴(r5) — 제어문 뒤 정규식 속 따옴표, 나눗셈 뒤 require, String.raw, 파이썬 raw 문자열 속 \" — 합집합이 잡는다.
  쓰기('r-39-release-20261030/rearm/edge.cjs', [
    "if (flag) /'/.test(s); require('../../edge-a-20260929/x.cjs');",
    "const n = {} / require('../../edge-b-20260928/x.cjs') / 2;",
    'const w = String.raw`C:\\work\\.tmp\\edge-c-20260927\\reader.cjs`;',
  ].join('\n'));
  쓰기('r-39-release-20261030/rearm/edge.py', 's = r"\\""; p = "../../edge-d-20260926/x.py"\n');
  // 두 추출기가 함께 속던 겹친 꼴(r6) — 제어문 뒤 정규식 + require와 괄호 사이 주석, 템플릿 식 속 주석의 백틱 + String.raw, 파이썬 raw \" + 세 겹 따옴표.
  쓰기('r-39-release-20261030/rearm/edge2.cjs', [
    String.raw`if (flag) /'/.test(s); require /* c */ ('../../edge-e-20260925/x.cjs');`,
    String.raw`const p = String.raw` + '`${/* ` */ \'\'}' + String.raw`C:\work\.tmp\edge-f-20260924\reader.cjs` + '`;',
  ].join('\n'));
  쓰기('r-39-release-20261030/rearm/edge3.cjs', String.raw`const n = api.if(flag) / require /* ' */ ('../../edge-h-20260922/x.cjs') / 2;` + '\n');
  쓰기('edge-h-20260922/x.cjs', '//');
  쓰기('r-39-release-20261030/rearm/edge2.py', String.raw`s = r"\""; p = """` + '\n../../edge-g-20260923/x.py\n"""\n');
  for (const 이름 of ['edge-a-20260929', 'edge-b-20260928', 'edge-c-20260927', 'edge-d-20260926', 'edge-e-20260925', 'edge-f-20260924', 'edge-g-20260923']) 쓰기(`${이름}/x.cjs`, '//');
  쓰기('root-loader-20261002/a.cjs', "require('../root-loader-deep-20261001/b.cjs')");
  쓰기('root-loader-deep-20261001/b.cjs', '//');
  // 가리킨 폴더 안이어도 글자에 없는 파일은 따라가지 않는다 — 폴더 아래를 통째로 펼치면 .tmp 전체로 번진다.
  쓰기('dir-lib-20261011/other/noise.cjs', "require('../../noise-20261005/x.cjs')");
  쓰기('noise-20261005/x.cjs', '//');
  // 목록을 돌며 부르는 하위 폴더는 바로 아래 코드를 읽는다. 폴더 맨 위를 도는 것(후보 트리 훑기 같은 자료 보기)은 펼치지 않는다.
  쓰기('r-39-release-20261030/rearm/loader.cjs', "const fs=require('fs'),path=require('path');const D2=path.resolve(__dirname,'../../list-lib-20261008/plugins');for(const n of fs.readdirSync(D2))if(n.endsWith('.cjs'))require(path.join(D2,n));");
  쓰기('list-lib-20261008/plugins/a.cjs', "require('../../list-deep-20261007/b.cjs')");
  쓰기('list-deep-20261007/b.cjs', '//');
  쓰기('r-39-release-20261030/deployment/inspect.cjs', "const fs=require('fs'),path=require('path');const X=path.resolve(__dirname,'../../root-list-20261006');for(const n of fs.readdirSync(X))fs.statSync(path.join(X,n));");
  쓰기('root-list-20261006/generator.cjs', "const from='../../root-noise-20261004/candidate';");
  쓰기('root-noise-20261004/candidate/a.mjs', '//');
  쓰기('r-39-release-20261030/deployment/deployment-validation.json', JSON.stringify({ source: path.join(임시, 'prov-candidate-20261029', 'candidate') }));
  쓰기('prov-candidate-20261029/candidate/a.mjs', '//');
  쓰기('unrelated-20261001/a.cjs', '//');
  return { 임시, 대기, 쓰기, 옮기기, 판: path.join(임시, 'r-39-release-20261030') };
}

test('부모 승인 재검증이 실제로 읽는 폴더(require·fs·fs.promises·import)와 판 도구의 정적 코드 닫힘을 합치고, 기록 json의 출처 언급은 빼다', (t) => {
  const { 판 } = fixture(t);
  const 결과 = L.재기(판);
  a.equal(결과.chainLength, 3);
  a.deepEqual(Object.keys(결과.recheck).sort(), ['completed-p-20261029', 'esm-deep-20261011', 'esm-lib-20261012', 'ha-lib-20261011', 'old-evidence-20261012', 'p-38-release-20261029', 'q-37-release-20261028'],
    'fs.promises.realpath로만 건드린 기록(old-evidence)·import 안의 import(esm-deep)도 센다');
  a.deepEqual(결과.static, ['dir-deep-20261010', 'dir-lib-20261011', 'edge-a-20260929', 'edge-b-20260928', 'edge-c-20260927', 'edge-d-20260926', 'edge-e-20260925', 'edge-f-20260924', 'edge-g-20260923', 'edge-h-20260922', 'esm-deep-20261011', 'esm-lib-20261012', 'ha-lib-20261011', 'index-deep-20261003', 'list-deep-20261007', 'list-lib-20261008', 'p-38-release-20261029', 'q-37-release-20261028', 'qa-lib-20261009', 'root-list-20261006', 'root-loader-20261002', 'root-loader-deep-20261001', 'static-deep-20261012', 'static-lib-20261013', 'tree-root-20261001'],
    '폴더 참조 아래 중첩 도우미(dir-deep · 확장자 없이 · index.js)·판 안 qa/로 가는 require(qa-lib)·목록을 돌며 부르는 하위 폴더(list-deep)·맨 위를 도는 로더(root-loader-deep)·토크나이저가 놓치는 꼴(edge-a~d)은 따라가고, 글자에 없는 파일(noise)·로더 아닌 맨 위 목록 돌기 아래(root-noise · tree-noise)는 안 따라간다');
  a.ok(!결과.folders.includes('prov-candidate-20261029'), '기록 json의 출처 언급은 쓰는 폴더가 아니다');
  a.deepEqual(결과.missing, [], '없는 자리를 있는지 물어본 것(probe-gone)은 세지 않는다');
  const 절 = L.절로(결과, new Date(2026, 9, 30));
  a.match(절, /^#! 실측 계보 시작 — node tools\/company-release\/lineage\.cjs measure \.tmp\/r-39-release-20261030 \(2026-10-30 · 재검증 7곳 \d+초 · 정적 25곳\)\n/);
  a.match(절, /\nqa-lib-20261009\n/);
  a.match(절, /\n#! 실측 계보 끝$/);
});

test('재검증이 읽을 옛 기록이 없으면(정리 대기로 옮겨짐) 실패로 알린다 — 재무장 전에 같은 자리를 잡는다', (t) => {
  const { 옮기기, 판 } = fixture(t);
  옮기기('old-evidence-20261012');
  a.throws(() => L.재기(판), /PARENT_APPROVAL_RECHECK_FAILED .*ENOENT/s);
});

test('재검증이 안 타는 정적 참조의 폴더가 .tmp에서 빠지면 「.tmp에 없는 이름」으로 알리고, 정리대기를 주면 거기 있는지도 본다(디스크는 그대로)', (t) => {
  const { 임시, 대기, 옮기기, 판 } = fixture(t);
  옮기기('static-lib-20261013');
  const 결과 = L.재기(판, { 정리대기: 대기 });
  a.deepEqual(결과.missing, ['static-lib-20261013']);
  a.deepEqual(결과.missingInStaging, ['static-lib-20261013']);
  a.ok(!결과.folders.includes('static-lib-20261013'));
  a.ok(!fs.existsSync(path.join(임시, 'static-lib-20261013')) && fs.existsSync(path.join(대기, 'static-lib-20261013')), '디스크는 그대로');
  a.deepEqual(L.재기(판).missingInStaging, [], '정리대기를 안 주면 보지 않는다');
});

test('코드 읽기는 주석·문자열·템플릿·정규식을 가려 require·import와 글자를 뽑는다(정규식 흉내의 빈틈 — r4)', () => {
  const r = L.코드읽기([
    "const a=require( 'fs'), b=require ('./b.cjs'), c=require(path.join(D,'x.cjs'));",
    "// require(주석속) 와 import('주석속')",
    "/* require(가짜) */ const s='require(글자속)', t=`${T}/platform-ha-20261011/remote.cjs`;",
    "const re=/'/.test(s); const q=require.resolve(\"./q.cjs\"); obj.require(x);",
    "import('./e.mjs'); import(url); export {z} from './z.mjs'; const from = '../f';",
  ].join('\n'));
  a.deepEqual(r.부름들.map((b) => b.값), ['fs', './b.cjs', null, './q.cjs', './e.mjs', null, './z.mjs']);
  a.deepEqual(L.코드읽기('const s=`${require}${(T)}`; const u=`${a}${require(\'./in.cjs\')}`;').부름들.map((b) => b.값), ['./in.cjs'],
    '템플릿 식 둘이 이어져도 require(T)로 읽지 않는다(r5 GA2) — 식 안의 진짜 require는 읽는다');
  a.ok(r.글자들.includes('/platform-ha-20261011/remote.cjs'), '템플릿 고정 조각도 글자다');
  a.ok(!r.글자들.some((s) => s.includes('주석속') || s.includes('가짜')), '주석은 글자가 아니다');
  a.ok(r.이름들.has('path') && !r.이름들.has('주석속'));
  const py = L.코드읽기("# ROOT/'.tmp/주석-20261001'\np=ROOT/'.tmp/server-latency-20261013/runtime-deployment'\nfor x in sorted(p.glob('*.test.py')): pass\nr=r'C:\\x\\.tmp\\raw-20261002'\n", true);
  a.deepEqual(py.글자들, ['.tmp/server-latency-20261013/runtime-deployment', '*.test.py', 'C:\\x\\.tmp\\raw-20261002']);
  a.ok(py.이름들.has('glob') && py.부름들.length === 0);
});

test('봉인된 부모 승인 입력이 핀과 다르거나 부모 승인 모듈을 못 찾으면 돌리지 않는다', (t) => {
  const { 쓰기, 판 } = fixture(t);
  쓰기('completed-p-20261029/evidence/approval.json', '{"changed":true}');
  a.throws(() => L.재기(판), /PARENT_APPROVAL_INPUT_CHANGED/);
  const 두번째 = fixture(t);
  두번째.쓰기('r-39-release-20261030/rearm/approval.cjs', 'module.exports={};');
  a.throws(() => L.재기(두번째.판), /PARENT_APPROVAL_MODULE_REQUIRED/);
});
