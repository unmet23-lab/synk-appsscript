'use strict';
// 주문 폭주의 synk.im/world 공개 재료(11-05, 말의 리듬 공개묶음.cjs를 옮김): 바탕 판과 내 판에서 이 일이 바꾼 게임 파일만 꺼낸 두 폴더를 만든다.
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹으니 남의 아직 안 올린 변경은 두 판에 같이 있어 실리지 않는다. 받는 쪽 경로 고쳐 쓰기는 공개 빌드(tools/build-world-app-public.mjs)와 같다.
//   node experiences/order-rush/qa/world-campus-20261103/공개묶음.cjs <바탕 커밋> <내 판 커밋> [--판 <글자>]
//   → 공용 작업본 .tmp/order-rush-pub-20261105[-판]/{base,new}/world/order-rush/…, 다음 명령을 찍는다
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2), 판 = args.includes('--판') ? args[args.indexOf('--판') + 1] : '';
const [BASE, NEW] = args.filter((x, i, all) => !x.startsWith('--') && all[i - 1] !== '--판');
if (!BASE || !NEW) throw Error('사용법은 파일 머리글');
const OUT = path.join(공용작업본(ROOT), '.tmp', `order-rush-pub-20261105${판 ? '-' + 판 : ''}`);
const GAME = 'experiences/order-rush/';
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', '-c', 'core.quotepath=false', ...a], { maxBuffer: 1 << 28 });
const 바뀜 = git('diff', '--name-only', '--no-renames', BASE, NEW, '--', GAME).toString('utf8').split('\n').filter(Boolean)
  // 공개 빌드가 싣지 않는 것: qa · 시험 · 문서
  .filter((f) => !/\/qa\/|\.test\.mjs$|\.md$/.test(f));
function rewrite(bytes, pub) {
  let text = bytes.toString('utf8');
  if (text.includes('href="../learning-hub/"')) throw Error('학습 허브 주소 고쳐 쓰기가 필요하다: ' + pub);
  text = text.replaceAll('../synk-world-home/', './');
  text = text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  return Buffer.from(text, 'utf8');
}
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
fs.rmSync(OUT, { recursive: true, force: true });
const items = [];
for (const src of 바뀜) {
  const pub = 'world/order-rush/' + src.slice(GAME.length);
  const a = show(BASE, src), b = show(NEW, src);
  if (!b) throw Error('내 판에 없는 파일은 지우는 일이라 손으로 정한다: ' + src);
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    if (!bytes) continue;
    const file = path.join(OUT, dir, pub);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, /\.(mjs|css|js|html)$/.test(src) ? rewrite(bytes, pub) : bytes);
  }
  items.push(pub);
}
const posix = (p) => p.replaceAll('\\', '/');
console.log(`내 판 ${git('rev-parse', '--short', NEW).toString().trim()} · 바탕 ${git('rev-parse', '--short', BASE).toString().trim()} · ${items.length}개(새 파일 ${items.filter((p) => !fs.existsSync(path.join(OUT, 'base', p))).length})`);
// 두 폴더에 든 것이 바뀐 파일뿐이라 게임 폴더째 주어도 바탕 → 내 판 차이만 얹는다
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), 'world/order-rush', '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
