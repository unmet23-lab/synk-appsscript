'use strict';
// 말의 리듬 캠퍼스 판의 synk.im/world 공개 재료(2026-11-04): 바탕(origin/master) 판과 내 판(HEAD)에서 이 일이 바꾼 파일만 꺼낸 두 폴더를 만든다.
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다 — 남의 아직 안 올린 변경(주문 폭주 · 재방문 연습 등)은 두 판에 같이 있어 실리지 않는다.
// 코드는 공개 빌드와 같은 경로 고쳐 쓰기를 두 판에 똑같이 건다. 그림은 내 판에만 있는 새 파일이다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/공개묶음.cjs [바탕=origin/master] [내 판=HEAD] [--게임만 | --홈만]
//   → 공용 작업본 .tmp/rhythm-pub-20261104/{base,new}/world/…, 다음 명령을 찍는다
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
// --판 <글자>: 앞 후보 폴더를 지우지 않고 새 폴더에 만든다(앞 검수 묶음이 그 폴더를 가리킨다)
const 판 = process.argv.includes('--판') ? process.argv[process.argv.indexOf('--판') + 1] : '';
const OUT = path.join(공용작업본(ROOT), '.tmp', `rhythm-pub-20261104${판 ? '-' + 판 : ''}`);
const [BASE = 'origin/master', NEW = 'HEAD'] = process.argv.slice(2).filter((x, i, all) => !x.startsWith('--') && all[i - 1] !== '--판');
// --게임만: 게임 폴더만 먼저(홈 파일의 리듬 줄이 주문 폭주가 아직 안 올린 줄과 맞닿아 3방향이 겹칠 때 — 그 공개 뒤에 --홈만으로 올린다)
const ONLY_GAME = process.argv.includes('--게임만'), ONLY_HOME = process.argv.includes('--홈만');
const GAME = 'experiences/korean-rhythm/', HOME = 'experiences/brand-opening/';
const FILES = [
  ...['app.mjs', 'audio.mjs', 'stage.mjs', 'world-skin.css', 'world-play.mjs', 'world-sfx.mjs', 'world-fx.mjs',
    'assets/world/lobby.webp', 'assets/world/lobby-mic.webp', 'assets/world/stage-tall.webp', 'assets/world/stage-wide.webp', 'assets/world/finale.webp'].map((f) => [GAME + f, 'world/korean-rhythm/' + f]),
  [HOME + 'assets/world-play/rhythm.webp', 'world/brand-opening/assets/world-play/rhythm.webp'],
  [HOME + 'home.mjs', 'world/brand-opening/home.mjs'],
].filter(([, pub]) => (ONLY_GAME ? !pub.endsWith('home.mjs') : ONLY_HOME ? pub.endsWith('home.mjs') : true));
// tools/build-world-app-public.mjs rewrite()와 같은 글(이 파일들에 해당하는 줄만). 두 판에 똑같이 걸어 차이는 내 줄뿐이다.
function rewrite(bytes, pub) {
  let text = bytes.toString('utf8');
  if (text.includes('href="../learning-hub/"')) throw Error('학습 허브 주소 고쳐 쓰기가 필요하다: ' + pub);
  text = text.replaceAll('../synk-world-home/', pub.startsWith('world/brand-opening/') ? '../' : './');
  text = text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  return Buffer.from(text, 'utf8');
}
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
fs.rmSync(OUT, { recursive: true, force: true });
const items = [];
for (const [src, pub] of FILES) {
  const a = show(BASE, src), b = show(NEW, src);
  if (!b) throw Error('내 판에 없다: ' + src);
  if (a && a.equals(b)) continue;   // 공개한 뒤의 고침은 바뀐 파일만 싣는다
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    if (!bytes) continue;
    const file = path.join(OUT, dir, pub);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, /\.(mjs|css)$/.test(src) ? rewrite(bytes, pub) : bytes);
  }
  items.push(pub);
}
const posix = (p) => p.replaceAll('\\', '/');
console.log(`원천 ${execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', NEW]).toString().trim()} · 바탕 ${execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', BASE]).toString().trim()} · ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
