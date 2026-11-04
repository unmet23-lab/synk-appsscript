'use strict';
// 게시판 해독 공개 후보(2026-11-04, 환승 러시 · 찰칵 낱말 후보에서): origin/master에는 아직 공개하지 않은 다른 게임 줄이 함께 있어 공용 파일은 빌드 판을 쓰지 않는다.
// base = 지금 공개본 파일, new = 그 파일 + 게시판 해독 줄 + 게임 폴더 + 놀이 카드. tools/공개.js가 「공개본 + (base → new)」로 얹고 ?v=도 알아서 올린다.
// 계정 묶음은 공개본이 옛 판(11-02 핫픽스)이라 다시 빌드한 판을 얹으면 남의 미공개가 함께 나간다 → 공개본 묶음에 topik2Near만 넣는다. 문항 통과 표 줄은 넣지 않는다 — 이 게임은 Trail에 ko2 사건을 남기지 않는다(설계 6절).
//   node experiences/board-decode/qa/공개후보.cjs [커밋=HEAD] [--판 <글자>]
//   나가는 것: 공용 작업본 .tmp/board-decode-20261104/공개[-글자]/{base,new}/world/… + 목록.json, 끝에 공개.js 미리 보기 명령을 찍는다.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ref = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--판') || 'HEAD';
const SHARED = 공용작업본(ROOT), 판 = opt('--판');
const OUT = path.join(SHARED, '.tmp', 'board-decode-20261104', `공개${판 ? `-${판}` : ''}`);
const POLICY = process.env.SYNK_POLICY_DIR || path.join(SHARED, '..', 'synk-policy');
const GAME = 'experiences/board-decode', CARD = 'experiences/brand-opening/assets/world-play/board-decode.webp';
const KEEP = (rel) => !/^(?:qa\/|.*\.test\.mjs$|.*\.md$|server\.mjs$|review-items\.mjs$)/.test(rel);   // tools/build-world-app-public.mjs의 게시판 해독 줄과 같다
const TOOL_NAMES = /suno|higgsfield|nano banana|midjourney|gpt[- ]image|edge[-_ ]tts|elevenlabs|typecast|gemini-[0-9][\w.-]*tts|ko-KR-[A-Za-z]+Neural|made with (suno|udio)|gpt[- ]?이미지|지피티|codex|seedance|\bkling|demucs|타입캐스트|힉스필드|나노 ?바나나|synk-vendor|(?<![\w.-])\.tmp[\\/]|(?<![가-힣])(?:클로드|제미나이|수노|페이블|아르곤|아스트라)|\b(?:fable|argon)\b/i;

// 공개 저장소는 blob 없는 사본이라 받을 때 망을 탄다. GitHub가 잠깐 거절해도 되풀이한다.
function git(cwd, list, opts = {}) {
  let last = null;
  for (let i = 0; i < 6; i += 1) {
    try { return execFileSync('git', ['-C', cwd, ...list], { maxBuffer: 1 << 29, stdio: ['ignore', 'pipe', 'pipe'], ...opts }); } catch (e) { last = e; execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},5000)']); }
  }
  throw last;
}
git(POLICY, ['fetch', '-q', 'origin']);
const liveCommit = git(POLICY, ['rev-parse', '--short', 'origin/main']).toString().trim();
const live = (rel) => git(POLICY, ['show', `origin/main:${rel}`]);
const own = (rel) => git(ROOT, ['-c', 'core.autocrlf=false', 'show', `${ref}:${rel}`]).toString('utf8').replace(/\r\n/g, '\n');
const ownLines = (rel, test) => { const rows = own(rel).split('\n').filter(test); if (!rows.length) throw Error(`${rel}: 내 줄이 없다`); return rows; };

const swap = (s, rel, a, b) => { if (s.split(a).length !== 2) throw Error(`${rel}: 앵커가 하나가 아니다 — ${a.slice(0, 70)}`); return s.replace(a, () => b); };
const before = (s, rel, a, add) => swap(s, rel, a, `${add}${a}`);
const after = (s, rel, a, add) => swap(s, rel, a, `${a}${add}`);

const EDITS = {
  'world/brand-opening/play-unlocks.mjs': (s, rel) => {
    const at = s.indexOf('export const PLAY_UNLOCKS'), end = s.indexOf('\n});', at);
    if (at < 0 || end < 0) throw Error(`${rel}: 해금 표를 못 찾았다`);
    const mine = own('experiences/brand-opening/play-unlocks.mjs').split('\n'), i = mine.findIndex((l) => l.startsWith('  board: Object.freeze('));
    if (i < 0) throw Error(`${rel}: 내 줄이 없다`);
    s = `${s.slice(0, end)}\n${mine.slice(i - 2, i + 1).join('\n')}${s.slice(end)}`;
    s = swap(s, rel, 'export function playRecord(learningData) {', 'export function playRecord(learningData, extra = null) {');
    s = swap(s, rel, '  return Object.freeze({\n    cafeVisits:', '  return Object.freeze({\n    topik2Near: extra?.topik2Near === true,\n    cafeVisits:');
    s = swap(s, rel, 'export function playState(id, record) {', 'export function playState(id, record, seen = null) {');
    s = after(s, rel, '  if (!rule) return { open: true };\n', '  if (rule.sticky && Array.isArray(seen) && seen.includes(id)) return { open: true };\n');
    s = swap(s, rel, 'return open ? { open: true } : { open: false, where: rule.where };', 'return open ? { open: true } : { open: false, where: rule.where, ...(rule.lockOnly ? { lockOnly: true } : {}) };');
    return s;
  },
  'world/brand-opening/home.mjs': (s, rel) => {
    const src = 'experiences/brand-opening/home.mjs', mine = own(src).split('\n');
    const line = (start) => { const hit = mine.find((l) => l.startsWith(start)); if (!hit) throw Error(`${src}: ${start}`); return hit; };
    const at = s.indexOf('const games={'), end = s.indexOf('\n};', at);
    if (at < 0 || end < 0) throw Error(`${rel}: 놀이 표를 못 찾았다`);
    if (s.slice(at, end).endsWith(',')) throw Error(`${rel}: 놀이 표 끝에 쉼표가 있다`);
    const board = mine.findIndex((l) => l.startsWith(' board:{get title()'));
    if (board < 0) throw Error(`${rel}: 내 줄이 없다`);
    s = `${s.slice(0, end)},\n${mine.slice(board - 1, board + 1).join('\n').replace(/,$/, '')}${s.slice(end)}`;
    s = swap(s, rel, 'let learningUI=null,learningLoader=null,education=null,reminders=null;', 'let learningUI=null,learningLoader=null,education=null,reminders=null,playLevel=null;');
    s = swap(s, rel, ' const state=playState(id,playRecord(learningData));', ' const state=playState(id,playRecordNow(),seenPlays());');
    s = swap(s, rel, " if(!state.open){toast(t('play.locked',{where:t(state.where)}));return;}   // 잠긴 놀이는 이야기에서 연다", line(' if(!state.open){toast(lockText(state));'));
    const fns = [line('// 해금에 쓰는 기록: 생활 진도'), line('function playRecordNow()'), line('const lockText=state=>')].join('\n');
    s = before(s, rel, 'function seenPlays(){', `${fns}\n`);
    s = swap(s, rel, 'const record=playRecord(learningData),seen=seenPlays(),fresh=[];', 'const record=playRecordNow(),seen=seenPlays(),fresh=[];');
    s = swap(s, rel, "const state=playState(id,record),lock=state.open?'':t('play.locked',{where:t(state.where)});", "const state=playState(id,record,seen),lock=state.open?'':lockText(state);");
    s = swap(s, rel, 'connectEducation(value){education=value;},connectReminders', 'connectEducation(value){education=value;},connectPlayLevel(value){playLevel=value;},connectReminders');
    return s;
  },
  'world/brand-opening/world-strings.mjs': (s, rel) => {
    const rows = ownLines('experiences/brand-opening/world-strings.mjs', (l) => /^ '(?:game\.board\.(?:title|detail)|play\.locked\.level)':/.test(l));
    if (rows.length !== 3) throw Error(`${rel}: 화면 글 셋이 아니다`);
    return before(s, rel, " 'play.locked':{ko:", `${rows.join('\n')}\n`);
  },
  'world/app-shell.mjs': (s, rel) => {
    const mine = own('experiences/synk-world-app/app-shell.mjs').split('\n');
    const level = mine.findIndex((l) => l.startsWith(' home.connectPlayLevel?.(')), board = mine.findIndex((l) => l.startsWith(' board:{get title()'));
    if (level < 0 || board < 0) throw Error(`${rel}: 내 줄이 없다`);
    s = swap(s, rel, 'value=>{value.dispose();home.connectEducation?.(null);});', 'value=>{value.dispose();home.connectEducation?.(null);home.connectPlayLevel?.(null);});');
    s = after(s, rel, ' home.connectEducation?.(education);window.__synkEducation=education;\n', `${mine.slice(level - 1, level + 1).join('\n')}\n`);
    const snap = s.split('\n').find((l) => l.startsWith(' snap:{get title()'));
    if (!snap) throw Error(`${rel}: 찰칵 낱말 줄이 없다`);
    return after(s, rel, `${snap}\n`, `${mine.slice(board - 1, board + 1).join('\n')}\n`);
  },
  // 공개본 묶음의 이름(DAY2 · record2)을 읽어 내 판의 함수를 그 이름으로 넣는다.
  'world/world-account.bundle.mjs': (s, rel) => {
    const built = own('experiences/synk-world-app/world-account.bundle.mjs');
    const from = built.indexOf('var TOPIK2_NEAR='), to = built.indexOf('var PLACEMENT_LEVELS=', from);
    if (from < 0 || to < 0) throw Error(`${rel}: 내 판 묶음에 함수가 없다`);
    const fn = s.indexOf('function placeTownLevels('), body = s.slice(fn, fn + 900);
    const day = body.match(/TOWN_CHECK_POLICY\.windowDays\*(\w+)/)?.[1], rec = body.match(/filter\(row=>(\w+)\(row\.event\)/)?.[1], tr = body.match(/(\w+)\.default\.createIndex/)?.[1];
    const ownBody = built.slice(built.indexOf('function placeTownLevels('), built.indexOf('function placeTownLevels(') + 900);
    const ownDay = ownBody.match(/TOWN_CHECK_POLICY\.windowDays\*(\w+)/)?.[1], ownRec = ownBody.match(/filter\(row=>(\w+)\(row\.event\)/)?.[1], ownTr = ownBody.match(/(\w+)\.default\.createIndex/)?.[1];
    if (!day || !rec || !tr || !ownDay || !ownRec || !ownTr) throw Error(`${rel}: 묶음 안 이름을 못 읽었다`);
    const code = built.slice(from, to).replaceAll(`windowDays*${ownDay}`, `windowDays*${day}`).replaceAll(`${ownRec}(row.event)`, `${rec}(row.event)`).replaceAll(`${ownTr}.default.createIndex`, `${tr}.default.createIndex`);
    s = before(s, rel, 'var PLACEMENT_LEVELS=', code);
    s = swap(s, rel, 'TOWN_CHECK_POLICY:()=>TOWN_CHECK_POLICY,placeTownLevels:()=>placeTownLevels,', 'TOPIK2_NEAR:()=>TOPIK2_NEAR,TOWN_CHECK_POLICY:()=>TOWN_CHECK_POLICY,placeTownLevels:()=>placeTownLevels,');
    s = swap(s, rel, 'selectTownCheck:()=>selectTownCheck,townCheckAnswers:()=>townCheckAnswers,', 'selectTownCheck:()=>selectTownCheck,topik2Near:()=>topik2Near,townCheckAnswers:()=>townCheckAnswers,');
    return s;
  },
};

fs.rmSync(OUT, { recursive: true, force: true });
const NEW = path.join(OUT, 'new'), BASE = path.join(OUT, 'base');
const put = (root, rel, bytes) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
for (const [rel, edit] of Object.entries(EDITS)) {
  const bytes = live(rel), text = bytes.toString('utf8'), crlf = text.includes('\r\n');
  put(BASE, rel, bytes);
  const next = edit(crlf ? text.replace(/\r\n/g, '\n') : text, rel);
  put(NEW, rel, crlf ? next.replace(/\n/g, '\r\n') : next);
}
const gameFiles = git(ROOT, ['ls-tree', '-r', '--name-only', '-z', ref, `${GAME}/`]).toString('utf8').split('\0').filter(Boolean);
let kept = 0;
for (const file of gameFiles) {
  const rel = file.slice(GAME.length + 1);
  if (!KEEP(rel)) continue;
  put(NEW, `world/board-decode/${rel}`, git(ROOT, ['-c', 'core.autocrlf=false', 'show', `${ref}:${file}`]));
  kept += 1;
}
put(NEW, 'world/brand-opening/assets/world-play/board-decode.webp', git(ROOT, ['show', `${ref}:${CARD}`]));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(NEW);
for (const file of files.filter((f) => /\.mjs$/.test(f))) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
// 새로 얹는 파일에 도구 이름이 없어야 한다(공용 파일은 공개.js가 더한 줄만 본다).
const named = files.filter((f) => /[\\/]board-decode[\\/]/.test(f) && /\.(?:mjs|css|html)$/.test(f)).map((f) => [path.relative(NEW, f), fs.readFileSync(f, 'utf8').match(TOOL_NAMES)?.[0]]).filter(([, hit]) => hit);
if (named.length) throw Error(`도구 이름: ${JSON.stringify(named)}`);
const items = ['world/board-decode', 'world/brand-opening/assets/world-play/board-decode.webp', ...Object.keys(EDITS)];
const list = { ref: git(ROOT, ['rev-parse', '--short', ref]).toString().trim(), live: liveCommit, items, gameFiles: kept, bytes: files.reduce((n, f) => n + fs.statSync(f).size, 0) };
fs.writeFileSync(path.join(OUT, '목록.json'), `${JSON.stringify(list, null, 2)}\n`);
console.log(JSON.stringify(list));
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(NEW), '--기준폴더', posix(BASE), ...items, '--전부', '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
