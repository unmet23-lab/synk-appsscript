'use strict';
// 1화 자막 규칙의 synk.im/world 공개 재료(2026-11-05): 바탕 판과 내 판에서 이 일이 바꾼 시범판 파일 셋만 꺼낸 두 폴더를 만든다.
// tools/공개.js가 「공개본 + (바탕 → 내 판)」 3방향으로 얹는다 — 공개본의 ?v= 토큰 · 남의 공개 변경은 그대로 남는다. 경로 고쳐 쓰기는 공개 빌드(tools/build-world-app-public.mjs rewrite)와 같다.
//   node experiences/drama/qa/자막공개묶음.cjs <바탕> [내 판=HEAD]
const path = require('node:path'), fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const [BASE, NEW = 'HEAD'] = process.argv.slice(2);
if (!BASE) throw Error('바탕 커밋을 준다');
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const OUT = path.join(공용작업본(ROOT), '.tmp', 'drama-cues-pub-20261105');
const PILOT = 'experiences/drama/pilot/';
const FILES = ['pilot.mjs', 'pilot.css', 'world-lesson.json'].map((f) => [PILOT + f, 'world/drama/' + f]);
function 고쳐쓰기(bytes, pub) {
  if (!pub.endsWith('.mjs')) return bytes;
  const text = bytes.toString('utf8').replaceAll('../synk-world-home/', './')
    .replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => `${quote}/world/${folder}`);
  return Buffer.from(text, 'utf8');
}
// base · new만 새로 쓴다 — 후보 폴더는 검수에 묶인 배포 증거라 지우지 않는다
for (const dir of ['base', 'new']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
const items = [];
for (const [src, pub] of FILES) {
  const a = git('show', `${BASE}:${src}`), b = git('show', `${NEW}:${src}`);
  if (a.equals(b)) continue;
  for (const [dir, bytes] of [['base', a], ['new', b]]) {
    const file = path.join(OUT, dir, pub);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 고쳐쓰기(bytes, pub));
  }
  items.push(pub);
}
let 후보 = path.join(OUT, '후보');
for (let n = 2; fs.existsSync(후보); n++) 후보 = path.join(OUT, '후보' + n);
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(후보)].join(' '));
