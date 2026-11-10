'use strict';
// 회원 화면 「내 성향」 문장 낫표(2026-11-10) — 공개본 account/dist/platform.js에서 회원 문장 모듈 하나의 몸통만 갈아 끼운다.
// 공개본 묶음은 master 빌드와 구성이 달라(master에는 아직 공개하지 않은 남의 기능이 있다) 통째로 덮지 않는다
// (현장 노트 배포_공개 「공개본 account/dist/platform.js를 master 빌드로 덮으면」).
// 근거: 공개본의 그 모듈 몸통은 고치기 전 원천(CHANGE^)을 아래 설정으로 esbuild에 넣은 결과와 바이트가 같다.
//       그래서 검수한 커밋(CHANGE)의 원천을 같은 설정으로 지어 그 자리에만 넣는다 — 묶음의 나머지는 한 바이트도 바뀌지 않는다.
// 쓰기: node patch-live.cjs <공개본 account 폴더> <출력 폴더(없거나 빈 폴더)>
//   → <출력>/account/dist/platform.js · <출력>/account/platform.html(묶음 주소의 ?v= 만) · files.json · report.json · diff.txt
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { ROOT, MODULE_KEY, dep, version, acorn, parse, findModule } = require('./lib.cjs');
const esbuild = dep('esbuild'), eslintScope = dep('eslint-scope');

// 이 도구가 대 본 공개 바탕(synk-policy e7d2f5bb의 account/) — 달라졌으면 멈추고 다시 대조한다.
const BASE = { bundle: '05ae6351cc6f10c0dc2d05e54b3976fb5469507ae60e256253e910c712b2aa84', html: '7e88f075b8a272b12bf9271a531e6162dbe6cfae17140fcd5389e27dca89562f' };
const SOURCE = 'experiences/synk-account/src/vellum-insight.cjs', TEST = 'tests/vellum-insight.test.js';
const CHANGE = '3641cc792101fed69e17ca18ebf9d3af5594f231'; // 낫표를 넣고 검수(member-insight-brackets-20261110)를 마친 커밋
const INSIGHT = 'SYNK_MEMBER_INSIGHT_20261014';

const [liveDir, outDir] = process.argv.slice(2).map(p => path.resolve(p));
if (!outDir) { console.error('쓰기: node patch-live.cjs <공개본 account 폴더> <출력 폴더>'); process.exit(2); }
const fail = message => { console.error('멈춤: ' + message); process.exit(1); };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });

// 1. 공개 바탕
const liveBytes = fs.readFileSync(path.join(liveDir, 'dist/platform.js')), htmlBytes = fs.readFileSync(path.join(liveDir, 'platform.html'));
if (sha(liveBytes) !== BASE.bundle || sha(htmlBytes) !== BASE.html) fail(`공개 바탕이 이 도구가 대 본 판과 다르다(묶음 ${sha(liveBytes).slice(0, 12)} · 쪽 ${sha(htmlBytes).slice(0, 12)}). 공개본과 원천을 다시 대조한다.`);
const live = liveBytes.toString('utf8'), html = htmlBytes.toString('utf8');
if (!Buffer.from(live, 'utf8').equals(liveBytes) || !Buffer.from(html, 'utf8').equals(htmlBytes)) fail('공개 파일이 UTF-8로 그대로 돌아오지 않는다');

// 2. 원천 — 검수한 커밋의 것이고 그 뒤로 바뀌지 않았다
const blobId = rev => git('rev-parse', '--verify', '--quiet', `${rev}:${SOURCE}`).trim();
const blobs = { 고치기전: blobId(CHANGE + '^'), 검수한커밋: blobId(CHANGE), HEAD: blobId('HEAD'), 'origin/master': (() => { try { return blobId('origin/master'); } catch { return null; } })() };
if (blobs.HEAD !== blobs.검수한커밋 || blobs['origin/master'] && blobs['origin/master'] !== blobs.검수한커밋) fail('회원 문장 원천이 검수한 커밋 뒤에 바뀌었다 — 그 판을 검수한 뒤 CHANGE를 고친다');
const sourceAt = rev => git('cat-file', 'blob', `${rev}:${SOURCE}`);

// 3. 공개 묶음이 만들어진 설정 그대로 모듈 하나만 짓는다
const BUILD = { bundle: true, write: false, format: 'cjs', platform: 'browser', charset: 'utf8', minifyWhitespace: true, legalComments: 'none', target: 'es2022' };
function compile(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vellum-insight-'));
  try {
    fs.mkdirSync(path.join(dir, path.dirname(MODULE_KEY)));
    fs.writeFileSync(path.join(dir, MODULE_KEY), text);
    const out = esbuild.buildSync({ stdin: { contents: `module.exports=require('./${MODULE_KEY}');`, resolveDir: dir, loader: 'js' }, absWorkingDir: dir, ...BUILD }).outputFiles[0].text;
    const at = findModule(out);
    return { params: at.params, body: out.slice(at.start, at.end) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const at = findModule(live), liveBody = live.slice(at.start, at.end);
const newSource = sourceAt(CHANGE), before = compile(sourceAt(CHANGE + '^')), after = compile(newSource);
if (before.body !== liveBody) fail('공개본의 회원 문장 모듈이 고치기 전 원천을 지은 것과 다르다 — 몸통을 통째로 바꿀 근거가 없다');
if ([before, after].some(built => built.params.join() !== at.params.join())) fail('모듈 인자 이름이 공개본과 다르다');
if (after.body === liveBody) fail('바꿀 것이 없다');
const candidate = live.slice(0, at.start) + after.body + live.slice(at.end);

// 4. 묶음의 짜임이 그대로인지 — 바깥 문장 수 · 회원 성향 묶음의 문장 수와 선언 이름
function names(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) names(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const e of p.elements) names(e, out);
  else if (p.type === 'RestElement') names(p.argument, out);
  else if (p.type === 'AssignmentPattern') names(p.left, out);
  return out;
}
function shape(code) {
  const ast = parse(code), outer = ast.body.length === 1 && ast.body[0].expression?.callee?.body?.body;
  if (!outer) fail('바깥 (()=>{…})()를 못 찾았다');
  const first = outer[0], decl = first.type === 'VariableDeclaration' && first.declarations.length === 1 && first.declarations[0];
  const inner = decl && decl.id.name === INSIGHT && decl.init?.callee?.body?.body;
  if (!inner) fail('첫 문장이 회원 성향 묶음이 아니다');
  const declared = list => list.flatMap(st => st.type === 'VariableDeclaration' ? st.declarations.flatMap(d => names(d.id))
    : (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id ? [st.id.name] : []);
  const mod = findModule(code, ast);
  if (mod.fn.start < first.start || mod.fn.end > first.end) fail('회원 문장 모듈이 회원 성향 묶음 밖에 있다');
  return { ast, mod, outer: outer.length, inner: inner.length, outerNames: declared(outer), innerNames: declared(inner) };
}
const L = shape(live), C = shape(candidate);
for (const key of ['outer', 'inner']) if (L[key] !== C[key]) fail(`문장 수가 달라졌다(${key}) ${L[key]} → ${C[key]}`);
for (const key of ['outerNames', 'innerNames']) if (L[key].join() !== C[key].join()) fail(`선언 이름이 달라졌다(${key})`);
if (candidate.slice(0, C.mod.start) !== live.slice(0, at.start) || candidate.slice(C.mod.end) !== live.slice(at.end) || candidate.slice(C.mod.start, C.mod.end) !== after.body) fail('모듈 몸통 밖이 달라졌다');

// 5. 이름 묶임 — 새 몸통이 묶음의 다른 선언을 잡지 않고, 선언 없이 부르는 이름이 늘지 않고, 낫표 도우미는 모듈 안의 것만 부른다
function scopes({ ast, mod }) {
  const manager = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const fn = mod.fn, inside = node => node.range[0] >= fn.range[0] && node.range[1] <= fn.range[1], own = manager.acquire(fn);
  const outward = new Map(); let itemCalls = 0, itemElsewhere = 0;
  for (const scope of manager.scopes) {
    if (!inside(scope.block)) continue;
    for (const ref of scope.references) {
      const name = ref.identifier.name, variable = ref.resolved;
      if (!variable) outward.set(name, '전역');
      else if (!inside(variable.scope.block)) outward.set(name, '묶음의 다른 선언');
      if (name === 'item' && ref.isRead()) variable && variable.scope === own ? itemCalls++ : itemElsewhere++;
    }
  }
  return { globals: new Set(manager.globalScope.through.map(ref => ref.identifier.name)), outward, itemCalls, itemElsewhere };
}
const SL = scopes(L), SC = scopes(C);
const captured = [...SC.outward].filter(([, kind]) => kind !== '전역').map(([name]) => name);
if (captured.length) fail('새 몸통이 묶음의 다른 선언을 잡는다: ' + captured.join(', '));
const newOutward = [...SC.outward.keys()].filter(name => !SL.outward.has(name));
if (newOutward.length) fail('새 몸통이 전에 부르지 않던 바깥 이름을 부른다: ' + newOutward.join(', '));
const addedGlobals = [...SC.globals].filter(name => !SL.globals.has(name));
if (addedGlobals.length) fail('선언 없이 부르는 이름이 늘었다: ' + addedGlobals.join(', '));
const itemExpected = (newSource.match(/\bitem\(/g) || []).length;
if (!itemExpected || SC.itemCalls !== itemExpected || SC.itemElsewhere || SL.itemCalls || SL.itemElsewhere) fail(`낫표 도우미 부름이 맞지 않는다(원천 ${itemExpected} · 새 몸통 ${SC.itemCalls}+${SC.itemElsewhere} · 공개본 ${SL.itemCalls}+${SL.itemElsewhere})`);

// 6. 바뀐 곳을 낱말(토큰) 단위로 — 검수가 볼 근거
const tokens = body => [...acorn.tokenizer(body, { ecmaVersion: 'latest' })].map(t => ({ text: body.slice(t.start, t.end), start: t.start, end: t.end }));
function hunks(a, b) {
  let s = 0; while (s < a.length && s < b.length && a[s].text === b[s].text) s++;
  let e = 0; while (e < a.length - s && e < b.length - s && a[a.length - 1 - e].text === b[b.length - 1 - e].text) e++;
  const n = a.length - s - e, m = b.length - s - e, w = m + 1, t = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * w + j] = a[s + i].text === b[s + j].text ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
  const out = []; let i = 0, j = 0, open = null;
  while (i < n || j < m) {
    if (i < n && j < m && a[s + i].text === b[s + j].text) { open = null; i++; j++; continue; }
    if (!open) out.push(open = { a: s + i, b: s + j, minus: 0, plus: 0 });
    if (j < m && (i === n || t[i * w + j + 1] >= t[(i + 1) * w + j])) { open.plus++; j++; } else { open.minus++; i++; }
  }
  return out;
}
const ta = tokens(liveBody), tb = tokens(after.body);
const span = (body, list, from, count) => { const start = from < list.length ? list[from].start : body.length; return [start, count ? list[from + count - 1].end : start]; };
const changes = hunks(ta, tb).map(h => {
  const [a0, a1] = span(liveBody, ta, h.a, h.minus), [b0, b1] = span(after.body, tb, h.b, h.plus);
  return { at: at.start + a0, 앞: liveBody.slice(Math.max(0, a0 - 48), a0), 빠짐: liveBody.slice(a0, a1), 들어옴: after.body.slice(b0, b1), 뒤: liveBody.slice(a1, a1 + 32) };
});
const delta = changes.reduce((sum, c) => sum + c.들어옴.length - c.빠짐.length, 0);
if (delta !== after.body.length - liveBody.length || candidate.length - live.length !== delta) fail('바뀐 곳의 글자 수 합이 몸통 차이와 맞지 않는다');

// 7. 쪽(platform.html) — 묶음 주소의 ?v= 만 새 묶음의 sha256 앞 12자로
const token = sha(Buffer.from(candidate, 'utf8')).slice(0, 12), oldRef = './dist/platform.js?v=' + BASE.bundle.slice(0, 12);
if (html.split('dist/platform.js').length !== 2 || !html.includes(`<script type="module" src="${oldRef}"></script>`)) fail('공개 쪽의 묶음 주소가 예상과 다르다');
const nextHtml = html.replace(oldRef, './dist/platform.js?v=' + token);

// 8. 쓰기
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) fail('출력 폴더가 비어 있지 않다: ' + outDir);
fs.mkdirSync(path.join(outDir, 'account/dist'), { recursive: true });
const files = [['account/dist/platform.js', Buffer.from(candidate, 'utf8'), liveBytes], ['account/platform.html', Buffer.from(nextHtml, 'utf8'), htmlBytes]].map(([공개경로, bytes, was]) => {
  const 파일 = path.join(outDir, 공개경로);
  fs.writeFileSync(파일, bytes, { flag: 'wx' });
  return { 공개경로, 파일, bytes: bytes.length, sha256: sha(bytes), 공개본: { bytes: was.length, sha256: sha(was) } };
});

// 9. 그 모듈의 단위 시험을 후보 묶음 속 몸통으로 돌린다(공개본 몸통으로는 낫표 문장에서 떨어져야 한다 — 시험이 묶음을 읽는다는 표지)
function unit(bundlePath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vellum-insight-test-'));
  try {
    for (const file of [TEST, SOURCE]) fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(dir, TEST), git('cat-file', 'blob', `HEAD:${TEST}`));
    fs.writeFileSync(path.join(dir, SOURCE), `module.exports=require(${JSON.stringify(path.join(__dirname, 'lib.cjs'))}).loadModule(${JSON.stringify(bundlePath)});\n`);
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(dir, TEST)], { encoding: 'utf8' });
    const count = key => Number((run.stdout.match(new RegExp(`^# ${key} (\\d+)$`, 'm')) || [])[1]);
    return { status: run.status, tests: count('tests'), pass: count('pass'), fail: count('fail'), failed: [...run.stdout.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1]) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const unitNew = unit(files[0].파일), unitLive = unit(path.join(liveDir, 'dist/platform.js'));
if (unitNew.status !== 0 || !unitNew.tests || unitNew.fail !== 0 || unitNew.pass !== unitNew.tests) fail('후보 묶음의 회원 문장 모듈이 단위 시험을 통과하지 못했다: ' + JSON.stringify(unitNew));
if (unitLive.tests !== unitNew.tests || !unitLive.fail) fail('공개본 몸통으로도 시험이 다 통과한다 — 시험이 묶음 속 몸통을 읽지 않았다: ' + JSON.stringify(unitLive));

const report = {
  만든날: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  공개바탕: BASE, 원천: { 파일: SOURCE, 검수한커밋: CHANGE, blobs }, 도구: { esbuild: version('esbuild'), acorn: version('acorn'), 'eslint-scope': version('eslint-scope'), node: process.version, 설정: BUILD },
  모듈: { 이름: MODULE_KEY, 인자: at.params, 자리: [at.start, at.end], 공개본글자: liveBody.length, 새글자: after.body.length, 고치기전원천과같음: true },
  짜임: { 바깥문장: C.outer, 회원성향묶음문장: C.inner, 회원성향묶음이름: C.innerNames.length, 몸통밖바이트같음: true },
  이름묶임: { 바깥으로부르는이름: [...SC.outward.keys()].sort(), 공개본과같음: SC.outward.size === SL.outward.size, 선언없는이름: SC.globals.size, 공개본선언없는이름: SL.globals.size, 낫표도우미부름: SC.itemCalls },
  바뀐곳: { 수: changes.length, 글자차: delta }, 단위시험: { 후보: unitNew, 공개본: unitLive }, 쪽: { 옛주소: oldRef, 새주소: './dist/platform.js?v=' + token }, files,
};
fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(files, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(outDir, 'diff.txt'), changes.map((c, n) => `#${n + 1} 묶음 자리 ${c.at}\n  앞   …${c.앞}\n  빠짐 ${c.빠짐 || '(없음)'}\n  들어옴 ${c.들어옴 || '(없음)'}\n  뒤   ${c.뒤}…\n`).join('\n'), { flag: 'wx' });

console.log(`공개본 모듈 = 고치기 전 원천을 지은 것(바이트 같음, ${liveBody.length}자) → 새 몸통 ${after.body.length}자(${delta >= 0 ? '+' : ''}${delta})`);
console.log(`짜임 그대로: 바깥 문장 ${C.outer} · 회원 성향 묶음 문장 ${C.inner} · 이름 ${C.innerNames.length} · 몸통 밖 바이트 같음`);
console.log(`이름 묶임: 바깥으로 부르는 이름 ${SC.outward.size}개 모두 전역(공개본과 같은 이름) · 선언 없는 이름 ${SC.globals.size} = 공개본 ${SL.globals.size} · 낫표 도우미 부름 ${SC.itemCalls}`);
console.log(`바뀐 곳 ${changes.length}곳(diff.txt) · 단위 시험 후보 ${unitNew.pass}/${unitNew.tests} · 공개본 몸통 ${unitLive.pass}/${unitLive.tests}(떨어진 ${unitLive.fail}개가 낫표 문장)`);
for (const file of files) console.log(`${file.공개경로}: ${file.공개본.bytes} → ${file.bytes}B · sha256 ${file.sha256.slice(0, 12)}`);
console.log('공개.js 인자: ' + files.map(file => `${file.공개경로}=${file.파일}`).join(' '));
