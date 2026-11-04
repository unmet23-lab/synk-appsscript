'use strict';
// 환승 러시 공개 후보를 만든다(2026-11-04, 말 랠리 공개후보.cjs에서). 커밋 하나를 git archive로 꺼내 tools/build-world-app-public.mjs로 빌드한 뒤 이 게임 폴더에서 라이브와 달라진 파일만 고른다.
// master에는 아직 공개하지 않은 다른 게임 줄이 함께 있어 공용 파일은 빌드 판을 쓰지 않는다: 라이브 판을 base/에, 라이브 판 + 환승 러시 줄을 new/에 둔다(현장 노트 배포 · 공개).
//   node experiences/subway-rush/qa/공개후보.cjs <커밋> --설정 <world-config.json> [--밖 <폴더>] [--빌드재사용]
//   나가는 것: <밖>/base · <밖>/new (world/ 아래) + 목록.json. 그 뒤: node tools/공개.js 올리기 --원본 <밖>/new --기준폴더 <밖>/base <목록.json의 경로…> --전부 --후보폴더 <폴더>
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ref = args[0];
if (!ref || !opt('--설정')) throw Error('사용법은 파일 머리글');
const SHARED = 공용작업본(ROOT), CONFIG = path.resolve(opt('--설정'));
const OUT = path.resolve(opt('--밖') || path.join(SHARED, '.tmp', 'subway-rush-20261104', '공개'));
const POLICY = process.env.SYNK_POLICY_DIR || path.join(SHARED, '..', 'synk-policy');
const PATHS = ['experiences/brand-opening', 'experiences/synk-world-app', 'experiences/hangul-stage', 'experiences/korean-runner', 'experiences/korean-rhythm', 'experiences/synk-world-home', 'experiences/synk-account', 'experiences/synk-town', 'experiences/play-common', 'experiences/korean-racing', 'experiences/order-rush', 'experiences/blank-slice', 'experiences/snap-words', 'experiences/talk-rally', 'experiences/subway-rush', 'experiences/drama', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'atlas', 'strata', 'tools', 'package.json'];
const OUTSIDE = ['experiences/synk-town/assets/district', 'experiences/synk-world-home/assets/avatar-textiles-v1', 'experiences/drama/pilot/media', 'experiences/talk-rally/assets/world/cast/taeo/clips'];
const OUTSIDE_FILES = ['experiences/korean-racing/assets/coastal-rocks-v6.glb'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

function build() {
  const src = path.join(OUT, '_src'), out = path.join(OUT, 'build');
  fs.rmSync(src, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
  const tool = execFileSync('git', ['-C', ROOT, 'show', `${ref}:tools/build-world-app-public.mjs`], { maxBuffer: 1 << 26 }).toString('utf8');
  const used = [...tool.matchAll(/experiences(?:'\s*,\s*'|\/)([a-z0-9-]+)/g)].map((m) => `experiences/${m[1]}`);
  const have = [...new Set([...PATHS, ...used])].filter((p) => { try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${ref}:${p}`], { stdio: 'ignore' }); return true; } catch { return false; } });
  const tar = path.join(OUT, '_src.tar');
  execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', tar, ref, ...have]);
  execFileSync('tar', ['-xf', path.relative(src, tar).replace(/\\/g, '/')], { cwd: src, stdio: 'inherit' });   // 절대 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  fs.rmSync(tar);
  for (const to of OUTSIDE) { fs.mkdirSync(path.join(src, to), { recursive: true }); fs.cpSync(path.join(SHARED, to), path.join(src, to), { recursive: true, force: false }); }
  for (const f of fs.readdirSync(path.join(SHARED, 'experiences/brand-opening/assets')).filter((n) => /^world-menu-.*\.mp4$/.test(n))) if (!fs.existsSync(path.join(src, 'experiences/brand-opening/assets', f))) fs.copyFileSync(path.join(SHARED, 'experiences/brand-opening/assets', f), path.join(src, 'experiences/brand-opening/assets', f));
  for (const f of OUTSIDE_FILES) fs.copyFileSync(path.join(SHARED, f), path.join(src, f));
  fs.symlinkSync(path.join(SHARED, 'node_modules'), path.join(src, 'node_modules'), 'junction');
  // 남의 파일 주석의 도구 이름은 공개 빌드가 멈춘다 — 내 후보에 안 드는 파일이면 이 사본에만 같은 고침을 넣는다(현장 노트 배포 · 공개).
  { const strings = path.join(src, 'experiences/drama/pilot/strings.mjs'), text = fs.readFileSync(strings, 'utf8'); fs.writeFileSync(strings, text.replace('역번역 → Fable → 아르곤 세 겹 확인', '세 겹 확인')); }
  const r = spawnSync(process.execPath, ['tools/build-world-app-public.mjs', '--config', CONFIG, '--out', '.tmp/out'], { cwd: src, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (!r.stdout.includes('{')) throw Error(`빌드 실패: ${(r.stderr || r.stdout).slice(-1500)}`);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  // 이 후보에는 이 게임 폴더만 싣는다. master의 다른 미공개 게임에 걸린 참조는 알리기만 한다.
  const mine = (j.missing || []).filter((m) => /^(?:subway-rush|brand-opening)\//.test(m.from));
  if (mine.length || (j.publicToolNames || []).length || !fs.existsSync(path.join(src, '.tmp/out/world/subway-rush/index.html'))) throw Error(`빌드 ok:false — 빠진 참조 ${JSON.stringify(mine).slice(0, 600)} · 도구 이름 ${JSON.stringify(j.publicToolNames).slice(0, 400)}`);
  if (!j.ok) console.log('다른 게임에 걸린 빌드 알림(이 후보에 안 든다):', JSON.stringify(j.missing).slice(0, 400));
  console.log('빌드', ref, '파일', j.files, '크기', j.totalBytes);
  fs.renameSync(path.join(src, '.tmp/out'), out);
  fs.unlinkSync(path.join(src, 'node_modules'));
  fs.rmSync(src, { recursive: true, force: true });
}

// 공용 파일: 라이브 판 + 환승 러시 줄. 앵커가 없거나 둘 이상이면(라이브가 움직이면) 멈춘다. done 낱말이 이미 라이브에 있으면 그 파일은 건드리지 않는다.
const live = (rel) => execFileSync('git', ['-C', POLICY, 'show', `origin/main:${rel}`], { maxBuffer: 1 << 28 }).toString('utf8');
function edit(text, rel, pairs) {
  const crlf = text.includes('\r\n'); let s = text.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw Error(`${rel}: 앵커가 하나가 아니다 — ${a.slice(0, 70)}`);
    s = s.replace(a, () => b);
  }
  return crlf ? s.replace(/\n/g, '\r\n') : s;
}
// 계획 후보(11-05): 공개 묶음 둘은 master 빌드가 아니라 라이브 판이라, world-learning-plan.mjs의 후보 한 줄과 같은 동작을 도움 함수 하나로 끼운다.
// 잠금은 놀이 해금 표의 subway 줄(레슨 하나)과 같다. 문항 표는 그 커밋의 plan-items.mjs다. 끝에서 원본 빌드와 결과를 대조한다(planCheck).
const ascii = (text) => text.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
const planItems = () => {
  const text = execFileSync('git', ['-C', ROOT, 'show', `${ref}:experiences/subway-rush/plan-items.mjs`], { maxBuffer: 1 << 24 }).toString('utf8');
  return text.slice(text.indexOf('Object.freeze(['), text.lastIndexOf(']);') + 2).replace(/\s*\n\s*/g, '');
};
const helper = () => ascii(`var SUBWAY_PLAN_ITEMS=${planItems()};function pushSubwayPlan(candidates,settings,access,presentation,finished){if(!(finished>=1))return;const upper=Number(settings?.targetGrade)>=3,targets=SUBWAY_PLAN_ITEMS.filter(item=>upper||!item.skillId.startsWith("ko2.")).map(item=>({id:"subway-rush."+item.id,skillIds:[item.skillId],difficulty:item.difficulty,modality:"listening",responseFormat:"single-choice",familyKeys:["subway-rush."+item.family+".v1"],itemKey:"subway-rush."+item.id+".v1",conceptIds:[]}));candidates.push({id:"world.play.subway",label:"환승 러시 · 안내방송 듣고 갈아타기",route:"game",gameId:"subway",minutes:3,minutesEstimated:!0,targets,goals:["exam","prepare","listening","travel"],audioRequired:!0,modality:"listening",presentation,...access("subway")})}\n`);
const timeName = (text, rel) => { const m = text.match(/pack\.lessons\.find\(\(?\w+\)?\s*=>\s*!(\w+)\(source\.lessons/); if (!m) throw Error(`${rel}: 시각 검사 이름을 못 찾았다`); return m[1]; };
const SHARED_EDITS = {
  'world/brand-opening/world-strings.mjs': { done: 'plan.game.subway', pairs: () => [
    [" 'plan.game.hangul':{ko:", " 'plan.game.subway':{ko:'환승 러시 · 안내방송 듣고 갈아타기',en:'Transfer Rush · follow station announcements',mn:'Метро дамжин суух · буудал зарлахыг сонсох'},\n 'plan.game.hangul':{ko:"],
  ] },
  'world/app-shell.mjs': { done: 'subway-rush/?grade=', pairs: () => [
    [" // 환승 러시(11-04): 홈 「놀이」가 해금 표로 연 뒤에만 여기로 온다.\n subway:{get title(){return t('game.subway.title');},path:'subway-rush/'},",
     " // 환승 러시(11-04): 홈 「놀이」와 이번 주 계획 · 튜터 후보가 해금 표로 연 뒤에만 여기로 온다. 찰칵 낱말처럼 시험 목표 급을 넘긴다 — 3급 이상이면 고른 난도가 없을 때 바쁜 아침부터(level.mjs).\n subway:{get title(){return t('game.subway.title');},get path(){let grade=0;try{grade=Number(life.progress?.learningProfileValues?.().targetGrade)||0;}catch{grade=0;}return grade>=3?`subway-rush/?grade=${grade}`:'subway-rush/';}},"],
  ] },
  'world/world-account.bundle.mjs': { done: 'world.play.subway', pairs: (text, rel) => [
    ['function buildWorldLearningCandidates(', helper() + 'function buildWorldLearningCandidates('],
    ['...access("hangul")}),candidates}', `...access("hangul")}),pushSubwayPlan(candidates,settings,access,presentationFor(settings),PACKS.flatMap(pack=>pack.lessons).filter(lesson=>${timeName(text, rel)}(source.lessons?.[lesson.id]?.completedAt)).length),candidates}`],
  ] },
  'world/brand-opening/content/life-standalone.mjs': { done: 'world.play.subway', pairs: (text, rel) => [
    ['function buildWorldLearningCandidates(', helper() + 'function buildWorldLearningCandidates('],
    ['      ...access("hangul")\n    }\n  );\n  return candidates;', `      ...access("hangul")\n    }\n  );\n  pushSubwayPlan(candidates, settings, access, presentationFor(settings), PACKS.flatMap((pack) => pack.lessons).filter((lesson2) => ${timeName(text, rel)}(source.lessons?.[lesson2.id]?.completedAt)).length);\n  return candidates;`],
  ] },
};

fs.mkdirSync(OUT, { recursive: true });
if (!args.includes('--빌드재사용')) build();
const BUILD = path.join(OUT, 'build', 'world'), NEW = path.join(OUT, 'new', 'world'), BASE = path.join(OUT, 'base', 'world');
fs.rmSync(path.join(OUT, 'new'), { recursive: true, force: true }); fs.rmSync(path.join(OUT, 'base'), { recursive: true, force: true });
execFileSync('git', ['-C', POLICY, 'fetch', '-q', 'origin']);
// 이 게임 폴더: 라이브와 바이트가 다른 파일만 싣는다(blob 번호로 견준다 — 부분 클론이라 안 받고 잰다). 라이브에만 있는 파일은 멈춘다.
const blobId = (bytes) => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const liveGame = new Map(execFileSync('git', ['-C', POLICY, 'ls-tree', '-r', '-z', 'origin/main', 'world/subway-rush'], { maxBuffer: 1 << 26 }).toString('utf8').split('\0').filter(Boolean).map((line) => { const [meta, file] = line.split('\t'); return [file.slice('world/'.length), meta.split(' ')[2]]; }));
const put = (root, rel, bytes) => { const to = path.join(root, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, bytes); };
const gameFiles = walk(path.join(BUILD, 'subway-rush')).map((file) => path.relative(BUILD, file).replace(/\\/g, '/'));
const gone = [...liveGame.keys()].filter((rel) => !gameFiles.includes(rel));
if (gone.length) throw Error('라이브에만 있는 게임 파일: ' + gone.slice(0, 8).join(' '));
const gameChanged = [];
for (const rel of gameFiles) {
  const bytes = fs.readFileSync(path.join(BUILD, rel));
  if (liveGame.get(rel) === blobId(bytes)) continue;
  gameChanged.push(rel); put(NEW, rel, bytes);
  if (liveGame.has(rel)) put(BASE, rel, execFileSync('git', ['-C', POLICY, 'show', `origin/main:world/${rel}`], { maxBuffer: 1 << 28 }));
}
const shared = [];
for (const [rel, { done, pairs }] of Object.entries(SHARED_EDITS)) {
  const text = live(rel), inner = rel.replace(/^world\//, '');
  if (text.includes(done)) continue;   // 이미 라이브에 있으면 건드리지 않는다
  shared.push(rel);
  put(BASE, inner, text); put(NEW, inner, edit(text, rel, pairs(text, rel)));
}
// 끼운 판이 바로 읽히는지(문법 오류 · 쉼표 빠짐을 공개 전에 잡는다) + 라이브 묶음에 끼운 계획 후보가 원본 빌드와 같은 결과를 내는지.
for (const rel of shared) execFileSync(process.execPath, ['--check', path.join(OUT, 'new', rel)], { stdio: 'inherit' });
if (shared.includes('world/world-account.bundle.mjs')) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '계획후보대조.mjs'), path.join(OUT, 'new/world/world-account.bundle.mjs'), path.join(ROOT, 'experiences/synk-world-app/world-learning-plan.mjs')], { encoding: 'utf8', maxBuffer: 1 << 24 });
  console.log((r.stdout || '').trim());
  if (r.status !== 0) throw Error('계획 후보 대조 실패: ' + (r.stderr || r.stdout).slice(-1200));
}
const files = walk(path.join(OUT, 'new', 'world')).map((f) => path.relative(path.join(OUT, 'new'), f).replace(/\\/g, '/'));
const noWorldQa = files.filter((f) => /\/qa\/|\.test\.mjs$|\.md$|review-items|plan-items/.test(f));
if (noWorldQa.length) throw Error('실으면 안 되는 파일: ' + noWorldQa.slice(0, 8).join(' '));
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ ref, shared, items: files, files: files.length, bytes: files.reduce((n, f) => n + fs.statSync(path.join(OUT, 'new', f)).size, 0) }, null, 1) + '\n');
console.log(fs.readFileSync(path.join(OUT, '목록.json'), 'utf8'));
