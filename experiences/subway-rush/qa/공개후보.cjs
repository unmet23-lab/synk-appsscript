'use strict';
// 환승 러시 공개 후보를 만든다(2026-11-04, 말 랠리 공개후보.cjs에서). 커밋 하나를 git archive로 꺼내 tools/build-world-app-public.mjs로 빌드한 뒤 이 게임 폴더와 놀이 카드만 고른다.
// master에는 아직 공개하지 않은 다른 게임 줄이 함께 있어 공용 파일 넷은 빌드 판을 쓰지 않는다: 라이브 판을 base/에, 라이브 판 + 환승 러시 줄을 new/에 둔다(현장 노트 배포 · 공개).
//   node experiences/subway-rush/qa/공개후보.cjs <커밋> --설정 <world-config.json> [--밖 <폴더>] [--빌드재사용]
//   나가는 것: <밖>/base · <밖>/new (world/ 아래) + 목록.json. 그 뒤: node tools/공개.js 올리기 --원본 <밖>/new --기준폴더 <밖>/base <목록.json의 경로…> --전부 --후보폴더 <폴더>
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ref = args[0];
if (!ref || !opt('--설정')) throw Error('사용법은 파일 머리글');
const SHARED = 공용작업본(ROOT), CONFIG = path.resolve(opt('--설정'));
const OUT = path.resolve(opt('--밖') || path.join(SHARED, '.tmp', 'subway-rush-20261104', '공개'));
const POLICY = process.env.SYNK_POLICY_DIR || path.join(SHARED, '..', 'synk-policy');
const PATHS = ['experiences/brand-opening', 'experiences/synk-world-app', 'experiences/hangul-stage', 'experiences/korean-runner', 'experiences/korean-rhythm', 'experiences/synk-world-home', 'experiences/synk-account', 'experiences/synk-town', 'experiences/play-common', 'experiences/korean-racing', 'experiences/order-rush', 'experiences/blank-slice', 'experiences/snap-words', 'experiences/talk-rally', 'experiences/subway-rush', 'experiences/drama', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'atlas', 'strata', 'tools', 'package.json'];
const OUTSIDE = ['experiences/synk-town/assets/district', 'experiences/synk-world-home/assets/avatar-textiles-v1', 'experiences/drama/pilot/media'];
const OUTSIDE_FILES = ['experiences/korean-racing/assets/coastal-rocks-v6.glb'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

function build() {
  const src = path.join(OUT, '_src'), out = path.join(OUT, 'build');
  fs.rmSync(src, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
  const have = PATHS.filter((p) => { try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${ref}:${p}`], { stdio: 'ignore' }); return true; } catch { return false; } });
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
  if (r.status !== 0) throw Error(`빌드 실패: ${(r.stderr || r.stdout).slice(-1500)}`);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  if (!j.ok) throw Error(`빌드 ok:false — 빠진 참조 ${JSON.stringify(j.missing).slice(0, 600)} · 도구 이름 ${JSON.stringify(j.publicToolNames).slice(0, 400)}`);
  console.log('빌드', ref, '파일', j.files, '크기', j.totalBytes);
  fs.renameSync(path.join(src, '.tmp/out'), out);
  fs.unlinkSync(path.join(src, 'node_modules'));
  fs.rmSync(src, { recursive: true, force: true });
}

// 공용 파일 넷: 라이브 판 + 환승 러시 줄. 앵커가 없으면(라이브가 움직이면) 멈춘다.
const live = (rel) => execFileSync('git', ['-C', POLICY, 'show', `origin/main:${rel}`], { maxBuffer: 1 << 28 }).toString('utf8');
function edit(text, rel, pairs) {
  const crlf = text.includes('\r\n'); let s = text.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw Error(`${rel}: 앵커가 없다 — ${a.slice(0, 70)}`); s = s.replace(a, () => b); }
  return crlf ? s.replace(/\n/g, '\r\n') : s;
}
const SHARED_EDITS = {
  'world/brand-opening/play-unlocks.mjs': [
    [`  racing: Object.freeze({ where: 'play.where.directions', open: (record) => record.directionsDone >= 1 }),
});
`, `  racing: Object.freeze({ where: 'play.where.directions', open: (record) => record.directionsDone >= 1 }),
  // 환승 러시: 이야기 자리는 1화 아침인데 드라마 기록이 생활 요약에 없어, 가장 가까운 이야기 기록인 레슨 하나를 마침으로 연다(설계 9절) —
  // 1화에 등굣길 장면이 생기면 그 기록으로 바꾼다.
  subway: Object.freeze({ where: 'play.where.lesson', open: (record) => record.lessons >= 1 }),
});

// 대신하는 놀이가 그 학생에게 열리면 「놀이」 목록에서 그 자리를 이어받는다. 잠겨 있는 동안은 그대로 있어 듣기 놀이가 비지 않는다.
// 게임 자체는 그대로 남는다(WORLD 듣기 확인 도구 · 계획 줄이 쓴다) — 목록의 카드만 바뀐다.
export const PLAY_REPLACED_BY = Object.freeze({ runner: 'subway' });
`],
    [`    cafeVisits: Number(summary.cafe?.completed) || 0,
`, `    cafeVisits: Number(summary.cafe?.completed) || 0,
    lessons: Number(summary.completed) || 0,
`],
    [`/** 놀이 하나의 상태:`, `/** 「놀이」 목록의 차례. 대신하는 놀이가 열렸으면 앞 놀이의 자리에 놓고 앞 놀이는 뺀다. */
export function playOrder(ids, record) {
  const successors = Object.values(PLAY_REPLACED_BY), out = [];
  for (const id of ids) {
    const next = PLAY_REPLACED_BY[id];
    if (next && playState(next, record).open) out.push(next);
    else if (!successors.includes(id) || !playState(id, record).open) out.push(id);
  }
  return out;
}

/** 놀이 하나의 상태:`],
  ],
  'world/brand-opening/home.mjs': [
    [`import {PLAY_UNLOCKS,playRecord,playState} from './play-unlocks.mjs';`, `import {PLAY_UNLOCKS,playRecord,playState,playOrder} from './play-unlocks.mjs';`],
    [`<div class="play-list">\${Object.entries(games).map(([id,g],i)=>{`, `<div class="play-list">\${playOrder(Object.keys(games),record).map(id=>[id,games[id]]).map(([id,g],i)=>{`],
    [`area:'문장을 듣고 답이 있는 길로 옮기는 듣기 연습'}
};`, `area:'문장을 듣고 답이 있는 길로 옮기는 듣기 연습'},
 // 환승 러시(11-04, 캠퍼스 판): 레슨 하나를 마치면 열린다(play-unlocks.mjs). 열린 뒤에는 바람길 카드 자리를 이어받는다.
 subway:{get title(){return t('game.subway.title');},get detail(){return t('game.subway.detail');},label:'LISTEN & GO',path:'../subway-rush/',image:'world-play/subway-rush.webp',area:'지하철 안내방송을 듣고 문·통로·출구 고르기 연습'}
};`],
  ],
  'world/brand-opening/world-strings.mjs': [
    [` 'play.locked':{ko:`, ` 'game.subway.title':{ko:'환승 러시',en:'Transfer Rush',mn:'Метро дамжин суух'},
 'game.subway.detail':{ko:'안내방송을 듣고 갈아타서 첫 수업에 닿아요',en:'Follow the announcements, transfer, and make it to your first class',mn:'Буудал зарлахыг сонсоод метро дамжин сууж, эхний хичээлдээ амжина'},
 'play.locked':{ko:`],
    [` 'play.where.directions':{`, ` 'play.where.lesson':{ko:'첫 학습을 마치면',en:'after your first lesson',mn:'Эхний хичээлээ дуусгахад'},
 'play.where.directions':{`],
    [` 'position.source.order-rush':{ko:'주문 폭주',en:'Order Rush',mn:'Захиалгын шуурга'},
`, ` 'position.source.order-rush':{ko:'주문 폭주',en:'Order Rush',mn:'Захиалгын шуурга'},
 'position.source.subway-rush':{ko:'환승 러시',en:'Transfer Rush',mn:'Метро дамжин суух'},
`],
  ],
  'world/app-shell.mjs': [
    [` racing:{get title(){return t('game.racing.title');},path:'korean-racing/'},
`, ` racing:{get title(){return t('game.racing.title');},path:'korean-racing/'},
 // 환승 러시(11-04): 홈 「놀이」가 해금 표로 연 뒤에만 여기로 온다.
 subway:{get title(){return t('game.subway.title');},path:'subway-rush/'},
`],
  ],
};

fs.mkdirSync(OUT, { recursive: true });
if (!args.includes('--빌드재사용')) build();
const BUILD = path.join(OUT, 'build', 'world'), NEW = path.join(OUT, 'new', 'world'), BASE = path.join(OUT, 'base', 'world');
fs.rmSync(path.join(OUT, 'new'), { recursive: true, force: true }); fs.rmSync(path.join(OUT, 'base'), { recursive: true, force: true });
fs.cpSync(path.join(BUILD, 'subway-rush'), path.join(NEW, 'subway-rush'), { recursive: true });
fs.mkdirSync(path.join(NEW, 'brand-opening/assets/world-play'), { recursive: true });
fs.copyFileSync(path.join(BUILD, 'brand-opening/assets/world-play/subway-rush.webp'), path.join(NEW, 'brand-opening/assets/world-play/subway-rush.webp'));
execFileSync('git', ['-C', POLICY, 'fetch', '-q', 'origin']);
for (const [rel, pairs] of Object.entries(SHARED_EDITS)) {
  const text = live(rel), inner = rel.replace(/^world\//, '');
  fs.mkdirSync(path.dirname(path.join(BASE, inner)), { recursive: true }); fs.mkdirSync(path.dirname(path.join(NEW, inner)), { recursive: true });
  fs.writeFileSync(path.join(BASE, inner), text); fs.writeFileSync(path.join(NEW, inner), edit(text, rel, pairs));
}
// 만든 해금 표가 바로 읽히고 환승 러시가 레슨 하나로 열리는지(문법 오류 · 쉼표 빠짐을 공개 전에 잡는다)
for (const rel of Object.keys(SHARED_EDITS)) execFileSync(process.execPath, ['--check', path.join(OUT, 'new', rel)], { stdio: 'inherit' });
const files = walk(path.join(OUT, 'new', 'world')).map((f) => path.relative(path.join(OUT, 'new'), f).replace(/\\/g, '/'));
const noWorldQa = files.filter((f) => /\/qa\/|\.test\.mjs$|\.md$|review-items/.test(f));
if (noWorldQa.length) throw Error('실으면 안 되는 파일: ' + noWorldQa.slice(0, 8).join(' '));
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ ref, shared: Object.keys(SHARED_EDITS), items: ['world/subway-rush', 'world/brand-opening/assets/world-play/subway-rush.webp', ...Object.keys(SHARED_EDITS)], files: files.length, bytes: files.reduce((n, f) => n + fs.statSync(path.join(OUT, 'new', f)).size, 0) }, null, 1) + '\n');
console.log(fs.readFileSync(path.join(OUT, '목록.json'), 'utf8'));
