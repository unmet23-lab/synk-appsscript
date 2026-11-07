'use strict';
// 고정 도구 고리를 판 안으로(tool-ring-port.cjs) — 합성 scope 상속 사슬(맨 밑 · 중간 · 판)과 합성 원문으로 생성 · 같음 확인 · 거절 꼴을 본다.
// 실제 .tmp · 운영 값은 쓰지 않는다.
const test = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const T = require('../tools/company-release/tool-ring-port.cjs');

// 맨 밑 모듈 — 실제 사슬 맨 밑(pulse-workspace-integration scope.cjs)과 같은 꼴의 정의 다섯.
const BOTTOM = [
  "'use strict';",
  "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),a=require('node:assert/strict');",
  "const task=__dirname,prior=path.resolve(task,'../old-prior-20261012');",
  "const COMPANY='docs/company/',PUBLIC=COMPANY+'public/app/',MESSENGER='tools/messenger/';",
  "const sha=b=>crypto.createHash('sha256').update(b).digest('hex');",
  "function safeName(n){a.equal(typeof n,'string');a.ok(n&&!path.isAbsolute(n)&&!n.includes('\\\\')&&!n.split('/').includes('..')&&!n.split('/').includes('.'));return n;}",
  "function readRegular(root,name){const f=path.join(root,safeName(name)),st=fs.lstatSync(f);a.ok(st.isFile()&&!st.isSymbolicLink(),name);return fs.readFileSync(f);}",
  "function verify(root,digest){const raw=readRegular(root,'release-manifest.json');a.equal(sha(raw),digest,'Manifest changed');const manifest=JSON.parse(raw),seen=new Set();for(const row of manifest.files){safeName(row.path);a.ok(!seen.has(row.path));seen.add(row.path);const b=readRegular(root,row.path);a.equal(b.length,row.bytes,row.path);a.equal(sha(b),row.sha256,row.path);}const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{a.ok(!e.isSymbolicLink());const f=path.join(d,e.name);return e.isDirectory()?walk(f):[path.relative(root,f).split(path.sep).join('/')];});a.deepEqual(walk(root).sort(),[...seen,'release-manifest.json'].sort(),'Exact source closure');return {raw,manifest};}",
  "function writeNew(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}",
  'module.exports={task,prior,COMPANY,PUBLIC,MESSENGER,sha,safeName,readRegular,verify,writeNew};',
  '',
].join('\n');
// 중간 — 실제 workspace-login-v3처럼 WORKERS · RUNTIME_NAMES를 정하고 prior를 다시 계산해 넘긴다.
const MID = (bottomFolder, override = '') => [
  "'use strict';",
  "const path=require('node:path');",
  `const prior=path.resolve(__dirname,'../../${bottomFolder}'),base=require(path.join(prior,'scope.cjs'));`,
  'const {sha,safeName,readRegular,verify,writeNew,COMPANY,PUBLIC,MESSENGER}=base;',
  "const WORKERS=['deployment-job.py','deployment-host.py'];",
  "const RUNTIME_NAMES=['controller.mjs','node-host.py'].sort();",
  override,
  'module.exports={prior,COMPANY,PUBLIC,MESSENGER,WORKERS,RUNTIME_NAMES,sha,safeName,readRegular,verify,writeNew};',
  '',
].join('\n');
// 판 scope.cjs — 실제 판처럼 상속에서 받고 자기 것을 더해 내보낸다.
const RELEASE = (midFolder) => [
  "'use strict';",
  "const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');",
  `const inherited=require('../../${midFolder}/deployment/scope.cjs');`,
  'const task=__dirname;',
  'const {sha,safeName,readRegular,verify,writeNew,COMPANY,PUBLIC,MESSENGER,WORKERS,RUNTIME_NAMES}=inherited;',
  "function candidate(root,digest){return verify(root,digest);}",
  'module.exports={task,prior:inherited.prior,COMPANY,PUBLIC,MESSENGER,WORKERS,RUNTIME_NAMES,sha,safeName,readRegular,verify,writeNew,candidate};',
  '',
].join('\n');

function fixture(t, { midOverride = '' } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tool-ring-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const tmp = path.join(temp, '.tmp');
  const put = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  const bottomFile = put('bottom-20261013/scope.cjs', BOTTOM);
  put('mid-20261016/deployment/scope.cjs', MID('bottom-20261013', midOverride));
  const releaseScope = put('next-release-20261107/deployment/scope.cjs', RELEASE('mid-20261016'));
  // 진짜 후보 트리 흉내(부모 후보) — verify가 통째로 읽는다.
  const cand = path.join(tmp, 'parent-completed-20261106', 'candidate');
  const files = [['app.mjs', 'export const v=1;\n'], ['docs/a.json', '{"a":1}']];
  for (const [p, b] of files) put(path.join('parent-completed-20261106', 'candidate', p), b);
  const sha = (b) => require('node:crypto').createHash('sha256').update(b).digest('hex');
  const manifest = JSON.stringify({ files: files.map(([p, b]) => ({ path: p, bytes: Buffer.byteLength(b), sha256: sha(b) })) });
  fs.writeFileSync(path.join(cand, 'release-manifest.json'), manifest);
  return { tmp, bottomFile, releaseScope, probes: { candidate: { root: cand, manifestSha256: sha(manifest) } } };
}
function generate(f) {
  const releaseDir = path.dirname(f.releaseScope);
  const oldChain = require(path.join(f.tmp, 'mid-20261016/deployment/scope.cjs')), bottom = require(f.bottomFile);
  const priorRelative = path.relative(releaseDir, oldChain.prior).split(path.sep).join('/');
  const text = T.scopeBase({ oldChain, bottom, bottomText: fs.readFileSync(f.bottomFile, 'utf8'), priorRelative });
  const baseFile = path.join(releaseDir, 'scope-base.cjs');
  fs.writeFileSync(baseFile, text);
  return { oldChain, bottom, baseFile, text };
}

test('scope-base: 생성 → 같음 확인 통과 → 판 scope.cjs를 옮겨도 내보내기가 같다', (t) => {
  const f = fixture(t), g = generate(f);
  a.match(g.text, /module\.exports=\{prior,COMPANY,PUBLIC,MESSENGER,WORKERS,RUNTIME_NAMES,sha,safeName,readRegular,verify,writeNew\};/);
  a.equal(g.text.includes('mid-20261016'), false); // 사슬 중간 폴더 이름이 남지 않는다
  const next = require(g.baseFile);
  a.equal(T.scopeBaseEquivalence(next, g.oldChain, g.bottom, f.probes), true);
  const before = require(f.releaseScope);
  const ported = T.portScope(fs.readFileSync(f.releaseScope, 'utf8'));
  a.equal(ported.inheritedFolder, 'mid-20261016');
  const portedFile = path.join(path.dirname(f.releaseScope), 'scope-ported.cjs');
  fs.writeFileSync(portedFile, ported.text);
  const after = require(portedFile);
  for (const k of ['prior', 'COMPANY', 'PUBLIC', 'MESSENGER', 'WORKERS', 'RUNTIME_NAMES']) a.equal(JSON.stringify(after[k]), JSON.stringify(before[k]), k);
  for (const k of T.FUNCTIONS) a.equal(after[k].toString(), before[k].toString(), k);
  const c = f.probes.candidate;
  a.ok(after.candidate(c.root, c.manifestSha256).raw.equals(before.candidate(c.root, c.manifestSha256).raw));
});

test('scope-base: 사슬 중간이 도우미를 덮으면 생성이 멈춘다', (t) => {
  const f = fixture(t, { midOverride: "const verify2=verify;module.exports.x=1;" });
  // 덮지 않은 꼴은 통과 — 덮는 꼴을 따로 만든다
  const f2 = fixture(t, { midOverride: '' });
  fs.writeFileSync(path.join(f2.tmp, 'mid-20261016/deployment/scope.cjs'), MID('bottom-20261013').replace('const WORKERS=', "const verifyOld=verify;function verifyX(r,d){return verifyOld(r,d);}const WORKERS=").replace('RUNTIME_NAMES,sha,safeName,readRegular,verify,writeNew}', 'RUNTIME_NAMES,sha,safeName,readRegular,verify:verifyX,writeNew}'));
  a.throws(() => generate(f2), /SCOPE_CHAIN_OVERRIDES verify/);
  a.ok(generate(f).text); // 덮지 않은 중간은 그대로 통과
});

test('scope-base: 글 · 값 · prior · 내보내기가 다르면 같음 확인이 막는다', (t) => {
  const f = fixture(t), g = generate(f);
  const variants = [
    [(s) => s.replace("a.equal(sha(raw),digest,'Manifest changed')", "a.equal(sha(raw),digest,'Manifest changed!')"), /SCOPE_BASE_SOURCE verify/],
    [(s) => s.replace("const WORKERS=[\"deployment-job.py\",\"deployment-host.py\"]", "const WORKERS=[\"deployment-job.py\"]"), /SCOPE_BASE_VALUE WORKERS/],
    [(s) => s.replace('const prior=path.resolve(__dirname,', "const prior=path.resolve(__dirname,'..',"), /SCOPE_BASE_VALUE prior/],
    [(s) => s.replace('module.exports={prior,', 'module.exports={extra:1,prior,'), /SCOPE_BASE_EXPORTS/],
    [(s) => s.replace("function writeNew(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}", "function writeNew(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'w'});}"), /SCOPE_BASE_SOURCE writeNew/],
  ];
  variants.forEach(([change, code], i) => {
    const file = path.join(path.dirname(g.baseFile), `scope-base-bad-${i}.cjs`);
    const bad = change(g.text); a.notEqual(bad, g.text, 'variant ' + i + ' changed nothing');
    fs.writeFileSync(file, bad);
    a.throws(() => T.scopeBaseEquivalence(require(file), g.oldChain, g.bottom, f.probes), code);
  });
  // 같은 글이라도 strict가 아닌 assert를 쥔 도우미 — 글 같음(b)은 못 잡고 거절 메시지 대조(d)가 잡는다(Fable 11-07 P3)
  const loose = path.join(path.dirname(g.baseFile), 'scope-base-loose.cjs');
  fs.writeFileSync(loose, g.text.replace("a=require('node:assert/strict')", "a=require('node:assert')"));
  a.throws(() => T.scopeBaseEquivalence(require(loose), g.oldChain, g.bottom, f.probes), /SCOPE_BASE_SAFE_NAME/);
  // 같은 글이라도 행동이 다른 환경(다른 builtin을 쥔 도우미) — sha 바꿔치기
  const sneaky = path.join(path.dirname(g.baseFile), 'scope-base-sneaky.cjs');
  fs.writeFileSync(sneaky, g.text.replace("crypto=require('node:crypto')", "crypto={createHash:()=>({update:()=>({digest:()=>'0'})})}"));
  a.throws(() => T.scopeBaseEquivalence(require(sneaky), g.oldChain, g.bottom, f.probes), /SCOPE_BASE_SHA/);
  // 후보 탐침이 없으면 멈춘다
  a.throws(() => T.scopeBaseEquivalence(require(g.baseFile), g.oldChain, g.bottom, {}), /SCOPE_BASE_CANDIDATE_PROBE/);
});

test('scope-base: 맨 밑 원문에 정의가 정확히 한 번 없으면 멈춘다', (t) => {
  const f = fixture(t);
  const oldChain = require(path.join(f.tmp, 'mid-20261016/deployment/scope.cjs')), bottom = require(f.bottomFile);
  const text = fs.readFileSync(f.bottomFile, 'utf8');
  a.throws(() => T.scopeBase({ oldChain, bottom, bottomText: text + '\n' + bottom.verify.toString(), priorRelative: '../../x' }), /SCOPE_BASE_SOURCE_ONCE verify/);
  a.throws(() => T.scopeBase({ oldChain, bottom, bottomText: text.replace("const sha=b=>", 'const sha = b=>'), priorRelative: '../../x' }), /SCOPE_BASE_SOURCE_ONCE sha/);
  a.throws(() => T.scopeBase({ oldChain, bottom, bottomText: text, priorRelative: 'C:\\abs' }), /SCOPE_BASE_PRIOR_RELATIVE/);
});

test('portScope: 상속 줄이 정확히 한 번이어야 하고, 다른 판 require가 남으면 멈춘다', () => {
  const one = RELEASE('mid-20261016');
  const out = T.portScope(one).text;
  a.ok(out.includes("const inherited=require('./scope-base.cjs');"));
  a.throws(() => T.portScope(one.replace("const inherited=require('../../mid-20261016/deployment/scope.cjs');", '')), /EXACT_PORT_ANCHOR/);
  a.throws(() => T.portScope(one + "\nconst inherited=require('../../mid-20261016/deployment/scope.cjs');"), /EXACT_PORT_ANCHOR/);
  a.throws(() => T.portScope(one + "\nconst other=require('../../other-20261020/x.cjs');"), /SCOPE_OTHER_RELEASE_REQUIRE_LEFT/);
});

test('portPrepareFreshMirror · portLinuxQa: 정확한 글만 걷고, 없거나 두 번이면 멈춘다', () => {
  const A = T._anchors;
  const fresh = [
    "'use strict';",
    "const CARRY_MIRROR = Object.freeze({relative:'evidence-carry/carry.json'});",
    'function createHelper({root, readRoot}){',
    A.MIRROR_COMMENT + A.MIRROR_LINES + '  const mirrored = full => { if(full===CARRY_MIRROR.source)return root;' + A.MIRROR_LOOP + 'return full; };',
    '  return mirrored;',
    '}',
    'module.exports={createHelper,CARRY_MIRROR};',
    '',
  ].join('\n');
  const out = T.portPrepareFreshMirror(fresh);
  for (const x of ['business-automation', 'CODEX', 'inert-v7']) a.equal(out.includes(x), false, x);
  a.ok(out.includes("const mirrored = full => { if(full===CARRY_MIRROR.source)return root;return full; };"));
  a.throws(() => T.portPrepareFreshMirror(fresh.replace(A.MIRROR_LOOP, '')), /EXACT_PORT_ANCHOR mirror loop/);
  a.throws(() => T.portPrepareFreshMirror(fresh + '\n' + A.MIRROR_LINES), /EXACT_PORT_ANCHOR mirror lines/);
  const qa = "function sources(){const found=new Set();function add(p){found.add(p);}" + A.HA_COMPAT_QA + "add('x');return [...found];}\nmodule.exports={sources};\n";
  const qaOut = T.portLinuxQa(qa);
  a.equal(qaOut.includes('ha-compat'), false);
  a.ok(qaOut.includes("add('x');"));
  a.throws(() => T.portLinuxQa(qaOut), /EXACT_PORT_ANCHOR ha-compat/);
});
