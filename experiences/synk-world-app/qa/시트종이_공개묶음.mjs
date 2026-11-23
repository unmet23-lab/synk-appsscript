// WORLD 학생 레슨 시트 종이 겉(유호님 11-23 「종이」 · 「학생 시트만」)의 synk.im/world 선택 공개 재료(2026-11-23). 본보기: 생활2단_공개묶음.mjs.
//   node experiences/synk-world-app/qa/시트종이_공개묶음.mjs [--끝 <커밋=origin/master>] [--앞끝 <지난번 공개한 원천 커밋>]
// --앞끝: 이 일을 이미 한 번 공개한 뒤 고침만 다시 올릴 때. 3방향 합침의 바탕을 「바탕 판 + 앞끝까지의 이 일 커밋」으로 두어,
//   공개본 위에 앞끝 → 끝 사이의 바꿈만 얹는다(11-24 — 바탕 커밋 기준으로 다시 합치면 이미 공개한 포스터 머리 줄과 부딪힌다).
//   항목도 앞끝 뒤 커밋이 바꾼 파일만이다.
// master 전체 공개는 몽골 시범 뒤라(결정 11-20 Atlas 선택 공개), 지금 공개본 위에 이 일의 변경만 얹는다(앞면 공개묶음.mjs와 같은 꼴).
// · 고친 원천: 바탕 판(이 일의 첫 커밋 바로 앞)에 이 일의 커밋(제목이 「WORLD 레슨 시트 종이 겉」)만 얹은 「내 판」을
//   공개 빌드와 같은 경로 고쳐 쓰기를 거쳐 지금 공개본 위에 3방향으로 합친다. 겹치면 멈춘다.
// · 이야기 해설 글꼴 조각(NotoSerifKR-story — 레슨 제목 · 문제 상황 글자를 더함): 끝 판 그대로.
// · 앱(mobile.html)은 life-ui.mjs를 바로 읽는다. 홈을 혼자 여는 판의 묶음(content/life-standalone.mjs)은 이번에 바꾸지 않는다.
// 출력: .tmp/sheet-paper-pub/base(지금 공개본) · new(후보 원천) · 항목.txt, 그리고 tools/공개.js 미리 보기 명령.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const END = opt('--끝', 'origin/master');
const TITLE = '^WORLD 레슨 시트 종이 겉';
const OUT = path.join(ROOT, '.tmp', 'sheet-paper-pub');
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], {maxBuffer: 1 << 30});
const lf = s => s.replace(/\r\n/g, '\n');
// 공개 빌드(tools/build-world-app-public.mjs rewrite)와 같은 경로 고쳐 쓰기
function rw(text, rel) {
  text = text.replaceAll('../synk-world-home/', rel.startsWith('brand-opening/') ? '../' : './');
  if (!rel.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, q, f) => `${q}/world/${f}`);
}
const live = async rel => { const r = await fetch(`https://synk.im/world/${rel}?probe=${Date.now()}`, {cache: 'no-store'}); if (!r.ok) throw Error(`공개본을 못 받음 ${r.status} ${rel}`); return lf(await r.text()); };
const mine = git('log', '--reverse', '--format=%H', `--grep=${TITLE}`, END).toString().trim().split('\n').filter(Boolean);
if (!mine.length) throw Error(`이 일의 커밋이 ${END}에 없다(${TITLE})`);
const BASE = git('rev-parse', `${mine[0]}^`).toString().trim();
const PREV = opt('--앞끝', null);
const isAncestor = (a, b) => { try { execFileSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };
const before = PREV ? mine.filter(c => isAncestor(c, PREV)) : [], newer = PREV ? mine.filter(c => !isAncestor(c, PREV)) : mine;
if (PREV && !newer.length) throw Error(`앞끝 ${PREV} 뒤에 이 일의 커밋이 없다`);
// 기준 · 새 판 · 항목만 지운다. 후보 폴더(cand*)는 검수 사슬이 바이트를 묶고 있어 남긴다 — 다시 검수는 앞 검수의 후보를 읽는다(11-23).
for (const name of ['base', 'new', '항목.txt']) fs.rmSync(path.join(OUT, name), {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
const srcOf = rel => rel.startsWith('brand-opening/') ? `experiences/${rel}` : `experiences/synk-world-app/${rel}`;
// 바탕 판에 이 일의 커밋만 얹는다(그 파일의 diff를 차례로). 남의 커밋은 싣지 않는다.
function mineOnly(src, commits = mine) {
  const tmp = fs.mkdtempSync(path.join(OUT, 'm-'));
  const file = path.join(tmp, 'f');
  fs.writeFileSync(file, lf(git('show', `${BASE}:${src}`).toString()));
  for (const c of commits) {
    const d = lf(git('diff', `${c}^`, c, '--', src).toString());
    if (!d.trim()) continue;
    const patch = path.join(tmp, 'p.diff');
    fs.writeFileSync(patch, d.replaceAll(`a/${src}`, 'a/f').replaceAll(`b/${src}`, 'b/f'));
    execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--recount', '--unsafe-paths', `--directory=${path.relative(ROOT, tmp).replaceAll('\\', '/')}`, '-p1', patch], {cwd: ROOT});
  }
  const text = fs.readFileSync(file, 'utf8'); fs.rmSync(tmp, {recursive: true, force: true}); return text;
}
function merge3(tag, liveText, baseText, mineText) {
  const dir = fs.mkdtempSync(path.join(OUT, 'g-')), a = path.join(dir, 'live'), b = path.join(dir, 'base'), c = path.join(dir, 'mine');
  fs.writeFileSync(a, liveText); fs.writeFileSync(b, baseText); fs.writeFileSync(c, mineText);
  let out, conflicts = 0;
  try { out = execFileSync('git', ['merge-file', '-p', '--diff3', a, b, c]).toString(); } catch (e) { out = e.stdout.toString(); conflicts = e.status; }
  fs.rmSync(dir, {recursive: true, force: true});
  // 겹친 원문(공개본 · 바탕 · 내 판 세 쪽)을 남긴다 — 풀이가 무엇을 버렸는지 사람이 대조할 수 있게(11-23 카본 C1: 겹친 덩어리의 F1 고침이 빠졌다).
  if (conflicts) fs.writeFileSync(path.join(OUT, `겹침원문-${tag.replaceAll('/', '_')}.txt`), out);
  if (conflicts && RESOLVE[tag]) { const fixed = RESOLVE[tag](out, tag); if (!/^<<<<<<< |^\|\|\|\|\|\|\| |^=======$|^>>>>>>> /m.test(fixed)) { console.log(`${tag}: 공개본과 겹친 ${conflicts}곳을 바뀐 줄 묶음마다 공개본 위에 얹어 풀었다`); return fixed; } }
  if (conflicts) { fs.writeFileSync(path.join(OUT, `겹침-${tag.replaceAll('/', '_')}.txt`), out); throw Error(`${tag}: 공개본과 겹침 ${conflicts}곳 — ${OUT}`); }
  return out;
}
// 겹침 풀기: 공개본의 life-ui.mjs는 master보다 앞 판이라(Atlas 새 길 포스터 등이 아직 없다) 이 일이 같은 덩어리에 낸 바꿈이 겹친다.
// 덩어리(공개본 L · 바탕 B · 내 판 M)마다 B→M의 바뀐 줄 묶음을 하나씩 공개본 위에 얹는다(11-23 카본 C1 — 덩어리째 공개본 쪽을 두면 그 안의 F1 고침이 빠졌다).
//  ① 바뀐 B 줄이 공개본에 그대로 있으면 M 줄로 바꾼다. 줄만 더한 묶음은 앞(없으면 뒤) B 줄을 공개본에서 찾아 그 옆에 넣는다.
//  ② 공개본이 그 줄을 따로 고쳤고 이 일의 바꿈이 꼬리표뿐이면(영문 대문자 꼬리표 → 화면 언어 머리, 포스터 머리 kicker) 아래 LABELS로 공개본 줄에 다시 얹는다.
//  ③ 그 묶음의 B 줄이 공개본에 하나도 없으면(공개본에 아직 없는 코드 — Atlas 새 길 포스터) 건너뛴다.
//  그 밖은 멈춘다(조용히 버리지 않는다).
const LABELS = [
  ['class="life-section-label">EXAM</p>', 'class="life-section-label is-text">${t(\'goal.reason.exam\')}</p>'],
  ['class="life-section-label">LIFE PACKS</p>', 'class="life-section-label is-text">${t(\'life.packsSection\')}</p>'],
  ['class="life-section-label">MORE</p>', 'class="life-section-label is-text">${t(\'life.more\')}</p>'],
  ['class="life-section-label">EPISODES</p>', 'class="life-section-label is-text">${t(\'life.stories\')}</p>'],
  ['class="life-section-label">CAFE VISITS</p>', 'class="life-section-label is-text">${t(\'life.cafeVisits\')}</p>'],
];
const labelled = x => LABELS.reduce((y, [a, b]) => y.replaceAll(a, b), x);
const KICKED = x => x.replaceAll('</small><strong class="life-poster-word"', '</small>${kicker()}<strong class="life-poster-word"');
const KICKER = " // 종이 겉의 포스터 머리: 영문 모노 라벨(밤 겉 그대로 둔다) 대신 화면 언어 한 줄.\n const kicker=()=>`<span class=\"life-poster-kicker\">${t('life.upNext')}</span>`;\n";
// 줄 차이(LCS) — 덩어리는 작아 단순 표로 충분하다.
function hunks(B, M) {
  const n = B.length, m = M.length, d = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) d[i][j] = B[i] === M[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const out = []; let i = 0, j = 0, cur = null;
  const flush = () => { if (cur) { out.push(cur); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && B[i] === M[j]) { flush(); i++; j++; continue; }
    cur ??= {b0: i, b: [], m: []};
    if (j < m && (i >= n || d[i][j + 1] >= d[i + 1][j])) cur.m.push(M[j++]); else cur.b.push(B[i++]);
  }
  flush(); return out;
}
function resolveBlock(L, B, M, log) {
  L = [...L];
  for (const h of hunks(B, M).reverse()) {
    if (h.b.length) {
      const at = L.findIndex((_, k) => h.b.every((x, q) => L[k + q] === x));
      if (at >= 0) { L.splice(at, h.b.length, ...h.m); continue; }
      if (h.b.length === h.m.length && h.b.every((x, q) => KICKED(labelled(x)) === h.m[q] || labelled(x) === h.m[q])) { log.push('꼬리표만 — 공개본 줄에 LABELS'); continue; }
      if (h.b.every(x => !L.includes(x))) { log.push(`공개본에 없는 코드 ${h.b.length}줄 — 건너뜀`); continue; }
      throw Error(`겹친 덩어리를 풀 수 없다(바탕 ${h.b0 + 1}줄째부터 ${h.b.length}줄): ${h.b[0].slice(0, 120)}`);
    }
    const before = B[h.b0 - 1], after = B[h.b0];
    const ai = before !== undefined ? L.indexOf(before) : -1, bi = ai < 0 && after !== undefined ? L.indexOf(after) : -1;
    if (ai >= 0) L.splice(ai + 1, 0, ...h.m); else if (bi >= 0) L.splice(bi, 0, ...h.m);
    else if ((before === undefined || !L.length) && (after === undefined || !L.includes(after))) log.push(`공개본에 없는 자리에 더한 ${h.m.length}줄 — 건너뜀`);
    else throw Error(`더한 줄의 자리를 공개본에서 못 찾는다: ${h.m[0].slice(0, 120)}`);
  }
  return L.map(labelled);
}
const RESOLVE = {
  'life-ui.mjs': (out, tag) => {
    const log = [];
    let t = out.replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^\|\|\|\|\|\|\| [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, l, b, m) => {
      const lines = x => x ? x.replace(/\n$/, '').split('\n') : [];
      const r = resolveBlock(lines(l), lines(b), lines(m), log);
      return r.length ? r.join('\n') + '\n' : '';
    });
    if (log.length) console.log(`${tag} 겹침 풀이: ${log.join(' · ')}`);
    // 공개본의 「지금 할 일」 포스터(nowPoster) 세 꼴에도 포스터 머리를 얹는다.
    const at = t.indexOf(' function nowPoster(s){'), stop = t.indexOf(' function reviewRow(', at);
    if (at < 0 || stop < 0) return out;
    if (!/const kicker=/.test(t)) { t = t.slice(0, at) + KICKER + t.slice(at); }
    const a2 = t.indexOf(' function nowPoster(s){'), s2 = t.indexOf(' function reviewRow(', a2);
    t = t.slice(0, a2) + KICKED(t.slice(a2, s2)).replaceAll('${kicker()}${kicker()}', '${kicker()}') + t.slice(s2);
    return t;
  },
};
const write = (dir, rel, data) => { const f = path.join(OUT, dir, 'world', rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, data); };
const changed = new Set(newer.flatMap(c => git('diff-tree', '--no-commit-id', '--name-only', '-r', c).toString().trim().split('\n')).filter(Boolean));
const SOURCES = ['life-ui.mjs', 'life-ui.css', 'life-story.mjs', 'app-shell.css', 'brand-opening/home.mjs', 'brand-opening/home.css', 'brand-opening/world-ui.css', 'brand-opening/world-strings.mjs'];
const items = [];
for (const rel of SOURCES) {
  const src = srcOf(rel);
  if (!changed.has(src)) continue;
  const pub = await live(rel);
  const mergeBase = PREV ? mineOnly(src, before) : lf(git('show', `${BASE}:${src}`).toString());
  const text = merge3(rel, pub, rw(mergeBase, rel), rw(mineOnly(src), rel));
  write('base', rel, pub); write('new', rel, text); items.push(`world/${rel}`);
}
// 새 그림과 이야기 해설 글꼴(이야기 글자로 다시 자른 조각): 끝 판 그대로
const ASSETS = f => /^experiences\/brand-opening\/assets\/NotoSerifKR-story\.(woff2|json)$/.test(f);
for (const src of [...changed].filter(ASSETS)) {
  const rel = src.replace('experiences/', '');
  write('new', rel, git('show', `${END}:${src}`)); items.push(`world/${rel}`);
  // 공개본에 같은 파일이 있으면 기준에도 둔다(없으면 공개.js가 「새로 만든 파일」로 본다)
  const r = await fetch(`https://synk.im/world/${rel}?probe=${Date.now()}`, {cache: 'no-store'});
  if (r.ok) write('base', rel, Buffer.from(await r.arrayBuffer()));
}
// 이 일이 고치지 않은 원천이 섞이지 않았는지
const outside = [...changed].filter(f => f.startsWith('experiences/') && !SOURCES.some(rel => srcOf(rel) === f) && !ASSETS(f) && !f.startsWith('experiences/brand-opening/content/') && !/\/qa\//.test(f));
if (outside.length) console.log('공개하지 않는 원천(확인):', outside.join(' '));
fs.writeFileSync(path.join(OUT, '항목.txt'), items.join('\n') + '\n');
const posix = p => p.replaceAll('\\', '/');
console.log(`끝 ${git('rev-parse', '--short', END).toString().trim()} · 바탕 ${BASE.slice(0, 9)} · 이 일의 커밋 ${mine.length}개${PREV ? ` (앞끝 ${PREV.slice(0, 9)} 뒤 ${newer.length}개)` : ""} · 항목 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(path.join(OUT, 'cand'))].join(' '));
