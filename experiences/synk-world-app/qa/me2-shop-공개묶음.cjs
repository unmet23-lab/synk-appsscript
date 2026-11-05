'use strict';
// 「제2의 나」 옷 가게(2026-11-05)의 synk.im/world 공개 재료: 바탕 판과 내 판에서 이 일이 바꾼 파일만 꺼낸 두 폴더를 만든다(me2-photo-공개묶음.cjs와 같은 꼴).
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다 — 남의 아직 안 올린 변경은 두 판에 같이 있어 실리지 않는다.
// 경로 고쳐 쓰기는 공개 빌드(tools/build-world-app-public.mjs rewrite)와 같다: 뿌리 모듈의 ../brand-opening/ → ./brand-opening/, me2-shop.mjs의 끌기 부품 한 줄 → ./play-common/.
//   node experiences/synk-world-app/qa/me2-shop-공개묶음.cjs [바탕] [내 판=HEAD] [--판 <글자>]
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 판자리 = 값.indexOf('--판'), 판 = 판자리 >= 0 ? 값[판자리 + 1] : '';
const 위치 = 값.filter((x, i) => (판자리 < 0 || (i !== 판자리 && i !== 판자리 + 1)));
const NEW = 위치[1] || 'HEAD';
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const BASE = 위치[0] || git('merge-base', NEW, 'origin/master').toString().trim();
const OUT = path.join(공용작업본(ROOT), '.tmp', `me2-shop-pub-20261105${판 ? '-' + 판 : ''}`);
const APP = 'experiences/synk-world-app/';
const 그림 = git('ls-tree', '-r', '--name-only', NEW, `${APP}me2-assets`).toString().trim().split('\n').map((x) => x.slice(APP.length)).filter((x) => /^me2-assets\/shop-/.test(x));
const FILES = [...['me2-photo.mjs', 'me2-photo.css', 'me2-shop.mjs', 'me2-shop.css', 'me2-shop-items.mjs', 'me2-shop-sound.mjs', ...그림].map((f) => [APP + f, 'world/' + f]),
  ['experiences/play-common/drag-rail.js', 'world/play-common/drag-rail.js']];
function 고쳐쓰기(bytes, pub) {
  const relative = pub.slice('world/'.length);
  if (!/\.(mjs|css)$/.test(pub)) return bytes;
  let text = bytes.toString('utf8');
  text = text.replaceAll('../synk-world-home/', './');
  if (relative === 'me2-shop.mjs') {
    const from = "'../play-common/drag-rail.js'";
    if (text.split(from).length !== 2) throw Error('me2-shop.mjs의 끌기 부품 줄이 바뀌었다');
    text = text.replace(from, "'./play-common/drag-rail.js'");
  }
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  text = text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  return Buffer.from(text, 'utf8');
}
const show = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };
fs.rmSync(OUT, { recursive: true, force: true });
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
console.log(`원천 ${git('rev-parse', '--short', NEW).toString().trim()} · 바탕 ${git('rev-parse', '--short', BASE).toString().trim()} · 파일 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(path.join(OUT, '후보'))].join(' '));
