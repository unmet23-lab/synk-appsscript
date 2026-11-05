'use strict';
// 서울행의 synk.im/world 공개 재료(2026-11-05): 바탕 판과 내 판에서 이 일이 바꾼 파일만 꺼낸 두 폴더를 만든다.
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다 — 남의 아직 안 올린 변경은 두 판에 같이 있어 실리지 않는다.
// 코드는 공개 빌드(tools/build-world-app-public.mjs rewrite · publicAsset)와 같은 경로 고쳐 쓰기를 두 판에 똑같이 건다.
// 새 파일(seoul-entry · seoul-watch · seoul-record · seoul-arrival 폴더)을 부르는 쪽만 바뀌므로 import 엇갈림이 없다(옛 판이 새 이름을 부르지 않고, 새 판의 새 이름은 새 파일에 있다).
//   node experiences/seoul-arrival/qa/공개묶음.cjs [바탕] [내 판=HEAD] [--판 <글자>]
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 판자리 = 값.indexOf('--판'), 판 = 판자리 >= 0 ? 값[판자리 + 1] : '';
const 위치 = 값.filter((_, i) => 판자리 < 0 || (i !== 판자리 && i !== 판자리 + 1));
const NEW = 위치[1] || 'HEAD';
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const BASE = 위치[0] || git('merge-base', NEW, 'origin/master').toString().trim();
const OUT = path.join(공용작업본(ROOT), '.tmp', `seoul-pub-20261105${판 ? '-' + 판 : ''}`);
const APP = 'experiences/synk-world-app/', BO = 'experiences/brand-opening/', ARR = 'experiences/seoul-arrival/';
// 빌드의 금지 이름과 같게: qa · 설계 문서는 나가지 않는다(tests/seoul-arrival.test.mjs가 빌드 쪽도 본다).
const 앱폴더 = git('ls-tree', '-r', '--name-only', NEW, ARR).toString().trim().split('\n').map((x) => x.slice(ARR.length))
  .filter((x) => !x.startsWith('qa/') && /\.(mjs|css|html|webp|mp3|jpg|png)$/.test(x));
const FILES = [
  ...['app-shell.mjs', 'app-shell.css', 'life-progress.mjs', 'seoul-entry.mjs', 'seoul-watch.mjs', 'seoul-record.mjs'].map((f) => [APP + f, 'world/' + f]),
  [BO + 'opening.mjs', 'world/brand-opening/opening.mjs'],
  ...앱폴더.map((f) => [ARR + f, 'world/seoul-arrival/' + f]),
];
// 생활 단독 묶음(content/life-standalone.mjs)은 싣지 않는다(11-05): 공개본은 CJS 모듈을 공백 압축한 다른 묶는 설정이라 줄 3방향이 13곳 겹치고,
// 그 묶음을 쓰는 혼자 여는 홈은 arrival()·setArrival()을 부르지 않는다. 옛 묶음도 arrival 칸을 지우지 않는다 — validate()가 읽은 값을
// 그대로 돌려주고 commit이 clone(state)에 칸만 바꾼다. 저장소 묶음에는 들어 있으니 다음 묶음 공개 때 함께 나간다.
function 고쳐쓰기(bytes, pub) {
  const relative = pub.slice('world/'.length);
  if (!/\.(mjs|js|html|css)$/.test(pub)) return bytes;
  let text = bytes.toString('utf8');
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './');
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  text = text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  if (relative === 'brand-opening/content/life-standalone.mjs') text = text.replaceAll('SUNO_RECORDINGS', 'RECORDINGS').replaceAll('suno-tracks.mjs', 'recording-tracks.mjs');
  return Buffer.from(text, 'utf8');
}
const show = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };
// base · new만 새로 쓴다 — 후보 폴더는 검수에 묶인 배포 증거라 지우지 않는다(처리방침묶음.cjs와 같은 까닭, 11-05)
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const items = [];
for (const [src, pub] of FILES) {
  const a = show(BASE, src), b = show(NEW, src);
  if (!b) throw Error('내 판에 없다: ' + src);
  if (a && a.equals(b)) continue;
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    if (!bytes) continue;
    const file = path.join(OUT, dir, pub);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 고쳐쓰기(bytes, pub));
  }
  items.push(pub);
}
const posix = (p) => p.replaceAll('\\', '/');
fs.writeFileSync(path.join(OUT, '항목.txt'), items.join('\n') + '\n');
let 후보 = path.join(OUT, '후보');
for (let n = 2; fs.existsSync(후보); n++) 후보 = path.join(OUT, '후보' + n);
console.log(`원천 ${git('rev-parse', '--short', NEW).toString().trim()} · 바탕 ${git('rev-parse', '--short', BASE).toString().trim()} · 파일 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(후보)].join(' '));
