'use strict';
// Atlas × WORLD 1단계(2026-11-08)의 synk.im/world 공개 재료. 바탕(origin/master) 판과 내 판(HEAD)에서 이 일이 바꾼 WORLD 공개 파일만 꺼내
// 두 폴더를 만든다 — tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다(남의 아직 안 올린 변경은 두 판에 같이 있어 실리지 않는다).
// 공개 빌드(tools/build-world-app-public.mjs)의 고쳐 쓰기(rewrite · copyFile)와 드라마 ?v= 토큰(208~225행)을 두 판에 똑같이 건다.
// 바탕 결과는 지금 공개본과 바이트까지 같아야 한다 — 다르면 멈춘다(이 대조가 「빌드와 같은 고쳐 쓰기」의 증거다).
//   node docs/_ops/qa/atlas-world-engine-20261108/공개묶음.cjs [바탕=origin/master] [내 판=HEAD] [--판 <글자>]
//   → 공용 작업본 .tmp/atlas-world-pub-20261108[-판]/{base,new}/world/…, 미리 보기 명령을 찍는다
const path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2), 판 = args.includes('--판') ? args[args.indexOf('--판') + 1] : '';
const [BASE = 'origin/master', NEW = 'HEAD'] = args.filter((x, i, all) => !x.startsWith('--') && all[i - 1] !== '--판');
// --판은 폴더 이름 끝에 붙는 글자 하나뿐이다 — 경로를 받지 않는다(아래에서 이 폴더를 통째로 지우므로, 검수 GPT A1).
if (args.includes('--판') && !/^[A-Za-z0-9_-]{1,40}$/.test(판 || '')) throw Error('--판은 영문 · 숫자 · _ · - 40자까지');
const TMP = path.join(공용작업본(ROOT), '.tmp');
const OUT = path.join(TMP, `atlas-world-pub-20261108${판 ? '-' + 판 : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');

// build-world-app-public.mjs rewrite()와 같은 글. relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const copied = (rev, src, relative) => { const b = show(rev, src); return b && Buffer.from(rewrite(b.toString('utf8'), relative)); };
const GAMES = ['blank-slice', 'entry-check', 'hangul-stage', 'korean-rhythm', 'korean-runner', 'order-rush', 'snap-words', 'subway-rush'];
// WORLD 계정 묶음(world-account.bundle.mjs) · 생활 묶음(brand-opening/content/life-standalone.mjs)은 싣지 않는다: 공개본은 11-04 원천이고
// origin에는 그 뒤 남의 WORLD 변경이 쌓여 있어 이 판으로 지으면 미공개 기능까지 나간다. 기록 꼴이 같아 지금처럼 돌고(재확인은 옛 비교),
// 다음 계정 묶음 공개 때 이 엔진 판이 저절로 실린다.
const PLAIN = [
  ...GAMES.map(g => [`experiences/${g}/atlas-learning.js`, `${g}/atlas-learning.js`]),
  ['experiences/brand-opening/world-sound.mjs', 'brand-opening/world-sound.mjs'],
  ['experiences/synk-world-app/world-learning-followups.mjs', 'world-learning-followups.mjs'],
  ['experiences/korean-rhythm/supplemental-player.mjs', 'korean-rhythm/supplemental-player.mjs'],
  ['experiences/order-rush/learning.mjs', 'order-rush/learning.mjs'],
  ['experiences/drama/pilot/atlas-learning.js', 'drama/atlas-learning.js'],
  ['experiences/drama/pilot/takes.mjs', 'drama/takes.mjs'],
];
// 드라마: pilot.mjs는 고쳐 쓴 뒤 세 가져오기에 원천 해시 토큰, index.html은 WORLD 표시와 세 파일 토큰(빌드 212~224행).
function drama(rev) {
  const D = 'experiences/drama/pilot/', token = name => sha(show(rev, D + name)).slice(0, 12);
  let pilot = rewrite(show(rev, D + 'pilot.mjs').toString('utf8'), 'drama/pilot.mjs');
  for (const name of ['strings.mjs', 'takes.mjs', 'orbloom.mjs']) { const from = `'./${name}'`; if (pilot.split(from).length !== 2) throw Error('드라마 pilot.mjs 가져오기 꼴이 다르다: ' + from); pilot = pilot.replace(from, `'./${name}?v=${token(name)}'`); }
  const html = show(rev, D + 'index.html').toString('utf8');
  if (!html.includes('<html lang="ko">')) throw Error('드라마 index.html 꼴이 다르다');
  const tokens = { 'pilot.css': token('pilot.css'), 'atlas-learning.js': token('atlas-learning.js'), 'pilot.mjs': sha(Buffer.from(pilot)).slice(0, 12) };
  let page = html.replace('<html lang="ko">', '<html lang="ko" data-drama="world">');
  for (const [attr, name] of [['href', 'pilot.css'], ['src', 'atlas-learning.js'], ['src', 'pilot.mjs']]) { const from = `${attr}="${name}"`; if (page.split(from).length !== 2) throw Error('드라마 index.html 참조가 다르다: ' + from); page = page.replace(from, `${attr}="${name}?v=${tokens[name]}"`); }
  return { 'drama/pilot.mjs': Buffer.from(pilot), 'drama/index.html': Buffer.from(page) };
}
fs.rmSync(OUT, { recursive: true, force: true });
const versions = { base: {}, new: {} };
for (const [rev, key] of [[BASE, 'base'], [NEW, 'new']]) {
  for (const [src, relative] of PLAIN) versions[key][relative] = copied(rev, src, relative);
  Object.assign(versions[key], drama(rev));
}
// ① 공개본이 11-02 핫픽스 「모듈마다 공백을 줄인 판」인 게임 묶음 셋: 3방향이 안 되므로 공개본 꼴을 그대로 두고 내용이 다른 모듈만
//    새 판의 모듈을 공백 줄여 바꿔 끼운다(splice). 바탕은 공개본이다 — 공개본과의 차이가 바꿔 낀 모듈뿐이고, 모듈마다 새 판과 같은 뜻인지
//    정규화(이름 · 공백 무시)로 확인한다. 바꿔 끼는 모듈 가운데 learning.js · vellum-flow.js · game-flow.js(한글 learning-entry.cjs)는
//    다른 WORLD 게임 묶음에 11-03~04에 이미 공개된 판이고 temper.js · game-learning.js가 이번 변경이다.
// ② 드라마 pilot.mjs · index.html: 공개본은 CRLF 작업본에서 지어 줄끝과 ?v= 토큰만 다르다 — 바탕은 진짜 바탕 그대로 두고 공개.js 3방향이
//    줄끝 · 토큰을 맞춘다(그 두 가지를 맞추면 바탕과 공개본이 같은지 여기서 본다).
const SPLICE = new Set(['hangul-stage', 'korean-rhythm', 'korean-runner'].map(g => `world/${g}/atlas-learning.js`));
const EOL_TOKEN_ONLY = new Set(['world/drama/pilot.mjs', 'world/drama/index.html']);
const es = require(path.join(공용작업본(ROOT), 'node_modules', 'esbuild'));
const norm = code => es.transformSync(`globalThis.__m=function(__commonJS,__toESM,__require){${code}\n};`, { minifySyntax: true, minifyWhitespace: true, minifyIdentifiers: true, charset: 'utf8', target: 'es2022', legalComments: 'none' }).code;
const squeeze = code => es.transformSync(code, { minifyWhitespace: true, charset: 'utf8', target: 'es2022', legalComments: 'none' }).code.replace(/\n$/, '');
function parts(text) {
  const s = text.replace(/\r\n/g, '\n'), m = [...s.matchAll(/^ {2}\/\/ ((?:atlas|strata|experiences)\/[^\n]+)$/gm)];
  const mods = new Map(); for (let i = 0; i < m.length; i++) mods.set(m[i][1], { head: m[i][0], body: s.slice(m[i].index + m[i][0].length, i + 1 < m.length ? m[i + 1].index : undefined) });
  return { pre: s.slice(0, m[0].index), mods, last: m.at(-1)[1] };
}
// 마지막 모듈 조각 끝에는 묶음을 닫는 고정 꼴 「  return require_…();\n})();」이 붙어 있다 — 그 꼴로만 자르고 없으면 멈춘다(검수 그록 KA2).
const END = /\n {2}return require_[\w$]+\(\);\n\}\)\(\);\s*$/;
const cut = (text, key) => { const m = END.exec(text); if (!m) throw Error('묶음 끝 꼴을 못 찾았다: ' + key); return m.index + 1; };
function splice(liveBytes, newBytes) {
  const L = parts(liveBytes.toString('utf8')), N = parts(newBytes.toString('utf8'));
  if (JSON.stringify([...L.mods.keys()]) !== JSON.stringify([...N.mods.keys()])) throw Error('모듈 목록 · 차례가 공개본과 다르다');
  if (L.pre !== N.pre) throw Error('묶음 머리가 공개본과 다르다');
  const swapped = []; let out = L.pre;
  for (const [key, l] of L.mods) {
    const n = N.mods.get(key), last = key === L.last;
    // 마지막 모듈 조각에는 묶음 끝(IIFE 닫기)이 붙어 있다 — 그 끝은 두 판이 같아야 하고 모듈 몸만 견준다.
    const tail = text => { if (!last) return [text, '']; const at = cut(text, key); return [text.slice(0, at), text.slice(at)]; };
    const [lb, lt] = tail(l.body), [nb, nt] = tail(n.body);
    if (last && lt.trim() !== nt.trim()) throw Error('묶음 끝이 공개본과 다르다');
    if (norm(lb) === norm(nb)) { out += l.head + l.body; continue; }
    swapped.push(key); out += `${l.head}\n  ${squeeze(nb)}\n\n${lt}`;
  }
  const body = (text, key) => key === N.last ? text.slice(0, cut(text, key)) : text;
  const S = parts(out); for (const [key, n] of N.mods) if (norm(body(S.mods.get(key).body, key)) !== norm(body(n.body, key))) throw Error('바꿔 낀 묶음이 새 판과 뜻이 다르다: ' + key);
  return { bytes: Buffer.from(out), swapped };
}
const unify = b => b.toString('utf8').replace(/\r\n/g, '\n').replace(/\?v=[0-9a-f]{12}/g, '?v=*');
const items = [], mismatched = [], spliced = [];
for (const relative of Object.keys(versions.new)) {
  let a = versions.base[relative], b = versions.new[relative];
  const pub = `world/${relative}`;
  if (!b) throw Error('내 판에 없다: ' + relative);
  if (a && a.equals(b)) continue;
  const now = live(pub);
  if (now && SPLICE.has(pub)) { const r = splice(now, b); spliced.push({ pub, swapped: r.swapped }); a = now; b = r.bytes; }
  else if (!a || !now || !(a.equals(now) || (EOL_TOKEN_ONLY.has(pub) && unify(a) === unify(now)))) mismatched.push({ pub, base: a && sha(a).slice(0, 12), live: now && sha(now).slice(0, 12) });
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    if (!bytes) continue;
    const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  }
  items.push(pub);
}
console.log(JSON.stringify({ base: BASE, new: NEW, out: OUT, changed: items.length, items, baseEqualsLive: mismatched.length === 0, mismatched, spliced }, null, 1));
if (mismatched.length) { console.error('멈춤: 바탕 결과가 지금 공개본과 다른 파일이 있다 — 공개본의 원천을 바탕으로 다시 잡는다'); process.exit(3); }
console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
