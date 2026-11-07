// A 진열대(2026-11-08) — 공개본 account/dist/platform.js에 이번 판의 화면 코드만 갈아 끼운다.
// 공개본 묶음은 master 빌드와 구성이 달라(회원 성향 묶음 SYNK_MEMBER_INSIGHT_20261014 + 바깥 플랫폼 코드) 통째로 덮지 않는다
// (현장 노트 배포_공개 「공개본 account/dist/platform.js를 master 빌드로 덮으면」). 바꾸는 곳은 셋이다.
//   P = 바깥 플랫폼 코드(platform.mjs, `var $=…getElementById` ~ 끝) — 공개본 P가 앞 판 master 빌드의 P와 같은 코드인지 먼저 대조한다.
//   M = 회원 혜택 모듈(member-benefits.mjs, `var esc=…` ~ `function benefitDetail`) + 새 선반 모듈(platform-shelf.mjs) 두 문장.
//   A = 앱 목록의 그림 두 칸(applications.mjs의 image 값) — 글자로 바꾼다(곳마다 한 번).
// 회원 성향 묶음의 이름(renderMemberInsight 등 일곱)은 공개본처럼 SYNK_MEMBER_INSIGHT_20261014.<이름>으로 부른다.
// 쓰기: node patch-live.cjs <공개본 platform.js> <앞 판 master 빌드 platform.js> <새 master 빌드 platform.js> <출력 platform.js>
'use strict';
const fs = require('node:fs'), path = require('node:path');
const SHARED = 'C:/Users/q1212/Documents/SYNK-appsscript';
const from = name => require(require.resolve(name, { paths: [path.resolve(__dirname, '../../../../영상'), SHARED + '/영상'] }));
const acorn = from('acorn'), eslintScope = from('eslint-scope');
const [livePath, oldPath, newPath, outPath] = process.argv.slice(2);
if (!outPath) { console.error('쓰기: node patch-live.cjs <공개본> <앞 판 master 빌드> <새 master 빌드> <출력>'); process.exit(2); }
const fail = message => { console.error('멈춤: ' + message); process.exit(1); };
const read = file => fs.readFileSync(file, 'utf8');
const live = read(livePath), oldBuild = read(oldPath), newBuild = read(newPath);
const INSIGHT = ['renderMemberInsight', 'createMemberActivity', 'createMemberUnderstanding', 'createMemberSettings', 'createMemberInsight', 'bindMemberUnderstandingEditor', 'captureMemberUnderstandingFocus'];

function names(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) names(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const e of p.elements) names(e, out);
  else if (p.type === 'RestElement') names(p.argument, out);
  else if (p.type === 'AssignmentPattern') names(p.left, out);
  return out;
}
function statements(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest' });
  const stmt = ast.body.find(st => st.type === 'ExpressionStatement'), fn = stmt?.expression?.callee;
  if (!fn || fn.body?.type !== 'BlockStatement') fail('바깥 (()=>{…})()를 못 찾았다');
  return fn.body.body.map(st => {
    const declared = [];
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) names(d.id, declared);
    else if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) declared.push(st.id.name);
    return { start: st.start, end: st.end, declared };
  });
}
// P: `var $=…getElementById…` 문장부터 바깥 함수 끝 문장까지. M: artPath 앞 esc 문장부터 benefitDetail까지(새 판은 그 앞 선반 두 문장까지).
function regions(code, { shelf = false } = {}) {
  const list = statements(code), at = name => list.findIndex(st => st.declared.includes(name));
  const p0 = list.findIndex(st => st.declared.length === 1 && st.declared[0] === '$' && code.slice(st.start, st.end).includes('document.getElementById'));
  const art = at('artPath'), m1 = at('benefitDetail');
  if (p0 < 0 || art < 1 || m1 < art) fail(`구역을 못 찾았다 P ${p0} M ${art}~${m1}`);
  if (!/^esc\d*$/.test(list[art - 1].declared[0] || '') || !code.slice(list[art - 1].start, list[art - 1].end).includes('&amp;')) fail('artPath 앞 문장이 혜택 모듈의 esc가 아니다');
  let m0 = art - 1;
  if (shelf) { if (!list[m0 - 2].declared.includes('shelfItem') || !list[m0 - 1].declared.includes('shelfColumns')) fail('새 판 혜택 모듈 앞에 선반 모듈 두 문장이 없다'); m0 -= 2; }
  return { list, P: [p0, list.length - 1], M: [m0, m1] };
}
const slice = (code, list, [a, b]) => code.slice(list[a].start, list[b].end);
const declaredIn = (list, [a, b]) => new Set(list.slice(a, b + 1).flatMap(st => st.declared));
// 회원 성향 묶음 이름: master 빌드는 같은 묶음 안 이름을 바로 부르고, 공개본은 묶음 객체를 거쳐 부른다.
function viaInsight(text) {
  let count = 0;
  const out = text.replace(new RegExp(`(?<![.\\w$])(${INSIGHT.join('|')})(?=\\()`, 'g'), (_, name) => { count++; return 'SYNK_MEMBER_INSIGHT_20261014.' + name; });
  return { out, count };
}
// 대조용: 공백 · 지역 이름 번호(c2 → c) · let/const → var · 한 문장 여러 선언을 같게 보고, 문장(;)마다 한 줄로 나눈다.
const norm = text => text.replace(/\s+/g, ' ').replace(/\b(let|const)\b/g, 'var').replace(/\b([A-Za-z_$][\w$]*?)\d+\b/g, '$1').replace(/ ?([{}()[\];,=:?<>+\-*/&|!]) ?/g, '$1')
  .replace(/var ([\w$]+=[^;]*?),([\w$]+=)/g, 'var $1;var $2').replace(/\{type:"launch",id:id,/g, '{type:"launch",id,').replace(/var id=id;/g, '');
const lines = text => norm(text).split(';').filter(Boolean);
// 두 줄 목록의 차이(LCS) — [공개본에만, 앞 판 master에만]
function lineDiff(a, b) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const onlyA = [], onlyB = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) onlyA.push(a[i++]); else onlyB.push(b[j++]); }
  return [onlyA.concat(a.slice(i)), onlyB.concat(b.slice(j))];
}
// 공개본 P가 앞 판 master 빌드 P와 다른 줄 가운데 이유를 아는 것(공개본 쪽이 옛 판이거나 같은 뜻):
//   ① 로딩 문구 — 공개본 「계정을 확인하고 있어요.」(10-22 글 전수조사 b4b28e17a 전 판), master 「로그인 상태를 확인하고 있어요.」
//   ② quickCard의 「내 수업」 입구(entryId) — master caf7fa5ce에만(공개본 platform-home에도 그 갈래가 없다). 새 판은 그 입구를 못 만들면 Workspace 길로 연다.
//   ③ PATH 주소 — 공개본은 글자 그대로, master는 PATH_INTERVIEW_URL(같은 값, 10-31 공개본에 선언을 얹음)
//   ④ 함수 차례 · 닫는 괄호 자리
const KNOWN = [/message:"(계정을 확인하고 있어요|로그인 상태를 확인하고 있어요)\."/, /function quickCard\(|entryId|var item=itemById\(id\)|destination=shortcutDestination\(id,|var action=destination\.kind==="client"\?button\(destination\.label,"launch",id,/,
  /var web=app\.id==="path"\?("https:\/\/synk\.im\/path\/interview\/film\/rehearsal\.html"|PATH_INTERVIEW_URL)/, /^return(\(!query|`<a class="back-link" href="#discover">|`\$\{client\?\.canLaunch)/, /addEventListener\("pagehide",event=>\{if\(!event\.persisted\)stop\(\)\}\)/, /^\}void detectDownloadOS|^\}?$/];

const L = regions(live), O = regions(oldBuild), N = regions(newBuild, { shelf: true });
// 1. 공개본 P · M이 앞 판 master 빌드와 같은 코드인지(성향 묶음 부르기 · 공백 · 지역 번호를 같게 보고, 이유를 아는 차이만 허용)
const liveP = slice(live, L.list, L.P), liveM = slice(live, L.list, L.M);
const oldP = viaInsight(slice(oldBuild, O.list, O.P)), oldM = viaInsight(slice(oldBuild, O.list, O.M));
const [pLive, pOld] = lineDiff(lines(liveP), lines(oldP.out)), [mLive, mOld] = lineDiff(lines(liveM), lines(oldM.out));
const unknown = [...pLive, ...pOld, ...mLive, ...mOld].filter(line => !KNOWN.some(re => re.test(line)));
const clip = list => list.map(line => line.length > 160 ? line.slice(0, 160) + '…' : line);
const report = { 공개본: { bytes: Buffer.byteLength(live), P: liveP.length, M: liveM.length }, 앞판대조: { M같음: !mLive.length && !mOld.length, P공개본에만: clip(pLive), P앞판master에만: clip(pOld), 모르는차이: clip(unknown) } };
if (unknown.length || mLive.length || mOld.length) { console.log(JSON.stringify(report, null, 1)); fail('공개본 P · M에 이유를 모르는 차이가 있다 — 공개본에만 있는 고침일 수 있다'); }

// 2. 새 판 P · M(+ 선반)을 같은 꼴로
const newP = viaInsight(slice(newBuild, N.list, N.P)), newM = viaInsight(slice(newBuild, N.list, N.M));
if (newP.count !== oldP.count || newM.count !== oldM.count) fail(`성향 묶음 부르기 수가 바뀌었다 P ${oldP.count}→${newP.count} M ${oldM.count}→${newM.count}`);

// 3. 이름 충돌: 새 구역이 선언하는 최상위 이름이 공개본의 나머지(바꾸지 않는 문장)와 겹치면 안 된다
const keptNames = new Set(L.list.flatMap((st, i) => (i >= L.P[0] && i <= L.P[1]) || (i >= L.M[0] && i <= L.M[1]) ? [] : st.declared));
const newNames = new Set([...declaredIn(N.list, N.P), ...declaredIn(N.list, N.M)]);
const clash = [...newNames].filter(n => keptNames.has(n));
if (clash.length) fail('공개본 나머지와 겹치는 새 최상위 이름: ' + clash.join(', '));
// 공개본 M이 선언하고 다른 곳이 부르는 이름(platform-home의 publicBenefitEntry · localBenefitPreview 등)은 새 M에도 있어야 한다
const liveMNames = declaredIn(L.list, L.M), lostM = [...liveMNames].filter(n => !newNames.has(n));

// 4. 갈아 끼우기(뒤에서부터) + 앱 그림 두 칸
let text = live.slice(0, L.list[L.M[0]].start) + newM.out + live.slice(L.list[L.M[1]].end, L.list[L.P[0]].start) + newP.out + live.slice(L.list[L.P[1]].end);
const swaps = [['image:"sticker-book.webp"', 'image:"world-annyeong.webp"'], ['image:"laptop-felt.webp"', 'image:"laptop.webp"']];
for (const [before, after] of swaps) {
  const n = text.split(before).length - 1;
  if (n !== 1) fail(`앱 그림 칸이 공개본에서 ${n}번 맞는다: ${before}`);
  if (!newBuild.includes(after)) fail('새 master 빌드에 없는 그림 값: ' + after);
  text = text.replace(before, after);
}
// 4b. 회원 성향 묶음(SYNK_MEMBER_INSIGHT_20261014) 안의 내 성향 보기(member-insight-view.mjs): 이번 판이 바꾼 글자만 — 영문 꼬리표 셋을 빼고
//     머리 기본 글을 「회원 혜택」으로. 곳마다 그 묶음 안에서 한 번만 맞는지, 새 master 빌드에는 옛 글이 없고 새 글이 있는지 본다.
const insightEnd = L.list[0].end;
if (!live.startsWith('var SYNK_MEMBER_INSIGHT_20261014=', L.list[0].start)) fail('첫 문장이 회원 성향 묶음이 아니다');
const label = live.slice(0, insightEnd).match(/escape\((text\d*)\(value\?\.label,"SYNK FOR YOU"\)\)/);
if (!label) fail('회원 성향 묶음에서 머리 기본 글을 못 찾았다');
const insightSwaps = [['<span class="mi2-label mi2-en">CHOSEN</span>', ''], ['<span class="mi2-label mi2-en">DONE</span>', ''], ['<span class="mi2-label mi2-en">30 DAYS</span>', ''],
  [label[0], `escape(${label[1]}(value?.label,"회원 혜택"))`]];
for (const [before, after] of insightSwaps) {
  const at = text.indexOf(before);
  if (text.split(before).length !== 2 || at < 0 || at > insightEnd) fail('회원 성향 묶음에서 한 번만 맞지 않는다: ' + before);
  text = text.slice(0, at) + after + text.slice(at + before.length);
}
if (/mi2-en|value\?\.label,"SYNK FOR YOU"/.test(newBuild) || !newBuild.includes('value?.label,"회원 혜택"')) fail('새 master 빌드의 내 성향 보기가 이 바꾸기와 맞지 않는다');

// 5. 선언 없이 부르는 이름(전역 참조)이 공개본보다 늘지 않았는지 — 새 구역이 부르는 이름이 모두 공개본에 있다
const globals = code => { const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', ranges: true }); const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' }); return new Set(sm.globalScope.through.map(ref => ref.identifier.name)); };
const gLive = globals(live), gNew = globals(text);
const added = [...gNew].filter(n => !gLive.has(n)), removed = [...gLive].filter(n => !gNew.has(n));
if (added.length) fail('새로 생긴 선언 없는 이름: ' + added.join(', '));
// 공개본 M이 선언했고 새 M에 없는 이름(옛 포스터 도우미 art · state 등)을 누가 아직 부르면 위 전역 참조에 새로 잡힌다 — 여기서 한 번 더 이름으로 본다.
const lostRefs = lostM.filter(n => gNew.has(n));
if (lostRefs.length) fail('공개본 M이 선언하고 아직 부르는 이름이 새 판에 없다: ' + lostRefs.join(', '));
// 남의 미공개 기능 표지: master 빌드 쪽 모듈이 새로 실리지 않았는지(문장 수 차이는 P · M 안에서만)
const outList = statements(text);
const expectStatements = L.list.length - (L.P[1] - L.P[0] + 1) - (L.M[1] - L.M[0] + 1) + (N.P[1] - N.P[0] + 1) + (N.M[1] - N.M[0] + 1);
if (outList.length !== expectStatements) fail(`문장 수가 맞지 않는다 ${outList.length} ≠ ${expectStatements}`);
for (const leftover of ['quick-card', 'sb-eyebrow', 'SYNK FOR YOU</', 'benefit-hero-art']) if (newP.out.includes(leftover) || newM.out.includes(leftover)) fail('새 구역에 옛 표지가 남았다: ' + leftover);

fs.writeFileSync(outPath, text);
Object.assign(report, {
  새판: { bytes: Buffer.byteLength(text), P: newP.out.length, M: newM.out.length, 성향부르기: { P: newP.count, M: newM.count } },
  문장: { 공개본: L.list.length, 후보: outList.length }, 새최상위이름: [...newNames].filter(n => !liveMNames.has(n) && !declaredIn(L.list, L.P).has(n)).sort(),
  사라진최상위이름: [...declaredIn(L.list, L.P), ...liveMNames].filter(n => !newNames.has(n)).sort(),
  전역참조: { 공개본: gLive.size, 후보: gNew.size, 빠짐: removed },
});
console.log(JSON.stringify(report, null, 1));
