// 첫날 끝 · 맞춤 앞면 1차의 synk.im/world 선택 공개 재료(2026-11-20, Claude).
//   node experiences/world-front/qa/공개묶음.mjs [--끝 <커밋=origin/master>]
// master 전체 공개는 몽골 시범 뒤라(결정 11-20 Atlas 선택 공개), 지금 공개본 위에 이 일의 변경만 얹는다.
// · app-shell.mjs: 공개본과 master의 머리(import 묶음 · Atlas 줄)가 많이 달라, 앞면 갈고리를 「공개본의 이 글 → 이렇게」 표(shellRecipe)로 얹는다.
// · 고친 파일 넷(seoul-entry · home · 서울행 app · strings): 바탕 판(이 일 전 a9d50abdd)에 이 일의 커밋(제목이 「WORLD 첫날 끝」)만 얹은
//   「내 판」을 공개 빌드와 같은 경로 고쳐 쓰기를 거쳐 지금 공개본 위에 3방향으로 합친다. 겹치면 멈춘다.
// · 새 파일(world-front-entry.mjs · world-front/): 끝 판 그대로(빌드의 경로 고쳐 쓰기), 스위치 FRONT_AUTO만 참으로. 공개본이 앞 공개판(LAST)과 다르면
//   그 사이 다른 일이 얹은 것이라(11-26 앞면 녹음 b870e228) 앞 공개판 · 끝 판 · 공개본을 3방향으로 합친다. 겹치면 멈춘다.
// 출력: .tmp/world-front-pub/base(지금 공개본) · new(후보 원천) · 항목.txt, 그리고 tools/공개.js 미리 보기 명령.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const END = opt('--끝', 'origin/master'), BASE = 'a9d50abdd97d649ddb2ba1906cad6451f2f29200';
// 이 일이 마지막으로 공개한 원천(11-26 synk-policy 9961e4f4). 그 뒤 다른 일이 앞면 파일에 먼저 공개한 변경을 지우지 않게 3방향의 바탕으로 쓴다 — 공개할 때마다 새 원천으로 고친다.
const LAST = opt('--앞판', '54d626cc17ce9d56ae050f5b9c116500eae14c40');
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
  try { out = execFileSync('git', ['merge-file', '-p', '--diff3', a, b, c]).toString(); } catch (e) { out = e.stdout.toString(); }
  fs.rmSync(dir, {recursive: true, force: true});
  fs.writeFileSync(path.join(OUT, `합침-${tag.replaceAll('/', '_')}.txt`), out);   // 풀기 전 합침(겹침 표식 포함) — 풀기 표를 고칠 때 본다
  return resolve(out, tag);
}
// 고친 파일 넷(서울행 · 홈)은 공개본과 겹치지 않는다. 겹치면 손으로 풀어야 하니 멈춘다(app-shell은 아래 shellRecipe가 맡는다).
// 낱말 덩이(공백 · 쉼표 · 괄호로 가름)와 덩이 모음의 뺄셈(같은 낱말이 여럿이면 그 수만큼)
const toks = s => s.match(/[^\s,(){}[\];]+/g) || [];
const minus = (a, b) => { const m = new Map(); for (const t of b) m.set(t, (m.get(t) || 0) + 1); return a.filter(t => { const n = m.get(t) || 0; if (n) { m.set(t, n - 1); return false; } return true; }); };
// 이 일이 바탕에 더한 낱말이 공개본 쪽에 다 있고 이 일이 뺀 낱말이 공개본 쪽에 없으면, 이 일의 변경은 이미 공개됐고 남은 차이는
// 공개본에 먼저 오른 남의 고침이다 → 공개본 쪽을 쓴다(11-24 손님 1화가 createSeoulEntry 머리에서 operating · signIn을 뺀 공개).
function alreadyLive(liveSide, baseSide, mineSide) {
  const L = toks(liveSide), add = minus(toks(mineSide), toks(baseSide)), del = minus(toks(baseSide), toks(mineSide));
  return add.length > 0 && minus(add, L).length === 0 && del.every(t => !L.includes(t));
}
function resolve(text, tag) {
  // 공개 뒤 다시 돌릴 때: 공개본 쪽에서 공개 때 덧붙인 글(homeExtra의 planLabel 한 토막)만 빼면 내 쪽과 같을 때만 공개본 쪽을 쓴다. 내 쪽이 비었으면(줄 삭제) 그대로 멈춘다.
  const ADDED = 'planLabel:next=>planLabel(next), ';
  text = text.replace(/<<<<<<< [^\n]*\n([\s\S]*?)\|\|\|\|\|\|\| [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g,
    (all, liveSide, baseSide, mineSide) => mineSide.trim() && (liveSide.replace(ADDED, '') === mineSide || alreadyLive(liveSide, baseSide, mineSide)) ? liveSide : all);
  if (/^<<<<<<< /m.test(text)) throw Error(`${tag}: 공개본과 겹친다 — 합침-${tag.replaceAll('/', '_')}.txt를 보고 갈고리 표로 옮긴다`);
  return text;
}

const MOD = [
  ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs'],
  ['experiences/synk-world-app/seoul-entry.mjs', 'seoul-entry.mjs'],
  ['experiences/brand-opening/home.mjs', 'brand-opening/home.mjs'],
  ['experiences/seoul-arrival/app.mjs', 'seoul-arrival/app.mjs'],
  ['experiences/seoul-arrival/strings.mjs', 'seoul-arrival/strings.mjs'],
  // 동아리장 알림(11-24): 앞면 대화 카드가 부르는 짧은 진단 문(clubCheck) — 아래 learningRecipe가 얹는다
  ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs']
];
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
const items = [];
const write = (dir, rel, text) => { const f = path.join(OUT, dir, 'world', rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, text); };
// app-shell.mjs는 공개본과 master의 머리(import 묶음 · Atlas 줄)가 많이 달라 3방향 합침이 갈고리를 큰 겹침에 묻는다.
// 그래서 앞면 갈고리 아홉 군데를 「공개본의 이 글 → 이렇게」 표로 하나씩 얹는다. 글마다 공개본에 꼭 한 번 있어야 하고, 아니면 멈춘다.
function shellRecipe(pub) {
  const endText = lf(git('show', `${END}:experiences/synk-world-app/app-shell.mjs`).toString());
  const s0 = endText.indexOf('// 첫날 끝 · 맞춤 앞면(1차, 결정 11-19)'), s1 = endText.indexOf("note:t('goal.consent.note')};}});", s0);
  if (s0 < 0 || s1 < 0) throw Error('app-shell.mjs: 끝 판에서 앞면 다리 묶음을 못 찾음');
  const block = endText.slice(s0, s1 + "note:t('goal.consent.note')};}});".length)
    .replace("newEngine:owner=>atlasNextOn&&(owner!=='guest'||atlasNextGuestOn),", /atlasNextOn/.test(pub) ? '$&' : 'newEngine:()=>false,');   // Atlas ③(11-25) 전 공개본에는 새 엔진(atlasNext)이 없다
  const onEnter = "   if(entryGate.state().phase!=='ready'||identity.owner!==(client.snapshot?.accountId||'guest')||identity.generation!==client.generation)return;\n";
  const h0 = endText.indexOf('   // 앞면 학생은 앞면이 홈이다'), h1 = endText.indexOf("openReminderLink();});return;}\n", h0);
  if (h0 < 0 || h1 < 0) throw Error('app-shell.mjs: 끝 판에서 관문 뒤 앞면 갈고리를 못 찾음');
  const enterHook = endText.slice(h0, h1 + "openReminderLink();});return;}\n".length);
  const seoulEnd = 'native:()=>operating&&account?.supportsSpeaking===false});';
  const readHook = endText.match(/tutor:home\.tutor\?\.\(\)\.tutor\|\|\([^\n]*?\)\}\),/g) || [];
  if (readHook.length !== 1) throw Error('app-shell.mjs: 끝 판에서 관문 read 갈고리를 못 찾음');
  const identityHook = ' if(front?.onIdentity())entryDestinationHandled=false;';
  const i0 = endText.indexOf(identityHook);
  if (i0 < 0) throw Error('app-shell.mjs: 끝 판에서 주인 바뀜 갈고리를 못 찾음');
  // [공개본의 글, 바꿀 글, 끝 판(master)에 꼭 있어야 하는 글] — 손으로 적은 갈고리가 master와 어긋나면 멈춘다(Fable P2-3)
  const steps = [
    [/^import \{createSeoulEntry[^}]*\} from '\.\/seoul-entry\.mjs';\n/m, m => m + "import {createFrontEntry} from './world-front-entry.mjs';\n", "import {createFrontEntry} from './world-front-entry.mjs';"],
    ['let seoul=null,entryGate=null,', 'let seoul=null,front=null,entryGate=null,'],
    [' seoul?.onIdentity();\n', ' seoul?.onIdentity();\n' + endText.slice(i0, endText.indexOf('\n', i0) + 1), identityHook],
    ['if(!fromSeoul&&home.ensureTutor&&', 'if(!fromSeoul&&!front?.free()&&home.ensureTutor&&'],
    ['sessionConfirmed=false;close();if(home.isMaru)await entryGate.start();else welcome();}catch', 'sessionConfirmed=false;close();if(front?.active()){front.drop();entryDestinationHandled=false;void startOpening();}else if(home.isMaru)await entryGate.start();else welcome();}catch'],
    ['home.connectHost?.({road:', 'home.connectHost?.({tutorFree:()=>!!front?.free(),road:'],
    // master와 11-25 공개본(fadf697)은 frontOn 뒤에 「내 사진으로」 me2 줄이 이어진다(c20a4cfed) — 끝 판 · 공개본 표식은 frontOn까지만 보고, 다리 묶음은 아래에서 따로 본다
    [seoulEnd + '\n', seoulEnd.replace('});', ',frontOn:()=>!!front?.soon()});') + '\n' + block + '\n', 'supportsSpeaking===false,frontOn:()=>!!front?.soon()', 'supportsSpeaking===false,frontOn:()=>!!front?.soon()'],
    ['tutor:home.tutor?.().tutor||null}),', readHook[0]],
    [onEnter, onEnter + enterHook, onEnter]
  ];
  for (const [, to, mark] of steps) { const need = mark ?? to; if (!endText.includes(need)) throw Error(`app-shell.mjs: 끝 판(master)에 「${need.slice(0, 60)}」가 없다 — master 갈고리가 바뀌었으면 표를 맞춘다`); }
  // 이미 앞면을 공개한 뒤(11-20 f50ef5c7)에 다시 돌리면: 갈고리를 또 얹지 않고, 공개본 갈고리가 master 글과 같은지만 본다.
  if (pub.includes("import {createFrontEntry} from './world-front-entry.mjs';")) {
    for (const [, to, mark, pubMark] of steps) { const need = pubMark ?? (typeof to === 'string' ? to : mark); if (!pub.includes(need)) throw Error(`app-shell.mjs: 공개본의 앞면 갈고리가 master와 다르다 — 「${need.slice(0, 60)}」`); }
    if (!pub.includes(block)) throw Error('app-shell.mjs: 공개본의 앞면 다리 묶음이 master와 다르다');
    return pub;
  }
  let text = pub;
  for (const [from, to] of steps) {
    const n = typeof from === 'string' ? text.split(from).length - 1 : (text.match(new RegExp(from.source, from.flags + 'g')) || []).length;
    if (n !== 1) throw Error(`app-shell.mjs: 공개본에서 「${String(from).slice(0, 60)}」가 ${n}번 — 꼭 한 번이어야 한다`);
    text = text.replace(from, to);
  }
  if (/atlasNext(Guest)?On/.test(text) && !/atlasNext(Guest)?On/.test(pub)) throw Error('app-shell.mjs: 공개본에 없는 atlasNextOn을 부른다');
  return text;
}
// world-learning-ui.mjs도 공개본(Atlas 선택 공개 전 판)과 master의 내보내기 줄이 달라 3방향 합침이 겹친다. 동아리장 알림의
// 짧은 진단 문(clubCheck) 한 토막과 내보내기 이름 하나만 「공개본의 이 글 → 이렇게」로 얹는다. 공개본에 Atlas 새 길(homePhase)이 없으면 그 줄을 뺀다.
function learningRecipe(pub) {
  if (pub.includes('async function clubCheck(')) return pub;
  const endText = lf(git('show', `${END}:experiences/synk-world-app/world-learning-ui.mjs`).toString());
  const b0 = endText.indexOf(' // 동아리 튜터의 첫 실력 파악'), b1 = endText.indexOf(' // 진단 판 한 바퀴(', b0);
  if (b0 < 0 || b1 < 0) throw Error('world-learning-ui.mjs: 끝 판에서 clubCheck 토막을 못 찾음');
  let block = endText.slice(b0, b1);
  // 새 길 줄: clubCheck는 판으로, clubMap(11-25)은 지도 없음으로 — 공개본에 Atlas 새 길(homePhase)이 없으면 둘 다 뺀다
  const phases = ["  if(homePhase()!=='old')return {status:'board'};\n", "  if(homePhase()!=='old')return null;\n"];
  if (!/\bfunction homePhase\(/.test(pub)) for (const phase of phases) { if (block.split(phase).length !== 2) throw Error('world-learning-ui.mjs: 동아리 토막의 새 길 줄이 바뀜'); block = block.replace(phase, ''); }
  for (const name of ['readCoach', 'positionData', 'finishSet', 'evidenced', 'bankReady', 'diagnosed', 'refresh', 'audioUrl', 'prepare'])
    if (!new RegExp(`\\b(?:function|const|let)\\s+${name}\\b|[,{(]\\s*${name}\\s*=`).test(pub)) throw Error(`world-learning-ui.mjs: 공개본에 clubCheck가 부르는 ${name}이 없다`);
  const at = ' // 진단 판 한 바퀴(', exp = 'practice:startPractice,';
  if (pub.split(at).length !== 2) throw Error('world-learning-ui.mjs: 공개본에서 진단 판 머리 주석을 못 찾음');
  const ret = pub.lastIndexOf('\n return {'), e = pub.indexOf(exp, ret);
  if (ret < 0 || e < 0 || pub.indexOf(exp, e + 1) >= 0) throw Error('world-learning-ui.mjs: 공개본 내보내기 줄에서 practice:startPractice를 못 찾음');
  const text = pub.replace(at, block + at);
  const r2 = text.lastIndexOf('\n return {'), e2 = text.indexOf(exp, r2);
  return text.slice(0, e2 + exp.length) + 'clubCheck,clubMap,' + text.slice(e2 + exp.length);
}
// 서울행 내 길의 동아리장 알림 갈고리(11-24)는 다른 일의 커밋(f69a3b9e2 승급 오디션 자리)에 함께 실려 「WORLD 첫날 끝」 커밋으로는 못 집는다.
// import 한 줄과 1화 전 시작 단추 묶음만 「공개본의 이 글 → 끝 판의 글」로 얹는다.
function roadRecipe(text) {
  if (text.includes('clubWanted')) return text;
  const endText = lf(git('show', `${END}:experiences/seoul-arrival/app.mjs`).toString());
  const imp = "import {createNameTrace,nameSyllables,signSvg} from './name-trace.mjs';\n", add = "import {clubCall,clubWanted} from './club-call.mjs';\n";
  if (!endText.includes(imp + add) || text.split(imp).length !== 2) throw Error('seoul-arrival/app.mjs: import 줄을 못 맞춤');
  const from = "<button class=\"back-btn\" id=\"goHome\" type=\"button\">${L(HOST?.front?.()?'오늘은 여기까지':'우리 동네 먼저 둘러보기')}</button>`}</div>`;\n  $('#startEp').onclick=playScene;$('#goHome').onclick=leave;\n";
  const t0 = endText.indexOf("${HOST?.front?.()&&clubWanted()?'':`<button class=\"back-btn\" id=\"goHome\""), t1 = endText.indexOf("  $('#road').classList.toggle('calm'", t0);
  if (t0 < 0 || t1 < 0) throw Error('seoul-arrival/app.mjs: 끝 판에서 동아리장 알림 갈고리를 못 찾음');
  if (text.split(from).length !== 2) throw Error('seoul-arrival/app.mjs: 공개본에서 1화 전 시작 단추 묶음을 못 찾음');
  return text.replace(imp, imp + add).replace(from, endText.slice(t0, t1));
}
// 다리가 활동 이름을 화면 언어로 바꿀 때 부르는 home.planLabel은 master(Atlas 커밋)에서만 내보낸다. 공개본에 함수는 있으니 내보내기 한 줄만 얹는다(Fable P2-1).
// 그리고 다리 · 앱 셸 앞면 묶음이 부르는 home 이름이 후보 home 객체에 다 있는지 본다(import 이름 대조는 속성 부르기를 보지 않는다).
function homeExtra(text) {
  const line = 'planLabel:next=>planLabel(next),';
  if (!lf(git('show', `${END}:experiences/brand-opening/home.mjs`).toString()).includes(line)) throw Error('home.mjs: 끝 판에 planLabel 내보내기가 없다');
  if (!/^function planLabel\(/m.test(text)) throw Error('home.mjs: 공개본에 planLabel 함수가 없다');
  if (!text.includes(line)) {
    const a = '\n showPlay:()=>showPlay(),';
    if (text.split(a).length !== 2) throw Error('home.mjs: 후보에서 showPlay 내보내기 줄을 못 찾음');
    text = text.replace(a, `\n ${line}${a.slice(1)}`);
  }
  const o0 = text.indexOf('export const home={'), o1 = text.indexOf('\n};', o0);
  if (o0 < 0 || o1 < 0) throw Error('home.mjs: 후보에서 home 객체를 못 찾음');
  const obj = text.slice(o0, o1);
  const shell = lf(git('show', `${END}:experiences/synk-world-app/app-shell.mjs`).toString()), s0 = shell.indexOf('// 첫날 끝 · 맞춤 앞면(1차, 결정 11-19)');
  const callers = lf(git('show', `${END}:experiences/synk-world-app/world-front-entry.mjs`).toString()) + shell.slice(s0, shell.indexOf("note:t('goal.consent.note')};}});", s0));
  for (const name of new Set([...callers.matchAll(/\bhome\.([a-zA-Z]+)/g)].map(m => m[1])))
    if (!new RegExp(`(?:^|[\\s,{])${name}\\s*[:,(]`, 'm').test(obj)) throw Error(`home.mjs: 다리가 부르는 home.${name}이 후보 home 객체에 없다`);
  return text;
}
for (const [src, rel] of MOD) {
  const pub = await live(rel);
  let cand = rel === 'app-shell.mjs' ? shellRecipe(pub) : rel === 'world-learning-ui.mjs' ? learningRecipe(pub) : merge3(pub, rw(lf(git('show', `${BASE}:${src}`).toString()), rel), rw(mineOnly(src), rel), rel);
  if (rel === 'brand-opening/home.mjs') cand = homeExtra(cand);
  if (rel === 'seoul-arrival/app.mjs') cand = roadRecipe(cand);
  if (cand === pub) continue;
  write('base', rel, pub); write('new', rel, cand); items.push('world/' + rel);
}
// 레슨 글(world/life-content.mjs · life-content-lang.mjs)은 싣지 않는다. 11-20에 한 번 맞춰 올렸고(사이트 1f634d9e),
// 11-23부터는 생활 원고 2단이 레슨 화면 묶음과 함께 따로 공개한다. 앞면은 그 글의 첫 레슨 세 문장을 읽을 뿐이라
// 이 도구는 앞면 갈고리와 앞면 파일만 대조한다(레슨 글 후보를 얹은 앞면은 qa/흐름.mjs --후보로 본다).
// 새 파일: 다리 + 틀 폴더(시험 · 설계 문서 · 견줌 자료는 빼고 — 빌드의 거름과 같다). 공개본에 이미 같은 바이트로 있으면 뺀다(공개 뒤 다시 돌릴 때).
const liveBytes = async rel => { const r = await fetch(`https://synk.im/world/${rel}?probe=${Date.now()}`, {cache: 'no-store'}); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
const lastText = (src, rel) => { try { return rw(lf(execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${LAST}:${src}`], {maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore']}).toString()), rel); } catch { return null; } };
async function addNew(rel, data, src = null, fix = t => t) {
  const pubBuf = await liveBytes(rel);
  if (pubBuf && pubBuf.equals(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'))) return;   // 이미 같은 바이트로 공개됨(공개 뒤 다시 돌릴 때)
  if (src && typeof data === 'string' && pubBuf) {
    const pub = lf(pubBuf.toString('utf8')), was = lastText(src, rel);
    if (was === null) throw Error(`${rel}: 공개본에 있는데 앞 공개판(${LAST.slice(0, 9)})에는 없다 — 다른 일이 만든 파일인지 본다`);
    if (pub !== fix(was)) data = merge3(pub, fix(was), data, rel);
  }
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  if (pubBuf && pubBuf.equals(buf)) return;
  const f = path.join(OUT, 'new', 'world', rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, buf);
  if (pubBuf) { const b = path.join(OUT, 'base', 'world', rel); fs.mkdirSync(path.dirname(b), {recursive: true}); fs.writeFileSync(b, pubBuf); }
  items.push('world/' + rel);
}
const entry = rw(lf(git('show', `${END}:experiences/synk-world-app/world-front-entry.mjs`).toString()), 'world-front-entry.mjs');
if (!/export const FRONT_AUTO=(true|false);/.test(entry)) throw Error('스위치 줄을 못 찾음');   // 공개 뒤 master가 켜져 있어도 같은 재료
const frontOn = t => t.replace(/export const FRONT_AUTO=(true|false);/, 'export const FRONT_AUTO=true;');
await addNew('world-front-entry.mjs', frontOn(entry), 'experiences/synk-world-app/world-front-entry.mjs', frontOn);
// 동아리장 알림(11-24): 다리와 내 길 알림은 새 파일이라 끝 판 그대로(빌드의 경로 고쳐 쓰기)
for (const [src, rel] of [['experiences/synk-world-app/world-front-club.mjs', 'world-front-club.mjs'], ['experiences/synk-world-app/world-front-why.mjs', 'world-front-why.mjs'], ['experiences/seoul-arrival/club-call.mjs', 'seoul-arrival/club-call.mjs']])
  await addNew(rel, rw(lf(git('show', `${END}:${src}`).toString()), rel), src);
for (const f of git('ls-tree', '-r', '--name-only', END, 'experiences/world-front/').toString().trim().split('\n')) {
  const rel = f.slice('experiences/'.length);
  if (/^world-front\/(?:qa\/|.*\.test\.mjs$|.*\.md$|assets\/.*\.(?:txt|json)$)/.test(rel)) continue;
  const bytes = git('show', `${END}:${f}`);
  await addNew(rel, /\.(mjs|js|css|html)$/.test(rel) ? rw(lf(bytes.toString('utf8')), rel) : bytes, f);
}
fs.writeFileSync(path.join(OUT, '항목.txt'), items.join('\n') + '\n');
let cand = path.join(OUT, '후보'); for (let n = 2; fs.existsSync(cand); n++) cand = path.join(OUT, '후보' + n);
const posix = p => p.replaceAll('\\', '/');
console.log(`끝 ${git('rev-parse', '--short', END).toString().trim()} · 바탕 ${BASE.slice(0, 9)} · 이 일의 커밋 ${mine.length}개 · 항목 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(cand)].join(' '));
