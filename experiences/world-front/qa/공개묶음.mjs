// 첫날 끝 · 맞춤 앞면 1차의 synk.im/world 선택 공개 재료(2026-11-20, Claude).
//   node experiences/world-front/qa/공개묶음.mjs [--끝 <커밋=origin/master>]
// master 전체 공개는 몽골 시범 뒤라(결정 11-20 Atlas 선택 공개), 지금 공개본 위에 이 일의 변경만 얹는다.
// · app-shell.mjs: 공개본과 master의 머리(import 묶음 · Atlas 줄)가 많이 달라, 앞면 갈고리를 「공개본의 이 글 → 이렇게」 표(shellRecipe)로 얹는다.
// · 고친 파일 넷(seoul-entry · home · 서울행 app · strings): 바탕 판(이 일 전 a9d50abdd)에 이 일의 커밋(제목이 「WORLD 첫날 끝」)만 얹은
//   「내 판」을 공개 빌드와 같은 경로 고쳐 쓰기를 거쳐 지금 공개본 위에 3방향으로 합친다. 겹치면 멈춘다.
// · 새 파일(world-front-entry.mjs · world-front/): 끝 판 그대로(빌드의 경로 고쳐 쓰기), 스위치 FRONT_AUTO만 참으로.
// 출력: .tmp/world-front-pub/base(지금 공개본) · new(후보 원천) · 항목.txt, 그리고 tools/공개.js 미리 보기 명령.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const END = opt('--끝', 'origin/master'), BASE = 'a9d50abdd97d649ddb2ba1906cad6451f2f29200';
const OUT = path.join(ROOT, '.tmp', 'world-front-pub');
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], {maxBuffer: 1 << 30});
const lf = s => s.replace(/\r\n/g, '\n');
// 공개 빌드(tools/build-world-app-public.mjs rewrite)와 같은 경로 고쳐 쓰기
function rw(text, rel) {
  text = text.replaceAll('../synk-world-home/', rel.startsWith('brand-opening/') ? '../' : './');
  if (!rel.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  if (rel === 'world-front-entry.mjs') text = text.replace("from '../seoul-arrival/", "from './seoul-arrival/");
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, q, f) => `${q}/world/${f}`);
}
const live = async rel => { const r = await fetch(`https://synk.im/world/${rel}?probe=${Date.now()}`, {cache: 'no-store'}); if (!r.ok) throw Error(`공개본을 못 받음 ${r.status} ${rel}`); return lf(await r.text()); };
const mine = execFileSync('git', ['-C', ROOT, 'log', '--reverse', '--format=%H', '--grep=^WORLD 첫날 끝', `${BASE}..${END}`]).toString().trim().split('\n').filter(Boolean);
// 바탕 판에 이 일의 커밋만 얹는다(그 파일의 diff를 차례로). 남의 커밋은 싣지 않는다.
function mineOnly(src) {
  const tmp = fs.mkdtempSync(path.join(OUT, 'm-'));
  const file = path.join(tmp, 'f');
  fs.writeFileSync(file, lf(git('show', `${BASE}:${src}`).toString()));
  for (const c of mine) {
    const d = lf(git('diff', `${c}^`, c, '--', src).toString());
    if (!d.trim()) continue;
    const patch = path.join(tmp, 'p.diff');
    fs.writeFileSync(patch, d.replaceAll(`a/${src}`, 'a/f').replaceAll(`b/${src}`, 'b/f'));
    execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--recount', '--unsafe-paths', `--directory=${path.relative(ROOT, tmp).replaceAll('\\', '/')}`, '-p1', patch], {cwd: ROOT});
  }
  const out = lf(fs.readFileSync(file, 'utf8')); fs.rmSync(tmp, {recursive: true, force: true}); return out;
}
function merge3(liveText, baseText, mineText, tag) {
  const dir = fs.mkdtempSync(path.join(OUT, 'g-'));
  const [a, b, c] = ['live', 'base', 'mine'].map(n => path.join(dir, n));
  fs.writeFileSync(a, liveText); fs.writeFileSync(b, baseText); fs.writeFileSync(c, mineText);
  let out;
  try { out = execFileSync('git', ['merge-file', '-p', a, b, c]).toString(); } catch (e) { out = e.stdout.toString(); }
  fs.rmSync(dir, {recursive: true, force: true});
  fs.writeFileSync(path.join(OUT, `합침-${tag.replaceAll('/', '_')}.txt`), out);   // 풀기 전 합침(겹침 표식 포함) — 풀기 표를 고칠 때 본다
  return resolve(out, tag);
}
// 고친 파일 넷(서울행 · 홈)은 공개본과 겹치지 않는다. 겹치면 손으로 풀어야 하니 멈춘다(app-shell은 아래 shellRecipe가 맡는다).
function resolve(text, tag) {
  if (/^<<<<<<< /m.test(text)) throw Error(`${tag}: 공개본과 겹친다 — 합침-${tag.replaceAll('/', '_')}.txt를 보고 갈고리 표로 옮긴다`);
  return text;
}

const MOD = [
  ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs'],
  ['experiences/synk-world-app/seoul-entry.mjs', 'seoul-entry.mjs'],
  ['experiences/brand-opening/home.mjs', 'brand-opening/home.mjs'],
  ['experiences/seoul-arrival/app.mjs', 'seoul-arrival/app.mjs'],
  ['experiences/seoul-arrival/strings.mjs', 'seoul-arrival/strings.mjs']
];
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
const items = [];
const write = (dir, rel, text) => { const f = path.join(OUT, dir, 'world', rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, text); };
// app-shell.mjs는 공개본과 master의 머리(import 묶음 · Atlas 줄)가 많이 달라 3방향 합침이 갈고리를 큰 겹침에 묻는다.
// 그래서 앞면 갈고리 열 군데를 「공개본의 이 글 → 이렇게」 표로 하나씩 얹는다. 글마다 공개본에 꼭 한 번 있어야 하고, 아니면 멈춘다.
function shellRecipe(pub) {
  const endText = lf(git('show', `${END}:experiences/synk-world-app/app-shell.mjs`).toString());
  const s0 = endText.indexOf('// 첫날 끝 · 맞춤 앞면(1차, 결정 11-19)'), s1 = endText.indexOf("note:t('goal.consent.note')};}});", s0);
  if (s0 < 0 || s1 < 0) throw Error('app-shell.mjs: 끝 판에서 앞면 다리 묶음을 못 찾음');
  const block = endText.slice(s0, s1 + "note:t('goal.consent.note')};}});".length)
    .replace("newEngine:owner=>atlasNextOn&&(owner!=='guest'||atlasNextGuestOn),", 'newEngine:()=>false,');   // 공개본에는 아직 Atlas 새 엔진(atlasNext)이 없다
  const onEnter = "   if(entryGate.state().phase!=='ready'||identity.owner!==(client.snapshot?.accountId||'guest')||identity.generation!==client.generation)return;\n";
  const h0 = endText.indexOf('   // 앞면 학생은 앞면이 홈이다'), h1 = endText.indexOf("openReminderLink();});return;}\n", h0);
  if (h0 < 0 || h1 < 0) throw Error('app-shell.mjs: 끝 판에서 관문 뒤 앞면 갈고리를 못 찾음');
  const enterHook = endText.slice(h0, h1 + "openReminderLink();});return;}\n".length);
  const seoulEnd = 'native:()=>operating&&account?.supportsSpeaking===false});';
  const steps = [
    [/^import \{createSeoulEntry[^}]*\} from '\.\/seoul-entry\.mjs';\n/m, m => m + "import {createFrontEntry} from './world-front-entry.mjs';\n"],
    ['let seoul=null,entryGate=null,', 'let seoul=null,front=null,entryGate=null,'],
    [' seoul?.onIdentity();\n', ' seoul?.onIdentity();\n front?.onIdentity();\n'],
    ['if(!fromSeoul&&home.ensureTutor&&', 'if(!fromSeoul&&!front?.free()&&home.ensureTutor&&'],
    ['sessionConfirmed=false;close();if(home.isMaru)await entryGate.start();else welcome();}catch', 'sessionConfirmed=false;close();if(front?.active()){front.drop();void startOpening();}else if(home.isMaru)await entryGate.start();else welcome();}catch'],
    ['home.connectHost?.({road:', 'home.connectHost?.({tutorFree:()=>!!front?.free(),road:'],
    [seoulEnd + '\n', seoulEnd.replace('});', ',frontOn:()=>!!front?.soon()});') + '\n' + block + '\n'],
    ["tutor:home.tutor?.().tutor||null}),", "tutor:home.tutor?.().tutor||(front?.free()?'front':null)}),"],
    [onEnter, onEnter + enterHook]
  ];
  let text = pub;
  for (const [from, to] of steps) {
    const n = typeof from === 'string' ? text.split(from).length - 1 : (text.match(new RegExp(from.source, from.flags + 'g')) || []).length;
    if (n !== 1) throw Error(`app-shell.mjs: 공개본에서 「${String(from).slice(0, 60)}」가 ${n}번 — 꼭 한 번이어야 한다`);
    text = text.replace(from, to);
  }
  if (/atlasNext(Guest)?On/.test(text) && !/atlasNext(Guest)?On/.test(pub)) throw Error('app-shell.mjs: 공개본에 없는 atlasNextOn을 부른다');
  return text;
}
for (const [src, rel] of MOD) {
  const pub = await live(rel);
  const cand = rel === 'app-shell.mjs' ? shellRecipe(pub) : merge3(pub, rw(lf(git('show', `${BASE}:${src}`).toString()), rel), rw(mineOnly(src), rel), rel);
  if (cand === pub) continue;
  write('base', rel, pub); write('new', rel, cand); items.push('world/' + rel);
}
// 새 파일: 다리 + 틀 폴더(시험 · 설계 문서 · 견줌 자료는 빼고 — 빌드의 거름과 같다)
const entry = rw(lf(git('show', `${END}:experiences/synk-world-app/world-front-entry.mjs`).toString()), 'world-front-entry.mjs');
if (!/export const FRONT_AUTO=(true|false);/.test(entry)) throw Error('스위치 줄을 못 찾음');   // 공개 뒤 master가 켜져 있어도 같은 재료
write('new', 'world-front-entry.mjs', entry.replace(/export const FRONT_AUTO=(true|false);/, 'export const FRONT_AUTO=true;'));
items.push('world/world-front-entry.mjs');
for (const f of git('ls-tree', '-r', '--name-only', END, 'experiences/world-front/').toString().trim().split('\n')) {
  const rel = f.slice('experiences/'.length);
  if (/^world-front\/(?:qa\/|.*\.test\.mjs$|.*\.md$|assets\/.*\.(?:txt|json)$)/.test(rel)) continue;
  const bytes = git('show', `${END}:${f}`);
  const fileOut = path.join(OUT, 'new', 'world', rel); fs.mkdirSync(path.dirname(fileOut), {recursive: true});
  fs.writeFileSync(fileOut, /\.(mjs|js|css|html)$/.test(rel) ? rw(lf(bytes.toString('utf8')), rel) : bytes);
  items.push('world/' + rel);
}
fs.writeFileSync(path.join(OUT, '항목.txt'), items.join('\n') + '\n');
let cand = path.join(OUT, '후보'); for (let n = 2; fs.existsSync(cand); n++) cand = path.join(OUT, '후보' + n);
const posix = p => p.replaceAll('\\', '/');
console.log(`끝 ${git('rev-parse', '--short', END).toString().trim()} · 바탕 ${BASE.slice(0, 9)} · 이 일의 커밋 ${mine.length}개 · 항목 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(cand)].join(' '));
