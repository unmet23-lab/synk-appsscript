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
  a.match(절, /^#! 실측 계보 시작 — node tools\/company-release\/lineage\.cjs measure \.tmp\/r-39-release-20261030 \(재검증 7곳 \d+초 · 입력 그래프 1곳 · 정적 25곳\) \(2026-10-30\)\n/);
  a.equal(결과.design, 'previous');
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

test('①′ 재무장 입력 그래프: 부모 핀 JSON 속 핀을 따라 닿는 폴더도 계보에 넣고(①이 안 읽어도), 생성기는 가리키는 폴더 이름만 넣는다', (t) => {
  const f = fixture(t);
  const 해시 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const 깊은 = f.쓰기('graph-deep-20261020/owner.json', '{"ok":1}');
  const 중간 = f.쓰기('graph-mid-20261021/contract.json', JSON.stringify({ acceptance: { evidence: [{ path: 깊은, sha256: 해시(깊은) }] } }));
  const 핀 = JSON.parse(fs.readFileSync(path.join(f.판, 'deployment/parent-arm-pin.json')));
  핀.contract = { path: 중간, sha256: 해시(중간) };
  f.쓰기('r-39-release-20261030/deployment/parent-arm-pin.json', JSON.stringify(핀));
  // 생성기: 앞 판 원천을 글자로 적어 옮길 뿐 — 그 폴더 이름은 넣되 그 안 코드(gen-deep)로 따라가지 않는다.
  f.쓰기('gen-only-20261019/rearm/approval.cjs', "require('../../gen-deep-20261018/x.cjs')");
  f.쓰기('gen-deep-20261018/x.cjs', '//');
  f.쓰기('r-39-release-20261030/generators/p39-rearm.cjs', "const BASE=require('path').join(T,'gen-only-20261019');if(name==='rearm/approval.cjs')read(BASE,name);require('../../gen-only-20261019/rearm/approval.cjs');");
  const 결과 = L.재기(f.판);
  a.deepEqual(Object.keys(결과.inputGraph.folders).sort(), ['completed-p-20261029', 'graph-deep-20261020', 'graph-mid-20261021']);
  a.ok(결과.folders.includes('graph-deep-20261020') && 결과.folders.includes('graph-mid-20261021'), '입력 그래프가 닿는 폴더는 계보다');
  a.ok(결과.static.includes('gen-only-20261019') && !결과.static.includes('gen-deep-20261018'), '생성기는 이름만');
  fs.writeFileSync(깊은, '{"changed":1}');
  a.deepEqual(L.재기(f.판).inputGraph.changed, [깊은], '핀과 다른 파일은 따로 알린다(prepare-arm이 멈출 자리)');
});

test('봉인된 부모 설계 판: ①은 판 자신의 loadParent, ①′은 판 코드의 봉인 역사 H를 건너뛰어 옛 판으로 내려가지 않는다', (t) => {
  const f = fixture(t);
  const 해시 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  // 옛 판(봉인 역사): 부모 봉인 계약이 가리키는 그 앞 판 증거 — 새 설계에서는 읽지 않아야 한다.
  const 옛증거 = f.쓰기('history-old-20261015/owner.json', '{"old":1}');
  // 부모 무장 계약의 증거에도 있는(=봉인 역사) DR 묶음 — 그래도 앞 판 정적 입력이 가리키면 prepare-arm이 맨 위에서 읽으므로 계보에 든다.
  const 연습 = f.쓰기('dr-hist-20261016/result.json', '{"schema":"synk-company-restore-drill/v1"}');
  const 봉인계약 = f.쓰기('completed-s-20261029/evidence/contract.json', JSON.stringify({ acceptance: { evidence: [{ path: 옛증거, sha256: 해시(옛증거) }, { path: 연습, sha256: 해시(연습) }] } }));
  const 앞정적 = f.쓰기('s-39-release-20261030/rearm/fresh-static-inputs-final-v1.json', JSON.stringify({ drProof: { path: 연습, sha256: 해시(연습) } }));
  f.쓰기('s-40-release-20261031/rearm-ops/rearm-operations.cjs', `const PARENT_STATIC=Object.freeze({path:path.resolve(__dirname,'../../s-39-release-20261030/rearm/fresh-static-inputs-final-v1.json'),sha256:'${해시(앞정적)}'});`);
  const 봉인입력 = f.쓰기('completed-s-20261029/evidence/approval.json', '{"schema":"sealed-parent-input"}');
  // 지금 판이 라이브에서 잡은 무장 해제 기준 — 같은 승인(부모가 설치한 것)을 담아 옛 증거를 가리킨다.
  const 기준 = f.쓰기('s-40-release-20261031/deployment/disarmed.json', JSON.stringify({ acceptance: { evidence: [{ path: 옛증거, sha256: 해시(옛증거) }] } }));
  f.쓰기('s-40-release-20261031/candidate-validation.json', JSON.stringify({ disarmed: { path: 기준, sha256: 해시(기준) } }));
  f.쓰기('s-40-release-20261031/deployment/parent-arm-pin.json', JSON.stringify({ approval: { path: 봉인입력, sha256: 해시(봉인입력) }, contract: { path: 봉인계약, sha256: 해시(봉인계약) } }));
  // 리뷰는 676 무장의 게이트 증거를 맨 위에서 읽는다 — 그 증거도 봉인 역사(부모 계약)에 있지만 계보에 든다.
  const 게이트증거 = f.쓰기('gate-676-20261012/proof.json', '{"proof":1}');
  // 실제 676 무장 기록처럼 게이트 증거 하나는 저장소 뿌리 기준 상대 경로(.tmp/…) — 판의 evidence()가 작업 폴더 기준으로 푼다.
  const 상대증거 = f.쓰기('gate-rel-20261012/proof.json', '{"rel":1}');
  const 무장676 = f.쓰기('ha-base-20261011/final-arm.json', JSON.stringify({ acceptance: { _operatorEvidence: { gates: { g: { evidence: [{ path: 게이트증거, sha256: 해시(게이트증거) }, { path: '.tmp/gate-rel-20261012/proof.json', sha256: 해시(상대증거) }] } } } } }));
  const 계약글 = JSON.parse(fs.readFileSync(봉인계약, 'utf8')); 계약글.acceptance.evidence.push({ path: 게이트증거, sha256: 해시(게이트증거) }); fs.writeFileSync(봉인계약, JSON.stringify(계약글));
  // 재무장 Linux QA 결과의 원천 목록 — prepare-arm이 하나씩 잡는다.
  const qa원천 = f.쓰기('qa-tool-20261013/verify.cjs', '//');
  f.쓰기('s-40-release-20261031/rearm/linux-qa-result-v1.json', JSON.stringify({ files: [{ name: path.relative(path.dirname(f.임시), qa원천).split(path.sep).join('/'), sha256: 해시(qa원천) }] }));
  // 부모 결과의 previousApproval(조부모 봉인 입력)은 판 모듈이 자기 값으로 덮는 열쇠라 ①′가 걷지 않는다 — 안 그러면 옛 사슬로 내려간다.
  const 조부모안 = f.쓰기('chain-older-20261014/approval-input.json', '{"older":1}');
  const 조부모 = f.쓰기('completed-g-20261028/evidence/approval.json', JSON.stringify({ previousApproval: { path: 조부모안, sha256: 해시(조부모안) } }));
  // 봉인 결과(자료) — 부모 결과의 inputPins. 코드에 경로 글자를 두지 않는다(정적 닫힘이 그 글자를 잡지 않게).
  const 봉인결과 = f.쓰기('approval-s-20261029/approval-result.json', JSON.stringify({ deploymentChain: [1, 2, 3], inputPins: { finalArm676: { path: 무장676, sha256: 해시(무장676) }, previousApproval: { path: 조부모, sha256: 해시(조부모) } } }));
  f.쓰기('s-40-release-20261031/rearm/sealed/sealed-approval.cjs', [
    "const fs=require('node:fs'),path=require('node:path');",
    "module.exports={history(P){const v=JSON.parse(fs.readFileSync(P.contract,'utf8'));return new Set(v.acceptance.evidence.map(x=>path.resolve(x.path).toLowerCase()+'|'+x.sha256));},",
    "load(P,pin){if(path.resolve(pin.path)!==path.resolve(P.input))throw Error('PIN');fs.readFileSync(P.contract);return JSON.parse(fs.readFileSync(P.result,'utf8'));}};",
  ].join('\n'));
  f.쓰기('s-40-release-20261031/rearm/approval.cjs', [
    "const base={},trusted=require('./sealed/sealed-approval.cjs');",
    `const SEALED_PARENT=Object.freeze(${JSON.stringify({ contract: 봉인계약, input: 봉인입력, result: 봉인결과 })});`,
    'function load(a,input){const inputPins={...a.inputPins,previousApproval:input.previousApproval,parentManifest:input.parentManifest};delete inputPins.currentAccountBaseline;return inputPins;}',
    'module.exports={...base,SEALED_PARENT,loadParent:pin=>trusted.load(SEALED_PARENT,pin)};',
  ].join('\n'));
  const 결과 = L.재기(path.join(f.임시, 's-40-release-20261031'));
  a.equal(결과.design, 'sealed');
  a.equal(결과.chainLength, 3);
  a.deepEqual(Object.keys(결과.recheck).sort(), ['approval-s-20261029', 'completed-s-20261029', 's-40-release-20261031']);
  a.ok(!결과.folders.includes('history-old-20261015'), '봉인 역사 핀은 입력 그래프가 안쪽에서 따라가지 않는다');
  a.ok(결과.folders.includes('dr-hist-20261016') && 결과.folders.includes('s-39-release-20261030'), '앞 판 정적 입력과 그 DR 묶음은 봉인 역사여도 맨 위에서 읽는다');
  a.ok(결과.folders.includes('gate-676-20261012') && 결과.folders.includes('ha-base-20261011'), '리뷰가 맨 위에서 읽는 676 게이트 증거');
  a.ok(결과.folders.includes('gate-rel-20261012'), '저장소 뿌리 기준 상대 경로 증거도(10-30 — 37 · 38 실측에서 pulse-portfolio-server-audit · pulse-library를 놓쳤다)');
  a.ok(결과.folders.includes('qa-tool-20261013'), '재무장 Linux QA 결과의 원천 파일');
  a.ok(!결과.folders.includes('completed-g-20261028') && !결과.folders.includes('chain-older-20261014'), '판 모듈이 덮는 열쇠(previousApproval)는 부모 결과의 값으로 걷지 않는다');
  a.equal(결과.inputGraph.skippedHistory, 5, "무장 해제 기준 1 · 부모 계약 셋 · 676 무장 안쪽 1(그 증거는 맨 위에서 따로 읽음)");
  a.match(L.절로(결과, new Date(2026, 9, 31)), /measure \.tmp\/s-40-release-20261031 \(봉인된 부모 · 재검증 3곳 \d+초 · 입력 그래프 \d+곳 · 정적 \d+곳\) \(2026-10-31\)\n/);
  // 절은 여러 판(지금 운영 판 · 준비 중인 판)의 합집합이다(Fable P1-2) — 옛 설계 판의 계보를 함께 남긴다.
  const 옛판 = L.재기(f.판), 합 = L.절로([옛판, 결과], new Date(2026, 9, 31));
  a.match(합, /measure \.tmp\/r-39-release-20261030 \(재검증 7곳 .*\) \+ \.tmp\/s-40-release-20261031 \(봉인된 부모 · .*\) \(2026-10-31 · 합집합 \d+곳\)\n/);
  for (const 이름 of [...옛판.folders, ...결과.folders]) a.ok(합.includes('\n' + 이름 + '\n'), 이름);
  // 판 모듈이 previous도 함께 부르면(반쯤 옮긴 꼴) 어느 쪽인지 정하지 않고 멈춘다.
  f.쓰기('s-40-release-20261031/rearm/approval.cjs', fs.readFileSync(path.join(f.임시, 's-40-release-20261031/rearm/approval.cjs'), 'utf8') + "\nconst previous=require('../../p-38-release-20261029/rearm/approval.cjs');");
  a.throws(() => L.재기(path.join(f.임시, 's-40-release-20261031')), /PARENT_APPROVAL_MODULE_REQUIRED/);
});

test('①′ 앞 판 정적 입력(PARENT_STATIC): prepare-arm 첫 단계가 읽는 DR 묶음이 여러 판 앞 폴더여도 계보에 든다 — 봉인 역사에 있어도', (t) => {
  const f = fixture(t);
  const 해시 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  // 앞 판의 정적 입력은 열네 판 앞 폴더의 연습 묶음을 물려받아 가리킨다(37 · 36 실측 꼴).
  const 묶음 = f.쓰기('dr-old-20261022/rearm/dr-drill/run/result.json', '{"schema":"synk-company-restore-drill/v1"}');
  const 정적 = f.쓰기('p-38-release-20261029/rearm/fresh-static-inputs-final-v1.json', JSON.stringify({ schema: 'static', drProof: { path: 묶음, sha256: 해시(묶음) } }));
  f.쓰기('r-39-release-20261030/rearm-ops/rearm-operations.cjs',
    `const PARENT_STATIC=Object.freeze({path:path.resolve(__dirname,'../../p-38-release-20261029/rearm/fresh-static-inputs-final-v1.json'),sha256:'${해시(정적)}',bytes:${fs.statSync(정적).size}});`);
  const 결과 = L.재기(f.판);
  a.ok(결과.inputGraph.folders['dr-old-20261022'] === 1 && 결과.folders.includes('dr-old-20261022'), '앞 판 정적 입력이 가리키는 DR 묶음 폴더');
  fs.renameSync(path.join(f.임시, 'dr-old-20261022'), path.join(f.임시, 'dr-old-20261022.gone'));
  const 빠짐 = L.재기(f.판);
  a.deepEqual(빠짐.missing, ['dr-old-20261022'], '그 묶음이 정리되면 실패로 알린다(prepare-arm이 parentDrBundle에서 멈출 자리)');
});

// 재무장 Linux QA 원천 함수가 있는 판(38 rearm/linux-qa.cjs sources()의 꼴을 줄임): 판 안 고정 파일 · 글자로 적은 QA 도구와 그 상대 require ·
// 자료 json(qa-roots.json)에서 읽은 원천. 배포 때 생기는 deployment/rearm-stage-plan-pin.json은 아직 없다. 앞줄은 sources() 맨 앞에 넣는 줄.
function QA원천판(f, 앞줄 = '') {
  f.쓰기('qa-src-20261013/verify.cjs', "require('../qa-deep-20261012/x.cjs')");
  f.쓰기('qa-deep-20261012/x.cjs', '//');
  f.쓰기('qa-data-20261014/tool.py', '# 원격 QA 도구');
  f.쓰기('r-39-release-20261030/rearm/qa-roots.json', JSON.stringify(['../../qa-data-20261014/tool.py']));
  f.쓰기('r-39-release-20261030/rearm/linux-qa.cjs', String.raw`const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const found=new Set();
function add(p){p=path.resolve(p);if(found.has(p))return;if(!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink())throw Error('REGULAR_REPO_SOURCE');found.add(p);if(!/\.[mc]?js$/.test(p))return;for(const m of fs.readFileSync(p,'utf8').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){const c=path.resolve(path.dirname(p),m[1]);if(fs.existsSync(c))add(c);}}
module.exports={sources(){
` + 앞줄 + String.raw`
add(path.join(__dirname,'../deployment','rearm-stage-plan-pin.json'));
add(path.join(__dirname,'../../qa-src-20261013/verify.cjs'));
for(const r of JSON.parse(fs.readFileSync(path.join(__dirname,'qa-roots.json'),'utf8')))add(path.resolve(__dirname,r));
return [...found].sort().map(p=>{const b=fs.readFileSync(p);return{name:path.relative(path.resolve(__dirname,'../../..'),p).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(b).digest('hex'),base64:b.toString('base64')};});
}};
`);
}

test('③ QA 원천: 판 rearm/linux-qa.cjs의 sources()를 판 코드 그대로 돌려 닿는 폴더를 넣는다 — 자료 json에서 읽는 경로(②가 못 보는 것)까지, 배포 전 판 안에 없는 JS 아닌 파일만 빈 파일로 본다', (t) => {
  const f = fixture(t);
  QA원천판(f);
  const 결과 = L.재기(f.판);
  a.equal(결과.qaSources.files, 4, '배포 때 생길 판 안 파일 · QA 도구 · 그 상대 require · 자료에서 읽은 원천');
  a.deepEqual(결과.qaSources.tolerated, ['deployment/rearm-stage-plan-pin.json']);
  a.deepEqual(Object.keys(결과.qaSources.folders).sort(), ['qa-data-20261014', 'qa-deep-20261012', 'qa-src-20261013', 'r-39-release-20261030']);
  a.deepEqual(결과.qaSources.outsideStatic, ['qa-data-20261014'], '자료 json에서 읽은 경로는 ②가 못 본다 — ③이 잡는다');
  a.ok(결과.folders.includes('qa-data-20261014') && 결과.folders.includes('qa-deep-20261012'));
  a.equal(결과.qaSources.qaResult, null, 'QA 전에는 대조할 QA 결과가 없다');
  a.match(L.절로(결과, new Date(2026, 9, 30)), / · 정적 \d+곳 · QA 원천 4곳 · QA 전 · 봐줌 1\(deployment\/rearm-stage-plan-pin\.json\)\) \(2026-10-30\)\n/,
    'QA 전 · 봐준 파일은 절 머리에 남는다 — _정리제외.txt에 붙여도 그 판 몫이 임시임이 보인다(Fable P2)');
  // QA 뒤(배포 파일이 생기고 QA가 돈 뒤): 가장 새 QA 결과의 원천 이름이 ③에 다 있는지 대조한다(실제 37: 877 = 877).
  const 해시 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const 이름 = (p) => path.relative(path.dirname(f.임시), p).split(path.sep).join('/');
  const QA결과 = (n, 목록) => f.쓰기(`r-39-release-20261030/rearm/linux-qa-result-v${n}.json`, JSON.stringify({ status: 'passed', files: 목록.map((p) => ({ name: 이름(p), sha256: 해시(p) })) }));
  f.쓰기('r-39-release-20261030/deployment/rearm-stage-plan-pin.json', '{"plan":1}');
  const 옛도구 = f.쓰기('qa-old-20261001/old.py', '# 앞 QA 때 원천');
  const 원천들 = [path.join(f.판, 'deployment', 'rearm-stage-plan-pin.json'), path.join(f.임시, 'qa-src-20261013', 'verify.cjs'), path.join(f.임시, 'qa-deep-20261012', 'x.cjs'), path.join(f.임시, 'qa-data-20261014', 'tool.py')];
  QA결과(1, [...원천들, 옛도구]);
  QA결과(2, 원천들);
  const 뒤 = L.재기(f.판);
  a.deepEqual(뒤.qaSources.tolerated, [], '배포 파일이 생겼으니 봐줄 것이 없다');
  a.deepEqual(뒤.qaSources.qaResult, { result: 'linux-qa-result-v2.json', invalid: false, names: 4, missing: [], extra: 0 }, '가장 새 QA 결과(v2)와 같다');
  a.match(L.절로(뒤, new Date(2026, 9, 30)), / · QA 원천 4곳\) \(2026-10-30\)\n/, 'QA 뒤 대조가 같으면 임시 표시가 없다');
  QA결과(10, [...원천들, 옛도구]);
  const 다름 = L.재기(f.판);
  a.deepEqual(다름.qaSources.qaResult.missing, ['.tmp/qa-old-20261001/old.py'], '가장 새 QA 결과(v10 — 숫자 순)에만 있는 원천을 알린다');
  a.ok(다름.folders.includes('qa-old-20261001'), '그 파일은 ①′가 QA 결과 목록으로 계보에 넣는다');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '../tools/company-release/lineage.cjs'), 'measure', f.판], { encoding: 'utf8' });
  a.equal(r.status, 1, '③이 실제 QA가 보낸 원천을 못 찾으면 실패로 끝낸다');
  a.match(r.stdout, /QA 결과\(linux-qa-result-v10\.json\)에만 있는 원천 1개/);
  // 원천 목록 꼴이 아닌 결과({} · 빈 files · 이름 없는 줄)는 「다 있음」이 아니라 대조 못 함이다(GPT r5 GA1).
  for (const [n, 글] of [[11, '{}'], [12, '{"files":[]}'], [13, '{"files":[{"sha256":"x"}]}']]) {
    f.쓰기(`r-39-release-20261030/rearm/linux-qa-result-v${n}.json`, 글);
    a.deepEqual(L.재기(f.판).qaSources.qaResult, { result: `linux-qa-result-v${n}.json`, invalid: true, names: 0, missing: [], extra: 0 }, 글);
  }
  const 꼴아님 = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '../tools/company-release/lineage.cjs'), 'measure', f.판], { encoding: 'utf8' });
  a.equal(꼴아님.status, 1);
  a.match(꼴아님.stdout, /원천 목록 꼴이 아니라 ③과 대조할 수 없다/);
  a.ok(!꼴아님.stdout.includes('모두 ③에 있음'));
});

test('③ QA 원천이 끝까지 못 돌면 재기 전체가 실패하고 절을 내지 않는다 — 판 밖 원천이 없음 · 판 안에 없는 파일을 글로 읽음 · 판 안에 없는 JS(GPT GB1)', (t) => {
  const f = fixture(t);
  QA원천판(f);
  f.옮기기('qa-data-20261014');
  a.throws(() => L.재기(f.판), /QA_SOURCES_FAILED .*ENOENT.*qa-data-20261014/s);
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '../tools/company-release/lineage.cjs'), 'measure', f.판, '--절'], { encoding: 'utf8' });
  a.equal(r.status, 1);
  a.ok(!r.stdout.includes('#! 실측 계보'), '도중까지 센 절을 내지 않는다');
  a.match(r.stderr, /QA_SOURCES_FAILED/);
  const 글로 = fixture(t);
  QA원천판(글로, "JSON.parse(fs.readFileSync(path.join(__dirname,'../deployment/rearm-stage-plan-pin.json'),'utf8'));");
  a.throws(() => L.재기(글로.판), /QA_SOURCES_FAILED .*ENOENT.*rearm-stage-plan-pin\.json/s, '없는 파일의 내용을 쓰려 하면 봐주지 않는다');
  const 없는JS = fixture(t);
  QA원천판(없는JS, "add(path.join(__dirname,'../deployment/later.cjs'));");
  a.throws(() => L.재기(없는JS.판), /QA_SOURCES_FAILED .*ENOENT.*later\.cjs/s, 'deployment/ 안이어도 없는 JS는 봐주지 않는다(그 상대 require를 못 따라간다)');
  const 배포밖 = fixture(t);
  QA원천판(배포밖, "add(path.join(__dirname,'local-199.json'));");
  a.throws(() => L.재기(배포밖.판), /QA_SOURCES_FAILED .*ENOENT.*local-199\.json/s, '판 안이어도 배포 단계 자리(deployment/) 밖의 없는 파일은 봐주지 않는다(깨진 사본 — Fable P3)');
  // 봐준 파일이 잎이 아닌 꼴(Fable P2): 빈 내용으로 원천 목록을 만들고(인코딩 없는 읽기 둘 — 목록 + 해시), 있는지 물어본 뒤 목록에 넣지 않음.
  const 두번 = fixture(t);
  QA원천판(두번, "for(const x of fs.readFileSync(path.join(__dirname,'../deployment/rearm-stage-plan-pin.json')).toString().split('\\n').filter(Boolean))add(path.resolve(__dirname,x));");
  a.throws(() => L.재기(두번.판), /QA_SOURCES_FAILED .*QA_TOLERATED_NOT_A_LEAF deployment\/rearm-stage-plan-pin\.json \(인코딩 없는 읽기 2회 · 원천 목록에 있음\)/s,
    '배포 뒤 그 파일 내용이 원천 목록을 늘릴 수 있는 꼴은 QA 전에 조용히 통과하지 않는다');
  const 물음 = fixture(t);
  QA원천판(물음, "try{fs.lstatSync(path.join(__dirname,'../deployment/extra-flag.json'));}catch{}");
  a.throws(() => L.재기(물음.판), /QA_SOURCES_FAILED .*QA_TOLERATED_NOT_A_LEAF deployment\/extra-flag\.json \(인코딩 없는 읽기 0회 · 원천 목록에 없음\)/s,
    '있는지만 물어본 봐준 파일(갈래를 바꿀 수 있다)도 잎이 아니다');
});

test('봉인된 부모 승인 입력이 핀과 다르거나 부모 승인 모듈을 못 찾으면 돌리지 않는다', (t) => {
  const { 쓰기, 판 } = fixture(t);
  쓰기('completed-p-20261029/evidence/approval.json', '{"changed":true}');
  a.throws(() => L.재기(판), /PARENT_APPROVAL_INPUT_CHANGED/);
  const 두번째 = fixture(t);
  두번째.쓰기('r-39-release-20261030/rearm/approval.cjs', 'module.exports={};');
  a.throws(() => L.재기(두번째.판), /PARENT_APPROVAL_MODULE_REQUIRED/);
});
