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
// 첫 이야기 줄은 11-05에 공개됐다(공개본 102d816a), 11-06 「테이크 2 → 한 번 더」 말 맞춤도 공개됐다(5c97a26). 그 판들은 이 파일의 git 기록에 있다.
// 11-06 부스 이름 손글씨(experiences/seoul-arrival/이름손글씨.md 6절): 손으로 쓴 이름 글씨를 학생증에 남긴다 — 획의 점 좌표만이고 시각 · 속도 · 필압은 남기지 않는다.
const 자리 = [
  ['직접 적거나 고른 이름과 나라(칸마다 「나중에 말할래요」를 고르면 그 칸은 받지 않습니다), ',
   '직접 적거나 고른 이름과 나라(칸마다 「나중에 말할래요」를 고르면 그 칸은 받지 않습니다), 손으로 따라 쓴 이름 글씨(획의 점 좌표만 남기고 쓴 시각 · 속도 · 필압은 남기지 않습니다. 「넘어가기」를 고르면 받지 않습니다), '],
  ['the name and country you enter (choose “I’ll tell you later” for either and we don’t collect that one), ',
   'the name and country you enter (choose “I’ll tell you later” for either and we don’t collect that one), the name you trace by hand (only the points of each stroke — not when, how fast or how hard you wrote; choose “Skip” and we don’t collect it), '],
  ['첫 이야기 기록 추가: 2026년 11월 5일', `첫 이야기 기록 추가: 2026년 11월 5일 · 손으로 쓴 이름 글씨 추가: ${y}년 ${m}월 ${d}일`],
  ['First-story records added 5 November 2026.', `First-story records added 5 November 2026. Handwritten name added ${d} ${영월} ${y}.`],
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
