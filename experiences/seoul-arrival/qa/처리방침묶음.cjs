'use strict';
// 서울행의 synk.im/privacy 공개 재료(2026-11-05): 공개본 HTML에 이 일의 줄만 정확히 한 번씩 얹은 두 폴더를 만든다(me2-photo-처리방침묶음.cjs와 같은 길).
//   node experiences/seoul-arrival/qa/처리방침묶음.cjs <개정일 YYYY-MM-DD> [--보기]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 날 = 값[0];
if (!/^\d{4}-\d{2}-\d{2}$/.test(날 || '')) throw Error('개정일 YYYY-MM-DD를 준다');
const OUT = path.join(공용작업본(ROOT), '.tmp', 'seoul-privacy-20261105');
const [y, m, d] = 날.split('-').map(Number);
const 영월 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
execFileSync('git', ['-C', 사본, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore' });
const live = execFileSync('git', ['-C', 사본, '-c', 'core.autocrlf=false', 'show', 'FETCH_HEAD:privacy/index.html'], { maxBuffer: 1 << 28 }).toString('utf8');
if (값.includes('--보기')) {
  const 찾기 = (s) => { const i = live.indexOf(s); console.log(`--- ${s} @${i}\n${i < 0 ? '' : live.slice(Math.max(0, i - 80), i + 500)}\n`); };
  for (const s of ['SYNK account and learning records', 'What we do not', 'What SYNK does not', 'do not guess', 'Only if you choose', 'If you choose']) 찾기(s);
  process.exit(0);
}
// 첫 이야기 줄은 11-05에 공개됐다(공개본 102d816a) — 지금은 그 안의 말만 고친다. 줄을 새로 얹는 판은 이 파일의 git 기록에 있다.
// 11-06 결정 「테이크 2 → 한 번 더」: 화면에서 쓰지 않는 말이 처리방침에 남지 않게.
const 자리 = [
  ['테이크 2 · 새 상황까지 했는지', '「한 번 더」 · 새 상황까지 했는지'],
  ['whether you did take 2 and the new situation', 'whether you did “one more time” and the new situation'],
];
let html = live;
for (const [from, to] of 자리) {
  if (html.split(from).length !== 2) throw Error('공개본에 정확히 한 번 있어야 한다: ' + from.slice(0, 70));
  html = html.replace(from, () => to);
}
// base · new만 새로 쓴다. 후보 폴더는 앞 회차 검수의 배포 증거(검수묶음 다시가 읽는다)라 지우지 않고, 다음 후보는 빈 새 이름으로 준다
// (11-05: OUT을 통째로 지웠다가 다시 검수가 앞 후보.json ENOENT로 멈췄다).
for (const [dir, text] of [['base', live], ['new', html]]) {
  fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  const file = path.join(OUT, dir, 'privacy', 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
let 후보 = path.join(OUT, '후보');
for (let n = 2; fs.existsSync(후보); n++) 후보 = path.join(OUT, '후보' + n);
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), 'privacy/index.html', '--후보폴더', posix(후보)].join(' '));
