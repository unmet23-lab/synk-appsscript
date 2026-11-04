'use strict';
// 말 랠리 캠퍼스 판 공개 후보를 만든다(2026-11-04, 환승 러시 공개후보.cjs를 옮김). 커밋 하나를 git archive로 꺼내 tools/build-world-app-public.mjs로 빌드한 뒤 이 게임 폴더와 놀이 카드만 고른다.
// master에는 아직 공개하지 않은 다른 게임 줄이 함께 있어 공용 파일 넷은 빌드 판을 쓰지 않는다 — 같은 날 게임 여럿이 공용 파일을 번갈아 올려 한 묶음이면 앞판 불일치로 막히므로 둘로 나눈다(현장 노트 배포 · 공개):
//   --게임: 새 파일만(world/talk-rally/ · 놀이 카드 그림). 긴 검수는 여기서 받는다. 앞판이 없어 다른 게임 공개와 안 겹친다.
//   --카드: 공개 직전에 지금 공개본을 받아 말 랠리 줄만 끼운다(base/ = 공개본 판, new/ = 공개본 + 내 줄).
//   node experiences/talk-rally/qa/world-campus-20261104/공개후보.cjs <커밋> --설정 <world-config.json> --게임 [--빌드재사용]
//   node experiences/talk-rally/qa/world-campus-20261104/공개후보.cjs --카드 [--밖 <폴더>]
//   나가는 것: 공용 작업본 .tmp/talk-rally-world-20261104/공개/{new,base}/world/… + 목록.json. 그 뒤: node tools/공개.js 올리기 --원본 <밖>/new --기준폴더 <밖>/base <목록.json의 items…> --후보폴더 <폴더>
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), os = require('node:os');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const GAME = args.includes('--게임'), CARD = args.includes('--카드');
const ref = args[0] && !args[0].startsWith('--') ? args[0] : null;
if (GAME === CARD || (GAME && (!ref || !opt('--설정')))) throw Error('사용법은 파일 머리글');
const SHARED = 공용작업본(ROOT);
const OUT = path.resolve(opt('--밖') || path.join(SHARED, '.tmp', 'talk-rally-world-20261104', '공개'));
const PUBLISH = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const PATHS = ['experiences/brand-opening', 'experiences/synk-world-app', 'experiences/hangul-stage', 'experiences/korean-runner', 'experiences/korean-rhythm', 'experiences/synk-world-home', 'experiences/synk-account', 'experiences/synk-town', 'experiences/play-common', 'experiences/korean-racing', 'experiences/order-rush', 'experiences/blank-slice', 'experiences/snap-words', 'experiences/talk-rally', 'experiences/drama', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'atlas', 'strata', 'tools', 'package.json'];
const CLIP_DIR = 'experiences/talk-rally/assets/world/cast/taeo/clips';   // 움직여 치는 영상(git 밖 — qa/world-clips.json)
const OUTSIDE = ['experiences/synk-town/assets/district', 'experiences/synk-world-home/assets/avatar-textiles-v1', 'experiences/drama/pilot/media', CLIP_DIR];
const OUTSIDE_FILES = ['experiences/korean-racing/assets/coastal-rocks-v6.glb'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
  const r = spawnSync(process.execPath, ['tools/build-world-app-public.mjs', '--config', path.resolve(opt('--설정')), '--out', '.tmp/out'], { cwd: src, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (!r.stdout.includes('{')) throw Error(`빌드 실패: ${(r.stderr || r.stdout).slice(-1500)}`);
  const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  // 이 후보에는 이 게임 폴더만 싣는다. master의 다른 미공개 게임에 걸린 참조는 알리기만 한다.
  const mine = (j.missing || []).filter((m) => /^(?:talk-rally|brand-opening)\//.test(m.from));
  if (mine.length || (j.publicToolNames || []).length || !fs.existsSync(path.join(src, '.tmp/out/world/talk-rally/index.html'))) throw Error(`빌드 ok:false — 빠진 참조 ${JSON.stringify(mine).slice(0, 600)} · 도구 이름 ${JSON.stringify(j.publicToolNames).slice(0, 400)}`);
  if (!j.ok) console.log('다른 게임에 걸린 빌드 알림(이 후보에 안 든다):', JSON.stringify(j.missing).slice(0, 400));
  for (const [file, item] of Object.entries(JSON.parse(fs.readFileSync(path.join(src, 'experiences/talk-rally/qa/world-clips.json'), 'utf8')).clips)) {
    const put = path.join(src, '.tmp/out/world/talk-rally/assets/world/cast/taeo/clips', file);
    if (!fs.existsSync(put) || sha(put) !== item.sha256) throw Error('움직임 영상이 후보에 없거나 다르다: ' + file);
  }
  console.log('빌드', ref, '파일', j.files, '크기', j.totalBytes);
  fs.renameSync(path.join(src, '.tmp/out'), out);
  fs.unlinkSync(path.join(src, 'node_modules'));
  fs.rmSync(src, { recursive: true, force: true });
}

const NEW = path.join(OUT, 'new', 'world'), BASE = path.join(OUT, 'base', 'world');
const report = (items) => {
  const files = walk(path.join(OUT, 'new', 'world')).map((f) => path.relative(path.join(OUT, 'new'), f).replace(/\\/g, '/'));
  const bad = files.filter((f) => /\/qa\/|\.test\.mjs$|\.md$|mongle-|\/assets\/voice\/|\/assets\/narration\//.test(f));
  if (bad.length) throw Error('실으면 안 되는 파일: ' + bad.slice(0, 8).join(' '));
  fs.writeFileSync(path.join(OUT, '목록.json'), `${JSON.stringify({ ref, items, files: files.length, bytes: files.reduce((n, f) => n + fs.statSync(path.join(OUT, 'new', f)).size, 0) }, null, 1)}\n`);
  console.log(fs.readFileSync(path.join(OUT, '목록.json'), 'utf8'));
};

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(path.join(OUT, 'new'), { recursive: true, force: true }); fs.rmSync(path.join(OUT, 'base'), { recursive: true, force: true });
if (GAME) {
  if (!args.includes('--빌드재사용')) build();
  const BUILD = path.join(OUT, 'build', 'world');
  fs.cpSync(path.join(BUILD, 'talk-rally'), path.join(NEW, 'talk-rally'), { recursive: true });
  // 앱 안 몽글 그림은 부르지 않는다(index.html에서 뺐고 stage.mjs WORLD 분기가 안 쓴다) — 빈 기준 폴더로 3방향을 건다
  fs.mkdirSync(path.join(NEW, 'brand-opening/assets/world-play'), { recursive: true }); fs.mkdirSync(BASE, { recursive: true });
  fs.copyFileSync(path.join(BUILD, 'brand-opening/assets/world-play/talk-rally.webp'), path.join(NEW, 'brand-opening/assets/world-play/talk-rally.webp'));
  report(['world/talk-rally', 'world/brand-opening/assets/world-play/talk-rally.webp']);
} else {
  // 공용 파일 넷: 지금 공개본 + 말 랠리 줄. 앵커가 없으면(공개본이 움직여 자리가 없어지면) 멈춘다.
  const env = { ...process.env, GIT_NO_LAZY_FETCH: '0' };
  execFileSync('git', ['-C', PUBLISH, 'fetch', '-q', '--filter=blob:none', 'origin', 'main'], { env });
  const live = (rel) => execFileSync('git', ['-C', PUBLISH, 'show', `origin/main:${rel}`], { maxBuffer: 1 << 28, env }).toString('utf8');
  /** 표 끝에 줄을 더한다. 끝 항목에 쉼표가 없으면 붙인다. */
  const addToTable = (start, close, lines) => (s) => {
    const a = s.indexOf(start); if (a < 0) throw Error(`표가 없다 — ${start}`);
    const b = s.indexOf(close, a); if (b < 0) throw Error(`표 끝이 없다 — ${start}`);
    const head = s.slice(0, b);
    return `${head}${head.endsWith(',') ? '' : ','}\n${lines}${s.slice(b)}`;
  };
  const edit = (text, rel, pairs) => {
    const crlf = text.includes('\r\n'); let s = text.replace(/\r\n/g, '\n');
    for (const pair of pairs) {
      if (typeof pair === 'function') { s = pair(s); continue; }
      const [a, b] = pair;
      if (!s.includes(a)) throw Error(`${rel}: 앵커가 없다 — ${a.slice(0, 70)}`);
      s = s.replace(a, () => b);
    }
    return crlf ? s.replace(/\n/g, '\r\n') : s;
  };
  const ko = (s) => s;
  const EDITS = {
    'world/brand-opening/play-unlocks.mjs': [addToTable('export const PLAY_UNLOCKS = Object.freeze({', '\n});', ko(`  // 말 랠리(11-04, 설계 talk-rally/qa/world-campus-20261104/설계.md): 동아리 탁구 회차가 아직 없어 빈칸 베기와 같이 가장 가까운 공부 기록 — 레슨 한 번(카페 첫 방문을 먼저 한 학생도 막지 않는다). 그 회차가 생기면 그 기록으로 옮긴다.
  rally: Object.freeze({ where: 'play.where.lesson', open: (record) => record.lessons >= 1 || record.cafeVisits >= 1 }),`))],
    'world/brand-opening/home.mjs': [addToTable('const games={', '\n};', ko(` // 말 랠리(11-04, 캠퍼스 판 겉 — 동아리 탁구장): 태오 선배와 주고받는다. 레슨 한 번 뒤 열린다(play-unlocks.mjs). 그림은 라켓과 공 인화지 한 장.
 rally:{get title(){return t('game.rally.title');},get detail(){return t('game.rally.detail');},label:'LISTEN & RALLY',path:'../talk-rally/',image:'world-play/talk-rally.webp',area:'묻는 말 · 이어지는 말을 듣고 알맞은 대답 고르기 연습'}`))],
    'world/brand-opening/world-strings.mjs': [[` 'play.locked':{ko:`, ` 'game.rally.title':{ko:'말 랠리',en:'Talk Rally',mn:'Ярианы ралли'},
 'game.rally.detail':{ko:'태오 선배의 말을 듣고 알맞은 대답으로 받아쳐요',en:'Hear Tae-o and hit back with the right reply',mn:'Тэогийн яриаг сонсоод зөв хариултыг сонгож бөмбөгийг цохино'},
 'play.locked':{ko:`]],
    'world/app-shell.mjs': [[` racing:{get title(){return t('game.racing.title');},path:'korean-racing/'},
`, ` racing:{get title(){return t('game.racing.title');},path:'korean-racing/'},
 // 말 랠리(11-04, 캠퍼스 판 겉 — talk-rally/world-skin.css): 홈 「놀이」가 해금 표로 연 뒤에만 여기로 온다.
 rally:{get title(){return t('game.rally.title');},path:'talk-rally/'},
`]],
  };
  for (const [rel, pairs] of Object.entries(EDITS)) {
    const text = live(rel), inner = rel.replace(/^world\//, '');
    fs.mkdirSync(path.dirname(path.join(BASE, inner)), { recursive: true }); fs.mkdirSync(path.dirname(path.join(NEW, inner)), { recursive: true });
    fs.writeFileSync(path.join(BASE, inner), text); fs.writeFileSync(path.join(NEW, inner), edit(text, rel, pairs));
    execFileSync(process.execPath, ['--check', path.join(OUT, 'new', rel)], { stdio: 'inherit' });   // 쉼표 빠짐 같은 문법 오류를 공개 전에 잡는다
  }
  report(Object.keys(EDITS));
}
